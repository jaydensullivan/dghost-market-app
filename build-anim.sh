#!/usr/bin/env bash
#
# Анимации ножей в руках (как осмотр на F в игре): для каждого ножа —
# нож со скелетом и клипы (осмотр 1–3, ожидание, доставание) в glb:
# models/anim/<нож>/{knife,<клип>}.glb + index.json. Руки от первого
# лица с текстурами — общие для всех ножей: models/anim/arms/.
#
#   KNIFE=knife_butterfly bash build-anim.sh          # один нож
#   KNIFE="knife_karambit knife_m9_bayonet" bash ...   # несколько
#   KNIFE=all bash build-anim.sh                       # все ножи с 3D
#
# Клипы — формата CS2 AnimGraph 2 (.vnmclip); экспортёр отдаёт их как glb
# со скелетом вьюмодели (руки + кости ножа), без мешей. Кости в glb
# бывают только с --gltf_export_animations (без него — неподвижный меш).
#
set -uo pipefail
REPO="${REPO:-/workspaces/dghost-market-app}"
WORK="${WORK:-/tmp/cs2-assets}"
TOOLS="$WORK/tools"
GAME="$WORK/game"
VPK="$GAME/game/csgo/pak01_dir.vpk"
KNIFE="${KNIFE:-knife_butterfly}"
STEAM_USER="${STEAM_USER:-landofdinasty}"
T="$TOOLS/Source2Viewer-CLI"
ANIM="$REPO/models/anim"

[ -s "$WORK/vpk_dir.txt" ] || "$T" -i "$VPK" --vpk_dir > "$WORK/vpk_dir.txt" 2>/dev/null
D="$WORK/vpk_dir.txt"

download_chunk() {
    printf 'regex:^game/csgo/pak01_%s\\.vpk$\n' "$1" > "$WORK/fl-anim.txt"
    (cd "$TOOLS" && dotnet DepotDownloader.dll -app 730 -username "$STEAM_USER" -no-mobile \
        -remember-password -filelist "$WORK/fl-anim.txt" -dir "$GAME") > "$WORK/dd-anim.log" 2>&1 < /dev/null
}

# export_one <папка вывода> <файл в архиве> [флаги экспортёра…]
export_one() {
    local out="$1" file="$2"; shift 2
    local missing
    for attempt in 1 2 3 4 5; do
        "$T" -i "$VPK" -o "$out" -d --vpk_filepath "$file" "$@" > "$WORK/anim-one.log" 2>&1
        grep -qiE 'exception|error' "$WORK/anim-one.log" || return 0
        missing=$(grep -oE 'pak01_[0-9]{3}' "$WORK/anim-one.log" | grep -oE '[0-9]{3}' | head -1 || true)
        [ -z "$missing" ] && { tail -3 "$WORK/anim-one.log"; return 1; }
        download_chunk "$missing"
    done
    return 1
}

# Папка ножа в файлах игры: у части ножей она зовётся не как в items_game.
knife_dir() {
    case "$1" in
        bayonet)               echo "knife_bayonet" ;;
        knife_m9_bayonet)      echo "knife_m9" ;;
        knife_survival_bowie)  echo "knife_bowie" ;;
        knife_gypsy_jackknife) echo "knife_navaja" ;;
        knife_widowmaker)      echo "knife_talon" ;;
        *)                     echo "$1" ;;
    esac
}

if [ "$KNIFE" = "all" ]; then
    KNIFE=$(ls "$REPO/models" | grep -E '^(knife_[a-z0-9_]+|bayonet)\.glb$' | sed 's/\.glb$//' | tr '\n' ' ')
fi
echo "Ножи: $KNIFE"

# ---------- руки (общие) ----------
mkdir -p "$ANIM/arms"
if [ ! -f "$ANIM/arms/arms.glb" ]; then
    echo "▸ руки"
    rm -rf "$WORK/export-arms" "$WORK/export-arms-tex"
    export_one "$WORK/export-arms" weapons/models/shared/arms/weapon_arms.vmdl_c \
        --gltf_export_format glb --gltf_export_animations || echo "  (руки не вынулись)"
    # Текстуры (кожа, перчатка) — отдельным экспортом с материалами: с ним
    # экспортёр отдаёт руки без костей, поэтому берём оттуда только PNG.
    export_one "$WORK/export-arms-tex" weapons/models/shared/arms/weapon_arms.vmdl_c \
        --gltf_export_format glb --gltf_export_materials --gltf_textures_adapt || echo "  (текстуры рук не вынулись)"
    python3 - "$WORK/export-arms" "$WORK/export-arms-tex" "$ANIM/arms" <<'PY'
