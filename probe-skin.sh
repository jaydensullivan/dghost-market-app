#!/usr/bin/env bash
#
# Проба раскрасок (only = probe-skin:<kit,kit,...>): вынимает рецепт
# .vcompmat вместе с подключаемыми общими рецептами (m_vecCompMatIncludes)
# и печатает их целиком, а также все вынутые текстуры — размер, режим,
# средние по каналам. По ним разбираем, как игра смешивает слои у
# новых скинов. Ничего не коммитит.
#
set -uo pipefail
WORK="${WORK:-/tmp/cs2-assets}"
TOOLS="$WORK/tools"
VPK="$WORK/game/game/csgo/pak01_dir.vpk"
T="$TOOLS/Source2Viewer-CLI"
export STEAM_USER="${STEAM_USER:-landofdinasty}"

for kit in ${KITS//,/ }; do
    out="$WORK/probe-skins/$kit"
    mkdir -p "$out"
    echo "::group::$kit — экспорт"
    OUT="$out" bash fix-skin.sh "$kit" 2>&1 | tail -30
    echo "::endgroup::"

    comp=$(find "$out" -name "$kit.vcompmat" | head -1)
    if [ -n "$comp" ]; then
        echo "::group::$kit — рецепт"
        cat "$comp" | head -700
        echo "::endgroup::"
        for inc in $(grep -oE '"[^"]+\.vcompmat"' "$comp" | tr -d '"' | sort -u); do
            "$T" -i "$VPK" -o "$out/inc" -d --vpk_filepath "${inc}_c" > /dev/null 2>&1 || true
            f=$(find "$out/inc" -name "$(basename "$inc")" | head -1)
            echo "::group::$kit — include $inc"
            [ -n "$f" ] && head -900 "$f" || echo "не вынулся"
            echo "::endgroup::"
        done
    else
        mat=$(find "$out" -name "$kit.vmat" | head -1)
        echo "::group::$kit — vmat"
        [ -n "$mat" ] && cat "$mat" | head -300 || echo "нет ни vcompmat, ни vmat"
        echo "::endgroup::"
    fi

    echo "::group::$kit — текстуры"
    python3 - "$out" <<'PY'
import os, sys
from PIL import Image, ImageStat
for path, dirs, files in os.walk(sys.argv[1]):
    for f in sorted(files):
        if not f.endswith('.png'):
            continue
        p = os.path.join(path, f)
        try:
            im = Image.open(p)
            st = ImageStat.Stat(im)
            print(f'{os.path.relpath(p, sys.argv[1])}  {im.size}  {im.mode}  mean={[round(m) for m in st.mean]}  ext={st.extrema}')
        except Exception as e:
            print(p, 'ошибка', e)
PY
    echo "::endgroup::"
done
