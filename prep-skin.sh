#!/usr/bin/env bash
#
# Готовит текстуры раскраски для мини-аппа: ужимает их до разумного
# размера, переводит в WebP и складывает в models/skins/<имя>/,
# плюс вынимает параметры шейдера из материала в params.json.
#
# Износ и грязь у большинства скинов одни и те же файлы игры — их
# кладём один раз в models/shared/ и в params.json пишем общий путь.
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
SHARED="$REPO/models/shared"

if ! python3 -c 'import PIL' 2>/dev/null; then
    echo "==> Ставлю Pillow (нужен для сжатия картинок)"
    pip install --quiet Pillow
fi

mkdir -p "$DEST" "$SHARED"

MATFILE=$(find "$SRC" -name "${FINISH}.vmat" | head -1)
COMPFILE=$(find "$SRC" -name "${FINISH}.vcompmat" | head -1)

# ------------------------------------------------------------
# Новый формат (vcompmat): текстуры уже разложены по развёртке
# ствола, просто переводим их в WebP и пишем params.json так же,
# как у ak47_autoexec_camo.
# ------------------------------------------------------------
if [ -z "$MATFILE" ] && [ -n "$COMPFILE" ]; then
python3 - "$FINISH" "$SRC" "$DEST" "$COMPFILE" "$SHARED" <<'PY'
import glob, json, os, re, sys
from PIL import Image, ImageStat

finish, src, dest, compfile, shared = sys.argv[1:6]

def resize_bands(img, size):
    """Уменьшает каждый канал отдельно. Обычный resize у RGBA умножает
    цвет на прозрачность: там, где альфа 0 (у Printstream — почти везде,
    в альфе маска перламутра), цвет обнулялся и ствол выходил чёрным."""
    if img.mode not in ('RGBA', 'LA'):
        return img.resize(size, Image.LANCZOS)
    return Image.merge(img.mode, [b.resize(size, Image.LANCZOS) for b in img.split()])
recipe = open(compfile, encoding='utf-8', errors='ignore').read()

# Имена файлов, на которые ссылается рецепт (без расширения).
refs = {os.path.splitext(os.path.basename(r))[0].lower()
        for r in re.findall(r'[A-Za-z0-9_/.-]+\.(?:vtex|tga|psd|png)', recipe)}

pngs = []
for path, dirs, files in os.walk(src):
    for f in files:
        if not f.endswith('.png'):
            continue
        stem = f[:-4].lower()
        own = stem.startswith(finish.lower() + '_')
        # Хвост вида _tga_1c610e5a Source2Viewer добавляет сам.
        base = re.sub(r'_(tga|psd|png)_[0-9a-f]+$', '', stem)
        if own or base in refs:
            pngs.append((not own, os.path.join(path, f)))
pngs.sort()  # свои текстуры раньше общих

# слой → (признак в имени файла, наибольшая сторона, цветной ли)
LAYERS = [
    ('pattern',       'albedo',            2048, True),
    ('normal',        'normal',            2048, None),
    ('ao',            'ambient_occlusion', 1024, False),
    ('material_mask', 'material_mask',     1024, False),
    ('roughness',     'roughness',         1024, False),
    ('sfx',           'sfx',               1024, False),
]

os.makedirs(dest, exist_ok=True)
textures = {}

for layer, key, max_side, color in LAYERS:
    src_png = next((p for _, p in pngs if key in os.path.basename(p).lower()), None)
    if not src_png:
        print(f'  {layer}: нет')
        continue
    img = Image.open(src_png)
    w, h = img.size
    if max(w, h) > max_side:
        k = max_side / max(w, h)
        img = resize_bands(img, (int(w * k), int(h * k)))
    if color is None:
        img = img.convert('RGB')
    elif color:
        img = img.convert('RGBA' if 'A' in img.getbands() else 'RGB')
    else:
        img = img.convert('L')

    # Пустая текстура хуже никакой: нулевая карта нормалей затемняла
    # весь ствол, а пустое альбедо давало чёрный силуэт.
    if max(ImageStat.Stat(img.convert('RGB')).extrema[i][1] for i in range(3)) < 8:
        print(f'  {layer}: пустая картинка — пропускаю ({os.path.basename(src_png)})')
        old = os.path.join(dest, layer + '.webp')
        if os.path.isfile(old):
            os.remove(old)
        continue

    out = os.path.join(dest, layer + '.webp')
    img.save(out, 'WEBP', quality=88, method=6)
    print(f'  {layer}: {w}x{h} → {img.size[0]}x{img.size[1]}, {os.path.getsize(out) / 1024:.0f} КБ')
    textures[layer] = layer + '.webp'

if 'pattern' not in textures:
    print('❌ Альбедо нет или оно пустое — такой скин просмотрщик пока не покажет.')
    print('   Пришли рецепт: sed -n "/РЕЦЕПТ/,/=====/p" /tmp/cs2-assets/build-skin-' + finish + '.log')
    sys.exit(1)

# Своей маски износа у нового формата нет — берём общую.
wear = sorted(glob.glob(os.path.join(shared, 'wear_*.webp')))
if wear:
    textures['wear'] = 'models/shared/' + os.path.basename(wear[0])
    print(f'  wear: общий {textures["wear"]}')

