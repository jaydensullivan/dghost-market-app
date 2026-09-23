#!/usr/bin/env bash
#
# Готовит текстуры раскраски для мини-аппа: ужимает их до разумного
# размера, переводит в WebP и складывает в models/skins/<имя>/,
# плюс вынимает параметры шейдера из материала в params.json.
#
#   bash prep-skin.sh cu_ak47_cobra
#
# Запускать после fix-skin.sh, который вынимает сами PNG.
#
set -uo pipefail

FINISH="${1:-cu_ak47_cobra}"
SRC="${SRC:-/tmp/cs2-assets/export-skins}"
REPO="${REPO:-/workspaces/dghost-market-app}"
DEST="$REPO/models/skins/$FINISH"

if ! python3 -c 'import PIL' 2>/dev/null; then
    echo "==> Ставлю Pillow (нужен для сжатия картинок)"
    pip install --quiet Pillow
fi

mkdir -p "$DEST"

MATFILE=$(find "$SRC" -name "${FINISH}.vmat" | head -1)

if [ -z "$MATFILE" ]; then
    echo "❌ Материал не найден. Сначала: bash fix-skin.sh $FINISH"
    exit 1
fi

python3 - "$FINISH" "$SRC" "$DEST" "$MATFILE" <<'PY'
import json, re, sys, os
from PIL import Image

finish, src, dest, matfile = sys.argv[1:5]
mat = open(matfile, encoding='utf-8', errors='ignore').read()

def find_texture(key):
    """Путь к текстуре из строки вида "TexturePattern"  "materials/.../x.png" """
    m = re.search(r'"%s"\s+"([^"]+)"' % key, mat)
    return m.group(1) if m else None

def find_number(key, default=0.0):
    m = re.search(r'"%s"\s+"([-0-9.]+)"' % key, mat)
    return float(m.group(1)) if m else default

# Какие слои нам нужны и до какого размера их ужимать. Узор — самое
# важное, ему даём больше; грязь и износ — общие маски, они хорошо
# переживают уменьшение.
LAYERS = {
    'pattern':  ('TexturePattern',        2048),
    'rough':    ('TexturePaintRoughness', 1024),
    'wear':     ('TextureWear',           1024),
    'grunge':   ('TextureGrunge',         1024),
}

index = {}
for path, dirs, files in os.walk(src):
    for f in files:
        if f.endswith('.png'):
            index.setdefault(os.path.splitext(f)[0], os.path.join(path, f))

def locate(game_path):
    """По пути из материала находит вынутый PNG (имя может иметь хвост-хеш)."""
    base = os.path.splitext(os.path.basename(game_path))[0]
    if base in index:
        return index[base]
    for name, full in index.items():
        if name.startswith(base):
            return full
    return None

result = {
    'finish': finish,
    'shader': {
        'paint_style':      int(find_number('F_PAINT_STYLE', 0)),
        'pattern_scale':    find_number('g_flPatternTexCoordScale', 1),
        'pattern_rotation': find_number('g_flPatternTexCoordRotation', 0),
        'wear_scale':       find_number('g_flWearTexCoordScale', 1),
        'grunge_scale':     find_number('g_flGrungeTexCoordScale', 1),
        'paint_metalness':  find_number('g_flPaintMetalness', 0),
        'color_brightness': find_number('g_flColorBrightness', 1),
    },
    'textures': {},
}

for layer, (key, max_side) in LAYERS.items():
    game_path = find_texture(key)
    if not game_path:
        print(f'  {layer}: в материале нет {key}')
        continue
    png = locate(game_path)
    if not png:
        print(f'  {layer}: не нашёл вынутый файл для {game_path}')
        continue

    img = Image.open(png)
    w, h = img.size
    if max(w, h) > max_side:
        k = max_side / max(w, h)
        img = img.resize((int(w * k), int(h * k)), Image.LANCZOS)

    # Маски — в оттенках серого, это ещё экономит вес.
    if layer in ('rough', 'wear', 'grunge'):
        img = img.convert('L')
    else:
        img = img.convert('RGBA' if 'A' in img.getbands() else 'RGB')

    out = os.path.join(dest, layer + '.webp')
    img.save(out, 'WEBP', quality=88, method=6)
    size_kb = os.path.getsize(out) / 1024
    print(f'  {layer}: {w}x{h} → {img.size[0]}x{img.size[1]}, {size_kb:.0f} КБ')
    result['textures'][layer] = layer + '.webp'

with open(os.path.join(dest, 'params.json'), 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print('\nПараметры:', json.dumps(result['shader'], ensure_ascii=False))
PY

echo
echo "================================================"
ls -lh "$DEST"
echo
echo "Осталось закоммитить:"
echo "  cd $REPO && git add models/skins && git commit -m '3D: текстуры $FINISH' && git push"
echo "================================================"
