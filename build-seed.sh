#!/usr/bin/env bash
#
# Диапазоны pattern seed для всех собранных раскрасок.
#
# В игре paint seed предмета (0…1000) задаёт сдвиг узора по X, по Y
# и поворот: генератор Valve выдаёт три числа подряд, каждое — в своём
# диапазоне. В CS2 эти диапазоны лежат не в items_game.txt, а в рецепте
# раскраски (weapons/paints/<набор>/<имя>.vcompmat_c): у переменных
# узора заданы min/max, а шаблон стиля «бросает кубик» в этих границах.
#
# Скрипт вынимает все рецепты одним вызовом, находит в них сдвиг и
# поворот узора и дописывает в params.json каждой раскраски блок
# shader.seed_roll. Просмотрщик (app-3d.js, seedPlacement) по нему и
# по seed лота кладёт узор так же, как игра.
#
#   bash build-seed.sh          — только раскраски без seed_roll
#   FORCE=1 bash build-seed.sh  — пересчитать все
#
set -uo pipefail

WORK="${WORK:-/tmp/cs2-assets}"
TOOLS="$WORK/tools"
VPK="$WORK/game/game/csgo/pak01_dir.vpk"
REPO="${REPO:-/workspaces/dghost-market-app}"
OUT="$WORK/export-recipes"

if [ ! -f "$VPK" ] || [ ! -x "$TOOLS/Source2Viewer-CLI" ]; then
    echo "⚠️ Нет архива игры или Source2Viewer — seed пропускаю."
    exit 0
fi

if [ ! -d "$OUT/weapons/paints" ]; then
    echo "==> Вынимаю рецепты раскрасок и шаблоны стилей"
    "$TOOLS/Source2Viewer-CLI" -i "$VPK" -o "$OUT" -d \
        --vpk_filepath "weapons/paints/,workshop/paintkits/templates/" \
        --vpk_extensions vcompmat_c > "$WORK/build-seed-extract.log" 2>&1
    tail -3 "$WORK/build-seed-extract.log"
fi

python3 - "$OUT" "$REPO/models/skins" "${FORCE:-0}" <<'PY'
import json, os, re, sys

out, skins_dir, force = sys.argv[1], sys.argv[2], sys.argv[3] == '1'
VERSION = 1

recipes = {}
templates = []
for path, dirs, files in os.walk(out):
    for f in files:
        if not f.endswith('.vcompmat'):
            continue
        full = os.path.join(path, f)
        if '/workshop/paintkits/templates/' in full.replace('\\', '/'):
            templates.append(full)
        else:
            recipes.setdefault(f[:-len('.vcompmat')].lower(), full)
print(f'Рецептов: {len(recipes)}, шаблонов: {len(templates)}')

NUM = r'(-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)'

def loose_vars(text):
    """Переменные рецепта: имя → значения и границы (если заданы)."""
    found = {}
    for m in re.finditer(r'm_strName\s*=\s*"(\w+)"(.*?)(?=m_strName\s*=|\Z)', text, re.S):
        name, body = m.group(1), m.group(2)
        var = {}
        t = re.search(r'm_nVariableType\s*=\s*"(\w+)"', body)
        if t:
            var['type'] = t.group(1)
        b = re.search(r'm_bHasFloatBounds\s*=\s*(true|false)', body)
        if b:
            var['bounds'] = b.group(1) == 'true'
        for axis in 'XYZW':
            for suffix in ('', '_Min', '_Max'):
                v = re.search(r'm_flValueFloat%s%s\s*=\s*%s' % (axis, suffix, NUM), body)
                if v:
                    var[axis.lower() + suffix.lower()] = float(v.group(1))
        if any(k[0] in 'xyzw' for k in var):
            found[name] = var
    return found

