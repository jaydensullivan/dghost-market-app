// ---------------- Пополнения игр, Steam и Telegram (Arcadezy) ----------------
// Плитки в «Маркете» → экран каталога → карточка игры (пакет, логин/ID,
// оплата с баланса) → заказы во вкладке «Сделки». Бот: game_topups.py.
// Раздел выключен в админке — плиток нет, экран пишет «недоступно».

let gtEnabled = false;
let gtItems = [];
let gtTypes = [];
let gtType = '';
let gtGenre = '';
let gtCurrent = null;
let gtOffer = null;
let gtBusy = false;

function gtDict(){ return I18N[currentLang] || I18N.ru; }

function gtTypeLabel(t){
const d = gtDict();
return d['gt_type_' + t] || t;
}

// Без обложки (у Steam её нет в каталоге) — свой значок на фоне цвета
// сервиса. Логотипы не рисуем: это товарные знаки.
const GT_ICONS = {
wallet: '<svg viewBox="0 0 24 24" width="55%" height="55%" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a1 1 0 0 1 1 1v2"/><path d="M3 7.5v10A2.5 2.5 0 0 0 5.5 20H20a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5.5A2.5 2.5 0 0 1 3 7.5Z"/><circle cx="16.5" cy="14.5" r="1.3" fill="currentColor"/></svg>',
gift: '<svg viewBox="0 0 24 24" width="55%" height="55%" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12M12 8S10.5 3.5 8 4.5 9 8 12 8Zm0 0s1.5-4.5 4-3.5S15 8 12 8Z"/></svg>',
key: '<svg viewBox="0 0 24 24" width="55%" height="55%" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l2 2M15 8l2 2"/></svg>',
send: '<svg viewBox="0 0 24 24" width="55%" height="55%" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m21 3-9.5 9.5M21 3l-6.5 18-3-8.5-8.5-3L21 3Z"/></svg>',
};
const GT_THEMES = {
steam: { from: '#1b2838', to: '#2f6a96', accent: '#8fd3ff', icon: 'wallet' },
telegram: { from: '#1c93d6', to: '#2AABEE', accent: '#2AABEE', icon: 'send' },
giftcard: { from: '#9d174d', to: '#db2777', accent: '#f472b6', icon: 'gift' },
gamekey: { from: '#92400e', to: '#d97706', accent: '#fbbf24', icon: 'key' },
};
const GT_PH_COLORS = [['#7B2CFF', '#C4169F'], ['#1d4ed8', '#7B2CFF'], ['#0f766e', '#2563eb'], ['#b45309', '#C4169F'], ['#be123c', '#7B2CFF']];

function gtTheme(c){ return GT_THEMES[c.type] || null; }

