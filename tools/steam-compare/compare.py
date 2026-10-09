#!/usr/bin/env python3
"""
Сверка 3D-рендера мини-аппа с картинками скинов из Steam.

  python compare.py prepare <out>   — список скинов (out/jobs.json) и
                                       картинки Steam (out/steam/)
  python compare.py analyze <out>   — сравнение, отчёт out/report.json,
                                       пары «Steam | наш» для худших и
                                       сводная картинка out/worst.jpg

Рендер между шагами делает render.cjs. Сравниваем не пиксели (ракурс и
свет у Steam другие), а цвет самого предмета: яркость, насыщенность и
распределение оттенков. Этого хватает, чтобы поймать «белый вместо
оранжевого», «весь фиолетовый вместо затвора» и пастель вместо хрома.

Переменные окружения:
  MODELS_CDN   — откуда брать models/index.json (по умолчанию Cloudflare)
  MAX_SKINS    — сколько скинов за запуск (0 — все); список идёт по
                 кругу от недели к неделе
  ONLY_NAMES   — через «;» точные названия, которые сверить обязательно
  WORST_PAIRS  — сколько худших пар сохранить картинками
"""
import datetime
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

import numpy as np
from PIL import Image, ImageDraw, ImageFont

MODELS_CDN = os.environ.get('MODELS_CDN', 'https://dghost-3d.pages.dev/').rstrip('/') + '/'
SKINS_API = 'https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json'
MAX_SKINS = int(os.environ.get('MAX_SKINS', '250') or 0)
WORST_PAIRS = int(os.environ.get('WORST_PAIRS', '40'))
UA = {'User-Agent': 'DGhostMarket-3D-check/1.0'}


def fetch(url, timeout=60):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def slugify(name):
    return re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')[:80]


def clean_name(name):
    return name.replace('★', '').replace('StatTrak™', '').strip()


# ---------------------------------------------------------------- prepare

# Сначала износы, которых на рынке больше всего, — меньше запросов к CSFloat.
WEARS = [('Field-Tested', 0.25), ('Minimal Wear', 0.1), ('Factory New', 0.03),
         ('Well-Worn', 0.41), ('Battle-Scarred', 0.6)]


def spread_sample(names, k):
    """
    k названий вразброс по всему списку (через равный шаг), со сдвигом
    по неделе года — за несколько запусков пройдём все. Подряд идущий
    кусок отсортированного списка брал скины двух-трёх стволов.
    """
    n = len(names)
    if not k or k >= n:
        return list(names)
    step = n / k
    week = datetime.date.today().isocalendar()[1]
    shift = week % max(int(step), 1)
    return [names[(int(i * step) + shift) % n] for i in range(k)]


