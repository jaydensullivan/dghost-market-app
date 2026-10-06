#!/usr/bin/env bash
#
# Ужимает базовые текстуры оружия и кладёт их в
# models/weapons/<оружие>/ для мини-аппа.
#
#   bash prep-model.sh ak47
#
# Запускать после fix-model.sh.
#
set -uo pipefail

WEAPON="${1:-ak47}"
SRC="${SRC:-/tmp/cs2-assets/export-model}"
REPO="${REPO:-/workspaces/dghost-market-app}"
DEST="$REPO/models/weapons/$WEAPON"

if ! python3 -c 'import PIL' 2>/dev/null; then
    echo "==> Ставлю Pillow"
    pip install --quiet Pillow
fi

mkdir -p "$DEST"

python3 - "$WEAPON" "$SRC" "$DEST" <<'PY'
import json, os, re, sys
from PIL import Image

weapon, src, dest = sys.argv[1:4]

# Что ищем в именах файлов и до какого размера ужимать.
# masks — маска покраски, она маленькая и должна остаться чёткой.
WANTED = [
    ('masks',   ['_masks'],            1024, 'RGB'),
    ('color',   ['_color'],            2048, 'RGB'),
    ('rough',   ['_rough'],            1024, 'L'),
    ('ao',      ['_ao'],               1024, 'L'),
    ('surface', ['_surface', '_normal'], 1024, 'RGB'),
]

# Берём файлы без хвоста-хеша: ak47_color.png лучше, чем
# ak47_color_psd_1f318532.png — это один и тот же слой.
candidates = []
for path, dirs, files in os.walk(src):
    for f in files:
        if f.endswith('.png'):
            candidates.append(os.path.join(path, f))

def pick(keys):
    matches = [c for c in candidates if any(k in os.path.basename(c).lower() for k in keys)]
    if not matches:
        return None
    matches.sort(key=lambda p: (bool(re.search(r'_(psd|tga)_[0-9a-f]{8}', p)), len(p)))
    return matches[0]

result = {'weapon': weapon, 'textures': {}}

for name, keys, max_side, mode in WANTED:
    png = pick(keys)
    if not png:
        print(f'  {name}: не нашёл')
        continue

    img = Image.open(png)
    w, h = img.size
    if max(w, h) > max_side:
        k = max_side / max(w, h)
        img = img.resize((int(w * k), int(h * k)), Image.LANCZOS)
    img = img.convert(mode)

    out = os.path.join(dest, name + '.webp')
    # Маску сохраняем без потерь: от неё зависит, где лежит краска.
    if name == 'masks':
        img.save(out, 'WEBP', lossless=True)
    else:
        img.save(out, 'WEBP', quality=88, method=6)

    print(f'  {name}: {w}x{h} → {img.size[0]}x{img.size[1]}, {os.path.getsize(out)/1024:.0f} КБ')
    result['textures'][name] = name + '.webp'

with open(os.path.join(dest, 'params.json'), 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)
PY

echo
echo "================================================"
ls -lh "$DEST"
echo
echo "Закоммитить:"
echo "  cd $REPO && git add models/weapons && git commit -m '3D: текстуры $WEAPON' && git push"
echo "================================================"
