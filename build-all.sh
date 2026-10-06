#!/usr/bin/env bash
#
# Докачивает 3D-модели и раскраски ВСЕГО оружия CS2 — по одному
# стволу за раз, пропуская то, что уже собрано.
#
#   bash build-all.sh            # собрать всё, чего не хватает
#   bash build-all.sh status     # только показать, что готово, а что нет
#   ONLY="ak47 awp" bash build-all.sh      # только эти стволы
#
# Как работает:
#   1. Из файлов игры (items_game.txt) берётся полный список: какие
#      раскраски бывают у каждого ствола.
#   2. По каждому стволу сверяется с репозиторием:
#        · есть модель, базовые текстуры и ВСЕ раскраски — ствол
#          пропускается целиком;
#        · чего-то не хватает — докачивается только недостающее.
#   3. После каждой раскраски — коммит и push, поэтому обрыв не
#      страшен: следующий запуск продолжит с того же места.
#
# Запускай столько раз, сколько нужно, — пока в конце не будет
# «Всё собрано». Раскраска, которая не вынулась MAX_ATTEMPTS раз
# подряд, больше не пробуется (её видно в отчёте); чтобы попробовать
# снова, удали её из models/build-failures.json.
#
# Ножи и перчатки по умолчанию не собираются: у них свои модели и
# особые раскраски (Doppler, Fade), просмотрщик под них ещё не готов.
# Включить: INCLUDE_KNIVES=1 bash build-all.sh
#
# Запускать в GitHub Codespaces (как и остальные скрипты 3D).
#
set -uo pipefail

MODE="${1:-run}"

REPO="${REPO:-/workspaces/dghost-market-app}"
WORK="${WORK:-/tmp/cs2-assets}"
GAME="$WORK/game/game/csgo"
TOOLS="$WORK/tools"

MIN_FREE_GB="${MIN_FREE_GB:-6}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-3}"
# GitHub Pages публикует сайт до 1 ГБ — останавливаемся заранее.
MAX_MODELS_MB="${MAX_MODELS_MB:-900}"
INCLUDE_KNIVES="${INCLUDE_KNIVES:-0}"
ONLY="${ONLY:-}"

# Порядок: сначала то, что чаще всего продают.
PRIORITY="${PRIORITY:-ak47 awp m4a1_silencer m4a1 deagle usp_silencer glock p250 famas galilar mp9 mac10 ump45 p90 mp7 ssg08 fiveseven tec9 cz75a hkp2000 elite revolver aug sg556 mp5sd bizon nova xm1014 mag7 sawedoff m249 negev g3sg1 scar20}"

FAILURES="$REPO/models/build-failures.json"
PLAN="$WORK/build-plan.tsv"

log() { echo -e "\n\033[1;35m▸ $*\033[0m"; }

free_gb() { df -BG /tmp | tail -1 | awk '{gsub("G","",$4); print $4}'; }

models_mb() { du -sm "$REPO/models" 2>/dev/null | cut -f1; }

purge_chunks() {
    local before after
    # На сервере GitHub архив скачан целиком одним входом — не удаляем.
    [ "${KEEP_CHUNKS:-0}" = "1" ] && return 0
    before=$(free_gb)
    find "$GAME" -name 'pak01_[0-9]*.vpk' -delete 2>/dev/null
    after=$(free_gb)
    echo "   🧹 освободил место: было ${before}G, стало ${after}G"
}

check_disk() {
    if [ "$(free_gb)" -lt "$MIN_FREE_GB" ]; then
        echo "   ⚠️ мало места на диске"
        purge_chunks
    fi
}

commit_if_changed() {
    cd "$REPO"
    if [ -n "$(git status --porcelain models)" ]; then
        git add models >/dev/null 2>&1
        git commit -q -m "3D: $1" >/dev/null 2>&1
        # Параллельно мог пушить кто-то ещё (сайт, Codespace) — тогда
        # подтягиваем чужие коммиты поверх и пробуем ещё раз.
        if git push -q 2>/dev/null || { git pull -q --rebase 2>/dev/null && git push -q 2>/dev/null; }; then
            echo "   ✅ отправлено"
        else
            echo "   ⚠️ push не прошёл, отправится со следующим коммитом"
        fi
    fi
}

