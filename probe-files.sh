#!/usr/bin/env bash
#
# Проба файлов игры (only = probe-files:<путь;путь;…>): вынимает файлы
# из архива (vmat — текстом, текстуры — уменьшенным PNG до 512 px) в
# reports/probe-files/ ветки 3d-assets. Путь можно дать регуляркой
# (re:<выражение>) — берутся все совпавшие файлы, до 40.
#
set -uo pipefail
WORK="${WORK:-/tmp/cs2-assets}"
T="$WORK/tools/Source2Viewer-CLI"
VPK="$WORK/game/game/csgo/pak01_dir.vpk"
OUT="$WORK/probe-files"
STEAM_USER="${STEAM_USER:-landofdinasty}"
DEST="$PWD/reports/probe-files"
rm -rf "$OUT" "$DEST"
mkdir -p "$OUT" "$DEST"
[ -s "$WORK/vpk_dir.txt" ] || "$T" -i "$VPK" --vpk_dir > "$WORK/vpk_dir.txt" 2>/dev/null

extract() {
    local f="$1" miss
    for i in 1 2 3 4 5 6; do
        timeout 300 "$T" -i "$VPK" -o "$OUT" -d --vpk_filepath "$f" > "$OUT/one.log" 2>&1
        miss=$(grep -oE 'pak01_[0-9]{3}\.vpk' "$OUT/one.log" | grep -oE '[0-9]{3}' | head -1 || true)
        [ -z "$miss" ] && return 0
        printf 'regex:^game/csgo/pak01_%s\\.vpk$\n' "$miss" > "$OUT/fl.txt"
        (cd "$WORK/tools" && dotnet DepotDownloader.dll -app 730 -username "$STEAM_USER" \
            -no-mobile -remember-password -filelist "$OUT/fl.txt" -dir "$WORK/game") > "$OUT/dd.log" 2>&1 < /dev/null
    done
    return 1
}

IFS=';' read -ra ITEMS <<< "$FILES"
for item in "${ITEMS[@]}"; do
    item=$(echo "$item" | xargs)
    [ -z "$item" ] && continue
    if [[ "$item" == re:* ]]; then
        grep -iE "${item#re:}" "$WORK/vpk_dir.txt" | sed -E 's/ (crc|CRC)[=:].*//' | head -40
    else
        echo "$item"
    fi
done | sort -u > "$OUT/list.txt"
echo "файлов: $(wc -l < "$OUT/list.txt")"
while read -r f; do
    [ -z "$f" ] && continue
    echo "→ $f"
    extract "$f" || echo "  не вынулось"
done < "$OUT/list.txt"

python3 - "$OUT" "$DEST" <<'PY'
import os, sys, shutil
from PIL import Image
src, dest = sys.argv[1:3]
for root, _, files in os.walk(src):
    for f in files:
        p = os.path.join(root, f)
        rel = os.path.relpath(p, src).replace(os.sep, '__')
        if f.endswith(('.vmat', '.vcompmat', '.vdata', '.txt')) and not f.endswith(('one.log', 'list.txt')):
            shutil.copy(p, os.path.join(dest, rel))
        elif f.endswith('.png'):
            try:
                im = Image.open(p)
                print(rel, im.size, im.mode)
                im.thumbnail((512, 512))
                im.save(os.path.join(dest, rel), optimize=True)
            except Exception as e:
                print('не открылась', rel, e)
PY
git add -A reports/probe-files
git commit -q -m "3D: проба файлов игры" || exit 0
for i in 1 2 3 4 5; do
    git push -q origin HEAD:3d-assets && exit 0
    sleep $((i * 5))
    git pull -q --rebase origin 3d-assets
done
