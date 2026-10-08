#!/usr/bin/env bash
#
# Родные текстуры старого корпуса (body_legacy) — ровно те, что висят на
# его материале в игре. Раньше prep-model.sh брал первый попавшийся
# *_color из папки ствола, и у части стволов это был чужой слой: у Glock —
# песочная подложка (рамка у Moonrise выходила пятнистой), у AUG, SG 553,
# SCAR-20, G3SG1 — текстура линзы прицела (некрашеные детали — чёрные).
#
# Имя материала берём из модели (models/<ствол>.glb, корпус body_legacy),
# его .vmat — из архива игры, текстуры — по TextureColor/Roughness/
# AmbientOcclusion/Normal. Пишем color/rough/ao/surface.webp и ключ
# "legacy_version": 2 в params.json ствола.
#
#   bash prep-legacy.sh glock
#
set -uo pipefail

WORK="${WORK:-/tmp/cs2-assets}"
REPO="${REPO:-$(pwd)}"
TOOLS="$WORK/tools"
VPK="$WORK/game/game/csgo/pak01_dir.vpk"
OUT="$WORK/export-legacy"
STEAM_USER="${STEAM_USER:-landofdinasty}"
WEAPON="$1"
GLB="$REPO/models/$WEAPON.glb"
DEST="$REPO/models/weapons/$WEAPON"

[ -f "$GLB" ] && [ -f "$DEST/params.json" ] || { echo "   нет модели или params.json"; exit 1; }
[ -s "$WORK/vpk_dir.txt" ] || "$TOOLS/Source2Viewer-CLI" -i "$VPK" --vpk_dir > "$WORK/vpk_dir.txt" 2>/dev/null

extract_one() {
    local file="$1" miss
    for attempt in 1 2 3 4 5 6; do
        timeout 300 "$TOOLS/Source2Viewer-CLI" -i "$VPK" -o "$OUT" -d --vpk_filepath "$file" > "$WORK/lg-one.log" 2>&1
        miss=$(grep -oE 'pak01_[0-9]{3}\.vpk' "$WORK/lg-one.log" | grep -oE '[0-9]{3}' | head -1 || true)
        [ -z "$miss" ] && return 0
        printf 'regex:^game/csgo/pak01_%s\\.vpk$\n' "$miss" > "$WORK/lg-fl.txt"
        (cd "$TOOLS" && dotnet DepotDownloader.dll -app 730 -username "$STEAM_USER" \
            -no-mobile -remember-password -filelist "$WORK/lg-fl.txt" -dir "$WORK/game") \
            > "$WORK/lg-dd.log" 2>&1 < /dev/null
    done
    return 1
}

rm -rf "$OUT" "$WORK/lg-dd.log"
mkdir -p "$OUT"

# Не нашли материал — помечаем, что искали, чтобы не искать на каждой сборке
# (текстуры остаются прежними).
give_up() {
    echo "   $1"
    python3 - "$DEST/params.json" <<'PY'
import json, sys
meta = json.load(open(sys.argv[1], encoding='utf-8'))
meta['legacy_version'] = 2
meta['legacy_material'] = None
json.dump(meta, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
PY
    exit 0
}

# Материал старого корпуса — первый у body_legacy (если корпус один — первый вообще).
MAT=$(python3 - "$GLB" <<'PY'
import json, struct, sys
d = open(sys.argv[1], 'rb').read()
n = struct.unpack('<I', d[12:16])[0]
j = json.loads(d[20:20 + n])
mats = [m.get('name', '') for m in j.get('materials', [])]
names = []
for node in j.get('nodes', []):
    if 'mesh' not in node:
        continue
    prims = j['meshes'][node['mesh']]['primitives']
    names.append((node.get('name', ''), [mats[p['material']] for p in prims if 'material' in p]))
legacy = [m for name, ms in names if 'body_legacy' in name for m in ms] or [m for _, ms in names for m in ms]
print(legacy[0] if legacy else '')
PY
)
[ -z "$MAT" ] && give_up "у модели нет материала"
VMAT=$(grep -iE "/$MAT\.vmat_c" "$WORK/vpk_dir.txt" | sed -E 's/ (crc|CRC)[=:].*//' | grep -iE '^(materials/models/weapons|weapons/models)/' | head -1)
[ -z "$VMAT" ] && give_up "нет материала $MAT в архиве"
extract_one "$VMAT" || { echo "   материал $MAT не вынулся"; exit 1; }
VFILE=$(find "$OUT" -iname "$MAT.vmat" | head -1)
[ -z "$VFILE" ] && give_up "материал $MAT не вынулся"
# Скомпилированные текстуры (g_t…): цвет, шероховатость, AO, нормали.
for tex in $(grep -oE '"g_t(Color|Roughness|AmbientOcclusion|Normal)"\s+"[^"]+"' "$VFILE" | sed -E 's/.*"([^"]+)"$/\1/'); do
    extract_one "${tex}_c" || true
done

python3 - "$VFILE" "$OUT" "$DEST" "$MAT" <<'PY'
import json, os, re, sys
from PIL import Image
vfile, out, dest, mat = sys.argv[1:5]
text = open(vfile, encoding='utf-8', errors='ignore').read()
compiled = dict(re.findall(r'"(g_t[A-Za-z]+)"\s+"([^"]+)"', text))
pngs = []
for root, _, files in os.walk(out):
    pngs += [os.path.join(root, f) for f in files if f.lower().endswith('.png')]

def find(param):
    ref = compiled.get(param)
    if not ref:
        return None
    stem = os.path.splitext(os.path.basename(ref))[0].lower()
    hit = [p for p in pngs if os.path.splitext(os.path.basename(p))[0].lower() == stem]
    return hit[0] if hit else None

WANTED = [('color', 'g_tColor', 2048, 'RGB'), ('rough', 'g_tRoughness', 1024, 'L'),
          ('ao', 'g_tAmbientOcclusion', 1024, 'L'), ('surface', 'g_tNormal', 1024, 'RGB')]
meta = json.load(open(os.path.join(dest, 'params.json'), encoding='utf-8'))
textures = meta.setdefault('textures', {})
done = []
for name, param, side, mode in WANTED:
    p = find(param)
    if not p:
        continue
    img = Image.open(p).convert(mode)
    img.thumbnail((side, side), Image.LANCZOS)
    img.save(os.path.join(dest, name + '.webp'), 'WEBP', quality=88, method=6)
    textures[name] = name + '.webp'
    done.append(name)
meta['legacy_material'] = mat
meta['legacy_version'] = 2
with open(os.path.join(dest, 'params.json'), 'w', encoding='utf-8') as fh:
    json.dump(meta, fh, ensure_ascii=False, indent=2)
print('   старый корпус:', mat, '→', ', '.join(done) or 'текстуры не нашлись')
PY
