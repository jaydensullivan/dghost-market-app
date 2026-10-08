#!/usr/bin/env bash
#
# Проба наклеек (only = probe-stickers:<ствол,ствол>): параметры слотов
# наклеек из материала ствола (смещение, масштаб, поворот) и диапазон
# карты позиций ствола (pos_pfm) — по ним считаем, куда ставить наклейку.
# Карты позиций (float16, npz) и маски наклеек — в reports/sticker-probe/
# ветки 3d-assets.
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
    [ -z "$f" ] && return 1
    for i in 1 2 3 4 5 6; do
        timeout 300 "$T" -i "$VPK" -o "$OUT" -d --vpk_filepath "$f" > "$OUT/one.log" 2>&1
        miss=$(grep -oE 'pak01_[0-9]{3}\.vpk' "$OUT/one.log" | grep -oE '[0-9]{3}' | head -1 || true)
        [ -z "$miss" ] && return 0
        printf 'regex:^game/csgo/pak01_%s\\.vpk$\n' "$miss" > "$OUT/fl.txt"
        (cd "$WORK/tools" && dotnet DepotDownloader.dll -app 730 -username "$STEAM_USER" \
            -no-mobile -remember-password -filelist "$OUT/fl.txt" -dir "$WORK/game") \
            > "$OUT/dd.log" 2>&1 < /dev/null
    done
    return 1
}

pip install --quiet OpenEXR numpy >/dev/null 2>&1 || true

for W in ${WEAPONS//,/ }; do
    echo "::group::$W — слоты наклеек"
    export DEST="$PWD/reports/sticker-probe/$W"
    mkdir -p "$DEST"
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
from PIL import Image, ImageStat
root, stem = sys.argv[1], sys.argv[2]
for path, dirs, files in os.walk(root):
    for f in files:
        if f.startswith(stem):
            p = os.path.join(path, f)
            print('файл', f, os.path.getsize(p))
            try:
                import OpenEXR, numpy as np
                f = OpenEXR.File(p)
                ch = f.channels()
                print(' каналы', list(ch.keys()))
                for name, c in ch.items():
                    a = np.asarray(c.pixels, dtype=float)
                    a = a.reshape(-1, a.shape[-1]) if a.ndim == 3 else a.reshape(-1, 1)
                    nz = a[np.abs(a).sum(1) > 0]
                    for i in range(a.shape[1]):
                        print('  ', name, i, 'min', round(float(nz[:, i].min()), 4), 'max', round(float(nz[:, i].max()), 4),
                              'mean', round(float(nz[:, i].mean()), 4), 'покрыто', round(len(nz) / len(a), 3))
                dest = os.environ['DEST']
                os.makedirs(dest, exist_ok=True)
                rgb = np.stack([np.asarray(c.pixels, dtype=float) for c in ch.values()], 0)[0]
                np.savez_compressed(os.path.join(dest, 'pos.npz'), pos=rgb[..., :3].astype(np.float16))
                print(' сохранено', rgb.shape)
            except Exception as e:
                print(' EXR не прочитан:', e)
PY
    fi
    mk=$(grep -iE "^weapons/models/$W/materials/stickers/[^ ]*_sticker_mask_hd[^ ]*\.vtex_c" "$D" | sed 's/ crc=.*//' | head -1)
    if [ -n "$mk" ] && extract "$mk"; then
        f=$(find "$OUT" -name "$(basename "${mk%.vtex_c}")*.png" | head -1)
        [ -n "$f" ] && cp "$f" "$DEST/sticker_mask_hd.png"
    fi
    echo "::endgroup::"
done

git add -A reports/sticker-probe
git commit -q -m "3D: проба наклеек — карты позиций и маски" || exit 0
for i in 1 2 3 4 5; do
    git push -q origin HEAD:3d-assets && exit 0
    sleep $((i * 5))
    git pull -q --rebase origin 3d-assets
done
