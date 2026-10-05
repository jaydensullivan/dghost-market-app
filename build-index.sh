#!/usr/bin/env bash
#
# Строит models/index.json — таблицу соответствий
# «AK-47 | Redline» → модель ak47.glb + раскраска cu_ak47_cobra.
#
#   bash build-index.sh
#
# Берёт названия из файлов игры (items_game.txt и csgo_english.txt),
# поэтому вести таблицу руками не нужно: добавил раскраску скриптом
# build-rarity.sh, перезапустил этот — и лот сам находит свои файлы.
#
# В индекс попадает только то, что реально лежит в репозитории.
#
set -uo pipefail

REPO="${REPO:-/workspaces/dghost-market-app}"
WORK="${WORK:-/tmp/cs2-assets}"
GAME="$WORK/game/game/csgo"
TOOLS="$WORK/tools"

log() { echo -e "\n\033[1;35m▸ $*\033[0m"; }

if [ ! -f "$GAME/pak01_dir.vpk" ]; then
    echo "❌ Нет индекса архива. Сначала: bash build-rarity.sh ak47 list"
    exit 1
fi

# ------------------------------------------------------------
# 1. Файл с названиями скинов на английском
# ------------------------------------------------------------

LANG_FILE="$WORK/csgo_english.txt"

if [ ! -s "$LANG_FILE" ]; then

    log "Достаю названия предметов"

    if [ ! -s "$WORK/vpk_dir.txt" ]; then
        "$TOOLS/Source2Viewer-CLI" -i "$GAME/pak01_dir.vpk" --vpk_dir > "$WORK/vpk_dir.txt" 2>/dev/null
    fi

    LANG_PATH=$(grep -oiE '[^ ]*csgo_english\.txt' "$WORK/vpk_dir.txt" | head -1 | tr -d '\r')

    if [ -z "$LANG_PATH" ]; then
        echo "❌ csgo_english.txt не нашёлся в индексе."
        exit 1
    fi

    for attempt in 1 2 3 4 5; do

        "$TOOLS/Source2Viewer-CLI" -i "$GAME/pak01_dir.vpk" -o "$WORK/lang" -d \
            --vpk_filepath "$LANG_PATH" > "$WORK/lang.log" 2>&1

        FOUND=$(grep -rl 'PaintKit' "$WORK/lang" 2>/dev/null | head -1)

        [ -n "$FOUND" ] && break

        MISSING=$(grep -oE 'pak01_[0-9]{3}' "$WORK/lang.log" | grep -oE '[0-9]{3}' | head -1 || true)

        [ -z "$MISSING" ] && break

        echo "   не хватает куска pak01_$MISSING.vpk — качаю"

        printf 'regex:^game/csgo/pak01_%s\\.vpk$\n' "$MISSING" > "$WORK/fl-lang.txt"

        (cd "$TOOLS" && dotnet DepotDownloader.dll -app 730 \
            -username "${STEAM_USER:-landofdinasty}" -no-mobile -remember-password \
            -filelist "$WORK/fl-lang.txt" -dir "$WORK/game") >/dev/null 2>&1
    done

    if [ -z "${FOUND:-}" ]; then
        echo "❌ Не удалось вынуть csgo_english.txt"
        exit 1
    fi

    cp "$FOUND" "$LANG_FILE"
    echo "   готово: $(du -h "$LANG_FILE" | cut -f1)"
fi

ITEMS="$WORK/items_game.txt"

if [ ! -s "$ITEMS" ]; then
    echo "❌ Нет items_game.txt. Запусти сначала: bash build-rarity.sh ak47 list"
    exit 1
fi

# ------------------------------------------------------------
# 2. Собираем таблицу
# ------------------------------------------------------------

log "Собираю таблицу соответствий"

python3 - "$ITEMS" "$LANG_FILE" "$REPO" <<'PY'
import json, os, re, sys

items_path, lang_path, repo = sys.argv[1:4]

items = open(items_path, encoding="utf-8", errors="ignore").read()

# Языковой файл в кодировке UTF-16 — именно так его хранит игра.
raw = open(lang_path, "rb").read()
for enc in ("utf-16", "utf-8"):
    try:
        lang = raw.decode(enc, errors="ignore")
        if "PaintKit" in lang:
            break
    except Exception:
        continue

# 1. Токен -> человеческое название: "PaintKit_cu_ak47_cobra_Tag" -> "Redline"
# Регистр в токенах items_game и языкового файла иногда расходится
# (_Tag / _tag), поэтому ключи храним в нижнем регистре.
# Разбираем построчно: "ключ"  "значение" в начале строки. Прежний
# поиск по всему файлу сбивался на длинных описаниях и кавычках
# внутри текста и подставлял вместо названия чужой токен.
tokens = {
    k.lower(): v
    for k, v in re.findall(r'^[ \t]*"([A-Za-z0-9_]+)"[ \t]+"((?:[^"\\\n]|\\.)*)"', lang, re.M)
}

def human(tag):
    """Название по токену вида #PaintKit_xxx_Tag."""
    return tokens.get((tag or "").lstrip("#").lower())

# 2. Раскраска -> её токен названия.
kit_tag = {}
# [^{}] — не выходим за границы блока: иначе "name" соседней записи
# без description_tag дотягивался до чужого тега и забирал его себе.
for block in re.finditer(r'"name"\s+"([a-zA-Z0-9_]+)"\s*([^{}]{0,400}?)"description_tag"\s+"([^"]+)"', items):
    kit_tag[block.group(1)] = block.group(3)