function gtCoverHtml(c, cls){
if (c.image) return `<img class="${cls}" src="${escapeHtml(c.image)}" alt="" loading="lazy">`;
const theme = gtTheme(c);
if (theme){
return `<span class="${cls} gt-ph" style="background:linear-gradient(135deg, ${theme.from}, ${theme.to}); color:${theme.accent}">${GT_ICONS[theme.icon]}</span>`;
}
let h = 0;
for (const ch of String(c.slug || c.name || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
const [a, b] = GT_PH_COLORS[h % GT_PH_COLORS.length];
return `<span class="${cls} gt-ph" style="background:linear-gradient(135deg, ${a}, ${b})">${escapeHtml((c.name || '?').slice(0, 1).toUpperCase())}</span>`;
}

function gtTileHtml(c, compact){
if (compact){
return `<button type="button" class="gt-chip-tile" data-gt-slug="${escapeHtml(c.slug)}"><span class="gt-chip-ring">${gtCoverHtml(c, 'gt-chip-img')}</span><span class="gt-chip-name">${escapeHtml(c.name)}</span></button>`;
}
const from = c.from_uzs ? `<span class="gt-tile-price">${escapeHtml(gtDict().gt_from.replace('{price}', formatCoins(c.from_uzs)))}</span>` : '';
const regions = c.gtVariants && c.gtVariants.length > 1 ? `<span class="gt-tile-regions">🌍 ${c.gtVariants.length}</span>` : '';
const fav = gtIsFav(gtFavKey(c)) ? '<span class="gt-tile-fav" aria-hidden="true">★</span>' : '';
return `<button type="button" class="gt-tile" data-gt-slug="${escapeHtml(c.slug)}">${gtCoverHtml(c, 'gt-tile-cover')}<span class="gt-tile-shade"></span>${regions}${fav}<span class="gt-tile-body"><span class="gt-tile-name">${escapeHtml(c.name)}</span>${from}</span></button>`;
}

// Сервисы (Steam, Telegram, карты) — компактными карточками сверху,
// игры — большими обложками ниже. Переключатели: Все · Сервисы · Игры.
const GT_SERVICE_TYPES = ['steam', 'telegram', 'giftcard'];

function gtIsService(c){ return GT_SERVICE_TYPES.includes(c.type); }

// Жанры игр. У Arcadezy категорий нет — делим по названию. Порядок важен:
// игра попадает в первый подходящий жанр, всё неопознанное — в RPG и приключения.
const GT_GENRES = [
{ id: 'popular', re: /^(PUBG Mobile|Mobile Legends \((Global|RU)\)|Free Fire \(CIS\)|Genshin Impact \(Global\)|Call of Duty Mobile|Marvel Rivals|Delta Force$|Stumble Guys|Wuthering Waves|Arena Breakout: Infinite|Blood Strike$|Honkai Impact 3rd \(SG\)|Valorant \(SG\)|Magic Chess Go Go \(RU\))/i },
{ id: 'apps', re: /bigo|chamet|mico|poppo|starmaker|hago|tik ?tok|capcut|mangatoon|qq coin|wesing|sugo|soulchill|jaco|^lita|dazz|migo|nimo|^imo$|sawa|firefly live|yoho/i },
{ id: 'shooter', re: /pubg|free fire|call of duty|valorant|delta force|blood strike|arena breakout|farlight|rainbow six|pixel gun|point blank|crossfire|hyper front|knives out|sausage man|bullet echo|frag pro|modern strike|badlanders|marvel rivals|t3 arena|undawn|once human|mecha break|destiny|division|crossout|ballistic|omega legends|project entropy|warships|metal slug|warborne/i },
{ id: 'moba', re: /mobile legends(?!: adventure)|wild rift|league of legends|arena of valor|onmyoji arena|heroes evolved|extraordinary ones/i },
{ id: 'strategy', re: /age of empire|lords mobile|state of survival|whiteout|kingshot|stormshot|puzzles & survival|clash of plants|civilization|rise to war|the ants|lagrange|eve echoes|x-clash|kings choice|ludus|be the king|runeterra|magic chess|tft|golden spatula|hero clash|dynasty heroes/i },
{ id: 'sport', re: /eafc|football|tsubasa|dunk|kuroko|asphalt|racing|drifters|ace racer|8 ball/i },
{ id: 'casual', re: /stumble|eggy|super sus|tom and jerry|ludo|teen patti|singing monsters|growtopia|cats:|fashion|nikki|life makeover|heartopia|spring valley|hatsune|ensemble stars|idol party|enhypen|sky: children|deepspace|isekai feast|realms of pixel|tomb busters|identity v/i },
{ id: 'rpg', re: null },
];
// Порядок чипов и разделов (отличается от порядка проверки).
const GT_GENRE_ORDER = ['popular', 'shooter', 'moba', 'strategy', 'rpg', 'sport', 'casual', 'apps'];
const gtPrimaryCache = new Map();
function gtPrimaryGenre(c){
const name = c.gtRepName || c.name || '';
if (!gtPrimaryCache.has(name)){
const g = GT_GENRES.find(x => x.re ? x.re.test(name) : true);
gtPrimaryCache.set(name, g.id);
}
return gtPrimaryCache.get(name);
}
// Жанр игры без учёта «Популярных»: популярный шутер виден и в «Шутерах».
function gtSecondaryGenre(c){
const name = c.gtRepName || c.name || '';
return GT_GENRES.find(x => x.id !== 'popular' && (x.re ? x.re.test(name) : true)).id;
}
function gtGenreOf(c, id){
return id === 'popular' ? gtPrimaryGenre(c) === 'popular' : gtSecondaryGenre(c) === id;
}

// ---------- регионы ----------
// «Free Fire (CIS)», «Free Fire (LATAM)»… — одна плитка, регион выбирается внутри.
const GT_REGION_PREF = ['global', '', 'cis', 'ru', 'sg', 'united states', 'us', 'naeu', 'eu', 'americas', 'asia', 'sea'];
const gtGroupBySlug = new Map();

function gtSplitRegion(name){
const m = /^(.*\S)\s*\(([^()]+)\)\s*$/.exec(String(name || ''));
return m ? { base: m[1], region: m[2] } : { base: String(name || ''), region: '' };
}

function gtGroupItems(items){
const groups = new Map();
const out = [];
for (const c of items){
if (gtIsService(c)){ out.push(c); continue; }
const { base, region } = gtSplitRegion(c.name);
const key = base.toLowerCase();
let g = groups.get(key);
if (!g){ g = { gtKey: key, gtBase: base, gtVariants: [] }; groups.set(key, g); out.push(g); }
g.gtVariants.push({ slug: c.slug, region: region, item: c });
}
const rank = v => { const i = GT_REGION_PREF.indexOf(v.region.toLowerCase()); return i < 0 ? 99 : i; };
for (const g of groups.values()){
g.gtVariants.sort((a, b) => rank(a) - rank(b) || a.region.localeCompare(b.region));
const main = g.gtVariants[0].item;
const prices = g.gtVariants.map(v => v.item.from_uzs).filter(Boolean);
Object.assign(g, main, {
name: g.gtVariants.length > 1 ? g.gtBase : main.name,
gtRepName: main.name,
from_uzs: prices.length ? Math.min(...prices) : main.from_uzs,
image: main.image || ((g.gtVariants.find(v => v.item.image) || { item: {} }).item.image),
});
for (const v of g.gtVariants) gtGroupBySlug.set(v.slug, g);
}
return out;
}

function renderTopupRegions(slug){
const d = gtDict();
const box = document.getElementById('gtRegions');
const g = gtGroupBySlug.get(slug);
if (!g || g.gtVariants.length < 2){ box.hidden = true; box.innerHTML = ''; return; }
box.hidden = false;
box.innerHTML = `<div class="gt-regions-title">${escapeHtml(d.gt_regions_title)}</div><div class="gt-regions-row">${g.gtVariants.map(v =>
`<button type="button" class="gt-genre${v.slug === slug ? ' active' : ''}" data-gt-region="${escapeHtml(v.slug)}">${escapeHtml(v.region || d.gt_region_main)}</button>`).join('')}</div>`;
const act = box.querySelector('.active');
if (act && act.scrollIntoView) act.scrollIntoView({ block: 'nearest', inline: 'center' });
}

// ---------- избранное ----------
// Хранится в Telegram CloudStorage (общий для всех устройств пользователя),
// копия — в localStorage, чтобы показать сразу и работать вне Telegram.
let gtFavs = [];
function gtFavKey(c){ return (c && (c.gtKey || c.slug)) || ''; }
function gtIsFav(key){ return !!key && gtFavs.includes(key); }
function gtCloud(){ try { return (tg && tg.CloudStorage && tg.CloudStorage.getItem) ? tg.CloudStorage : null; } catch (e){ return null; } }

function gtLoadFavs(){
try { gtFavs = JSON.parse(localStorage.getItem('gt_favs') || '[]') || []; } catch (e){ gtFavs = []; }
const cs = gtCloud();
if (!cs) return;
try {
cs.getItem('gt_favs', (err, v) => {
if (err || !v) return;
try { gtFavs = JSON.parse(v) || []; } catch (e){ return; }
try { localStorage.setItem('gt_favs', JSON.stringify(gtFavs)); } catch (e){}
renderTopupStrip();
if (gtItems.length && !(document.getElementById('gtSearch').value || '').trim()) renderTopupCatalog(gtItems);
});
} catch (e){}
}

function gtToggleFav(key){
if (!key) return;
gtFavs = gtIsFav(key) ? gtFavs.filter(k => k !== key) : [key].concat(gtFavs).slice(0, 50);
const raw = JSON.stringify(gtFavs);
try { localStorage.setItem('gt_favs', raw); } catch (e){}
const cs = gtCloud();
if (cs){ try { cs.setItem('gt_favs', raw); } catch (e){} }
renderTopupStrip();
const btn = document.getElementById('gtFavBtn');
if (btn) gtPaintFavBtn(btn, key);
}

function gtPaintFavBtn(btn, key){
const d = gtDict();
const on = gtIsFav(key);
btn.classList.toggle('on', on);
btn.setAttribute('aria-pressed', on ? 'true' : 'false');
btn.setAttribute('aria-label', on ? d.gt_fav_remove : d.gt_fav_add);
btn.textContent = on ? '★' : '☆';
}

// ---------- карточки пакетов ----------
// «1860 + 335 Diamonds» → крупно «1860 + 335», под ним «Diamonds»;
// картинок у пакетов нет — рисуем свою иконку: кристаллы, пропуск, звезда, монеты.
function gtParseOffer(name){
let n = String(name || '').trim();
let bonus = false;
n = n.replace(/\s*\((first|1st)[^)]*\)/i, () => { bonus = true; return ''; }).trim();
const m = /^(\d[\d.,]*(?:\s*[+x×]\s*\d[\d.,]*)?)\s+(.+)$/i.exec(n);
if (!m) return { big: n, unit: '', bonus: bonus, num: 0, total: 0 };
const nums = m[1].split(/[+x×]/).map(x => parseFloat(x.replace(/[,\s]/g, '')) || 0);
// «1860 + 335» — 2195 единиц; «2 x 50» — множитель.
const total = /[x×]/.test(m[1]) ? nums.reduce((a, b) => a * b, 1) : nums.reduce((a, b) => a + b, 0);
return { big: m[1].replace(/\s*\+\s*/g, ' + '), unit: m[2], bonus: bonus, num: nums[0], total: total };
}

// Валюта пакета по названию — своя иконка для каждой (рисуем сами, не арт игр).
function gtCurrencyKind(p){
const u = (p.unit + ' ' + p.big).toLowerCase();
const t = gtCurrent && gtCurrent.category && gtCurrent.category.type;
if (/\bstars?\b/.test(u)) return 'star';
if (/\buc\b/.test(u)) return 'uc';
if (/\bvp\b|valorant point|riot point|\brp\b|wild core/.test(u)) return 'vp';
if (/\bcp\b|cod point/.test(u)) return 'cp';
if (/bundle|chest|crate|\bbox\b|newbie|starter/.test(u)) return 'chest';
if (/pass|pack|card|month|week|member|subscri|premium|elite|vip|battle|access|welkin|blessing|level up|gift/.test(u)) return 'ticket';
if (/crystal|primogem|genesis|lunite|astrite|oneiric|jade|shard|quartz|orb\b|stellar/.test(u)) return 'crystal';
if (/diamond|\bgems?\b/.test(u)) return 'diamond';
if (t === 'steam' || /usd|eur|\$|wallet|\bidr\b|\brub\b|\btry\b|\bmyr\b|\bphp\b|\bthb\b/.test(u)) return 'wallet';
if (/coin|gold|token|shell|candy|ticket|cash|point|credit|bean|ruby|chip|money|silver/.test(u)) return 'coin';
return p.total ? 'diamond' : 'ticket';
}
const GT_CURRENCY_KINDS = ['diamond', 'crystal', 'uc', 'vp', 'cp', 'coin', 'star', 'wallet'];

const GT_GEM = '<path d="M6 0h12l6 7-12 15L0 7z" fill="#38bdf8"/><path d="M0 7h24L12 22z" fill="#0369a1"/><path d="M6 0l3 7h6l3-7z" fill="#e0f2fe"/><path d="M9 7l3 15 3-15z" fill="#0ea5e9"/>';
const GT_SHARD = '<path d="M8 0l8 10-8 22-8-22z" fill="#c084fc"/><path d="M8 0l8 10H0z" fill="#f3e8ff"/><path d="M8 32L0 10h8z" fill="#7e22ce"/><path d="M8 32l8-22H8z" fill="#a855f7"/>';
const GT_GEM_LAYOUT = [
[[20, 13, 1]],
[[8, 18, .85], [28, 12, 1.05]],
[[2, 22, .8], [20, 8, 1.1], [40, 22, .8]],
[[0, 25, .75], [14, 9, .95], [32, 14, 1.1], [46, 27, .7]],
];
const GT_SHARD_LAYOUT = [
[[24, 10, 1.25]],
[[14, 16, 1], [32, 8, 1.3]],
[[6, 18, .95], [24, 4, 1.4], [44, 18, .95]],
[[2, 22, .85], [16, 8, 1.15], [34, 4, 1.4], [50, 22, .8]],
];
const GT_SPARK = '<path d="M54 6l1.5 3.5L59 11l-3.5 1.5L54 16l-1.5-3.5L49 11l3.5-1.5z" fill="#fef9c3"/>';
// Монета с буквами валюты: [заливка, обод, текст].
const GT_COIN_STYLE = { uc: ['#fbbf24', '#b45309', '#78350f', 'UC'], vp: ['#fb7185', '#be123c', '#fff', 'VP'], cp: ['#fdba74', '#c2410c', '#431407', 'CP'], coin: ['#fde047', '#ca8a04', '#713f12', '¤'] };

function gtTier(n){ return n >= 1500 ? 3 : n >= 300 ? 2 : n >= 60 ? 1 : 0; }

function gtCoinSvg(kind, tier){
const [fill, rim, ink, label] = GT_COIN_STYLE[kind];
const spots = [[[32, 26]], [[24, 30], [38, 22]], [[18, 32], [32, 20], [46, 32]], [[14, 34], [26, 24], [40, 33], [47, 19]]][tier];
return spots.map(([x, y], i) => {
const front = i === spots.length - 1;
return `<g transform="translate(${x} ${y})"><circle r="15" fill="${rim}"/><circle r="12.5" fill="${fill}"/><circle r="10" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.5"/>`
+ (front ? `<text y="4.5" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="${label.length > 1 ? 11 : 14}" fill="${ink}">${label}</text>` : '') + '</g>';
}).join('');
}

function gtOfferIcon(p, kind){
const tier = gtTier(p.total);
let body;
if (kind === 'star'){
body = '<path d="M32 4l7.6 15.4 17 2.5-12.3 12 2.9 16.9L32 42.8 16.8 50.8l2.9-16.9-12.3-12 17-2.5z" fill="#fbbf24" stroke="#f59e0b" stroke-width="2" stroke-linejoin="round"/><path d="M32 12l4 9 9 1.3" fill="none" stroke="#fef3c7" stroke-width="2.5" stroke-linecap="round"/>';
} else if (kind === 'ticket'){
body = '<rect x="6" y="9" width="52" height="30" rx="7" fill="#7c3aed" transform="rotate(-8 32 24)"/><rect x="10" y="13" width="44" height="22" rx="5" fill="#a78bfa" transform="rotate(-8 32 24)"/><g transform="translate(20 13)">' + GT_GEM + '</g>';
} else if (kind === 'chest'){
body = '<rect x="10" y="22" width="44" height="24" rx="4" fill="#92400e"/><path d="M10 26q0-16 22-16t22 16z" fill="#b45309"/><rect x="10" y="24" width="44" height="5" fill="#fbbf24"/><rect x="28" y="22" width="8" height="12" rx="2" fill="#fde68a"/><g transform="translate(14 4) scale(.6)">' + GT_GEM + '</g><g transform="translate(36 6) scale(.55)">' + GT_GEM + '</g>';
} else if (kind === 'wallet'){
body = '<ellipse cx="32" cy="38" rx="20" ry="7" fill="#b45309"/><rect x="12" y="24" width="40" height="14" fill="#d97706"/><ellipse cx="32" cy="24" rx="20" ry="7" fill="#fbbf24"/><ellipse cx="32" cy="24" rx="12" ry="3.5" fill="none" stroke="#fef3c7" stroke-width="2"/>';
} else if (GT_COIN_STYLE[kind]){
body = gtCoinSvg(kind, tier);
} else if (kind === 'crystal'){
body = GT_SHARD_LAYOUT[tier].map(([x, y, sc]) => `<g transform="translate(${x} ${y}) scale(${sc * .85})">${GT_SHARD}</g>`).join('') + (tier >= 2 ? GT_SPARK : '');
} else {
body = GT_GEM_LAYOUT[tier].map(([x, y, sc]) => `<g transform="translate(${x} ${y}) scale(${sc})">${GT_GEM}</g>`).join('') + (tier >= 2 ? GT_SPARK : '');
}
return `<svg class="gt-offer-icon" viewBox="0 0 64 52" aria-hidden="true">${body}</svg>`;
}

function gtOfferHtml(o, p, kind, best, inSection){
const d = gtDict();
return `<button type="button" class="gt-offer" data-gt-offer="${escapeHtml(o.id)}" ${o.in_stock ? '' : 'disabled'}>
${p.bonus && !inSection ? `<span class="gt-offer-badge">${escapeHtml(d.gt_first_bonus)}</span>` : ''}
${best ? `<span class="gt-offer-best">${escapeHtml(d.gt_best_value)}</span>` : ''}
<span class="gt-offer-check" aria-hidden="true">✓</span>
${gtOfferIcon(p, kind)}
<span class="gt-offer-big${p.unit ? '' : ' is-text'}">${escapeHtml(p.big)}</span>
${p.unit ? `<span class="gt-offer-unit">${escapeHtml(p.unit)}</span>` : ''}
<span class="gt-offer-price">${o.in_stock ? formatCoins(o.price_uzs) : escapeHtml(d.gt_out_of_stock)}</span></button>`;
}

// Пакеты разделами: бонус 1-го пополнения · валюта · пропуски и наборы.
// «Выгодно» — самая низкая цена за единицу среди обычных пакетов одной валюты.
function gtOffersHtml(offers){
const d = gtDict();
const rows = offers.map(o => { const p = gtParseOffer(o.name); return { o: o, p: p, kind: gtCurrencyKind(p) }; });
const isCurrency = r => r.p.total > 0 && GT_CURRENCY_KINDS.includes(r.kind);
const groups = [
['bonus', d.gt_offers_bonus, rows.filter(r => r.p.bonus)],
['currency', d.gt_offers_currency, rows.filter(r => !r.p.bonus && isCurrency(r))],
['packs', d.gt_offers_packs, rows.filter(r => !r.p.bonus && !isCurrency(r))],
].filter(g => g[2].length);
const best = new Set();
const byUnit = {};
for (const r of rows){
if (r.p.bonus || !isCurrency(r) || !r.o.in_stock || !r.o.price_uzs) continue;
(byUnit[r.p.unit.toLowerCase()] = byUnit[r.p.unit.toLowerCase()] || []).push(r);
}
for (const list of Object.values(byUnit)){
if (list.length < 3) continue;
const top = list.reduce((a, b) => (b.o.price_uzs / b.p.total < a.o.price_uzs / a.p.total ? b : a));
// Не метим, если выгода копеечная (< 3% к среднему).
const avg = list.reduce((s, r) => s + r.o.price_uzs / r.p.total, 0) / list.length;
if (top.o.price_uzs / top.p.total < avg * 0.97) best.add(top.o.id);
}
const showTitles = groups.length > 1;
return groups.map(([id, title, list]) =>
(showTitles ? `<div class="gt-offers-title">${escapeHtml(title)}</div>` : '')
+ list.map(r => gtOfferHtml(r.o, r.p, r.kind, best.has(r.o.id), showTitles)).join('')).join('');
}

function loadTopupCatalog(){
const params = new URLSearchParams();
const q = (document.getElementById('gtSearch').value || '').trim();
if (q) params.set('q', q);
return fetch(API_BASE + '/api/game_topup/catalog?' + params.toString())
.then(r => r.json())
.then(data => {
gtEnabled = !!data.enabled;
gtTypes = data.types || [];
const items = gtGroupItems(data.items || []);
if (!q){
gtItems = items;
gtRetry = 0;
try { localStorage.setItem('gt_catalog', JSON.stringify({ at: Date.now(), enabled: gtEnabled, types: gtTypes, items: data.items || [] })); } catch (e){}
}
renderTopupStrip();
renderTopupCatalog(items);
})
.catch(() => {
// Бот перезапускается (выкатка) или сеть моргнула — не прячем раздел
// до следующего запуска, а пробуем ещё: 3 с, 10 с, 30 с, 1 мин.
if (!q && gtRetry < 4){
setTimeout(loadTopupCatalog, [3000, 10000, 30000, 60000][gtRetry]);
gtRetry++;
}
if (gtItems.length && !q) renderTopupCatalog(gtItems); else renderTopupCatalog(null);
});
}

let gtRetry = 0;

// Последний каталог из памяти телефона — полоса на «Маркете» видна сразу,
// даже если бот отвечает медленно; свежий подменит его через миг.
function gtRestoreCachedCatalog(){
try {
const c = JSON.parse(localStorage.getItem('gt_catalog') || 'null');
if (!c || !c.enabled || !Array.isArray(c.items) || Date.now() - c.at > 3 * 86400 * 1000) return;
gtEnabled = true;
gtTypes = c.types || [];
gtItems = gtGroupItems(c.items);
renderTopupStrip();
} catch (e){}
}

function renderTopupStrip(){
const strip = document.getElementById('gtStrip');
strip.hidden = !gtEnabled || !gtItems.length;
if (strip.hidden) return;
const favFirst = gtItems.filter(c => gtIsFav(gtFavKey(c))).concat(gtItems.filter(c => !gtIsFav(gtFavKey(c))));
document.getElementById('gtStripRow').innerHTML = favFirst.slice(0, 8).map(c => gtTileHtml(c, true)).join('')
+ `<button type="button" class="gt-chip-tile gt-chip-more" data-gt-open-all aria-label="${escapeHtml(gtDict().gt_all)}">→</button>`;
}

function gtServiceSubtitle(c){
const d = gtDict();
const slug = String(c.slug || '');
if (/stars/.test(slug)) return d.gt_sub_stars;
if (/premium/.test(slug)) return d.gt_sub_premium;
if (c.type === 'steam') return d.gt_sub_steam;
if (c.type === 'giftcard') return d.gt_sub_giftcard;
return d.gt_sub_service;
}

function gtServiceCardHtml(c){
const d = gtDict();
const from = c.from_uzs ? `<span class="gt-svc-price">${escapeHtml(d.gt_from.replace('{price}', formatCoins(c.from_uzs)))}</span>` : '';
const theme = gtTheme(c);
const glow = theme ? ` style="--gt-glow:${theme.accent}"` : '';
return `<button type="button" class="gt-svc" data-gt-slug="${escapeHtml(c.slug)}"${glow}>
<span class="gt-svc-icon">${gtCoverHtml(c, 'gt-svc-img')}</span>
<span class="gt-svc-name">${escapeHtml(c.type === 'steam' && /wallet/i.test(c.name || '') ? 'Steam' : c.name)}</span>
<span class="gt-svc-sub">${escapeHtml(gtServiceSubtitle(c))}</span>
<span class="gt-svc-foot">${from}<span class="gt-svc-time">⏱ ${escapeHtml(d.gt_time)}</span></span>
</button>`;
}

function renderTopupCatalog(items){
const d = gtDict();
const grid = document.getElementById('gtGrid');
if (!gtEnabled){
grid.innerHTML = `<div class="skins-empty skins-empty-md">${d.gt_disabled}</div>`;
document.getElementById('gtTypeChips').innerHTML = '';
return;
}
document.getElementById('gtTypeChips').innerHTML = [['', d.gt_type_all], ['services', d.gt_tab_services], ['games', d.gt_tab_games]].map(([t, label]) =>
`<button type="button" class="${t === gtType ? 'active' : ''}" data-gt-type="${t}">${escapeHtml(label)}</button>`).join('');
if (items === null){
grid.innerHTML = `<div class="skins-empty skins-empty-md">${d.gt_load_failed}</div>`;
return;
}
const services = gtType === 'games' ? [] : items.filter(gtIsService);
const allGames = gtType === 'services' ? [] : items.filter(c => !gtIsService(c));
const genreBox = document.getElementById('gtGenreChips');
const present = GT_GENRE_ORDER.map(id => ({ id })).filter(g => allGames.some(c => gtGenreOf(c, g.id)));
if (gtGenre && !present.some(g => g.id === gtGenre)) gtGenre = '';
genreBox.hidden = gtType === 'services' || present.length < 2;
genreBox.innerHTML = [['', d.gt_genre_all]].concat(present.map(g => [g.id, d['gt_genre_' + g.id]])).map(([id, label]) =>
`<button type="button" class="gt-genre${id === gtGenre ? ' active' : ''}" data-gt-genre="${id}">${escapeHtml(label)}</button>`).join('');
let html = '';
const favs = gtType || gtGenre ? [] : items.filter(c => gtIsFav(gtFavKey(c)));
if (favs.length){
html += `<div class="gt-section-title">${escapeHtml(d.gt_favorites)} <span class="gt-section-count">${favs.length}</span></div><div class="gt-games-grid">${favs.map(c => gtTileHtml(c, false)).join('')}</div>`;
}
if (services.length && !gtGenre){
html += `<div class="gt-section-title">${escapeHtml(d.gt_section_services)}</div><div class="gt-svc-grid">${services.map(gtServiceCardHtml).join('')}</div>`;
}
const gameGrid = (title, list) => list.length ? `<div class="gt-section-title">${escapeHtml(title)} <span class="gt-section-count">${list.length}</span></div><div class="gt-games-grid">${list.map(c => gtTileHtml(c, false)).join('')}</div>` : '';
if (gtGenre){
html += gameGrid(d['gt_genre_' + gtGenre], allGames.filter(c => gtGenreOf(c, gtGenre)));
} else if (present.length < 2){
html += gameGrid(d.gt_section_games, allGames);
} else {
// Каждая игра — в одном разделе: популярные сверху, остальные по жанру.
for (const g of present){
html += gameGrid(d['gt_genre_' + g.id], allGames.filter(c => gtPrimaryGenre(c) === g.id));
}
}
grid.innerHTML = html || `<div class="skins-empty skins-empty-md">${d.gt_nothing_found}</div>`;
}

function showTopupView(detail){
const wasDetail = !document.getElementById('gtDetailView').hidden;
document.getElementById('gtCatalogView').hidden = detail;
document.getElementById('gtDetailView').hidden = !detail;
// Страница игры выезжает справа, возврат к каталогу — слева.
if (wasDetail !== detail && typeof dgReplay === 'function') dgReplay(document.getElementById(detail ? 'gtDetailView' : 'gtCatalogView'), detail ? 'dg-in-right' : 'dg-in-left');
window.scrollTo(0, 0);
}

function loadTopupScreen(){
showTopupView(false);
loadTopupCatalog();
}

function openTopupCategory(slug){
const d = gtDict();
goToScreen('topup');
showTopupView(true);
gtCurrent = null;
gtOffer = null;
document.getElementById('gtDetailHead').innerHTML = `<div class="skins-empty skins-empty-md">${d.loading}</div>`;
document.getElementById('gtOffers').innerHTML = '';
if (!gtGroupBySlug.has(slug) || document.getElementById('gtDetailView').hidden) document.getElementById('gtRegions').hidden = true;
document.getElementById('gtFields').innerHTML = '';
document.getElementById('gtStatus').textContent = '';
document.getElementById('gtPayBox').hidden = true;
document.getElementById('gtCardBox').hidden = true;
fetch(API_BASE + '/api/game_topup/category/' + encodeURIComponent(slug))
.then(r => r.ok ? r.json() : Promise.reject(r.status))
.then(data => {
gtCurrent = data;
const c = data.category || {};
const known = gtItems.find(x => x.slug === slug) || {};
const group = gtGroupBySlug.get(slug);
const name = group && group.gtVariants.length > 1 ? group.gtBase : (c.name || known.name || slug);
const favKey = group ? group.gtKey : slug;
const image = c.image || known.image;
const cover = { slug: slug, name: name, image: image, type: c.type || known.type };
document.getElementById('gtDetailHead').innerHTML = `
${image ? `<img class="gt-head-bg" src="${escapeHtml(image)}" alt="">` : ''}
<button type="button" class="gt-fav-btn" id="gtFavBtn" data-gt-fav="${escapeHtml(favKey)}"></button>
<div class="gt-head-inner">${gtCoverHtml(cover, 'gt-head-img')}
<div><div class="gt-head-name">${escapeHtml(name)}</div><div class="gt-head-badges"><span class="gt-pill">⚡ ${escapeHtml(d.gt_fast)}</span><span class="gt-pill">🛡 ${escapeHtml(d.gt_refund_badge)}</span></div></div></div>`;
gtPaintFavBtn(document.getElementById('gtFavBtn'), favKey);
renderTopupRegions(slug);
const accent = c.color || (group && group.color) || known.color || (gtTheme(cover) || {}).accent || '';
const offersBox = document.getElementById('gtOffers');
if (accent) offersBox.style.setProperty('--gt-accent', accent); else offersBox.style.removeProperty('--gt-accent');
offersBox.innerHTML = gtOffersHtml(data.offers || [])
|| `<div class="skins-empty skins-empty-md">${d.gt_nothing_found}</div>`;
renderTopupFields((data.fields || []));
})
.catch(() => {
document.getElementById('gtDetailHead').innerHTML = `<div class="skins-empty skins-empty-md">${d.gt_load_failed}</div>`;
});
}

// «Себе / Другому» для Telegram (@username) и Steam (логин): «себе»
// сохраняется на сервере и подставляется в следующий раз, можно отвязать.
let gtRecip = null;
let gtRecipMode = 'self';

function gtRecipientKind(fields){
const t = gtCurrent && gtCurrent.category && gtCurrent.category.type;
return fields.length === 1 && (t === 'telegram' || t === 'steam') ? t : null;
}

function loadTopupRecipients(){
if (!tg || !tg.initData) return Promise.resolve(null);
if (gtRecip) return Promise.resolve(gtRecip);
return fetch(API_BASE + '/api/game_topup/recipients?init_data=' + encodeURIComponent(tg.initData))
.then(r => r.ok ? r.json() : null)
.then(data => { gtRecip = data; return data; })
.catch(() => null);
}

function renderTopupFields(fields){
const d = gtDict();
const kind = gtRecipientKind(fields);
const fieldHtml = fields.map(f => `
<div class="edit-field" id="gtFieldWrap">
<label>${escapeHtml(f.label)}${f.required ? ' *' : ''}</label>
<div class="gt-field-row">
<input type="text" data-gt-field="${escapeHtml(f.key)}" placeholder="${escapeHtml(f.placeholder || '')}" autocomplete="off" autocapitalize="off" spellcheck="false">
</div>
</div>`).join('');
const recipHtml = kind ? `
<div class="shop-tabs gt-recip-seg" data-gt-kind="${kind}">
<button type="button" data-gt-recip="self">${escapeHtml(d.gt_recip_self)}</button>
<button type="button" data-gt-recip="other">${escapeHtml(d.gt_recip_other)}</button>
</div>
<div id="gtRecipSaved" class="gt-recip-saved" hidden></div>` : '';
document.getElementById('gtFields').innerHTML = recipHtml + fieldHtml
+ (kind ? `<button type="button" class="steam-link-btn gt-recip-save" id="gtRecipSaveBtn" hidden></button>` : '')
+ (fields.length ? `<button type="button" class="steam-link-btn secondary gt-check-btn" id="gtCheckBtn">${d.gt_check}</button><div class="shop-hint" id="gtCheckResult"></div>` : '')
+ `<div class="gt-warn">⚠️ ${d.gt_warn}</div>`;
if (kind){
gtRecipMode = 'self';
loadTopupRecipients().then(() => renderTopupRecipient());
}
}

function renderTopupRecipient(){
const d = gtDict();
const seg = document.querySelector('#gtFields .gt-recip-seg');
if (!seg) return;
const kind = seg.dataset.gtKind;
const input = document.querySelector('#gtFields [data-gt-field]');
const wrap = document.getElementById('gtFieldWrap');
const savedBox = document.getElementById('gtRecipSaved');
const saveBtn = document.getElementById('gtRecipSaveBtn');
seg.querySelectorAll('[data-gt-recip]').forEach(b => b.classList.toggle('active', b.dataset.gtRecip === gtRecipMode));
const saved = gtRecip && gtRecip.recipients && gtRecip.recipients[kind];
if (gtRecipMode === 'other' || !gtRecip){
// Другому (или гость без входа) — обычное поле, сохранённое не трогаем.
savedBox.hidden = true;
saveBtn.hidden = true;
wrap.hidden = false;
if (gtRecipMode === 'other') input.value = '';
return;
}
if (saved){
savedBox.hidden = false;
savedBox.innerHTML = `<span>✓ ${escapeHtml(saved)}</span><button type="button" class="gt-recip-unlink" id="gtRecipUnlinkBtn">${escapeHtml(d.gt_recip_unlink)}</button>`;
input.value = saved;
wrap.hidden = true;
saveBtn.hidden = true;
return;
}
// Себе, ещё не сохранено: Telegram — подставляем свой @username.
savedBox.hidden = true;
wrap.hidden = false;
if (kind === 'telegram' && gtRecip.tg_username && !input.value) input.value = '@' + gtRecip.tg_username;
saveBtn.hidden = false;
saveBtn.textContent = kind === 'telegram' && gtRecip.tg_username ? d.gt_recip_confirm : d.gt_recip_save;
}

function saveTopupRecipient(value){
const d = gtDict();
const seg = document.querySelector('#gtFields .gt-recip-seg');
if (!seg || !tg || !tg.initData) return;
fetch(API_BASE + '/api/game_topup/recipients', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData, kind: seg.dataset.gtKind, value: value }),
})
.then(r => r.json().then(data => ({ ok: r.ok, data })))
.then(({ ok, data }) => {
if (!ok){ showToast(d.gt_recip_bad); return; }
gtRecip.recipients = data.recipients || {};
if (value === null) document.querySelector('#gtFields [data-gt-field]').value = '';
renderTopupRecipient();
showToast(value === null ? d.gt_recip_unlinked : d.gt_recip_saved);
})
.catch(() => showToast(d.gt_err_generic));
}

