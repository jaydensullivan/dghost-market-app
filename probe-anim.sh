#!/usr/bin/env bash
#
# Проба: анимации ножа в руках (осмотр, как на F в игре). Печатает, что
# лежит в архиве (модели рук, анимации ножа), и пробует вынуть модель
# ножа с анимациями в .glb — смотрим, какие клипы доходят до glTF.
# Ничего не коммитит. Запуск: сборка 3D с only = probe-anim.
#
set -uo pipefail
WORK="${WORK:-/tmp/cs2-assets}"
TOOLS="$WORK/tools"
GAME="$WORK/game"
VPK="$GAME/game/csgo/pak01_dir.vpk"
OUT="$WORK/export-anim"
KNIFE="${KNIFE:-knife_butterfly}"
STEAM_USER="${STEAM_USER:-landofdinasty}"
T="$TOOLS/Source2Viewer-CLI"

[ -s "$WORK/vpk_dir.txt" ] || "$T" -i "$VPK" --vpk_dir > "$WORK/vpk_dir.txt" 2>/dev/null
D="$WORK/vpk_dir.txt"

echo "::group::Source2Viewer: параметры glTF и анимаций"
"$T" --help 2>&1 | grep -iE 'gltf|anim|export|format' | head -40
echo "::endgroup::"

echo "::group::$KNIFE — модели, анимации, графы"
grep -i "$KNIFE" "$D" | grep -iE '\.(vmdl|vanim|vanmgrph|vagrp|vseq|vmdl_prefab)_c' | sed 's/ crc=.*//' | head -80
echo "::endgroup::"

echo "::group::руки (arms / viewmodel)"
grep -iE '(^|/)(arms|v_models|viewmodel)[^ ]*\.vmdl_c|first_person|fp_arms|_arms\.vmdl' "$D" | sed 's/ crc=.*//' | head -60
echo "::endgroup::"

echo "::group::анимации осмотра (inspect) — общие"
grep -iE 'inspect|lookat' "$D" | grep -iE '\.(vanim|vanmgrph|vseq)_c' | sed 's/ crc=.*//' | head -60
echo "::endgroup::"

download_chunk() {
    printf 'regex:^game/csgo/pak01_%s\\.vpk$\n' "$1" > "$WORK/fl-anim.txt"
    (cd "$TOOLS" && dotnet DepotDownloader.dll -app 730 -username "$STEAM_USER" -no-mobile \
        -remember-password -filelist "$WORK/fl-anim.txt" -dir "$GAME") > "$WORK/dd-anim.log" 2>&1 < /dev/null
}

# Вынуть один файл; при нехватке куска архива — докачать и повторить.
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

echo "::group::weapons/models/shared — всё, кроме текстур"
grep -iE '^weapons/models/shared/' "$D" | grep -viE '\.vtex_c|\.vmat_c' | sed 's/ crc=.*//' | head -80
echo "::endgroup::"
echo "::group::всё про butterfly (любые файлы)"
grep -i 'butterfly' "$D" | grep -viE '\.vtex_c|\.vmat_c|sticker|paints|econ' | sed 's/ crc=.*//' | head -60
echo "::endgroup::"
echo "::group::наборы анимаций (vanmgrph / vagrp / animset)"
grep -iE '\.(vanmgrph|vagrp|vnmgraph|vnmclip|vnmskel)_c|animset|animgraph' "$D" | grep -iE 'weapon|knife|arms|first|v_' | sed 's/ crc=.*//' | head -80
echo "::endgroup::"

# Клипы нового формата (AnimGraph 2, .vnmclip) — что из них даёт экспортёр.
CLIPDIR="animation/anims/viewmodel/knife/$KNIFE"
SHORT="${KNIFE#knife_}"
for f in "$CLIPDIR/lookat01_$SHORT.vnmclip_c" "animation/skeletons/weapons/$KNIFE.vnmskel_c" "animation/graphs/viewmodel/viewmodel_$KNIFE.vnmgraph_c"; do
    echo "::group::выемка $f"
    rm -rf "$WORK/export-clip"; mkdir -p "$WORK/export-clip"
    OUT_SAVE="$OUT"; OUT="$WORK/export-clip"
    export_one "$f" && echo "  -d: ок" || echo "  -d: не вышло"
    export_one "$f" --gltf_export_format glb --gltf_export_animations && echo "  glb: ок" || echo "  glb: не вышло"
    OUT="$OUT_SAVE"
    find "$WORK/export-clip" -type f -exec ls -la {} \;
    for t in $(find "$WORK/export-clip" -type f ! -name '*.glb' | head -3); do echo "--- $t"; head -c 1500 "$t"; echo; done
    tail -3 "$WORK/anim-one.log"
    echo "::endgroup::"