# Логин Steam для скачивания кусков архива. Первый вход (пароль и код
# Steam Guard) происходит на шаге подготовки, дальше — по токену.
export STEAM_USER="${STEAM_USER:-${STEAM_USERNAME:-landofdinasty}}"
export STEAM_USERNAME="${STEAM_USERNAME:-$STEAM_USER}"

# Steam не пустил (лимит входов) — признак в логе шага.
steam_refused() {
    grep -qE "STEAM_LOGIN_FAILED|RateLimitExceeded|InitializeSteam failed|Unable to get steam3 credentials" "$1" 2>/dev/null
}
STEAM_DOWN=0

# Счётчик неудач хранится в models/build-failures.json (едет в
# репозиторий вместе с прогрессом), в памяти — в двух массивах.
declare -A FAIL_SKIN=()
declare -A FAIL_WEAPON=()

load_failures() {
    local kind name count
    while read -r kind name count; do
        [ -z "$kind" ] && continue
        if [ "$kind" = "skins" ]; then FAIL_SKIN["$name"]=$count; else FAIL_WEAPON["$name"]=$count; fi
    done < <(python3 - "$FAILURES" <<'PY'
import json, os, sys
path = sys.argv[1]
if os.path.exists(path):
    try:
        data = json.load(open(path, encoding="utf-8"))
    except Exception:
        data = {}
    for kind in ("skins", "weapons"):
        for name, count in (data.get(kind) or {}).items():
            print(kind, name, int(count))
PY
)
}

# bump_failure <skins|weapons> <имя> — +1 к счётчику, печатает новое значение.
bump_failure() {
    python3 - "$FAILURES" "$1" "$2" <<'PY'
import json, os, sys
path, kind, name = sys.argv[1:4]
data = {"skins": {}, "weapons": {}}
if os.path.exists(path):
    try:
        data.update(json.load(open(path, encoding="utf-8")))
    except Exception:
        pass
data.setdefault(kind, {})[name] = data.get(kind, {}).get(name, 0) + 1
os.makedirs(os.path.dirname(path), exist_ok=True)
json.dump(data, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1, sort_keys=True)
print(data[kind][name])
PY
}

# Сборка научилась новому (узор из рецепта у кастомных cu_… —
# Stratosphere и др.) — один раз даём всем раскраскам из списка
# неудач новые попытки. Номер в поле reset: поменял правила — подними.
python3 - "$FAILURES" <<'PY'
import json, os, sys
path, RESET = sys.argv[1], 4
if os.path.exists(path):
    data = json.load(open(path, encoding="utf-8"))
    if data.get("reset") != RESET:
        print(f"Список неудач: сбрасываю {len(data.get('skins') or {})} раскрасок (новые правила сборки)")
        data["skins"], data["reset"] = {}, RESET
        json.dump(data, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1, sort_keys=True)
PY

load_failures

cd "$REPO" || { echo "❌ Нет репозитория $REPO"; exit 1; }

# ============================================================
# 0. ИНСТРУМЕНТЫ, ИНДЕКС АРХИВА И ОПИСАНИЕ ПРЕДМЕТОВ
#
# build-rarity.sh в режиме list ставит инструменты, качает индекс
# архива и достаёт items_game.txt, если их ещё нет (после
# перезапуска Codespace /tmp пустой).
# ============================================================

if [ ! -x "$TOOLS/Source2Viewer-CLI" ] || [ ! -f "$GAME/pak01_dir.vpk" ] || [ ! -s "$WORK/items_game.txt" ]; then
    log "Готовлю инструменты и описание предметов"
    bash build-rarity.sh ak47 list | tail -3
fi

if [ ! -s "$WORK/items_game.txt" ]; then
    echo "❌ Не удалось получить items_game.txt — смотри вывод выше."
    exit 1
fi

