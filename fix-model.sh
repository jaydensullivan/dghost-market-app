#!/usr/bin/env bash
#
# Достаёт базовые текстуры самого оружия: цвет, маску покраски,
# нормали, шероховатость. Экспортёр .glb на них спотыкается, поэтому
# берём их отдельными файлами — так же, как раскраску в fix-skin.sh.
#
#   bash fix-model.sh ak47
#
set -uo pipefail

WORK="${WORK:-/tmp/cs2-assets}"
TOOLS="$WORK/tools"
GAME="$WORK/game"
OUT="${OUT:-$WORK/export-model}"
VPK="$GAME/game/csgo/pak01_dir.vpk"
STEAM_USER="${STEAM_USER:-landofdinasty}"

WEAPON="${1:-ak47}"

if [ ! -f "$VPK" ]; then
    echo "❌ Нет индекса архива. Сначала: bash extract-ak47.sh"
    exit 1
fi

mkdir -p "$OUT"

download_chunk() {
    echo "    качаю кусок pak01_$1.vpk"
    printf 'regex:^game/csgo/pak01_%s\\.vpk$\n' "$1" > "$WORK/fl-one.txt"
    (cd "$TOOLS" && dotnet DepotDownloader.dll -app 730 \
        -username "$STEAM_USER" -no-mobile -remember-password \
        -filelist "$WORK/fl-one.txt" -dir "$GAME") >/dev/null 2>&1
}

# Вынимает один файл, докачивая недостающие куски по тексту ошибки.
extract_one() {
    local file="$1"
    for attempt in 1 2 3 4 5 6; do
        "$TOOLS/Source2Viewer-CLI" -i "$VPK" -o "$OUT" -d \
            --vpk_filepath "$file" > "$WORK/one.log" 2>&1

        if ! grep -qiE 'exception|error' "$WORK/one.log"; then
            return 0
        fi

        local missing
        missing=$(grep -oE 'pak01_[0-9]{3}' "$WORK/one.log" | grep -oE '[0-9]{3}' | head -1 || true)
        [ -z "$missing" ] && return 1
        download_chunk "$missing"
    done
    return 1
}

echo "==> 1/3 Читаю индекс"
"$TOOLS/Source2Viewer-CLI" -i "$VPK" --vpk_dir > "$WORK/vpk_dir.txt" 2>/dev/null || true

echo "==> 2/3 Ищу материалы $WEAPON"
grep -iE "materials/.*weapons/.*${WEAPON}.*\.vmat_c" "$WORK/vpk_dir.txt" \
    | grep -iv 'paints/' | sed 's/ crc=.*//' | sort -u > "$WORK/mat-list.txt" || true

if [ ! -s "$WORK/mat-list.txt" ]; then
    echo "⚠️ Материалы не нашлись. Вот что есть по '$WEAPON':"
    grep -i "$WEAPON" "$WORK/vpk_dir.txt" | grep -i '\.vmat_c' | sed 's/ crc=.*//' | head -20
    exit 1
fi

echo "Материалов: $(wc -l < "$WORK/mat-list.txt")"
cat "$WORK/mat-list.txt"

echo "==> 3/3 Вынимаю материалы и их текстуры"

while read -r mat; do
    [ -z "$mat" ] && continue
    echo "  → $mat"
    extract_one "$mat" || echo "    (не удалось)"
done < "$WORK/mat-list.txt"

# Из вынутых .vmat берём пути текстур и достаём их тем же способом.
TEXES=$(find "$OUT" -name '*.vmat' -exec cat {} \; 2>/dev/null \
    | grep -oiE '[a-z0-9_/]+\.(vtex|png|tga)' | sed 's/\.[a-z]*$/.vtex_c/' | sort -u)

for tex in $TEXES; do
    echo "  → $tex"
    extract_one "$tex" || echo "    (не удалось)"
done

echo
echo "================================================"
find "$OUT" -name '*.png' -exec ls -lh {} \; | head -30
echo
echo "Материалы:"
find "$OUT" -name '*.vmat' | head -10
echo "================================================"