function gtCollectFields(){
const out = {};
document.querySelectorAll('#gtFields [data-gt-field]').forEach(i => { out[i.dataset.gtField] = i.value.trim(); });
return out;
}

function gtSelectOffer(id){
resetTopupPromo();
gtOffer = ((gtCurrent && gtCurrent.offers) || []).find(o => o.id === id) || null;
document.querySelectorAll('#gtOffers [data-gt-offer]').forEach(b => b.classList.toggle('active', b.dataset.gtOffer === id));
updateTopupPayBox();
}

// ---------- промокод ----------
let gtPromo = null;

function gtPrice(){ return gtPromo ? gtPromo.price_uzs : (gtOffer ? gtOffer.price_uzs : 0); }

function resetTopupPromo(){
gtPromo = null;
const input = document.getElementById('gtPromoInput');
if (input) input.value = '';
const res = document.getElementById('gtPromoResult');
if (res){ res.textContent = ''; res.className = 'gt-promo-result'; }
}

function applyTopupPromo(){
const d = gtDict();
const code = document.getElementById('gtPromoInput').value.trim().toUpperCase();
const res = document.getElementById('gtPromoResult');
if (!code || !gtOffer || !gtCurrent) return;
if (!tg || !tg.initData){ res.textContent = d.gt_err_unauthorized; return; }
res.className = 'gt-promo-result';
res.textContent = d.gt_checking;
fetch(API_BASE + '/api/game_topup/promo', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData, code: code, slug: gtCurrent.category.slug, offer_id: gtOffer.id }),
})
.then(r => r.json().then(data => ({ ok: r.ok, data })))
.then(({ ok, data }) => {
if (!ok){ gtPromo = null; res.className = 'gt-promo-result bad'; res.textContent = d['gt_' + data.error] || d.gt_err_generic; updateTopupPayBox(); return; }
gtPromo = data;
res.className = 'gt-promo-result ok';
res.innerHTML = `🎟 ${escapeHtml(data.code)}: <s>${escapeHtml(formatCoins(data.old_price_uzs))}</s> <b>${escapeHtml(formatCoins(data.price_uzs))}</b> (−${escapeHtml(formatCoins(data.discount_uzs))})`;
updateTopupPayBox();
})
.catch(() => { res.textContent = d.gt_err_generic; });
}

