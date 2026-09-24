#!/usr/bin/env bash
#
# Собирает раскраски ОДНОГО ствола ОДНОЙ редкости.
#
#   bash build-rarity.sh glock consumer     # ширпотреб (белые)
#   bash build-rarity.sh glock industrial   # промышленные
#   bash build-rarity.sh ak47 milspec       # армейские (синие)
#   bash build-rarity.sh ak47 restricted    # запрещённые (фиолет)
#   bash build-rarity.sh awp classified     # засекреченные (розовые)
#   bash build-rarity.sh awp covert         # тайные (красные)
#
#   bash build-rarity.sh glock list         # показать, сколько чего есть
#
# Редкость не хранится в архиве текстур — она лежит в описании
# предметов items_game.txt. Скрипт достаёт его один раз, разбирает
# и дальше работает по нему.
#
# Модель ствола собирается автоматически при первом запуске.
# Прогресс коммитится после каждой раскраски: обрыв не страшен.
#
set -uo pipefail

WEAPON="${1:-}"
RARITY="${2:-list}"

if [ -z "$WEAPON" ]; then
    echo "Укажи ствол и редкость: bash build-rarity.sh glock consumer"
    exit 1
fi

REPO="${REPO:-/workspaces/dghost-market-app}"
WORK="${WORK:-/tmp/cs2-assets}"
GAME="$WORK/game/game/csgo"
TOOLS="$WORK/tools"

MIN_FREE_GB="${MIN_FREE_GB:-6}"
LIMIT="${LIMIT:-0}"

log() { echo -e "\n\033[1;35m▸ $*\033[0m"; }

free_gb() { df -BG /tmp | tail -1 | awk '{gsub("G","",$4); print $4}'; }

purge_chunks() {
    local before after
    before=$(free_gb)
    find "$GAME" -name 'pak01_[0-9]*.vpk' -delete 2>/dev/null
    after=$(free_gb)
    echo "   🧹 освободил место: было ${before}G, стало ${after}G"
}

check_disk() {
    if [ "$(free_gb)" -lt "$MIN_FREE_GB" ]; then
        echo "   ⚠️ мало места"
        purge_chunks
    fi
}

commit_if_changed() {
    cd "$REPO"
    if [ -n "$(git status --porcelain)" ]; then
        git add models >/dev/null 2>&1
        git commit -q -m "3D: $1" >/dev/null 2>&1
        git push -q 2>/dev/null && echo "   ✅ отправлено" || echo "   ⚠️ push не прошёл, сделаю позже"
    fi
}

cd "$REPO"

# ============================================================
# 0. ПОДГОТОВКА: ИНСТРУМЕНТЫ И ИНДЕКС АРХИВА
#
# /tmp очищается при перезапуске Codespace, поэтому перед работой
# проверяем, на месте ли распаковщик и индекс. Если нет — запускаем
# extract-ak47.sh, он ставит инструменты и качает индекс (~7 МБ).
# Заодно соберётся модель ствола, которая всё равно нужна.
# ============================================================

if [ ! -x "$TOOLS/Source2Viewer-CLI" ] || [ ! -f "$GAME/pak01_dir.vpk" ]; then

    log "Готовлю инструменты и индекс архива (после перезапуска Codespace)"

    WEAPON="$WEAPON" bash extract-ak47.sh 2>&1 | tail -5

    if [ ! -f "$GAME/pak01_dir.vpk" ]; then
        echo "❌ Индекс архива так и не скачался. Запусти вручную:"
        echo "   WEAPON=$WEAPON bash extract-ak47.sh"
        exit 1
    fi

    # Модель сразу кладём в репозиторий, раз уж она собралась.
    GLB=$(find "$WORK/export" -name '*.glb' 2>/dev/null | head -1)

    if [ -n "$GLB" ] && [ ! -f "$REPO/models/$WEAPON.glb" ]; then
        mkdir -p "$REPO/models"
        cp "$GLB" "$REPO/models/$WEAPON.glb"
        echo "   модель сохранена: $(du -h "$REPO/models/$WEAPON.glb" | cut -f1)"
    fi
fi

# ============================================================
# 1. ОПИСАНИЕ ПРЕДМЕТОВ — ОТТУДА БЕРЁМ РЕДКОСТЬ
# ============================================================

ITEMS="$WORK/items_game.txt"