def roll_lists(text):
    """Мутаторы Random Roll: какая переменная — seed, какие бросаются и в каком порядке."""
    seeds = re.findall(r'm_strRandomRollInputVars_SeedInputVar\s*=\s*"(\w*)"', text)
    lists = [re.findall(r'"(\w+)"', m) for m in
             re.findall(r'm_vecRandomRollInputVars_InputVarsToRoll\s*=\s*\[(.*?)\]', text, re.S)]
    return [{'seed_var': seeds[i] if i < len(seeds) else None, 'vars': names}
            for i, names in enumerate(lists)]

template_rolls = {}
for t in templates:
    rolls = roll_lists(open(t, encoding='utf-8', errors='ignore').read())
    if rolls:
        template_rolls[os.path.basename(t)] = rolls
print('Шаблоны с Random Roll:', json.dumps(template_rolls, ensure_ascii=False)[:1500])

def axis_range(var, axis):
    if var is None:
        return None
    lo, hi = var.get(axis + '_min'), var.get(axis + '_max')
    if var.get('bounds') and lo is not None and hi is not None:
        return [lo, hi]
    v = var.get(axis)
    return [v, v] if v is not None else None

def find_var(found, word):
    for name, var in found.items():
        if re.search(r'Pattern\w*' + word, name, re.I):
            return name, var
    return None, None

done = skipped = missing = 0
for finish in sorted(os.listdir(skins_dir)):
    pfile = os.path.join(skins_dir, finish, 'params.json')
    if not os.path.isfile(pfile):
        continue
    meta = json.load(open(pfile, encoding='utf-8'))
    shader = meta.setdefault('shader', {})
    if not force and shader.get('seed_version') == VERSION:
        skipped += 1
        continue
    recipe = recipes.get(finish.lower())
    if not recipe:
        missing += 1
        continue
    text = open(recipe, encoding='utf-8', errors='ignore').read()
    found = loose_vars(text)
    off_name, off = find_var(found, 'Offset')
    rot_name, rot = find_var(found, 'Rotat')
    roll = {
        'offset_x': axis_range(off, 'x'),
        'offset_y': axis_range(off, 'y'),
        'rotation': axis_range(rot, 'x'),
        'vars': [n for n in (off_name, rot_name) if n],
        'recipe': os.path.relpath(recipe, out),
    }
    own_rolls = roll_lists(text)
    if own_rolls:
        roll['rolls'] = own_rolls
    shader['seed_version'] = VERSION
    # Узор, который не сдвигается и не поворачивается, — блок не нужен.
    ranges = [r for r in (roll['offset_x'], roll['offset_y'], roll['rotation']) if r]
    if ranges and any(r[0] != r[1] for r in ranges):
        shader['seed_roll'] = roll
    else:
        shader.pop('seed_roll', None)
    # Все числовые переменные с границами — для проверки по логу и файлу.
    shader['recipe_bounds'] = {n: v for n, v in found.items() if v.get('bounds')} or None
    if shader['recipe_bounds'] is None:
        shader.pop('recipe_bounds')
    with open(pfile, 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    done += 1
    if done <= 5 or finish in ('aq_oiled', 'aa_fade', 'hy_webs', 'am_ruby_marbleized'):
        print(f'  {finish}: {json.dumps(shader.get("seed_roll"), ensure_ascii=False)}')

print(f'seed: обновлено {done}, уже было {skipped}, без рецепта {missing}')
PY

# Пара рецептов целиком — чтобы по журналу сборки сверить формат.
for name in aq_oiled aa_fade hy_webs; do
    f=$(find "$OUT" -name "$name.vcompmat" | head -1)
    [ -z "$f" ] && continue
    echo "::group::рецепт $name"
    grep -nE 'm_strName|m_nVariableType|m_bHasFloatBounds|m_flValueFloat|RandomRoll|templates/' "$f" | head -80
    echo "::endgroup::"
done
f=$(find "$OUT" -path '*templates*' -name 'case_hardening.vcompmat' | head -1)
if [ -n "$f" ]; then
    echo "::group::шаблон case_hardening"
    grep -nE -A3 'RandomRoll|m_strName|m_bHasFloatBounds|m_flValueFloat' "$f" | head -80
    echo "::endgroup::"
fi
