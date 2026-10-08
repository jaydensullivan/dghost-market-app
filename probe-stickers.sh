#!/usr/bin/env bash
#
# Проба наклеек (only = probe-stickers:<ствол>): где у модели слоты
# наклеек и как устроены материалы наклеек. Разбирает модель ствола
# в текст (.vmdl) и печатает всё про наклейки, плюс items_game и файлы
# наклеек в архиве. Ничего не коммитит.
#
set -uo pipefail
WORK="${WORK:-/tmp/cs2-assets}"
T="$WORK/tools/Source2Viewer-CLI"
VPK="$WORK/game/game/csgo/pak01_dir.vpk"
W="${WEAPON:-ak47}"
OUT="$WORK/probe-stickers"
export STEAM_USER="${STEAM_USER:-landofdinasty}"
mkdir -p "$OUT"

[ -s "$WORK/vpk_dir.txt" ] || "$T" -i "$VPK" --vpk_dir > "$WORK/vpk_dir.txt" 2>/dev/null
D="$WORK/vpk_dir.txt"

echo "::group::архив: файлы со словом sticker (кроме самих наклеек)"
grep -i "sticker" "$D" | sed 's/ crc=.*//' | grep -viE '^materials/models/weapons/customization/stickers/[^/]+/[^/]+\.(vmat|vtex)_c' | head -120
echo "всего строк со sticker: $(grep -ci sticker "$D")"
echo "::endgroup::"

# Вынимает файл, докачивая недостающие куски (как fix-skin.sh).
extract() {
    local f="$1" i miss
    for i in 1 2 3 4 5 6; do
        "$T" -i "$VPK" -o "$OUT" -d --vpk_filepath "$f" > "$OUT/one.log" 2>&1
        miss=$(grep -oE 'pak01_[0-9]{3}\.vpk' "$OUT/one.log" | grep -oE '[0-9]{3}' | head -1 || true)
        [ -z "$miss" ] && return 0
        printf 'regex:^game/csgo/pak01_%s\\.vpk$\n' "$miss" > "$OUT/fl.txt"
        (cd "$WORK/tools" && dotnet DepotDownloader.dll -app 730 -username "$STEAM_USER" \
            -no-mobile -remember-password -filelist "$OUT/fl.txt" -dir "$WORK/game") \
            > "$OUT/dd.log" 2>&1 < /dev/null
    done
    return 1
}

MDL=$(grep -iE "^weapons/models/$W/weapon_[a-z]+_$W\.vmdl_c" "$D" | sed 's/ crc=.*//' | head -1)
echo "::group::модель $MDL"
extract "$MDL" && echo ok || { echo "не вынулась"; tail -5 "$OUT/one.log"; }
find "$OUT" -name '*.vmdl' | head
echo "::endgroup::"

for f in $(find "$OUT" -name '*.vmdl' | head -3); do
    echo "::group::$f — всё про sticker"
    grep -n -i -B3 -A25 "sticker" "$f" | head -400
    echo "::endgroup::"
done

echo "::group::items_game: наклейки у $W"
IG=$(grep -iE '^scripts/items/items_game\.txt' "$D" | sed 's/ crc=.*//' | head -1)
[ -n "$IG" ] && extract "$IG"
IGF=$(find "$OUT" -name 'items_game.txt' | head -1)
if [ -n "$IGF" ]; then
    grep -n -i "sticker" "$IGF" | grep -viE '"name"|"item_name"|sticker_material' | head -60
    awk -v w="weapon_$W" 'index($0, "\"" w "_prefab\"") {p=1} p {print; n++} n>150 {exit}' "$IGF" | grep -n -i -A8 "sticker" | head -80
fi
echo "::endgroup::"