if [ ! -s "$ITEMS" ]; then

    log "Достаю описание предметов (нужно один раз)"

    if [ ! -s "$WORK/vpk_dir.txt" ]; then
        "$TOOLS/Source2Viewer-CLI" -i "$GAME/pak01_dir.vpk" --vpk_dir > "$WORK/vpk_dir.txt" 2>/dev/null
    fi

    if [ ! -s "$WORK/vpk_dir.txt" ]; then
        echo "❌ Не удалось прочитать индекс архива."
        exit 1
    fi

    ITEM_PATH=$(grep -oiE '[^ ]*items_game\.txt' "$WORK/vpk_dir.txt" | head -1 | tr -d '\r')

    if [ -z "$ITEM_PATH" ]; then
        echo "⚠️ items_game.txt не нашёлся в индексе. Похожие файлы:"
        grep -iE 'items_game|scripts/items' "$WORK/vpk_dir.txt" | sed 's/ crc=.*//' | head -10
        echo "Пришли этот список — подстрою поиск."
        exit 1
    fi

    echo "   путь в архиве: $ITEM_PATH"

    # Файл может лежать в куске архива, которого ещё нет на диске.
    # Ловим номер из ошибки, докачиваем кусок и повторяем.
    for attempt in 1 2 3 4 5; do

        "$TOOLS/Source2Viewer-CLI" -i "$GAME/pak01_dir.vpk" -o "$WORK/items" -d \
            --vpk_filepath "$ITEM_PATH" > "$WORK/items.log" 2>&1

        # Экспортёр может сохранить файл под другим именем или
        # расширением — ищем по содержимому, а не по имени.
        FOUND=$(grep -rl 'paint_kits_rarity' "$WORK/items" 2>/dev/null | head -1)

        if [ -z "$FOUND" ]; then
            FOUND=$(find "$WORK/items" -type f -size +1M 2>/dev/null | head -1)
        fi

        [ -n "$FOUND" ] && break

        MISSING=$(grep -oE 'pak01_[0-9]{3}' "$WORK/items.log" | grep -oE '[0-9]{3}' | head -1 || true)

        if [ -z "$MISSING" ]; then
            echo "❌ Не удалось вынуть items_game.txt."
            echo "Что лежит в $WORK/items:"
            find "$WORK/items" -type f -exec ls -lh {} \; 2>/dev/null | head -10
            echo "Лог:"
            grep -m1 -A5 -iE 'exception|error' "$WORK/items.log" || tail -10 "$WORK/items.log"
            exit 1
        fi

        echo "   не хватает куска pak01_$MISSING.vpk — качаю"

        printf 'regex:^game/csgo/pak01_%s\\.vpk$\n' "$MISSING" > "$WORK/fl-items.txt"

        (cd "$TOOLS" && dotnet DepotDownloader.dll -app 730 \
            -username "${STEAM_USER:-landofdinasty}" -no-mobile -remember-password \
            -filelist "$WORK/fl-items.txt" -dir "$WORK/game") >/dev/null 2>&1

    done

    if [ -z "$FOUND" ]; then
        echo "❌ items_game.txt так и не вынулся за 5 попыток."
        exit 1
    fi

    cp "$FOUND" "$ITEMS"
    echo "   готово: $(du -h "$ITEMS" | cut -f1)"
fi

# ============================================================
# 2. РАЗБОР: КАКАЯ РАСКРАСКА КАКОЙ РЕДКОСТИ
# ============================================================

python3 - "$ITEMS" "$WEAPON" "$RARITY" "$WORK" <<'PY'
import re, sys, os

items, weapon, rarity, work = sys.argv[1:5]

# Как редкости называются внутри игры и как их зовут игроки.
RARITY_MAP = {
    "common":    ("consumer",   "Ширпотреб (белые)"),
    "uncommon":  ("industrial", "Промышленные (голубые)"),
    "rare":      ("milspec",    "Армейские (синие)"),
    "mythical":  ("restricted", "Запрещённые (фиолетовые)"),
    "legendary": ("classified", "Засекреченные (розовые)"),
    "ancient":   ("covert",     "Тайные (красные)"),
    "immortal":  ("contraband", "Контрабанда (жёлтые)"),
}

text = open(items, encoding="utf-8", errors="ignore").read()

# Блок "paint_kits_rarity" — это пары «имя раскраски» «редкость».
block = re.search(r'"paint_kits_rarity"\s*\{(.*?)\n\t\}', text, re.S)

if not block:
    print("RARITY_PARSE_FAILED")
    sys.exit(0)

pairs = re.findall(r'"([a-zA-Z0-9_]+)"\s+"([a-z]+)"', block.group(1))

# Оставляем только раскраски нужного ствола: имя ствола встречается
# в названии раскраски (cu_ak47_cobra, aa_glock_candy_apple).
base = weapon.replace("_silencer", "").replace("knife_", "")

mine = [(name, rar) for name, rar in pairs if base in name.lower()]

by_rarity = {}
for name, rar in mine:
    key = RARITY_MAP.get(rar, (rar, rar))[0]
    by_rarity.setdefault(key, []).append(name)