# 3. Раскраска <-> оружие: записи вида "[cu_ak47_cobra]weapon_ak47".
pairs = re.findall(r'\[([a-zA-Z0-9_]+)\]weapon_([a-z0-9_]+)', items)

# Ножей в items_game CS2 нет — пары для них из открытой базы скинов,
# которую скачивает build-all.sh. Фазы Doppler называются одинаково
# («Karambit | Doppler»), в таблицу попадает первая по имени.
api_path = os.path.join(os.path.dirname(items_path), "skins-api.json")
api_weapon_names = {}
if os.path.isfile(api_path):
    try:
        for skin in json.load(open(api_path, encoding="utf-8")):
            weapon = skin.get("weapon") or {}
            wid = (weapon.get("id") or "").lower()
            kit = ((skin.get("pattern") or {}).get("id") or "").lower()
            if wid and weapon.get("name"):
                api_weapon_names[wid] = weapon["name"]
            if kit and (wid.startswith("weapon_knife") or wid == "weapon_bayonet"):
                pairs.append((kit, wid[len("weapon_"):]))
    except Exception as e:
        print("⚠️ база скинов не прочиталась:", e)

# 4. Человеческие названия оружия: weapon_ak47 -> "AK-47".
weapon_names = {}
for m in re.finditer(r'"name"\s+"(weapon_[a-z0-9_]+)"(.{0,600}?)"item_name"\s+"([^"]+)"', items, re.S):
    name = human(m.group(3))
    if name:
        weapon_names[m.group(1)] = name

# В CS2 у большинства стволов item_name лежит не в самом предмете,
# а в шаблоне "weapon_ak47_prefab" — без этого AK-47 не находился,
# и таблица выходила пустой.
for m in re.finditer(r'"(weapon_[a-z0-9_]+)_prefab"\s*\{(.{0,3000}?)"item_name"\s+"([^"]+)"', items, re.S):
    name = human(m.group(3))
    if name and m.group(1) not in weapon_names:
        weapon_names[m.group(1)] = name

# Названия из базы скинов — главнее: разбор items_game для части
# стволов цеплял чужой item_name (у M4A1-S выходило «Trade Up Contract»).
weapon_names.update(api_weapon_names)

# 5. Что реально есть в репозитории.
models_dir = os.path.join(repo, "models")
have_models = {
    f[:-4] for f in os.listdir(models_dir)
    if f.endswith(".glb")
} if os.path.isdir(models_dir) else set()

skins_dir = os.path.join(models_dir, "skins")
# Однотонные раскраски — без pattern.webp, только params.json с цветами.
have_skins = {
    d for d in os.listdir(skins_dir)
    if os.path.isfile(os.path.join(skins_dir, d, "pattern.webp"))
    or os.path.isfile(os.path.join(skins_dir, d, "params.json"))
} if os.path.isdir(skins_dir) else set()

weapons_dir = os.path.join(models_dir, "weapons")
have_weapon_tex = {
    d for d in os.listdir(weapons_dir)
    if os.path.isfile(os.path.join(weapons_dir, d, "masks.webp"))
} if os.path.isdir(weapons_dir) else set()

# Имя ствола в игре -> имя папки у нас. Совпадает почти всегда,
# кроме пистолетов с длинными именами.
FOLDER = {
    "glock": "glock",
    "hkp2000": "hkp2000",
    "usp_silencer": "usp_silencer",
    "m4a1_silencer": "m4a1_silencer",
}

index = {}
skipped = 0

# Обычные фазы Doppler — раньше Ruby/Sapphire/Black Pearl (у всех
# одно название в Steam).
for kit, weapon in sorted(set(pairs), key=lambda p: ("phase" not in p[0], p)):

    if kit not in have_skins:
        continue

    folder = FOLDER.get(weapon, weapon)

    if folder not in have_models:
        skipped += 1
        continue

    skin_name = human(kit_tag.get(kit))
    weapon_name = weapon_names.get("weapon_" + weapon)

    if not skin_name or not weapon_name:
        skipped += 1
        continue

    # Ключ — ровно то, как лот называется в Steam и у нас в базе.
    key = f"{weapon_name} | {skin_name}"

    if key in index:
        continue

    index[key] = {
        "model": f"models/{folder}.glb",
        "skin": f"models/skins/{kit}",
        "weapon": f"models/weapons/{folder}" if folder in have_weapon_tex else None,
    }

out = os.path.join(models_dir, "index.json")
os.makedirs(models_dir, exist_ok=True)

with open(out, "w", encoding="utf-8") as f:
    json.dump(index, f, ensure_ascii=False, indent=1, sort_keys=True)

print(f"  моделей в репозитории: {len(have_models)}")
print(f"  раскрасок в репозитории: {len(have_skins)}")
print(f"  записей в таблице: {len(index)}")
if skipped:
    print(f"  пропущено (нет модели или названия): {skipped}")
print()
for name in sorted(index)[:10]:
    print("   ", name)
if len(index) > 10:
    print(f"    ... и ещё {len(index) - 10}")
PY

echo
echo "================================================"
ls -lh "$REPO/models/index.json" 2>/dev/null
echo
echo "Закоммитить:"
echo "  cd $REPO && git add models/index.json && git commit -m '3D: таблица соответствий' && git push"
echo "================================================"