let gtMissing = 0;

// Баланса не хватает на пакет — открываем «Пополнить баланс» с суммой недостачи.
function gtOpenBalanceTopup(){
const openTopup = document.getElementById('openTopupBtn');
if (!openTopup) return;
openTopup.click();
const amount = document.getElementById('tAmount');
if (amount) amount.value = String(gtMissing);
if (typeof setTopupAcc === 'function' && !document.querySelector('#topupAcc [data-acc="card"]').hidden){
topupAccChosen = true;
setTopupAcc('card');
}
showToast(gtDict().gt_need_topup.replace('{missing}', formatCoins(gtMissing)));
}

function updateTopupPayBox(){
const d = gtDict();
const box = document.getElementById('gtPayBox');
box.hidden = !gtOffer;
if (!gtOffer) return Promise.resolve();
const payBtn = document.getElementById('gtPayBtn');
payBtn.textContent = d.gt_pay.replace('{price}', formatCoins(gtPrice()));
const balEl = document.getElementById('gtBalance');
const topupBtn = document.getElementById('gtTopupBtn');
if (!tg || !tg.initData){
balEl.textContent = '';
topupBtn.hidden = true;
return Promise.resolve();
}
return fetch(API_BASE + '/api/me?init_data=' + encodeURIComponent(tg.initData))
.then(r => r.json())
.then(me => {
const available = Number(me.available) || 0;
const missing = gtOffer ? gtPrice() - available : 0;
balEl.textContent = d.gt_balance.replace('{balance}', formatCoins(available));
balEl.classList.toggle('cart-short', missing > 0);
const openTopup = document.getElementById('openTopupBtn');
// Одна кнопка «Купить»: денег не хватает — она ведёт к пополнению
// баланса (сумма недостачи уже вписана), а не к отдельной оплате картой.
gtMissing = openTopup && openTopup.style.display !== 'none' ? Math.max(missing, 0) : 0;
topupBtn.hidden = true;
document.getElementById('gtCardBtn').hidden = true;
payBtn.hidden = false;
payBtn.disabled = false;
// Денег не хватает — кнопка мягко «зовёт»: нажатие ведёт к пополнению.
payBtn.classList.toggle('dg-attn', gtMissing > 0 && typeof dgMotionCalm === 'function' && !dgMotionCalm());
})
.catch(() => {});
}