if rarity == "list":
    print(f"Раскраски для {weapon}:")
    for code, (_, label) in [(v[0], v) for v in RARITY_MAP.values()]:
        pass
    order = ["consumer", "industrial", "milspec", "restricted", "classified", "covert", "contraband"]
    labels = {v[0]: v[1] for v in RARITY_MAP.values()}
    for code in order:
        names = by_rarity.get(code, [])
        if names:
            print(f"  {code:12} {labels[code]:28} — {len(names)} шт.")
    total = sum(len(v) for v in by_rarity.values())
    print(f"  {'ВСЕГО':12} {'':28} — {total} шт.")
    sys.exit(0)

names = by_rarity.get(rarity, [])

with open(os.path.join(work, f"rarity-{weapon}-{rarity}.txt"), "w") as f:
    f.write("\n".join(names))

print(f"NAMES:{len(names)}")
PY

PARSE_STATUS=$?

if [ "$RARITY" = "list" ]; then
    exit 0
fi

LIST="$WORK/rarity-$WEAPON-$RARITY.txt"

if [ ! -s "$LIST" ]; then
    echo "❌ Раскрасок редкости '$RARITY' для $WEAPON не нашлось."
    echo "Посмотри, что есть: bash build-rarity.sh $WEAPON list"
    exit 1
fi

TOTAL=$(wc -l < "$LIST")

# ============================================================
# 3. МОДЕЛЬ СТВОЛА (если ещё нет)
# ============================================================

if [ ! -f "$REPO/models/$WEAPON.glb" ] || [ ! -f "$REPO/models/weapons/$WEAPON/masks.webp" ]; then

    log "Сначала модель и базовые текстуры: $WEAPON"

    if [ ! -f "$REPO/models/$WEAPON.glb" ]; then
        rm -rf "$WORK/export"
        WEAPON="$WEAPON" bash extract-ak47.sh > "$WORK/build-$WEAPON.log" 2>&1
        GLB=$(find "$WORK/export" -name '*.glb' 2>/dev/null | head -1)
        if [ -z "$GLB" ]; then
            echo "❌ модель не собралась, смотри $WORK/build-$WEAPON.log"
            exit 1
        fi
        mkdir -p "$REPO/models"
        cp "$GLB" "$REPO/models/$WEAPON.glb"
        echo "   модель: $(du -h "$REPO/models/$WEAPON.glb" | cut -f1)"
    fi

    rm -rf "$WORK/export-model"
    bash fix-model.sh "$WEAPON" >> "$WORK/build-$WEAPON.log" 2>&1
    bash prep-model.sh "$WEAPON" 2>&1 | grep -E '^\s+(masks|color|rough|ao|surface)' || true

    commit_if_changed "модель и текстуры $WEAPON"
fi

# ============================================================
# 4. РАСКРАСКИ ВЫБРАННОЙ РЕДКОСТИ
# ============================================================

log "$WEAPON · $RARITY · раскрасок: $TOTAL"

START=$(date +%s)
DONE=0; SKIPPED=0; FAILED=0; INDEX=0

while read -r finish; do

    [ -z "$finish" ] && continue

    INDEX=$((INDEX + 1))

    if [ "$LIMIT" -gt 0 ] && [ "$DONE" -ge "$LIMIT" ]; then
        echo "Лимит $LIMIT за запуск достигнут — остальное в следующий раз."
        break
    fi

    if [ -f "$REPO/models/skins/$finish/pattern.webp" ]; then
        SKIPPED=$((SKIPPED + 1))
        continue
    fi

    echo -e "\n[$INDEX/$TOTAL] $finish"

    check_disk

    bash fix-skin.sh "$finish" > "$WORK/build-skin-$finish.log" 2>&1

    if ! find "$WORK/export-skins" -name "$finish.vmat" 2>/dev/null | grep -q .; then
        echo "   ⚠️ не вынулась, лог: $WORK/build-skin-$finish.log"
        FAILED=$((FAILED + 1))
        continue
    fi

    bash prep-skin.sh "$finish" 2>&1 | grep -E '^\s+(pattern|rough|wear|grunge)' || true

    commit_if_changed "раскраска $finish"

    DONE=$((DONE + 1))

done < "$LIST"

MINUTES=$(( ($(date +%s) - START) / 60 ))

log "ГОТОВО: $WEAPON / $RARITY за $MINUTES мин"
echo "   новых: $DONE, пропущено: $SKIPPED, не вышло: $FAILED"
echo "   в репозитории: $(du -sh "$REPO/models" 2>/dev/null | cut -f1)"
echo "   свободно на диске: $(free_gb)G"
