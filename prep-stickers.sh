#!/usr/bin/env bash
#
# Слоты наклеек ствола: из материала ствола (csgo_weapon.vfx, F_STICKERS)
# берём для каждого слота смещение, масштаб и поворот и дописываем в
# models/weapons/<ствол>/params.json ключ "stickers". Наклейка в игре
# ложится по второй развёртке модели (TEXCOORD_1): её центр — в точке
# uv1 = 0.5 + смещение, ширина — 1/масштаб (сверено со скриншотами
# CSFloat у AK-47, Glock-18 и Desert Eagle).
#
#   bash prep-stickers.sh ak47
#
set -uo pipefail

WORK="${WORK:-/tmp/cs2-assets}"
REPO="${REPO:-$(pwd)}"
TOOLS="$WORK/tools"
VPK="$WORK/game/game/csgo/pak01_dir.vpk"
OUT="$WORK/export-stickers"
STEAM_USER="${STEAM_USER:-landofdinasty}"
WEAPON="$1"

[ -s "$WORK/vpk_dir.txt" ] || "$TOOLS/Source2Viewer-CLI" -i "$VPK" --vpk_dir > "$WORK/vpk_dir.txt" 2>/dev/null

extract_one() {
    local file="$1" miss
    for attempt in 1 2 3 4 5 6; do
        timeout 300 "$TOOLS/Source2Viewer-CLI" -i "$VPK" -o "$OUT" -d --vpk_filepath "$file" > "$WORK/stk-one.log" 2>&1
        miss=$(grep -oE 'pak01_[0-9]{3}\.vpk' "$WORK/stk-one.log" | grep -oE '[0-9]{3}' | head -1 || true)
        [ -z "$miss" ] && return 0
        printf 'regex:^game/csgo/pak01_%s\\.vpk$\n' "$miss" > "$WORK/stk-fl.txt"
        (cd "$TOOLS" && dotnet DepotDownloader.dll -app 730 -username "$STEAM_USER" \
            -no-mobile -remember-password -filelist "$WORK/stk-fl.txt" -dir "$WORK/game") \
            > "$WORK/stk-dd.log" 2>&1 < /dev/null
    done
    return 1
}

# Папки части стволов в файлах игры называются иначе (см. fix-model.sh).
case "$WEAPON" in
    glock)         ALIASES="glock glock18" ;;
    m4a1)          ALIASES="m4a1 m4a4" ;;
    m4a1_silencer) ALIASES="m4a1_silencer m4a1_s" ;;
    usp_silencer)  ALIASES="usp_silencer pist_223 usp" ;;
    cz75a)         ALIASES="cz75a cz_75" ;;
    taser)         ALIASES="taser eq_taser" ;;
    hkp2000)       ALIASES="hkp2000 p2000" ;;
    *)             ALIASES="$WEAPON" ;;
esac

rm -rf "$OUT" "$WORK/stk-dd.log"
mkdir -p "$OUT"
# Материалы ствола — прямо в weapons/models/<папка>/materials/ (без
# composite_inputs, наклеек и прочих вложенных папок).
for a in $ALIASES; do
    grep -iE "^weapons/models/$a/materials/[^/ ]+\.vmat_c" "$WORK/vpk_dir.txt" | sed 's/ crc=.*//'
done | sort -u | while read -r mat; do
    [ -n "$mat" ] && extract_one "$mat"
done

python3 - "$OUT" "$REPO/models/weapons/$WEAPON/params.json" <<'PY'
import json, os, re, sys
out, path = sys.argv[1:3]

def vec(text, name):
    m = re.search(r'"%s"\s+"\[([^\]]*)\]"' % name, text)
    return [float(v) for v in m.group(1).split()] if m else None

def num(text, name):
    m = re.search(r'"%s"\s+"([-0-9.eE]+)"' % name, text)
    return float(m.group(1)) if m else 0.0

best = None
for root, _, files in os.walk(out):
    for f in sorted(files):
        if not f.endswith('.vmat'):
            continue
        text = open(os.path.join(root, f), encoding='utf-8', errors='ignore').read()
        if not re.search(r'"F_STICKERS"\s+"1"', text):
            continue
        slots = []
        for i in range(5):
            off, scale = vec(text, 'g_vSticker%dOffset' % i), vec(text, 'g_vSticker%dScale' % i)
            if not off or not scale or scale[0] <= 0:
                continue
            slots.append({'slot': i, 'off': [round(off[0], 4), round(off[1], 4)],
                          'scale': [round(scale[0], 4), round(scale[1] or scale[0], 4)],
                          'rot': round(num(text, 'g_flSticker%dRotation' % i), 4)})
        # Основной материал (не legacy), а из равных — с бо́льшим числом слотов.
        rank = (len(slots), 'legacy' not in f.lower())
        if slots and (best is None or rank > best[0]):
            best = (rank, f, slots)

if not os.path.isfile(path):
    sys.exit('нет params.json ствола')
meta = json.load(open(path, encoding='utf-8'))
meta['stickers'] = best[2] if best else []
meta['stickers_version'] = 1
with open(path, 'w', encoding='utf-8') as fh:
    json.dump(meta, fh, ensure_ascii=False, indent=2)
print('   наклейки:', len(meta['stickers']), 'слотов' + (' (' + best[1] + ')' if best else ''))
PY
