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

# Вынимает один файл архива, докачивая недостающие куски.
extract_file() {
    local file="$1" attempt missing
    for attempt in 1 2 3 4 5 6; do
        "$TOOLS/Source2Viewer-CLI" -i "$VPK" -o "$OUT" -d \
            --vpk_filepath "$file" > "$WORK/one.log" 2>&1
        missing=$(grep -oE 'pak01_[0-9]{3}\.vpk' "$WORK/one.log" | grep -oE '[0-9]{3}' | head -1 || true)
        [ -z "$missing" ] && return 0
        download_chunk "$missing"
    done
    return 1
}

# ------------------------------------------------------------
# Новый формат (скины с 2023 года: Printstream, Queen's Gambit…).
# Старого материала vmats/<имя>.vmat_c у них нет. Вместо него:
#   рецепт    weapons/paints/<набор>/<имя>.vcompmat_c
#   текстуры  items/assets/paintkits/<набор>/<имя>_albedo_texture…,
#             _normal_map…, _material_mask…, _roughness…,
#             _ambient_occlusion…, _sfx…
# Альбедо у них уже разложено по развёртке ствола целиком.
# ------------------------------------------------------------
LISTING="$WORK/vpk_dir.txt"
if [ ! -s "$LISTING" ]; then
    "$TOOLS/Source2Viewer-CLI" -i "$VPK" --vpk_dir > "$LISTING" 2>/dev/null || true
fi

vpk_paths() { sed 's/ .*//' "$LISTING" | tr -d '\r'; }

# Старый материал важнее: у старых скинов рецепт тоже есть (в
# weapons/paints/legacy/), но текстуры описаны в vmat. grep -c, а не
# -q: -q закрывает трубу раньше времени, и pipefail считал это ошибкой.
HAS_VMAT=0
[ -s "$LISTING" ] && HAS_VMAT=$(vpk_paths | grep -ci "vmats/${FINISH}\.vmat_c$" || true)

if [ -s "$LISTING" ] && [ "${HAS_VMAT:-0}" -eq 0 ]; then
    COMP=$(vpk_paths | grep -iE "^weapons/paints/.*/${FINISH}\.vcompmat_c$" | head -1)

    if [ -n "$COMP" ]; then
        echo "==> Новый формат: $COMP"
        extract_file "$COMP"

        COMPFILE=$(find "$OUT" -name "${FINISH}.vcompmat" | head -1)
        if [ -z "$COMPFILE" ]; then
            echo "❌ Рецепт не вынулся."
            head -20 "$WORK/one.log"
            exit 1
        fi

        echo
        echo "================ РЕЦЕПТ ================"
        head -80 "$COMPFILE"
        echo "========================================"

        # Свои текстуры скина — по имени…
        TEXLIST=$(vpk_paths | grep -iE "^items/assets/paintkits/.*/${FINISH}_[a-z0-9_]+\.vtex_c$")

        # …и всё, на что ссылается рецепт (у части скинов своих
        # текстур нет — они берут общие).
        for ref in $(grep -oiE '[a-z0-9_/.-]+\.(vtex|tga|psd|png)' "$COMPFILE" \
                     | sed -E 's/\.(vtex|tga|psd|png)$//' | sort -u); do
            stem=$(basename "$ref")
            hit=$(vpk_paths | grep -iE "/${stem}(_(tga|psd|png)_[0-9a-f]+)?\.vtex_c$" | head -1)
            [ -n "$hit" ] && TEXLIST="$TEXLIST"$'\n'"$hit"
        done

        for tex in $(echo "$TEXLIST" | sort -u); do
            [ -z "$tex" ] && continue
            echo "==> Текстура $tex"
            extract_file "$tex"
        done

        echo "✅ Рецепт и текстуры вынуты."
        exit 0
    fi
fi

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
