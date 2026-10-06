#!/usr/bin/env bash
#
# Фоны 3D «как в CS»: скриншоты карт из интерфейса CS2
# (panorama/images/map_icons/screenshots/1080p/<карта>_png) →
# models/backgrounds/<карта>.webp и models/backgrounds/index.json.
# Мини-апп показывает их кнопками под 3D-моделью.
#
#   bash build-backgrounds.sh
#
# Готовые фоны не пересобираются; удалить index.json — собрать заново.
#
set -uo pipefail

REPO="${REPO:-/workspaces/dghost-market-app}"
WORK="${WORK:-/tmp/cs2-assets}"
TOOLS="$WORK/tools"
GAME="$WORK/game"
VPK="$GAME/game/csgo/pak01_dir.vpk"
OUT="$WORK/export-backgrounds"
DEST="$REPO/models/backgrounds"
STEAM_USER="${STEAM_USER:-landofdinasty}"

# id карты в игре — название на кнопке (пробел в названии — через _).
MAPS="de_dust2:Dust_II de_mirage:Mirage de_inferno:Inferno de_nuke:Nuke de_ancient:Ancient de_anubis:Anubis de_overpass:Overpass de_train:Train de_vertigo:Vertigo cs_office:Office cs_italy:Italy"

if [ -f "$DEST/index.json" ]; then
    echo "Фоны уже есть — пропускаю."
    exit 0
fi
if [ ! -f "$VPK" ]; then
    echo "❌ Нет индекса архива игры."
    exit 1
fi

mkdir -p "$OUT" "$DEST"

download_chunk() {
    printf 'regex:^game/csgo/pak01_%s\\.vpk$\n' "$1" > "$WORK/fl-bg.txt"
    (cd "$TOOLS" && dotnet DepotDownloader.dll -app 730 \
        -username "$STEAM_USER" -no-mobile -remember-password \
        -filelist "$WORK/fl-bg.txt" -dir "$GAME") > "$WORK/dd-bg.log" 2>&1 < /dev/null
    if grep -qE "RateLimitExceeded|InitializeSteam failed|Unable to get steam3 credentials" "$WORK/dd-bg.log"; then
        echo "❌ STEAM_LOGIN_FAILED"
        exit 3
    fi
}

extract_one() {
    local file="$1" missing
    for attempt in 1 2 3 4; do
        "$TOOLS/Source2Viewer-CLI" -i "$VPK" -o "$OUT" -d --vpk_filepath "$file" > "$WORK/bg-one.log" 2>&1
        grep -qiE 'exception|error' "$WORK/bg-one.log" || return 0
        missing=$(grep -oE 'pak01_[0-9]{3}' "$WORK/bg-one.log" | grep -oE '[0-9]{3}' | head -1 || true)
        [ -z "$missing" ] && return 1
        download_chunk "$missing"
    done
    return 1
}

for pair in $MAPS; do
    id="${pair%%:*}"
    echo "  → $id"
    extract_one "panorama/images/map_icons/screenshots/1080p/${id}_png.vtex_c" || echo "    (не удалось)"
done

python3 - "$OUT" "$DEST" "$MAPS" <<'PY'
import json, os, sys
from PIL import Image
out, dest, maps = sys.argv[1:4]
pngs = {}
for path, dirs, files in os.walk(out):
    for f in files:
        if f.endswith('.png'):
            pngs[os.path.splitext(f)[0].lower()] = os.path.join(path, f)
index = []
for pair in maps.split():
    mid, name = pair.split(':', 1)
    name = name.replace('_', ' ')
    src = pngs.get(f'{mid}_png') or pngs.get(mid)
    if not src:
        print(f'  {mid}: нет картинки')
        continue
    img = Image.open(src).convert('RGB')
    if img.width > 1280:
        img = img.resize((1280, round(img.height * 1280 / img.width)), Image.LANCZOS)
    file = mid + '.webp'
    img.save(os.path.join(dest, file), 'WEBP', quality=80, method=6)
    index.append({'id': mid, 'name': name, 'file': file})
    print(f'  {mid}: {img.size[0]}x{img.size[1]}, {os.path.getsize(os.path.join(dest, file)) // 1024} КБ')
if index:
    with open(os.path.join(dest, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=1)
print(f'Фонов: {len(index)}')
PY