// ---------- оплата картой ----------
let gtCardOrderId = null;
let gtCardPhoto = null;

function startTopupCardPayment(){
const d = gtDict();
if (gtBusy || !gtCurrent || !gtOffer || !tg || !tg.initData) return;
const status = document.getElementById('gtStatus');
gtBusy = true;
status.textContent = d.gt_paying;
fetch(API_BASE + '/api/game_topup/order', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData, slug: gtCurrent.category.slug, offer_id: gtOffer.id, fields: gtCollectFields(), pay: 'card', promo: gtPromo ? gtPromo.code : null }),
})
.then(r => r.json().then(data => ({ ok: r.ok, data })))
.then(({ ok, data }) => {
if (!ok){ status.textContent = gtErrorText(data.error); return; }
status.textContent = '';
gtCardOrderId = data.order.id;
gtCardPhoto = null;
document.getElementById('gtPayBox').hidden = true;
const box = document.getElementById('gtCardBox');
box.hidden = false;
document.getElementById('gtCardAmount').textContent = formatCoins(data.order.price_uzs);
document.getElementById('gtCardDetails').textContent = (data.card_details || '') + '  📋';
document.getElementById('gtCardDetails').dataset.copy = data.card_details || '';
document.getElementById('gtCardHint').textContent = d.gt_card_hint.replace('{hours}', data.expires_hours || 2);
document.getElementById('gtCardFileLabel').textContent = d.gt_card_attach;
document.getElementById('gtCardStatus').textContent = '';
box.scrollIntoView({ behavior: 'smooth', block: 'start' });
})
.catch(() => { status.textContent = d.gt_err_generic; })
.finally(() => { gtBusy = false; });
}

