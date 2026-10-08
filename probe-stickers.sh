#!/usr/bin/env bash
#
# Проба наклеек (only = probe-stickers:<ствол,ствол>): параметры слотов
# наклеек из материала ствола (смещение, масштаб, поворот) и диапазон
# карты позиций ствола (pos_pfm) — по ним считаем, куда ставить наклейку.
# Ничего не коммитит.
#
set -uo pipefail
WORK="${WORK:-/tmp/cs2-assets}"
T="$WORK/tools/Source2Viewer-CLI"
VPK="$WORK/game/game/csgo/pak01_dir.vpk"
OUT="$WORK/probe-stickers"
export STEAM_USER="${STEAM_USER:-landofdinasty}"
mkdir -p "$OUT"
[ -s "$WORK/vpk_dir.txt" ] || "$T" -i "$VPK" --vpk_dir > "$WORK/vpk_dir.txt" 2>/dev/null
D="$WORK/vpk_dir.txt"

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

for W in ${WEAPONS//,/ }; do
    echo "::group::$W — слоты наклеек"
    vm=$(grep -iE "^weapons/models/$W/materials/weapon_[a-z]+_$W\.vmat_c" "$D" | sed 's/ crc=.*//' | head -1)
    [ -z "$vm" ] && vm=$(grep -iE "^weapons/models/$W/materials/[^/]*\.vmat_c" "$D" | sed 's/ crc=.*//' | grep -v composite | head -1)
    echo "материал: $vm"
    extract "$vm" || true
    m=$(find "$OUT" -name "$(basename "${vm%_c}")" | head -1)
    [ -n "$m" ] && grep -E 'Sticker[0-9](Offset|Scale|Rotation)|StickerWepInputs|g_vTexCoord' "$m" | sed 's/^\s*//'
    pos=$(grep -iE "^weapons/models/$W/materials/composite_inputs/[^ ]*_pos_pfm[^ ]*\.vtex_c" "$D" | sed 's/ crc=.*//' | head -1)
    echo "карта позиций: $pos"
    if [ -n "$pos" ]; then
        extract "$pos" || true
        python3 - "$OUT" "$(basename "${pos%.vtex_c}")" <<'PY'
import os, sys
import numpy as np
from PIL import Image
root, stem = sys.argv[1], sys.argv[2]
for path, dirs, files in os.walk(root):
    for f in files:
        if f.startswith(stem):
            p = os.path.join(path, f)
            print('файл', f, os.path.getsize(p))
            try:
                im = Image.open(p); print(' режим', im.mode, im.size)
                a = np.asarray(im).astype(float)
                a = a.reshape(-1, a.shape[-1]) if a.ndim == 3 else a.reshape(-1, 1)
                nz = a[(np.abs(a).sum(1) > 0)]
                for i in range(a.shape[1]):
                    print('  канал', i, 'min', nz[:, i].min().round(3), 'max', nz[:, i].max().round(3), 'mean', nz[:, i].mean().round(3))
            except Exception as e:
                print(' не открыть PIL:', e)
PY
    fi
    echo "::endgroup::"
done
