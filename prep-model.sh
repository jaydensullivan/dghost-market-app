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

# Папку HD-корпуса M4A4 (m4a4) fix-model.sh вынимает только ради набора
# HD ниже — в выбор старого набора она не попадает, как и раньше.
NEW_ALIAS_DIRS = {'m4a1': '/weapons/models/m4a4/'}

def pick(keys):
    skip = NEW_ALIAS_DIRS.get(weapon)
    matches = [c for c in candidates if any(k in os.path.basename(c).lower() for k in keys)
               and not (skip and skip in c.replace(os.sep, '/').lower())]
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

    # Режим — до уменьшения: RGBA Pillow уменьшает с домножением на
    # альфу, а у масок она почти нулевая (маска выходила чёрной).
    img = Image.open(png).convert(mode)
    w, h = img.size
    if max(w, h) > max_side:
        k = max_side / max(w, h)
        img = img.resize((int(w * k), int(h * k)), Image.LANCZOS)

    out = os.path.join(dest, name + '.webp')
    # Маску сохраняем без потерь: от неё зависит, где лежит краска.
    if name == 'masks':
        img.save(out, 'WEBP', lossless=True)
    else:
        img.save(out, 'WEBP', quality=88, method=6)

    print(f'  {name}: {w}x{h} → {img.size[0]}x{img.size[1]}, {os.path.getsize(out)/1024:.0f} КБ')
    result['textures'][name] = name + '.webp'

# Набор HD-корпуса: в CS2 у ствола две развёртки, и раскраски нового
# формата (однотонные, шаблоны, часть спреев) лежат на HD-корпусе. Его
# маска зон и родные текстуры — в weapons/models/<ствол>/materials/
# (composite_inputs/…_masks, <ствол>_default_color/ao/rough). Без них
# мини-апп заливал HD-корпус одним цветом. Всегда пишем ключ "hd"
# (null — не нашлось), чтобы build-all.sh не пересобирал ствол заново.
# Какие файлы берёт игра — из composite_inputs.vmat HD-корпуса: g_tMasks
# (зоны), g_tColor (основа под краской; у M249 это substrate_color, а не
# default_color). AO — родной default_ao (в composite лежит cavity с
# другой раскладкой каналов). Если vmat не нашёлся — по именам файлов.
HD_WANTED = [
    ('masks', 'g_tMasks', r'composite_inputs/[^/]*_masks', 1024, 'RGB'),
    ('color', 'g_tColor', r'materials/[^/]*_default_color', 2048, 'RGB'),
    ('rough', None, r'materials/[^/]*_default_rough', 1024, 'L'),
    ('ao', None, r'materials/[^/]*_default_ao|materials/[^/]*_ao[_.]|materials/[^/]*ambient_?occlusion', 1024, 'L'),
]
# Папка HD-корпуса в игре; у M4A4 и Glock она зовётся не как в items_game.
# Строго своя папка: в выемке для m4a1 лежат и файлы m4a1_silencer.
hd_dir = {'m4a1': 'm4a4', 'glock': 'glock18'}.get(weapon, weapon)
hd_marker = f'/weapons/models/{hd_dir}/materials/'
hd_cands = [c.replace(os.sep, '/') for c in candidates if hd_marker in c.replace(os.sep, '/').lower()]
hd_vmat_params = {}
for path, dirs, files in os.walk(src):
    for f in files:
        full = os.path.join(path, f).replace(os.sep, '/')
        if f.endswith('_composite_inputs.vmat') and hd_marker in full.lower():
            text = open(full, encoding='utf-8', errors='ignore').read()
            hd_vmat_params = dict(re.findall(r'"(g_t[A-Za-z]+)"\s+"([^"]+)"', text))

def hd_file(param, pat):
    ref = hd_vmat_params.get(param) if param else None
    if ref:
        stem = os.path.splitext(os.path.basename(ref))[0].lower()
        exact = [c for c in hd_cands if os.path.splitext(os.path.basename(c))[0].lower() == stem]
        if exact:
            return exact[0]
    found = sorted((c for c in hd_cands if re.search(pat, c.lower())), key=len)
    return found[0] if found else None

hd = {}
for name, param, pat, max_side, mode in HD_WANTED:
    path = hd_file(param, pat)
    if not path:
        print(f'  hd {name}: не нашёл')
        continue
    # Сначала режим, потом размер: при уменьшении RGBA Pillow домножает
    # цвет на альфу, а у масок она почти нулевая — маска выходила чёрной.
    img = Image.open(path).convert(mode)
    w, h = img.size
    if max(w, h) > max_side:
        k = max_side / max(w, h)
        img = img.resize((int(w * k), int(h * k)), Image.LANCZOS)
    os.makedirs(os.path.join(dest, 'hd'), exist_ok=True)
    out = os.path.join(dest, 'hd', name + '.webp')
    if name == 'masks':
        img.save(out, 'WEBP', lossless=True)
    else:
        img.save(out, 'WEBP', quality=88, method=6)
    print(f'  hd {name}: {os.path.basename(path)} {w}x{h} → {img.size[0]}x{img.size[1]}')
    hd[name] = 'hd/' + name + '.webp'
# AO у части стволов (Glock, MP7, AUG…) называется иначе или его нет —
# он необязателен: без него мини-апп обойдётся без затенения.
result['hd'] = {'textures': hd} if all(k in hd for k in ('masks', 'color')) else None
# 2 — маска без порчи альфой и основа из composite_inputs; 3 — AO необязателен.
result['hd_version'] = 3

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