function gtCompressImage(file){
return new Promise((resolve, reject) => {
const img = new Image();
const url = URL.createObjectURL(file);
img.onload = () => {
const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
const c = document.createElement('canvas');
c.width = Math.round(img.width * scale);
c.height = Math.round(img.height * scale);
c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
URL.revokeObjectURL(url);
resolve(c.toDataURL('image/jpeg', 0.85));
};
img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
img.src = url;
});
}

function sendTopupCardReceipt(){
const d = gtDict();
const status = document.getElementById('gtCardStatus');
const payer = document.getElementById('gtCardPayer').value.trim();
if (payer.split(/\s+/).length < 2){ status.textContent = d.gt_card_need_payer; return; }
if (!gtCardPhoto){ status.textContent = d.gt_card_need_photo; return; }
if (gtBusy) return;
gtBusy = true;
status.textContent = d.gt_card_sending;
fetch(API_BASE + '/api/game_topup/orders/' + gtCardOrderId + '/receipt', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData, payer_name: payer, photo_base64: gtCardPhoto }),
})
.then(r => r.json().then(data => ({ ok: r.ok, data })))
.then(({ ok, data }) => {
if (!ok){ status.textContent = d['gt_card_err_' + data.error] || d.gt_err_generic; return; }
status.textContent = d.gt_card_sent;
setTimeout(() => openTopupOrders(), 1500);
})
.catch(() => { status.textContent = d.gt_err_generic; })
.finally(() => { gtBusy = false; });
}