# Проверяем вход в Steam и заодно обновляем индекс архива (после
# обновлений CS2 в нём появляются новые скины). Если вход протух,
# загрузчик попросит пароль и код Steam Guard прямо здесь — иначе
# каждая раскраска молча не вынулась бы и была бы записана в неудачи.
if [ "$MODE" != "status" ]; then
    log "Проверяю вход в Steam и свежесть индекса игры"
    printf 'regex:^game/csgo/pak01_dir\\.vpk$\n' > "$WORK/filelist-dir.txt"
    if ! (cd "$TOOLS" && dotnet DepotDownloader.dll -app 730 -username "$STEAM_USER" \
            -no-mobile -remember-password -filelist "$WORK/filelist-dir.txt" -dir "$WORK/game"); then
        echo "❌ Не удалось войти в Steam — запусти ещё раз и введи пароль и код."
        exit 1
    fi
    # Индекс обновился (вышло обновление игры) — перечитываем список
    # файлов архива и описание предметов, чтобы увидеть новые скины.
    if [ "$GAME/pak01_dir.vpk" -nt "$WORK/items_game.txt" ]; then
        echo "   индекс игры обновился — перечитываю описание предметов"
        rm -f "$WORK/vpk_dir.txt" "$WORK/items_game.txt" "$WORK/csgo_english.txt"
        rm -rf "$WORK/items" "$WORK/lang"
        bash build-rarity.sh ak47 list | tail -3
        if [ ! -s "$WORK/items_game.txt" ]; then
            echo "❌ Не удалось перечитать items_game.txt."
            exit 1
        fi
    fi
fi

# В items_game.txt CS2 нет списка «нож — его раскраски» (раньше их
# находили по иконкам econ/default_generated, теперь иконок там нет).
# Берём его из открытой базы скинов (ByMykel/CSGO-API): weapon.id и
# pattern.id — те же внутренние имена, что в игре.
SKINS_API_URL="${SKINS_API_URL:-https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json}"
if [ ! -s "$WORK/skins-api.json" ]; then
    curl -fsSL --max-time 120 "$SKINS_API_URL" -o "$WORK/skins-api.json" 2>/dev/null \
        || echo "   ⚠️ база скинов не скачалась — ножей в плане не будет, названия стволов — из items_game"
fi