def prepare_csfloat(out, index, names):
    """
    Образцы с CSFloat: для каждого скина — реальные экземпляры с разными
    сидами (через бота: /api/ops/csfloat_refs, ключ OPS_API_KEY) и их
    скриншоты. Рендерим наш 3D с тем же сидом и float — сравнение
    один к одному, по паттернам.
    """
    api_base = os.environ.get('OPS_URL', 'https://api.dghostmarket.com').rstrip('/')
    key = os.environ.get('OPS_API_KEY', '')
    if not key:
        sys.exit('Нет OPS_API_KEY (секрет репозитория) — образцы CSFloat не получить.')
    per_skin = int(os.environ.get('PER_SKIN', '10'))
    # Номер раскраски → папка: у Doppler/Gamma Doppler одно название на все
    # фазы, а рисунок у каждой фазы свой (как в мини-аппе, modelEntryForSkin).
    try:
        paint_map = json.loads(fetch(MODELS_CDN + 'models/paint_index.json'))
    except Exception:
        paint_map = {}
    jobs = []
    for name in names:
        seen = set()
        # Ножи и перчатки на рынке — со звёздочкой: «★ Karambit | Doppler».
        model = str(index[name].get('model') or '')
        star = '★ ' if re.search(r'knife|bayonet|glove', model) else ''
        for wear_name, _ in WEARS:
            if len(seen) >= per_skin:
                break
            q = urllib.parse.urlencode({'name': f'{star}{clean_name(name)} ({wear_name})', 'limit': 50})
            req = urllib.request.Request(f'{api_base}/api/ops/csfloat_refs?{q}', headers=dict(UA, **{'X-Ops-Key': key}))
            try:
                with urllib.request.urlopen(req, timeout=60) as r:
                    refs = json.loads(r.read()).get('refs', [])
            except urllib.error.HTTPError as e:
                print(f'  ✗ CSFloat {name} ({wear_name}): HTTP {e.code}')
                if e.code in (429, 502):
                    time.sleep(30)  # лимит CSFloat — переждать
                continue
            except Exception as e:
                print(f'  ✗ CSFloat {name} ({wear_name}): {e}')
                continue
            for ref in refs:
                seed = ref.get('paint_seed')
                if seed is None or seed in seen or not ref.get('playside'):
                    continue
                # Проба наклеек: только экземпляры с наклейками на своих местах
                # (без сдвига) — по ним сверяем, куда 3D ставит наклейки.
                if os.environ.get('STICKERS_ONLY') and not [
                        st for st in ref.get('stickers') or []
                        if st.get('slot') is not None and not st.get('offset_x') and not st.get('offset_y')]:
                    continue
                slug = slugify(f'{name}_{seed}')
                dest = os.path.join(out, 'steam', slug + '.png')
                try:
                    Image.open(io.BytesIO(fetch(ref['playside']))).convert('RGBA').save(dest)
                except Exception as e:
                    print(f'  ✗ скриншот {name} #{seed}: {e}')
                    continue
                seen.add(seed)
                entry = index[name]
                exact = paint_map.get(str(ref.get('paint_index'))) if ref.get('paint_index') is not None else None
                if exact and exact != entry.get('skin'):
                    entry = dict(entry, skin=exact)
                phase = f" · {ref['phase']}" if ref.get('phase') else ''
                jobs.append({'name': f'{name}{phase} · паттерн {seed}', 'slug': slug, 'entry': entry,
                             'seed': seed, 'wear': ref.get('float_value') or 0.05,
                             'stickers': ref.get('stickers') or []})
                time.sleep(0.3)
                if len(seen) >= per_skin:
                    break
            time.sleep(1)
        print(f'  {name}: образцов {len(seen)}')
    return jobs


def prepare(out):
    os.makedirs(os.path.join(out, 'steam'), exist_ok=True)
    index = json.loads(fetch(MODELS_CDN + 'models/index.json'))
    if os.environ.get('REF_SOURCE') == 'csfloat':
        only = [n.strip() for n in os.environ.get('ONLY_NAMES', '').split(';') if n.strip()]
        if only:
            names = [n for n in only if n in index]
        else:
            # Широкая сверка: MAX_SKINS скинов с 3D, по кругу от запуска к
            # запуску (неделя года), по PER_SKIN образцов на скин.
            all_names = sorted(n for n, e in index.items() if isinstance(e, dict) and e.get('skin'))
            batch = os.environ.get('BATCH', '')
            if batch:
                # Полная сверка частями: BATCH=i/n — каждый n-й скин, начиная с i.
                i, n = (int(v) for v in batch.split('/'))
                names = all_names[i - 1::n]
            else:
                names = spread_sample(all_names, MAX_SKINS)
        jobs = prepare_csfloat(out, index, names)
        # Группа раскраски (формат и стиль) — чтобы видеть, какой тип
        # раскрасок рисуется хуже всего, и чинить целыми группами.
        groups = {}
        for job in jobs:
            skin_dir = job['entry'].get('skin')
            if skin_dir not in groups:
                try:
                    meta = json.loads(fetch(MODELS_CDN + skin_dir + '/params.json'))
                    groups[skin_dir] = f"{meta.get('format') or 'legacy'}/стиль {meta.get('shader', {}).get('paint_style', '?')}"
                except Exception:
                    groups[skin_dir] = '?'
            job['group'] = groups[skin_dir]
        with open(os.path.join(out, 'jobs.json'), 'w', encoding='utf-8') as f:
            json.dump(jobs, f, ensure_ascii=False, indent=1)
        print(f'Образцов CSFloat к сверке: {len(jobs)}')
        return
    api = json.loads(fetch(SKINS_API, timeout=120))
    images = {}
    for s in api:
        if s.get('image') and s.get('name'):
            images.setdefault(clean_name(s['name']), s['image'])

    names = sorted(n for n, e in index.items()
                   if isinstance(e, dict) and e.get('skin') and clean_name(n) in images)
    only = [n.strip() for n in os.environ.get('ONLY_NAMES', '').split(';') if n.strip()]
    if only:
        chosen = [n for n in names if n in only]
    elif MAX_SKINS and len(names) > MAX_SKINS:
        chosen = spread_sample(names, MAX_SKINS)
    else:
        chosen = names

    jobs = []
    for name in chosen:
        slug = slugify(name)
        dest = os.path.join(out, 'steam', slug + '.png')
        if not os.path.isfile(dest):
            try:
                data = fetch(images[clean_name(name)] + '/512fx384f')
                Image.open(io.BytesIO(data)).convert('RGBA').save(dest)
            except Exception as e:
                print(f'  ✗ Steam {name}: {e}')
                continue
            time.sleep(0.2)
        jobs.append({'name': name, 'slug': slug, 'entry': index[name]})

    with open(os.path.join(out, 'jobs.json'), 'w', encoding='utf-8') as f:
        json.dump(jobs, f, ensure_ascii=False, indent=1)
    print(f'Скинов с 3D и картинкой Steam: {len(names)}, к сверке: {len(jobs)}')


