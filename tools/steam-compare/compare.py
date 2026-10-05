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

def prepare(out):
    os.makedirs(os.path.join(out, 'steam'), exist_ok=True)
    index = json.loads(fetch(MODELS_CDN + 'models/index.json'))
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
        # По кругу: каждую неделю следующий кусок списка.
        week = datetime.date.today().isocalendar()[1]
        start = (week * MAX_SKINS) % len(names)
        chosen = (names + names)[start:start + MAX_SKINS]
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

    report = {
        'date': datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC'),
        'checked': len(rows),
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