# Модель меньше 30 КБ — это физический корпус, а не сама модель
# (раньше экспорт иногда брал не тот .glb): удаляем, чтобы ствол
# пересобрался.
for f in "$REPO"/models/*.glb; do
    [ -f "$f" ] || continue
    if [ "$(stat -c %s "$f")" -lt 30000 ]; then
        echo "   🗑 $(basename "$f") — только физический корпус, пересоберу"
        rm -f "$f"
    fi
done

# ============================================================
# 1. ПЛАН: КАКИЕ РАСКРАСКИ БЫВАЮТ У КАЖДОГО СТВОЛА
# ============================================================

python3 - "$WORK/items_game.txt" "$PLAN" "$INCLUDE_KNIVES" "$PRIORITY" "$ONLY" "$WORK/skins-api.json" <<'PY'
import json, os, re, sys

items_path, plan_path, include_knives, priority, only, api_path = sys.argv[1:7]
text = open(items_path, encoding="utf-8", errors="ignore").read()

# Связки «раскраска — ствол» из списков выпадения: "[cu_ak47_cobra]weapon_ak47".
pairs = set(re.findall(r'\[([a-zA-Z0-9_]+)\]weapon_([a-z0-9_]+)', text))

# Дополнительно — готовые иконки скинов: у части раскрасок (особенно
# у ножей) в списках выпадения записи нет, а иконка есть всегда:
# "econ/default_generated/weapon_ak47_cu_ak47_cobra_light".
known_weapons = sorted({w for _, w in pairs}, key=len, reverse=True)
known_kits = {k for k, _ in pairs}
rarity_block = re.search(r'"paint_kits_rarity"\s*\{(.*?)\n\t\}', text, re.S)
if rarity_block:
    known_kits |= set(re.findall(r'"([a-zA-Z0-9_]+)"\s+"[a-z]+"', rarity_block.group(1)))

for rest in re.findall(r'default_generated/weapon_([a-z0-9_]+?)_(?:light|medium|heavy)"', text, re.I):
    rest = rest.lower()
    for w in known_weapons:
        if rest.startswith(w + "_") and rest[len(w) + 1:] in known_kits:
            pairs.add((rest[len(w) + 1:], w))
            break

# Ножи — из базы скинов (см. выше).
if include_knives == "1" and os.path.isfile(api_path):
    try:
        for skin in json.load(open(api_path, encoding="utf-8")):
            wid = ((skin.get("weapon") or {}).get("id") or "").lower()
            kit = ((skin.get("pattern") or {}).get("id") or "").lower()
            if kit and (wid.startswith("weapon_knife") or wid == "weapon_bayonet"):
                pairs.add((kit, wid[len("weapon_"):]))
    except Exception as e:
        print("⚠️ база скинов не прочиталась:", e)

by_weapon = {}
for kit, weapon in pairs:
    if kit.lower() in ("default", "workshop_default"):
        continue
    by_weapon.setdefault(weapon, set()).add(kit)

def is_knife(w):
    return w.startswith("knife") or w == "bayonet"

only_set = set(only.split())
order = [w for w in priority.split() if w in by_weapon]
rest = sorted((w for w in by_weapon if w not in order), key=lambda w: -len(by_weapon[w]))

with open(plan_path, "w") as f:
    for w in order + rest:
        if only_set and w not in only_set:
            continue
        if is_knife(w) and include_knives != "1":
            continue
        f.write(w + "\t" + " ".join(sorted(by_weapon[w])) + "\n")
PY

if [ ! -s "$PLAN" ]; then
    echo "❌ Не удалось составить список стволов из items_game.txt."
    exit 1
fi

# Раскраска готова, если есть узор. У однотонных (so_, an_ и т. п.)
# узора в игре нет вовсе — им хватает params.json с цветами.
skin_ready() {
    local dir="$REPO/models/skins/$1"
    # Без params.json просмотрщик скин не покажет (сборку прервали на
    # середине) — такую папку собираем заново.
    [ -f "$dir/params.json" ] || return 1
    [ -f "$dir/pattern.webp" ] && return 0
    [ -f "$dir/params.json" ] && grep -q '"colors"' "$dir/params.json" \
        && ! grep -q '"pattern"' "$dir/params.json"
}

# Состояние ствола: сколько раскрасок уже есть, сколько не хватает.
weapon_state() {
    local weapon="$1" kits="$2" have=0 missing="" gave_up=0 kit
    for kit in $kits; do
        if skin_ready "$kit"; then
            have=$((have + 1))
        elif [ "${FAIL_SKIN[$kit]:-0}" -ge "$MAX_ATTEMPTS" ]; then
            gave_up=$((gave_up + 1))
        else
            missing="$missing $kit"
        fi
    done
    local model="нет"
    if [ -f "$REPO/models/$weapon.glb" ] && [ -f "$REPO/models/weapons/$weapon/masks.webp" ]; then
        model="есть"
    fi
    echo "$have|$gave_up|$model|$missing"
}

# ============================================================
# 2. ОТЧЁТ
# ============================================================

print_status() {
    local total_w=0 done_w=0 total_k=0 have_k=0 gave_k=0 weapon kits state have gave model missing n
    # Ширину колонок задаём вручную: printf считает байты, а не буквы.
    echo
    echo "ствол            модель  раскраски   статус"
    while IFS=$'\t' read -r -u 3 weapon kits; do
        n=$(echo "$kits" | wc -w)
        state=$(weapon_state "$weapon" "$kits")
        IFS='|' read -r have gave model missing <<< "$state"
        total_w=$((total_w + 1)); total_k=$((total_k + n))
        have_k=$((have_k + have)); gave_k=$((gave_k + gave))
        local status="готово"
        if [ "$model" != "есть" ] || [ -n "$(echo $missing)" ]; then
            status="не хватает $(echo $missing | wc -w)"
            [ "$model" != "есть" ] && status="$status + модель"
        else
            done_w=$((done_w + 1))
        fi
        [ "$gave" -gt 0 ] && status="$status (не вынулось: $gave)"
        local mark="нет "
        [ "$model" = "есть" ] && mark="есть"
        printf "%-16s %s    %-10s  %s\n" "$weapon" "$mark" "$have/$n" "$status"
    done 3< "$PLAN"
    echo
    echo "Стволов готово: $done_w из $total_w"
    echo "Раскрасок: $have_k из $total_k (не вынулось и пропущено: $gave_k)"
    echo "Размер models/: $(models_mb) МБ из $MAX_MODELS_MB МБ"
}

if [ "$MODE" = "status" ]; then
    print_status
    exit 0
fi

# ============================================================
# 3. СБОРКА: СТВОЛ ЗА СТВОЛОМ
# ============================================================

build_model() {
    local weapon="$1"
    log "$weapon: модель и базовые текстуры"

    if [ ! -f "$REPO/models/$weapon.glb" ]; then
        rm -rf "$WORK/export"
        WEAPON="$weapon" bash extract-ak47.sh > "$WORK/build-$weapon.log" 2>&1
        local glb
        glb=$(find "$WORK/export" -name '*.glb' ! -iname '*phys*' -printf '%s %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)
        if [ -z "$glb" ]; then
            echo "   ❌ модель не собралась, лог: $WORK/build-$weapon.log"
            return 1
        fi
        mkdir -p "$REPO/models"
        cp "$glb" "$REPO/models/$weapon.glb"
        echo "   модель: $(du -h "$REPO/models/$weapon.glb" | cut -f1)"
    fi

    if [ ! -f "$REPO/models/weapons/$weapon/masks.webp" ]; then
        rm -rf "$WORK/export-model"
        bash fix-model.sh "$weapon" >> "$WORK/build-$weapon.log" 2>&1
        bash prep-model.sh "$weapon" 2>&1 | grep -E '^\s+(masks|color|rough|ao|surface)' || true
    fi

    if [ ! -f "$REPO/models/weapons/$weapon/masks.webp" ]; then
        echo "   ❌ базовые текстуры не собрались, лог: $WORK/build-$weapon.log"
        return 1
    fi

    commit_if_changed "модель и текстуры $weapon"
    return 0
}

build_skin() {
    local kit="$1"
    bash fix-skin.sh "$kit" > "$WORK/build-skin-$kit.log" 2>&1

    if ! find "$WORK/export-skins" \( -name "$kit.vmat" -o -name "$kit.vcompmat" \) 2>/dev/null | grep -q .; then
        return 1
    fi

    bash prep-skin.sh "$kit" 2>&1 | grep -E '^\s+(pattern|rough|wear|grunge|normal|ao|material_mask|roughness|sfx)' || true

    skin_ready "$kit"
}

# Раскраски нового формата, собранные до prep_version 3, пересобираем
# только когда новая версия что-то меняет:
#  2 — WebP терял цвет под нулевой альфой (AWP Printstream полосатый),
#      у закалки (gsch_…) не было палитры;
#  3 — зоны покраски (paint by number: MP7 Amberline выходил белым) и
#      металличность краски (SSG 08 Zeno — металлик, а не белая матовая).
# Что нужно, смотрим по рецепту из recipes/. Остальным просто ставим версию.
if [ "$MODE" != "status" ] && [ -d "$REPO/models/skins" ]; then
python3 - "$REPO/models/skins" "$REPO/recipes" <<'PY'
import json, os, re, sys
from PIL import Image
root, recipes = sys.argv[1], sys.argv[2]

def uses(recipe, flag, texture):
    """Рецепт включает флаг и ссылается на свою (не стандартную) текстуру."""
    on = re.search(r'"%s"(?:(?!m_strName).)*?m_bValueBoolean\s*=\s*true' % flag, recipe, re.S)
    tex = re.search(r'"%s"(?:(?!m_strName).)*?m_strTextureContentAssetPath\s*=\s*"([^"]+)"' % texture, recipe, re.S)
    return bool(on and tex and 'materials/default/' not in tex.group(1))

redo = stamped = 0
for finish in sorted(os.listdir(root)):
    pfile = os.path.join(root, finish, 'params.json')
    if not os.path.isfile(pfile):
        continue
    meta = json.load(open(pfile, encoding='utf-8'))
    target = 4 if meta.get('format') == 'template' else 3
    if meta.get('format') not in ('vcompmat', 'template') or meta.get('prep_version', 1) >= target:
        continue
    pattern = os.path.join(root, finish, 'pattern.webp')
    rpath = os.path.join(recipes, meta.get('material', ''))
    recipe = open(rpath, encoding='utf-8', errors='ignore').read() if os.path.isfile(rpath) else ''
    need = (
        (meta.get('prep_version', 1) < 2 and meta.get('format') == 'vcompmat'
         and os.path.isfile(pattern) and 'A' in Image.open(pattern).getbands())
        or uses(recipe, 'g_bUsePaintByNumberMasks', 'g_tPaintByNumberMasks') and meta.get('format') == 'template'
        or uses(recipe, 'g_bUseMetalness', 'g_tPaintMetalness')
        # 4: у шаблона заданы металличность/шероховатость по цветам.
        or meta.get('format') == 'template' and meta.get('prep_version', 1) < 4
           and re.search(r'"g_vPaintMetalness"', recipe) is not None
    )
    if need:
        # Без params.json скин не считается готовым (skin_ready) и соберётся заново.
        os.remove(pfile)
        redo += 1
    else:
        meta['prep_version'] = target
        with open(pfile, 'w', encoding='utf-8') as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)
        stamped += 1
print(f'Раскраски нового формата: пересоберу {redo}, без изменений {stamped}')
PY
fi

START=$(date +%s)
NEW_SKINS=0; NEW_MODELS=0; FAILED_NOW=0; SKIPPED_WEAPONS=0
STOPPED_FOR_SIZE=0

# Список читаем через отдельный дескриптор 3: вложенные скрипты
# (загрузчик Steam) читают обычный ввод и иначе «съели» бы строки.
while IFS=$'\t' read -r -u 3 weapon kits; do

    state=$(weapon_state "$weapon" "$kits")
    IFS='|' read -r have gave model missing <<< "$state"
    total=$(echo "$kits" | wc -w)

    if [ "$model" = "есть" ] && [ -z "$(echo $missing)" ]; then
        if [ "$gave" -gt 0 ]; then
            echo "✔ $weapon — собрано $have/$total, ещё $gave не вынулись (см. build-failures.json), пропускаю"
        else
            echo "✔ $weapon — всё собрано ($have/$total), пропускаю"
        fi
        SKIPPED_WEAPONS=$((SKIPPED_WEAPONS + 1))
        continue
    fi

    if [ "$(models_mb)" -ge "$MAX_MODELS_MB" ]; then
        STOPPED_FOR_SIZE=1
        break
    fi

    log "$weapon: есть $have из $total, докачиваю $(echo $missing | wc -w)"

    if [ "$model" != "есть" ]; then

        if [ "${FAIL_WEAPON[$weapon]:-0}" -ge "$MAX_ATTEMPTS" ]; then
            echo "   модель не собиралась $MAX_ATTEMPTS раз — пропускаю ствол"
            continue
        fi

        check_disk

        if ! build_model "$weapon"; then
            if steam_refused "$WORK/build-$weapon.log"; then
                STEAM_DOWN=1
                break
            fi
            FAIL_WEAPON["$weapon"]=$(bump_failure weapons "$weapon")
            FAILED_NOW=$((FAILED_NOW + 1))
            continue
        fi

        NEW_MODELS=$((NEW_MODELS + 1))
    fi

    i=0
    count=$(echo $missing | wc -w)

    for kit in $missing; do

        i=$((i + 1))

        if [ "$(models_mb)" -ge "$MAX_MODELS_MB" ]; then
            STOPPED_FOR_SIZE=1
            break
        fi

        echo -e "\n[$weapon $i/$count] $kit"

        check_disk

        if build_skin "$kit"; then
            commit_if_changed "раскраска $kit ($weapon)"
            NEW_SKINS=$((NEW_SKINS + 1))
        elif steam_refused "$WORK/build-skin-$kit.log"; then
            # Не вина раскраски — в неудачи не пишем, останавливаемся.
            STEAM_DOWN=1
            break
        else
            n=$(bump_failure skins "$kit")
            FAIL_SKIN["$kit"]=$n
            echo "   ⚠️ не вынулась (попытка $n из $MAX_ATTEMPTS), лог: $WORK/build-skin-$kit.log"
            FAILED_NOW=$((FAILED_NOW + 1))
            commit_if_changed "учёт неудачных раскрасок"
        fi

    done

    # Лоты находят свои файлы через index.json — обновляем после ствола.
    bash build-index.sh > "$WORK/build-index.log" 2>&1 || echo "   ⚠️ индекс не обновился, лог: $WORK/build-index.log"
    commit_if_changed "индекс после $weapon"

    [ "$STOPPED_FOR_SIZE" = "1" ] && break

    [ "$STEAM_DOWN" = "1" ] && break

    # Куски архива от этого ствола следующему почти не нужны.
    purge_chunks

done 3< "$PLAN"

# Индекс — ещё раз в конце: если все стволы уже готовы, цикл выше его не
# трогает, и новые поля (например, models/paint_index.json) не появлялись.
if [ "$STEAM_DOWN" != "1" ]; then
    bash build-index.sh > "$WORK/build-index.log" 2>&1 || echo "   ⚠️ индекс не обновился, лог: $WORK/build-index.log"
    commit_if_changed "индекс"
fi

MINUTES=$(( ($(date +%s) - START) / 60 ))

log "Запуск завершён за $MINUTES мин"
echo "   новых моделей: $NEW_MODELS, новых раскрасок: $NEW_SKINS, не вышло сейчас: $FAILED_NOW"
echo "   стволов уже было готово: $SKIPPED_WEAPONS"

print_status

if [ "$STEAM_DOWN" = "1" ]; then
    echo
    echo "⏸ Steam временно не пускает (лимит входов). Ничего не записано в неудачи —"
    echo "   следующий запуск продолжит с этого места."
    [ -n "${GITHUB_ACTIONS:-}" ] && echo "::warning::Steam временно не пускает (лимит входов) — сборка продолжится в следующий запуск."
    exit 0
fi

if [ "$STOPPED_FOR_SIZE" = "1" ]; then
    echo
    echo "⛔ Папка models/ дошла до $MAX_MODELS_MB МБ — остановился, чтобы сайт не"
    echo "   упёрся в лимит GitHub Pages (1 ГБ). Дальше нужно внешнее хранилище."
    exit 2
fi

LEFT=$(while IFS=$'\t' read -r -u 3 weapon kits; do
    state=$(weapon_state "$weapon" "$kits")
    IFS='|' read -r have gave model missing <<< "$state"
    [ "$model" != "есть" ] && echo x
    for k in $missing; do echo x; done
done 3< "$PLAN" | wc -l)

GAVE_UP=$(while IFS=$'\t' read -r -u 3 weapon kits; do
    for k in $kits; do
        ! skin_ready "$k" && [ "${FAIL_SKIN[$k]:-0}" -ge "$MAX_ATTEMPTS" ] && echo x
    done
done 3< "$PLAN" | wc -l)

if [ "$LEFT" -eq 0 ] && [ "$GAVE_UP" -gt 0 ]; then
    echo
    echo "✅ Собрано всё, что удалось. Не вынулись $MAX_ATTEMPTS раза подряд и пропущены: $GAVE_UP"
    echo "   Список — в models/build-failures.json (пришли его, разберёмся)."
elif [ "$LEFT" -eq 0 ]; then
    echo
    echo "🎉 Всё собрано. Повторный запуск ничего не будет качать."
else
    echo
    echo "Осталось собрать: $LEFT. Запусти ещё раз: bash build-all.sh"
fi
