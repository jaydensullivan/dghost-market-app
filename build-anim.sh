#!/usr/bin/env bash
#
# Анимации ножа в руках (как осмотр на F в игре): руки от первого лица
# с текстурами и клипы ножа (осмотр, ожидание, доставание) — в glb для
# мини-аппа: models/anim/<нож>/{arms,<клип>}.glb + index.json.
#
#   KNIFE=knife_butterfly bash build-anim.sh
#
# Клипы — формата CS2 AnimGraph 2 (.vnmclip); экспортёр отдаёт их как glb
# со скелетом вьюмодели (руки + кости ножа), без мешей.
#
set -uo pipefail
REPO="${REPO:-/workspaces/dghost-market-app}"
WORK="${WORK:-/tmp/cs2-assets}"
TOOLS="$WORK/tools"
GAME="$WORK/game"
VPK="$GAME/game/csgo/pak01_dir.vpk"
KNIFE="${KNIFE:-knife_butterfly}"
SHORT="${KNIFE#knife_}"
OUT="$WORK/export-anim-$KNIFE"
DEST="$REPO/models/anim/$KNIFE"
STEAM_USER="${STEAM_USER:-landofdinasty}"
T="$TOOLS/Source2Viewer-CLI"

[ -s "$WORK/vpk_dir.txt" ] || "$T" -i "$VPK" --vpk_dir > "$WORK/vpk_dir.txt" 2>/dev/null

download_chunk() {
    printf 'regex:^game/csgo/pak01_%s\\.vpk$\n' "$1" > "$WORK/fl-anim.txt"
    (cd "$TOOLS" && dotnet DepotDownloader.dll -app 730 -username "$STEAM_USER" -no-mobile \
        -remember-password -filelist "$WORK/fl-anim.txt" -dir "$GAME") > "$WORK/dd-anim.log" 2>&1 < /dev/null
}

export_one() {
    local file="$1"; shift
    local missing
    for attempt in 1 2 3 4 5; do
        "$T" -i "$VPK" -o "$OUT" -d --vpk_filepath "$file" "$@" > "$WORK/anim-one.log" 2>&1
        grep -qiE 'exception|error' "$WORK/anim-one.log" || return 0
        missing=$(grep -oE 'pak01_[0-9]{3}' "$WORK/anim-one.log" | grep -oE '[0-9]{3}' | head -1 || true)
        [ -z "$missing" ] && { tail -5 "$WORK/anim-one.log"; return 1; }
        download_chunk "$missing"
    done
    return 1
}

rm -rf "$OUT"; mkdir -p "$OUT" "$DEST"

echo "▸ руки"
export_one weapons/models/shared/arms/weapon_arms.vmdl_c \
    --gltf_export_format glb --gltf_export_materials --gltf_textures_adapt || echo "  (руки не вынулись)"

CLIPS=$(grep -oE "animation/anims/viewmodel/knife/$KNIFE/(lookat0[1-3]|idle1|draw)_$SHORT\.vnmclip_c" "$WORK/vpk_dir.txt" | sort -u)
for c in $CLIPS; do
    echo "▸ клип $(basename "$c" .vnmclip_c)"
    export_one "$c" --gltf_export_format glb --gltf_export_animations || echo "  (не вынулся)"
done

python3 - "$OUT" "$DEST" "$SHORT" <<'PY'
import json, os, shutil, struct, sys
out, dest, short = sys.argv[1:4]
index = {'arms': None, 'clips': []}
for path, dirs, files in os.walk(out):
    for f in files:
        if not f.endswith('.glb') or 'physics' in f:
            continue
        src = os.path.join(path, f)
        b = open(src, 'rb').read()
        n = struct.unpack('<I', b[12:16])[0]
        j = json.loads(b[20:20 + n])
        anims = j.get('animations', [])
        def dur(a):
            return max([(j['accessors'][s['input']].get('max') or [0])[0] for s in a.get('samplers', [])] or [0])
        if f == 'weapon_arms.glb':
            name = 'arms.glb'
            index['arms'] = name
        else:
            name = f.replace('_' + short, '')
            index['clips'].append({'id': os.path.splitext(name)[0], 'file': name,
                                   'duration': round(max([dur(a) for a in anims] or [0]), 3)})
        shutil.copy(src, os.path.join(dest, name))
        print(f'  {name}: {len(b) // 1024} КБ, узлов {len(j.get("nodes", []))}, мешей {len(j.get("meshes", []))}, '
              f'анимаций {len(anims)}' + (f', {dur(anims[0]):.2f} с' if anims else ''))
index['clips'].sort(key=lambda c: c['id'])
with open(os.path.join(dest, 'index.json'), 'w', encoding='utf-8') as f:
    json.dump(index, f, ensure_ascii=False, indent=1)
print(json.dumps(index, ensure_ascii=False))
PY