done
echo "::group::Source2Viewer: версия и типы ресурсов"
"$T" --version 2>&1 | head -3
"$T" --help 2>&1 | grep -iE 'skel|clip|nm|anim' | head -10
echo "::endgroup::"

# Модель рук со всеми анимациями — какие клипы в ней есть.
ARMS=weapons/models/shared/arms/weapon_arms.vmdl_c
echo "::group::экспорт рук с анимациями"
rm -rf "$OUT"; mkdir -p "$OUT"
export_one "$ARMS" --gltf_export_format glb --gltf_export_animations && echo "  руки: ок"
find "$OUT" -name '*.glb' -exec ls -la {} \;
echo "::endgroup::"
python3 - "$OUT" <<'PY'
import json, os, struct, sys
for path, dirs, files in os.walk(sys.argv[1]):
    for f in files:
        if not f.endswith('.glb'):
            continue
        b = open(os.path.join(path, f), 'rb').read()
        n = struct.unpack('<I', b[12:16])[0]
        j = json.loads(b[20:20 + n])
        anims = j.get('animations', [])
        print(f'== {f}: {len(b) // 1024} КБ, узлов {len(j.get("nodes", []))}, мешей {len(j.get("meshes", []))}, анимаций {len(anims)}')
        def dur(a):
            return max([(j['accessors'][s['input']].get('max') or [0])[0] for s in a.get('samplers', [])] or [0])
        names = [(a.get('name') or '', dur(a), len(a.get('channels', []))) for a in anims]
        knife = [x for x in names if 'butterfly' in x[0].lower() or 'knife' in x[0].lower()]
        print(f'   клипов с knife/butterfly: {len(knife)}')
        for nm, d, c in knife[:80]:
            print(f'   {nm}: {d:.2f} с, каналов {c}')
        print('   первые 40 клипов:', ', '.join(x[0] for x in names[:40]))
PY

MDL=$(grep -iE "weapons/models/knife/$KNIFE/[^ ]*\.vmdl_c" "$D" | sed 's/ crc=.*//' | grep -viE 'phys|ag_|_ag\.' | head -1)
echo "Модель ножа: $MDL"
if [ -n "$MDL" ]; then
    echo "::group::экспорт glb"
    export_one "$MDL" --gltf_export_format glb --gltf_export_animations && echo "  с --gltf_export_animations: ок" \
        || export_one "$MDL" --gltf_export_format glb && echo "  без флага анимаций: ок"
    find "$OUT" -name '*.glb' -exec ls -la {} \;
    echo "::endgroup::"
fi

# Что внутри glb: узлы, скелет, клипы анимации и их длительность.
python3 - "$OUT" <<'PY'
import json, os, struct, sys
for path, dirs, files in os.walk(sys.argv[1]):
    for f in files:
        if not f.endswith('.glb'):
            continue
        b = open(os.path.join(path, f), 'rb').read()
        n = struct.unpack('<I', b[12:16])[0]
        j = json.loads(b[20:20 + n])
        print(f'== {f}: {len(b) // 1024} КБ, узлов {len(j.get("nodes", []))}, мешей {len(j.get("meshes", []))}, '
              f'скинов {len(j.get("skins", []))}, анимаций {len(j.get("animations", []))}')
        for a in j.get('animations', [])[:60]:
            # длительность — по max у входных аксессоров
            tmax = 0
            for s in a.get('samplers', []):
                acc = j['accessors'][s['input']]
                tmax = max(tmax, (acc.get('max') or [0])[0])
            print(f'   клип {a.get("name")}: каналов {len(a.get("channels", []))}, {tmax:.2f} с')
PY