# ---------------------------------------------------------------- analyze

def item_pixels(img):
    """Пиксели самого предмета (без фона), RGB 0..1, и обрезанная картинка."""
    a = np.asarray(img.convert('RGBA')).astype(np.float32) / 255
    alpha = a[..., 3]
    if alpha.min() < 0.5:
        mask = alpha > 0.5
    else:
        # Фон без прозрачности: всё, что заметно отличается от краёв.
        border = np.concatenate([a[0, :, :3], a[-1, :, :3], a[:, 0, :3], a[:, -1, :3]])
        bg = np.median(border, axis=0)
        mask = np.abs(a[..., :3] - bg).sum(-1) > 0.12
    ys, xs = np.nonzero(mask)
    if len(xs) < 50:
        return None, None
    crop = img.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    return a[..., :3][mask], crop


def srgb_to_lab(rgb):
    c = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    L = 116 * f[:, 1] - 16
    A = 500 * (f[:, 0] - f[:, 1])
    B = 200 * (f[:, 1] - f[:, 2])
    return L, A, B


HUE_NAMES = ['красный', 'оранжевый', 'жёлтый', 'салатовый', 'зелёный', 'бирюзовый',
             'голубой', 'синий', 'фиолетовый', 'пурпурный', 'розовый', 'малиновый']


def features(px):
    L, A, B = srgb_to_lab(px)
    chroma = np.hypot(A, B)
    hue = (np.degrees(np.arctan2(B, A)) + 360) % 360
    # Оттенки считаем только у заметно цветных пикселей, с весом по насыщенности.
    colored = chroma > 12
    hue_hist = np.histogram(hue[colored], bins=12, range=(0, 360), weights=chroma[colored])[0]
    hue_hist = hue_hist / max(hue_hist.sum(), 1e-6)
    light_hist = np.histogram(L, bins=8, range=(0, 100))[0] / len(L)
    return {
        'L': float(L.mean()),
        'chroma': float(chroma.mean()),
        'colored': float(colored.mean()),
        'hue_hist': hue_hist,
        'light_hist': light_hist,
        'main_hue': HUE_NAMES[int(hue_hist.argmax())] if colored.mean() > 0.05 else 'без цвета',
    }


def compare(steam, ours):
    d_light = float(np.abs(steam['light_hist'] - ours['light_hist']).sum()) / 2
    d_hue = float(np.abs(steam['hue_hist'] - ours['hue_hist']).sum()) / 2
    d_colored = abs(steam['colored'] - ours['colored'])
    # Оттенок важен, только если предмет вообще цветной.
    hue_weight = min(1.0, max(steam['colored'], ours['colored']) * 3)
    dist = 0.45 * d_light + 0.35 * d_hue * hue_weight + 0.2 * d_colored
    notes = []
    dl = ours['L'] - steam['L']
    if abs(dl) > 12:
        notes.append(f"{'светлее' if dl > 0 else 'темнее'} на {abs(dl):.0f} (яркость {steam['L']:.0f} → {ours['L']:.0f})")
    dc = ours['chroma'] - steam['chroma']
    if abs(dc) > 8:
        notes.append(f"{'насыщеннее' if dc > 0 else 'бледнее'} (насыщенность {steam['chroma']:.0f} → {ours['chroma']:.0f})")
    if hue_weight > 0.3 and steam['main_hue'] != ours['main_hue']:
        notes.append(f"основной цвет: в Steam {steam['main_hue']}, у нас {ours['main_hue']}")
    return round(100 * (1 - min(dist, 1)), 1), notes