function gtErrorText(code){
const d = gtDict();
return d['gt_err_' + code] || d.gt_err_generic;
}

function payTopup(){
const d = gtDict();
if (gtBusy || !gtCurrent || !gtOffer) return;
if (!tg || !tg.initData){ showToast(d.gt_err_unauthorized); return; }
if (gtMissing > 0){ gtOpenBalanceTopup(); return; }
const fields = gtCollectFields();
const status = document.getElementById('gtStatus');
gtBusy = true;
document.getElementById('gtPayBtn').disabled = true;
status.textContent = d.gt_paying;
fetch(API_BASE + '/api/game_topup/order', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData, slug: gtCurrent.category.slug, offer_id: gtOffer.id, fields: fields, promo: gtPromo ? gtPromo.code : null }),
})
.then(r => r.json().then(data => ({ ok: r.ok, data })))
.then(({ ok, data }) => {
if (!ok){
// Баланс успел измениться — сразу ведём к пополнению на недостачу.
if (data.error === 'insufficient_balance'){
status.textContent = '';
updateTopupPayBox().then(() => { if (gtMissing > 0) gtOpenBalanceTopup(); });
return;
}
status.textContent = gtErrorText(data.error);
if (typeof dgShake === 'function') dgShake(document.getElementById('gtPayBtn'));
updateTopupPayBox();
return;
}
const o = data.order || {};
status.textContent = o.status === 'refunded' ? d.gt_refunded : (o.status === 'completed' ? d.gt_done : d.gt_accepted);
if (o.status !== 'refunded' && typeof dgSuccess === 'function') dgSuccess(o.status === 'completed' ? d.gt_done : d.gt_accepted);
if (o.status !== 'refunded') setTimeout(() => openTopupOrders(), 1200);
})
.catch(() => { status.textContent = d.gt_err_generic; updateTopupPayBox(); })
.finally(() => { gtBusy = false; });
}

function checkTopupId(){
const d = gtDict();
const out = document.getElementById('gtCheckResult');
if (!gtCurrent || !tg || !tg.initData) return;
out.textContent = d.gt_checking;
fetch(API_BASE + '/api/game_topup/validate', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData, slug: gtCurrent.category.slug, fields: gtCollectFields() }),
})
.then(r => r.json())
.then(data => {
if (data.supported === false){ out.textContent = d.gt_check_unsupported; return; }
if (data.error === 'rate_limited'){ out.textContent = d.gt_err_rate_limited; return; }
out.textContent = data.valid ? d.gt_check_ok.replace('{name}', data.name || '—') : d.gt_check_bad;
})
.catch(() => { out.textContent = d.gt_check_unsupported; });
}

// Поля «куда зачислить» стоят над пакетами (index.html).