rel = compfile.split('/weapons/paints/', 1)[-1]
meta = {
    'finish': finish,
    'material': 'weapons/paints/' + rel,
    'format': 'vcompmat',
    'textures': textures,
    'shader': {},
}
with open(os.path.join(dest, 'params.json'), 'w', encoding='utf-8') as f:
    json.dump(meta, f, ensure_ascii=False, indent=2)
PY
    STATUS=$?
    echo
    ls -lh "$DEST"
    exit $STATUS
fi

if [ -z "$MATFILE" ]; then
    echo "❌ Материал не найден. Сначала: bash fix-skin.sh $FINISH"
    exit 1
fi

python3 - "$FINISH" "$SRC" "$DEST" "$MATFILE" "$SHARED" <<'PY'
import hashlib, io, json, re, sys, os
from PIL import Image

finish, src, dest, matfile, shared = sys.argv[1:6]

def resize_bands(img, size):
    """Уменьшает каждый канал отдельно. Обычный resize у RGBA умножает
    цвет на прозрачность: там, где альфа 0 (у Printstream — почти везде,
    в альфе маска перламутра), цвет обнулялся и ствол выходил чёрным."""
    if img.mode not in ('RGBA', 'LA'):
        return img.resize(size, Image.LANCZOS)
    return Image.merge(img.mode, [b.resize(size, Image.LANCZOS) for b in img.split()])
mat = open(matfile, encoding='utf-8', errors='ignore').read()

def find_texture(key):
    """Путь к текстуре из строки вида "TexturePattern"  "materials/.../x.png" """
    m = re.search(r'"%s"\s+"([^"]+)"' % key, mat)
    # Вместо пути бывает заглушка-цвет "[0.000000 0.000000 …]" —
    # это значит, что текстуры у слоя нет.
    if not m or m.group(1).startswith('['):
        return None
    return m.group(1)

def find_number(key, default=0.0):
    m = re.search(r'"%s"\s+"([-0-9.]+)"' % key, mat)
    return float(m.group(1)) if m else default

def find_color(key):
    """Цвет вида "g_vColor0" "[0.5 0.2 0.1 0.0]" → [r, g, b] в 0..1."""
    m = re.search(r'"%s"\s+"\[([^\]]+)\]"' % key, mat)
    if not m:
        return None
    rgb = [float(x) for x in m.group(1).split()[:3]]
    if max(rgb) > 1:
        rgb = [x / 255 for x in rgb]
    return [round(x, 4) for x in rgb]

# Какие слои нам нужны и до какого размера их ужимать. Узор — самое
# важное, ему даём больше; грязь и износ — общие маски, они хорошо
# переживают уменьшение.
LAYERS = {
    'pattern':  ('TexturePattern',        2048),
    'rough':    ('TexturePaintRoughness', 1024),
    'wear':     ('TextureWear',           1024),
    'grunge':   ('TextureGrunge',         1024),
}

# Слои, которые игра берёт из общих файлов. Имя в models/shared/ —
# по содержимому (<слой>_<хеш>.webp): одинаковая маска — один файл,
# даже если у разных скинов она лежит под разными именами.
SHARED_LAYERS = ('wear', 'grunge')

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

# Гидрография, спрей, анодирование: узор там — маска, а сами цвета
# лежат в материале. Без них просмотрщик покажет сырые каналы маски.
colors = [find_color('g_vColor%d' % i) for i in range(4)]
if any(colors):
    result['shader']['colors'] = [c or [0, 0, 0] for c in colors]

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
        img = resize_bands(img, (int(w * k), int(h * k)))

    # Маски — в оттенках серого, это ещё экономит вес.
    if layer in ('rough', 'wear', 'grunge'):
        img = img.convert('L')
    else:
        img = img.convert('RGBA' if 'A' in img.getbands() else 'RGB')

    buf = io.BytesIO()
    img.save(buf, 'WEBP', quality=88, method=6)
    data = buf.getvalue()

    if layer in SHARED_LAYERS:
        name = f'{layer}_{hashlib.md5(data).hexdigest()[:10]}.webp'
        out = os.path.join(shared, name)
        rel = 'models/shared/' + name
        # Старая копия в папке скина больше не нужна.
        old = os.path.join(dest, layer + '.webp')
        if os.path.isfile(old):
            os.remove(old)
    else:
        out = os.path.join(dest, layer + '.webp')
        rel = layer + '.webp'

    if layer in SHARED_LAYERS and os.path.isfile(out):
        print(f'  {layer}: уже есть в {rel}')
    else:
        with open(out, 'wb') as f:
            f.write(data)
        print(f'  {layer}: {w}x{h} → {img.size[0]}x{img.size[1]}, {len(data) / 1024:.0f} КБ → {rel}')
    result['textures'][layer] = rel

with open(os.path.join(dest, 'params.json'), 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print('\nПараметры:', json.dumps(result['shader'], ensure_ascii=False))
PY

echo
echo "================================================"
ls -lh "$DEST"
echo
echo "Осталось закоммитить:"
echo "  cd $REPO && git add models/skins models/shared && git commit -m '3D: текстуры $FINISH' && git push"
echo "================================================"