def ui_font(size=14):
    """Шрифт с кириллицей (в Ubuntu — DejaVu), иначе встроенный."""
    for path in ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
                 '/usr/share/fonts/dejavu/DejaVuSans.ttf'):
        if os.path.isfile(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def pair_image(steam_crop, ours_crop, title, score, h=220):
    def fit(im):
        im = im.convert('RGBA')
        k = min(h / im.height, 330 / im.width)
        return im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.LANCZOS)
    a, b = fit(steam_crop), fit(ours_crop)
    w = 330 * 2 + 30
    canvas = Image.new('RGB', (w, h + 34), (34, 34, 38))
    canvas.paste(a, ((330 - a.width) // 2 + 10, 30 + (h - a.height) // 2), a)
    canvas.paste(b, (330 + 20 + (330 - b.width) // 2, 30 + (h - b.height) // 2), b)
    d = ImageDraw.Draw(canvas)
    font = ui_font(14)
    d.text((10, 6), f'{title}   сходство {score}', fill=(235, 235, 235), font=font)
    d.text((10, h + 14), 'Steam', fill=(150, 150, 150), font=font)
    d.text((340, h + 14), 'наш 3D', fill=(150, 150, 150), font=font)
    return canvas


def analyze(out):
    jobs = json.load(open(os.path.join(out, 'jobs.json'), encoding='utf-8'))
    rows, missing = [], []
    crops = {}
    for job in jobs:
        sp = os.path.join(out, 'steam', job['slug'] + '.png')
        op = os.path.join(out, 'ours', job['slug'] + '.png')
        if not os.path.isfile(op):
            missing.append(job['name'])
            continue
        s_px, s_crop = item_pixels(Image.open(sp))
        o_px, o_crop = item_pixels(Image.open(op))
        if s_px is None or o_px is None:
            missing.append(job['name'])
            continue
        fs, fo = features(s_px), features(o_px)
        score, notes = compare(fs, fo)
        crops[job['slug']] = (s_crop, o_crop)
        rows.append({
            'name': job['name'], 'slug': job['slug'], 'skin': job['entry'].get('skin'),
            'group': job.get('group'),
            'stickers': job.get('stickers') or None,
            'score': score, 'notes': notes,
            'steam': {'L': round(fs['L'], 1), 'chroma': round(fs['chroma'], 1), 'main_hue': fs['main_hue']},
            'ours': {'L': round(fo['L'], 1), 'chroma': round(fo['chroma'], 1), 'main_hue': fo['main_hue']},
        })

    rows.sort(key=lambda r: r['score'])
    pairs_dir = os.path.join(out, 'pairs')
    os.makedirs(pairs_dir, exist_ok=True)
    tiles = []
    for r in rows[:WORST_PAIRS]:
        img = pair_image(*crops[r['slug']], r['name'], r['score'])
        img.save(os.path.join(pairs_dir, r['slug'] + '.jpg'), quality=85)
        r['pair'] = 'pairs/' + r['slug'] + '.jpg'
        tiles.append(img)
    if tiles:
        cols = 2
        tw, th = tiles[0].size
        sheet = Image.new('RGB', (tw * cols, th * ((min(len(tiles), 20) + cols - 1) // cols)), (20, 20, 24))
        for i, t in enumerate(tiles[:20]):
            sheet.paste(t, ((i % cols) * tw, (i // cols) * th))
        sheet.save(os.path.join(out, 'worst.jpg'), quality=82)

    by_group = {}
    for r in rows:
        if r.get('group'):
            by_group.setdefault(r['group'], []).append(r['score'])
    report = {
        'date': datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC'),
        'checked': len(rows),
        'groups': sorted(({'group': g, 'count': len(v), 'average_score': round(float(np.mean(v)), 1)}
                          for g, v in by_group.items()), key=lambda x: x['average_score']),
        'not_rendered': missing,
        'average_score': round(float(np.mean([r['score'] for r in rows])), 1) if rows else None,
        'skins': rows,
    }
    with open(os.path.join(out, 'report.json'), 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=1)
    print(f"Сверено: {len(rows)}, не отрендерилось: {len(missing)}, среднее сходство: {report['average_score']}")
    for r in rows[:15]:
        print(f"  {r['score']:5.1f}  {r['name']}: {'; '.join(r['notes']) or '—'}")


if __name__ == '__main__':
    cmd, out = sys.argv[1], sys.argv[2]
    {'prepare': prepare, 'analyze': analyze}[cmd](out)