// ---------- заказы во вкладке «Сделки» ----------

function setDealsSeg(seg){
document.querySelectorAll('#dealsSeg [data-deals-seg]').forEach(b => b.classList.toggle('active', b.dataset.dealsSeg === seg));
document.getElementById('dealsSkinsPane').hidden = seg !== 'skins';
document.getElementById('gtOrdersList').hidden = seg !== 'topup';
// Список сменяется с лёгким сдвигом, карточки — по очереди.
if (typeof dgReplay === 'function') dgReplay(document.getElementById(seg === 'topup' ? 'gtOrdersList' : 'dealsSkinsPane'), 'dg-in-up');
if (typeof dgArm === 'function'){ dgArm('dealsList'); dgArm('gtOrdersList'); }
if (seg === 'topup') loadTopupOrders();
}

function openTopupOrders(){
goToScreen('deals');
setDealsSeg('topup');
}

function gtStatusBadge(s){
const d = gtDict();
const cls = s === 'completed' ? 'ok' : (['refunded', 'rejected', 'expired'].includes(s) ? 'bad' : 'wait');
return `<span class="gt-badge gt-badge-${cls}">${escapeHtml(d['gt_status_' + s] || d.gt_status_processing)}</span>`;
}

function loadTopupOrders(){
const d = gtDict();
const list = document.getElementById('gtOrdersList');
if (!tg || !tg.initData){ list.innerHTML = ''; return; }
list.innerHTML = `<div class="skins-empty skins-empty-md">${d.loading}</div>`;
fetch(API_BASE + '/api/game_topup/orders?init_data=' + encodeURIComponent(tg.initData))
.then(r => r.json())
.then(data => {
const items = data.items || [];
list.innerHTML = items.length ? items.map(o => `
<div class="gt-order">
<div class="gt-order-top"><span class="gt-order-name">${escapeHtml(o.category)} — ${escapeHtml(o.offer)}</span>${gtStatusBadge(o.status)}</div>
<div class="gt-order-meta">${formatCoins(o.price_uzs)} · ${escapeHtml(new Date(o.created_at).toLocaleString())}</div>
${(o.codes || []).map(c => `<button type="button" class="gt-code" data-gt-copy="${escapeHtml(c)}">${escapeHtml(c)} 📋</button>`).join('')}
</div>`).join('') : `<div class="skins-empty skins-empty-md">${d.gt_orders_empty}</div>`;
})
.catch(() => { list.innerHTML = `<div class="skins-empty skins-empty-md">${d.gt_load_failed}</div>`; });
}

// ---------- события ----------

document.addEventListener('click', (e) => {
const favBtn = e.target.closest('[data-gt-fav]');
if (favBtn){ gtToggleFav(favBtn.dataset.gtFav); return; }
const region = e.target.closest('[data-gt-region]');
if (region){ if (!region.classList.contains('active')) openTopupCategory(region.dataset.gtRegion); return; }
const tile = e.target.closest('[data-gt-slug]');
if (tile){ openTopupCategory(tile.dataset.gtSlug); return; }
// Любое место полосы в «Маркете», кроме плитки игры, — весь каталог.
if (e.target.closest('[data-gt-open-all]') || e.target.closest('#gtStrip')){ gtType = ''; gtGenre = ''; goToScreen('topup'); return; }
const type = e.target.closest('[data-gt-type]');
const genre = e.target.closest('[data-gt-genre]');
if (genre){ gtGenre = genre.dataset.gtGenre; renderTopupCatalog(gtItems); return; }
if (type){ gtType = type.dataset.gtType; gtGenre = ''; if ((document.getElementById('gtSearch').value || '').trim()) loadTopupCatalog(); else renderTopupCatalog(gtItems); return; }
const offer = e.target.closest('[data-gt-offer]');
if (offer){ gtSelectOffer(offer.dataset.gtOffer); return; }
if (e.target.closest('#gtCheckBtn')){ checkTopupId(); return; }
const recip = e.target.closest('[data-gt-recip]');
if (recip){ gtRecipMode = recip.dataset.gtRecip; renderTopupRecipient(); return; }
if (e.target.closest('#gtRecipSaveBtn')){
const v = (document.querySelector('#gtFields [data-gt-field]') || {}).value || '';
if (v.trim()) saveTopupRecipient(v.trim());
return;
}
if (e.target.closest('#gtRecipUnlinkBtn')){ saveTopupRecipient(null); return; }
const seg = e.target.closest('#dealsSeg [data-deals-seg]');
if (seg){ setDealsSeg(seg.dataset.dealsSeg); return; }
const copy = e.target.closest('[data-gt-copy]');
if (copy && navigator.clipboard){
navigator.clipboard.writeText(copy.dataset.gtCopy).then(() => showToast(gtDict().gt_copied)).catch(() => {});
}
});

document.getElementById('gtPayBtn').addEventListener('click', payTopup);
document.getElementById('gtCardBtn').addEventListener('click', startTopupCardPayment);
document.getElementById('gtPromoBtn').addEventListener('click', applyTopupPromo);
document.getElementById('gtCardSendBtn').addEventListener('click', sendTopupCardReceipt);
document.getElementById('gtCardDetails').addEventListener('click', (e) => {
const text = e.currentTarget.dataset.copy || '';
if (text && navigator.clipboard) navigator.clipboard.writeText(text.replace(/[^\d]/g, '').length >= 16 ? (text.match(/\d[\d ]{14,}\d/) || [text])[0].replace(/\s/g, '') : text).then(() => showToast(gtDict().gt_copied)).catch(() => {});
});
document.getElementById('gtCardFile').addEventListener('change', (e) => {
const file = e.target.files && e.target.files[0];
if (!file) return;
gtCompressImage(file).then(data => {
gtCardPhoto = data;
document.getElementById('gtCardFileLabel').textContent = '✅ ' + gtDict().gt_card_attached;
}).catch(() => showToast(gtDict().gt_err_generic));
});
document.getElementById('gtTopupBtn').addEventListener('click', () => document.getElementById('openTopupBtn').click());
document.getElementById('gtBackBtn').addEventListener('click', () => {
if (!document.getElementById('gtDetailView').hidden) showTopupView(false);
else goToScreen('shop');
});
let gtSearchTimer = null;
document.getElementById('gtSearch').addEventListener('input', () => {
clearTimeout(gtSearchTimer);
gtSearchTimer = setTimeout(loadTopupCatalog, 350);
});

// Плитки на главной: узнаём, включён ли раздел, сразу при запуске.
gtLoadFavs();
gtRestoreCachedCatalog();
loadTopupCatalog();
// Вернулись в приложение, а каталога так и нет — пробуем снова.
document.addEventListener('visibilitychange', () => {
if (document.visibilityState === 'visible' && !gtItems.length) loadTopupCatalog();
});
document.getElementById('gtStrip').addEventListener('keydown', (e) => {
if ((e.key === 'Enter' || e.key === ' ') && e.target.id === 'gtStrip'){ e.preventDefault(); gtType = ''; gtGenre = ''; goToScreen('topup'); }
});