import os, shutil, sys
from PIL import Image
src, texdir, dest = sys.argv[1:4]
for path, dirs, files in os.walk(src):
    for f in files:
        if f == 'weapon_arms.glb':
            shutil.copy(os.path.join(path, f), os.path.join(dest, 'arms.glb'))
for path, dirs, files in os.walk(texdir):
    for f in files:
        low = f.lower()
        if not low.endswith('.png') or '_color' not in low:
            continue
        key = 'glove' if 'glove' in low else ('skin' if 'arm' in low else None)
        name = f'arms_{key}.webp' if key else None
        if not name or os.path.exists(os.path.join(dest, name)):
            continue
        img = Image.open(os.path.join(path, f)).convert('RGB')
        img.thumbnail((1024, 1024))
        img.save(os.path.join(dest, name), 'WEBP', quality=85, method=6)
print('  руки:', sorted(os.listdir(dest)))
PY
fi

# ---------- ножи ----------
ALL_CLIP_DIRS=$(grep -oE 'animation/anims/viewmodel/knife/[^/]+/' "$D" | sort -u)
for knife in $KNIFE; do
    dir=$(knife_dir "$knife")
    short="${dir#knife_}"
    # Папка клипов: точное имя, иначе — содержащая короткое имя.
    clipdir=$(echo "$ALL_CLIP_DIRS" | grep -E "/knife/$dir/\$" | head -1)
    [ -z "$clipdir" ] && clipdir=$(echo "$ALL_CLIP_DIRS" | grep -E "/knife/[^/]*$short[^/]*/\$" | head -1)
    mdl=$(grep -oE "weapons/models/knife/$dir/[^ /]+\.vmdl_c" "$D" | grep -viE 'phys|_ag' | head -1)
    echo "▸ $knife: модель ${mdl:-—}, клипы ${clipdir:-—}"
    if [ -z "$mdl" ] || [ -z "$clipdir" ]; then
        echo "  пропускаю: не нашлись модель или клипы"
        continue
    fi
    out="$WORK/export-anim-$knife"
    rm -rf "$out"; mkdir -p "$out"
    export_one "$out" "$mdl" --gltf_export_format glb --gltf_export_animations || { echo "  (нож не вынулся)"; continue; }
    for c in $(grep -oE "${clipdir}(lookat0[1-3]|idle1|draw)[^ /]*\.vnmclip_c" "$D" | grep -v '+' | sort -u); do
        export_one "$out" "$c" --gltf_export_format glb --gltf_export_animations || echo "  (клип $(basename "$c") не вынулся)"
    done
    mkdir -p "$ANIM/$knife"
    python3 - "$out" "$ANIM/$knife" <<'PY'
import json, os, re, shutil, struct, sys
out, dest = sys.argv[1:3]
index = {'arms': '../arms/arms.glb', 'knife': None, 'clips': [],
         'textures': {'skin': '../arms/arms_skin.webp', 'glove': '../arms/arms_glove.webp'}}
for path, dirs, files in os.walk(out):
    for f in files:
        if not f.endswith('.glb') or 'physics' in f:
            continue
        src = os.path.join(path, f)
        b = open(src, 'rb').read()
        n = struct.unpack('<I', b[12:16])[0]
        j = json.loads(b[20:20 + n])
        anims = j.get('animations', [])
        if f.startswith('weapon_'):
            if not j.get('skins'):
                print('  нож без скелета — пропускаю'); continue
            shutil.copy(src, os.path.join(dest, 'knife.glb'))
            index['knife'] = 'knife.glb'
            continue
        m = re.match(r'(lookat0[1-3]|idle1|draw)', f)
        if not m or not anims:
            continue
        cid = m.group(1)
        if any(c['id'] == cid for c in index['clips']):
            continue
        dur = max([(j['accessors'][s['input']].get('max') or [0])[0] for a in anims for s in a.get('samplers', [])] or [0])
        shutil.copy(src, os.path.join(dest, cid + '.glb'))
        index['clips'].append({'id': cid, 'file': cid + '.glb', 'duration': round(dur, 3)})
index['clips'].sort(key=lambda c: c['id'])
ok = index['knife'] and any(c['id'].startswith('lookat') for c in index['clips'])
if ok:
    with open(os.path.join(dest, 'index.json'), 'w', encoding='utf-8') as fh:
        json.dump(index, fh, ensure_ascii=False, indent=1)
    # Свои копии рук от первой версии комплекта больше не нужны — руки общие.
    for old in ('arms.glb', 'arms_skin.webp', 'arms_glove.webp'):
        if os.path.exists(os.path.join(dest, old)):
            os.remove(os.path.join(dest, old))
print('  ' + ('готово' if ok else 'НЕ хватает файлов') + ':', index['knife'], [c['id'] for c in index['clips']])
PY
done
