#!/usr/bin/env bash
#
# Докачивает недостающие куски архива и вынимает материал раскраски
# вместе с её текстурами. Запускать так:
#
#   bash fix-skin.sh cu_ak47_cobra
#
# Скрипт сам читает ошибку экспорта, видит, какого куска не хватает,
# докачивает его и повторяет — до 8 раз. Ничего копировать руками
# не нужно.
#
set -uo pipefail

WORK="${WORK:-/tmp/cs2-assets}"
TOOLS="$WORK/tools"
GAME="$WORK/game"
OUT="${OUT:-$WORK/export-skins}"
VPK="$GAME/game/csgo/pak01_dir.vpk"

FINISH="${1:-cu_ak47_cobra}"
MAT="materials/models/weapons/customization/paints/vmats/${FINISH}.vmat_c"

if [ ! -f "$VPK" ]; then
    echo "❌ Нет индекса архива. Сначала: bash extract-skin.sh $FINISH"
    exit 1
fi

STEAM_USER="${STEAM_USER:-landofdinasty}"

download_chunk() {
    echo "  Качаю кусок pak01_$1.vpk..."
    printf 'regex:^game/csgo/pak01_%s\\.vpk$\n' "$1" > "$WORK/fl-one.txt"
    (cd "$TOOLS" && dotnet DepotDownloader.dll -app 730 \
        -username "$STEAM_USER" -no-mobile -remember-password \
        -filelist "$WORK/fl-one.txt" -dir "$GAME") >/dev/null 2>&1
}

mkdir -p "$OUT"

for attempt in 1 2 3 4 5 6 7 8; do
    echo "==> Попытка $attempt: вынимаю $FINISH"

    "$TOOLS/Source2Viewer-CLI" -i "$VPK" -o "$OUT" -d \
        --vpk_filepath "$MAT" > "$WORK/mat.log" 2>&1

    # Материал вынулся — выходим.
    if find "$OUT" -name "${FINISH}.vmat" | grep -q .; then
        echo "✅ Материал вынут."
        break
    fi

    MISSING=$(grep -oE 'pak01_[0-9]{3}\.vpk' "$WORK/mat.log" | grep -oE '[0-9]{3}' | head -1 || true)

    if [ -z "$MISSING" ]; then
        echo "❌ Материал не вынулся, и недостающих кусков в логе нет."
        echo "--- начало ошибки ---"
        grep -m1 -A5 -iE 'exception|error' "$WORK/mat.log" || head -20 "$WORK/mat.log"
        exit 1
    fi

    download_chunk "$MISSING"
done

MATFILE=$(find "$OUT" -name "${FINISH}.vmat" | head -1)

if [ -z "$MATFILE" ]; then
    echo "❌ За 8 попыток материал так и не вынулся."
    exit 1
fi

echo
echo "================ МАТЕРИАЛ ================"
cat "$MATFILE"
echo "=========================================="
echo

# Текстуры, на которые он ссылается, — вынимаем тем же способом.
TEXES=$(grep -oiE '[a-z0-9_/]+\.(vtex|png|tga)' "$MATFILE" | sed 's/\.[a-z]*$/.vtex_c/' | sort -u)

for tex in $TEXES; do
    echo "==> Текстура $tex"
    for attempt in 1 2 3 4 5; do
        "$TOOLS/Source2Viewer-CLI" -i "$VPK" -o "$OUT" -d \
            --vpk_filepath "$tex" > "$WORK/tex.log" 2>&1 && break

        MISSING=$(grep -oE 'pak01_[0-9]{3}\.vpk' "$WORK/tex.log" | grep -oE '[0-9]{3}' | head -1 || true)
        [ -z "$MISSING" ] && break
        download_chunk "$MISSING"
    done
done

echo
echo "================ ИТОГ ===================="
find "$OUT" -name '*.png' -newermt '-30 minutes' -exec ls -lh {} \; | head -20
echo "=========================================="
