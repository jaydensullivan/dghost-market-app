// ============================================================
// ПК-ВЕРСИЯ МАРКЕТА (экран от 1280px)
//
// Телефон и мини-апп в Telegram не меняются: всё ниже включается
// классом html.dg-desk, когда окно шире DESK_MIN_WIDTH, и выключается
// обратно при сужении. Стили — app-desktop.css.
//
//   шапка: логотип, разделы, поиск (пишет в обычный #skinSearch);
//   «Выгода дня» на всю ширину: скин в 3D (embed.html, режим витрины),
//     свет цвета редкости идёт за курсором;
//   полоса доверия: гарант, 24 часа, 0% покупателю, оплата в сумах;
//   слева — категории (те же кнопки #categoryChips) и фильтры: цена,
//     износ, редкость, StatTrak, наклейки (тот же activeFilters);
//   справа — «Только что выставили» из каталога и «Продать скин»;
//   карточки наклоняются к курсору, блик идёт за мышью.
//
// Ничего не выдумываем: в ленте — настоящие лоты, в полосе доверия —
// правила площадки.
// ============================================================

(function(){
const DESK_MIN_WIDTH = 1280;
const mq = window.matchMedia('(min-width: ' + DESK_MIN_WIDTH + 'px)');
const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
const shop = document.getElementById('screenShop');
if (!shop) return;

const RARITY_COLOR = {
'rarity-consumer': '#b0c3d9', 'rarity-industrial': '#5e98d9', 'rarity-milspec': '#4b69ff',
'rarity-restricted': '#8847ff', 'rarity-classified': '#d32ce6', 'rarity-covert': '#eb4b4b',
'rarity-contraband': '#e4ae39', 'rarity-extraordinary': '#e4ae39',
};
// Редкость в фильтре: какие значения skin.rarity к ней относятся.
const RARITY_GROUPS = [
['covert', '#eb4b4b', ['Covert', 'Master', 'Extraordinary', 'Contraband']],
['classified', '#d32ce6', ['Classified', 'Superior']],
['restricted', '#8847ff', ['Restricted', 'Exceptional', 'Remarkable']],
['milspec', '#4b69ff', ['Mil-Spec Grade', 'Distinguished', 'High Grade']],
['industrial', '#5e98d9', ['Industrial Grade']],
['consumer', '#b0c3d9', ['Consumer Grade', 'Base Grade', 'Stock']],
];
// Износ → диапазон float (границы CS2).
const WEAR_RANGE = { FN: [0, 0.07], MW: [0.07, 0.15], FT: [0.15, 0.38], WW: [0.38, 0.45], BS: [0.45, 1] };

const dict = () => I18N[currentLang] || I18N.ru;
const esc = s => (typeof escapeHtml === 'function' ? escapeHtml(String(s == null ? '' : s)) : String(s == null ? '' : s));
const icon = (paths) => `<svg class="dt-i" viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
const ICON = {
search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L22 7H6"/>',
cube: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/>',
shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
zero: '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
};

// ---------- разметка ----------

const top = document.createElement('header');
top.className = 'dt-top';
top.innerHTML = `
<button type="button" class="dt-logo" data-dt-go="shop" aria-label="DGhostMarket"><img src="logo-120.webp" alt="" width="44" height="44"></button>
<nav class="dt-nav">
<button type="button" data-dt-go="shop" data-i18n="nav_market">Маркет</button>
<button type="button" data-dt-go="deals" data-i18n="nav_deals">Сделки</button>
<button type="button" data-dt-go="lots" data-i18n="nav_sell">Продать</button>
<button type="button" data-dt-go="timer" data-i18n="nav_giveaway">Раздача</button>
</nav>
<label class="dt-search">${icon(ICON.search)}<input id="dtSearch" type="search" autocomplete="off" data-i18n-placeholder="dt_search_ph" placeholder=""><span class="dt-kbd" aria-hidden="true">/</span></label>
<button type="button" class="dt-sell" data-dt-sell data-i18n="header_menu_sell">Продать скин</button>`;

const hero = document.createElement('section');
hero.className = 'dt-hero';
hero.id = 'dtHero';
hero.hidden = true;

const trust = document.createElement('div');
trust.className = 'dt-trust';
trust.innerHTML = [['shield', 1], ['clock', 2], ['zero', 3], ['card', 4]].map(([ic, n]) =>
`<div>${icon(ICON[ic])}<span><b data-i18n="dt_trust_${n}_t"></b><span data-i18n="dt_trust_${n}_s"></span></span></div>`).join('');

const side = document.createElement('aside');
side.className = 'dt-side';
side.innerHTML = `
<div class="dt-sh" data-i18n="dt_side_cats">Категории</div>
<div class="dt-cats-slot"></div>
<div class="dt-sh" data-i18n="dt_side_price">Цена</div>
<div class="dt-range"><label><span data-i18n="dt_from">от</span><input id="dtPriceMin" type="number" inputmode="numeric" min="0" placeholder="0"></label><label><span data-i18n="dt_to">до</span><input id="dtPriceMax" type="number" inputmode="numeric" min="0" placeholder="∞"></label></div>
<div class="dt-sh" data-i18n="dt_side_wear">Износ</div>
<div class="dt-wear">${Object.keys(WEAR_RANGE).map(w => `<button type="button" data-dt-wear="${w}" aria-pressed="false">${w}</button>`).join('')}</div>
<div class="dt-sh" data-i18n="dt_side_rarity">Редкость</div>
<div class="dt-rar">${RARITY_GROUPS.map(([k, c]) => `<label class="dt-chk"><input type="checkbox" data-dt-rar="${k}"><span class="dt-dot" style="--c:${c}"></span><span data-i18n="dt_rar_${k}"></span></label>`).join('')}</div>
<label class="dt-tog"><span data-i18n="dt_stattrak">StatTrak</span><input type="checkbox" id="dtStattrak"><i></i></label>
<label class="dt-tog"><span data-i18n="dt_stickers">Наклейки</span><input type="checkbox" id="dtStickers"><i></i></label>
<button type="button" class="dt-reset" id="dtReset" data-i18n="dt_reset" hidden>Сбросить</button>`;

const sortWrap = document.createElement('label');
sortWrap.className = 'dt-sortwrap';
sortWrap.innerHTML = '<span data-i18n="dt_sort"></span><select id="dtSort"></select>';

const rail = document.createElement('aside');
rail.className = 'dt-rail';
rail.innerHTML = `
<h3><span class="dt-ldot" aria-hidden="true"></span><span data-i18n="dt_fresh">Только что выставили</span></h3>
<div class="dt-fresh" id="dtFresh"></div>
<button type="button" class="dt-all" data-dt-fresh-all data-i18n="dt_fresh_all">Все новинки</button>
<div class="dt-cta"><b data-i18n="dt_sell_t"></b><p data-i18n="dt_sell_s"></p><button type="button" data-dt-sell data-i18n="header_menu_sell">Продать скин</button></div>`;

// Средняя колонка: вкладки + сортировка, под ними сетка карточек.
const body = document.createElement('div');
body.className = 'dt-body';
const main = document.createElement('div');
main.className = 'dt-main';
const toolbar = document.createElement('div');
toolbar.className = 'dt-toolbar';
main.appendChild(toolbar);
body.append(side, main, rail);

const searchInput = top.querySelector('#dtSearch');
const skinSearchEl = document.getElementById('skinSearch');
const chips = document.getElementById('categoryChips');
const chipsHome = document.createComment('categoryChips');
const tabs = document.getElementById('shopTabs');
const grid = document.getElementById('skinsList');
const tabsHome = document.createComment('shopTabs');
const gridHome = document.createComment('skinsList');

// ---------- включение / выключение ----------

let on = false;
function enable(){
if (on) return;
on = true;
document.documentElement.classList.add('dg-desk');
document.body.prepend(top);
shop.prepend(trust);
shop.prepend(hero);
// Вкладки и сетку переносим в колонку (обработчики остаются на них же);
// на их прежних местах — метки, чтобы вернуть при сужении окна.
tabs.before(tabsHome);
grid.before(gridHome);
toolbar.append(tabs, sortWrap);
main.appendChild(grid);
shop.appendChild(body);
// Категории — те же кнопки (обработчики app-catalog.js), просто в колонке.
if (chips && !chipsHome.parentNode){ chips.before(chipsHome); side.querySelector('.dt-cats-slot').appendChild(chips); }
fillSort();
syncFromState();
if (typeof applyTranslations === 'function') applyTranslations();
renderHero();
renderFresh();
highlightNav();
}
function disable(){
if (!on) return;
on = false;
document.documentElement.classList.remove('dg-desk');
if (tabsHome.parentNode) tabsHome.replaceWith(tabs);
if (gridHome.parentNode) gridHome.replaceWith(grid);
[top, hero, trust, body].forEach(el => el.remove());
shop.classList.remove('dt-has-hero');
grid.querySelectorAll('.skin-card').forEach(resetTilt);
if (chips && chipsHome.parentNode){ chipsHome.replaceWith(chips); }
stopHero3d();
}
function sync(){ if (mq.matches) enable(); else disable(); }
if (mq.addEventListener) mq.addEventListener('change', sync); else mq.addListener(sync);

// ---------- шапка ----------

const SCREEN_FOR_TAB = { shop: 'shop', deals: 'deals', lots: 'lots', timer: 'timer' };
top.addEventListener('click', (e) => {
const go = e.target.closest('[data-dt-go]');
if (go){ goToScreen(go.dataset.dtGo); window.scrollTo({ top: 0, behavior: 'smooth' }); }
});
document.addEventListener('click', (e) => {
if (!on || !e.target.closest('[data-dt-sell]')) return;
goToScreen('lots');
setTimeout(() => { const b = document.getElementById('addSkinBtn'); if (b) b.click(); }, 150);
});
function highlightNav(){
const tab = document.body.dataset.tab || 'shop';
top.querySelectorAll('.dt-nav [data-dt-go]').forEach(b => b.classList.toggle('on', SCREEN_FOR_TAB[b.dataset.dtGo] === tab));
}
new MutationObserver(highlightNav).observe(document.body, { attributes: true, attributeFilter: ['data-tab'] });

// Поиск в шапке пишет в обычное поле каталога — фильтрует app-catalog.js.
searchInput.addEventListener('input', () => {
if (!skinSearchEl) return;
if ((document.body.dataset.tab || 'shop') !== 'shop') goToScreen('shop');
skinSearchEl.value = searchInput.value;
skinSearchEl.dispatchEvent(new Event('input', { bubbles: true }));
});
document.addEventListener('keydown', (e) => {
if (!on || e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
const t = e.target;
if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
e.preventDefault();
searchInput.focus();
});

// ---------- фильтры слева ----------

const st = { wear: new Set(), rar: new Set() };

function applyNow(){
if (typeof applyFiltersAndRender === 'function') applyFiltersAndRender();
if (typeof updateFiltersBadge === 'function') updateFiltersBadge();
updateReset();
}

function numOrNull(v){ const n = Number(String(v).replace(/\s/g, '')); return v === '' || !isFinite(n) ? null : n; }

side.addEventListener('input', (e) => {
if (e.target.id === 'dtPriceMin') activeFilters.priceMin = numOrNull(e.target.value);
else if (e.target.id === 'dtPriceMax') activeFilters.priceMax = numOrNull(e.target.value);
else return;
applyNow();
});
side.addEventListener('change', (e) => {
const t = e.target;
if (t.dataset.dtRar){
if (t.checked) st.rar.add(t.dataset.dtRar); else st.rar.delete(t.dataset.dtRar);
const names = [];
RARITY_GROUPS.forEach(([k, , list]) => { if (st.rar.has(k)) names.push(...list); });
activeFilters.rarities = names.length ? names : null;
} else if (t.id === 'dtStattrak'){
activeFilters.stattrak = t.checked ? true : null;
} else if (t.id === 'dtStickers'){
activeFilters.stickers = t.checked ? 'yes' : 'any';
} else return;
applyNow();
});
side.addEventListener('click', (e) => {
const w = e.target.closest('[data-dt-wear]');
if (w){
const k = w.dataset.dtWear;
if (st.wear.has(k)) st.wear.delete(k); else st.wear.add(k);
w.setAttribute('aria-pressed', String(st.wear.has(k)));
// Несколько износов — общий диапазон float от меньшего к большему.
const ranges = [...st.wear].map(x => WEAR_RANGE[x]);
activeFilters.floatMin = ranges.length ? Math.min(...ranges.map(r => r[0])) : null;
activeFilters.floatMax = ranges.length ? Math.max(...ranges.map(r => r[1])) : null;
applyNow();
return;
}
if (e.target.closest('#dtReset')){
activeFilters.priceMin = activeFilters.priceMax = activeFilters.floatMin = activeFilters.floatMax = null;
activeFilters.stickers = 'any';
activeFilters.rarities = null;
activeFilters.stattrak = null;
st.wear.clear(); st.rar.clear();
syncFromState();
applyNow();
}
});

// Фильтры могли поменять в обычном окне «Фильтры» — показываем то же.
function syncFromState(){
side.querySelector('#dtPriceMin').value = activeFilters.priceMin ?? '';
side.querySelector('#dtPriceMax').value = activeFilters.priceMax ?? '';
side.querySelector('#dtStattrak').checked = !!activeFilters.stattrak;
side.querySelector('#dtStickers').checked = activeFilters.stickers === 'yes';
if (activeFilters.floatMin === null && activeFilters.floatMax === null) st.wear.clear();
side.querySelectorAll('[data-dt-wear]').forEach(b => b.setAttribute('aria-pressed', String(st.wear.has(b.dataset.dtWear))));
if (!activeFilters.rarities) st.rar.clear();
side.querySelectorAll('[data-dt-rar]').forEach(c => { c.checked = st.rar.has(c.dataset.dtRar); });
updateReset();
}
function updateReset(){
const any = activeFilters.priceMin !== null || activeFilters.priceMax !== null || activeFilters.floatMin !== null
|| activeFilters.floatMax !== null || activeFilters.stickers !== 'any' || !!activeFilters.rarities || !!activeFilters.stattrak;
side.querySelector('#dtReset').hidden = !any;
}

// Сортировка — копия обычного списка #skinSort (те же значения и подписи).
function fillSort(){
const src = document.getElementById('skinSort');
const sel = sortWrap.querySelector('select');
if (!src) return;
sel.innerHTML = [...src.options].map(o => `<option value="${esc(o.value)}"${o.value === src.value ? ' selected' : ''}>${esc(o.textContent)}</option>`).join('');
}
sortWrap.querySelector('select').addEventListener('change', (e) => {
const src = document.getElementById('skinSort');
if (!src) return;
src.value = e.target.value;
src.dispatchEvent(new Event('change', { bubbles: true }));
});

// ---------- «Выгода дня» ----------

let heroKey = '';
let heroFrame = null;
function heroSkin(){
return typeof promoDealSkin === 'function' ? promoDealSkin() : null;
}
function splitTitle(skin){
const t = String(skin.title || '').replace(/^★\s*/, '').replace(/^StatTrak™\s*/, '');
const wt = skin.weapon_type || '';
if (wt && t.startsWith(wt + ' | ')) return [wt, t.slice(wt.length + 3)];
const i = t.indexOf(' | ');
return i > 0 ? [t.slice(0, i), t.slice(i + 3)] : ['', t];
}
function renderHero(){
if (!on) return;
const deal = heroSkin();
const key = deal ? deal.skin.id + ':' + deal.skin.price + ':' + currentLang : '';
if (key === heroKey) return;
heroKey = key;
stopHero3d();
hero.hidden = !deal;
shop.classList.toggle('dt-has-hero', !!deal);
if (!deal) return;
const d = dict();
const s = deal.skin;
const market = Number(s.market_price_uzs || s.market_price) || 0;
const [weapon, name] = splitTitle(s);
const color = RARITY_COLOR[(typeof RARITY_CLASS !== 'undefined' && RARITY_CLASS[s.rarity]) || ''] || '#a855f7';
const wear = s.wear && typeof WEAR_LABELS !== 'undefined' ? (WEAR_LABELS[s.wear] || s.wear) : '';
const fl = s.float_value !== null && s.float_value !== undefined ? Number(s.float_value).toFixed(4) : '';
hero.style.setProperty('--rc', color);
hero.innerHTML = `
<div class="dt-floor" aria-hidden="true"></div>
<div class="dt-htext">
<span class="dt-htag"><b>−${deal.pct}%</b>${esc(d.dt_hero_tag)}</span>
<div class="dt-hw">${esc(weapon)}</div>
<h1 class="dt-hn">${s.stattrak ? 'StatTrak™ ' : ''}${esc(name)}</h1>
<div class="dt-hmeta">${wear ? `<span>${esc(wear)}</span>` : ''}${fl ? `<span>float <b>${fl}</b></span>` : ''}${s.pattern ? `<span>${esc(d.dt_pattern)} <b>${esc(s.pattern)}</b></span>` : ''}</div>
<div class="dt-hprice"><span>${esc(formatCoins(s.price))}</span>${market ? `<s>${esc(formatCoins(market))}</s>` : ''}</div>
<div class="dt-hbtn"><button type="button" class="dt-bp" data-dt-hero="buy">${icon(ICON.cart)}<span>${esc(d.btn_buy)}</span></button><button type="button" class="dt-bs" data-dt-hero="buy">${icon(ICON.cube)}<span>${esc(d.dt_hero_3d)}</span></button></div>
</div>
<div class="dt-stage"><img src="${esc(typeof steamImg === 'function' ? steamImg(s.photo_url, 512, 384) : s.photo_url)}" alt=""></div>`;
hero._skin = s;
startHero3d(s);
}
hero.addEventListener('click', (e) => {
if (e.target.closest('[data-dt-hero]') && hero._skin) openBuySheet(hero._skin);
});

// 3D в «Выгоде дня» — тот же виджет, что продаём сайтам (embed.html,
// режим витрины: прозрачный фон, без кнопок). Пока он грузится и если
// не загрузился — стоит обычная картинка лота.
// Без WebGL 3D не нарисуется — остаётся картинка лота.
let webglOk = null;
function hasWebgl(){
if (webglOk === null){
try { const c = document.createElement('canvas'); webglOk = !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { webglOk = false; }
}
return webglOk;
}
function startHero3d(s){
if (reduce.matches || (navigator.connection && navigator.connection.saveData) || !hasWebgl()) return;
const stage = hero.querySelector('.dt-stage');
const q = new URLSearchParams({ key: 'demo', skin: s.title || '', float: s.float_value ?? '', seed: s.pattern ?? '', lang: currentLang, hero: '1' });
if (s.paint_index) q.set('paint', s.paint_index);
heroFrame = document.createElement('iframe');
heroFrame.title = '3D';
heroFrame.setAttribute('aria-hidden', 'true');
heroFrame.tabIndex = -1;
heroFrame.src = 'embed.html?' + q.toString();
stage.appendChild(heroFrame);
}
function stopHero3d(){
if (heroFrame){ heroFrame.remove(); heroFrame = null; }
}
window.addEventListener('message', (e) => {
if (!heroFrame || e.source !== heroFrame.contentWindow || !e.data || e.data.source !== 'dghost3d') return;
if (e.data.event === 'ready') hero.classList.add('dt-live');
});
// Свет за курсором, 3D-скин поворачивается мышью.
hero.addEventListener('pointermove', (e) => {
if (reduce.matches) return;
const r = hero.getBoundingClientRect();
const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
hero.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
hero.style.setProperty('--my', (y * 100).toFixed(1) + '%');
if (heroFrame && heroFrame.contentWindow) heroFrame.contentWindow.postMessage({ source: 'dghost-site', type: 'hero', p: x }, location.origin);
});

// ---------- «Только что выставили» ----------

function agoText(iso){
const t = Date.parse(iso || '');
if (!t) return '';
const m = Math.max(1, Math.round((Date.now() - t) / 60000));
const d = dict();
if (m < 60) return d.dt_ago_min.replace('{n}', m);
const h = Math.round(m / 60);
if (h < 24) return d.dt_ago_h.replace('{n}', h);
return d.dt_ago_d.replace('{n}', Math.round(h / 24));
}
function renderFresh(){
if (!on) return;
const box = rail.querySelector('#dtFresh');
const list = (typeof lastSkins !== 'undefined' ? lastSkins : [])
.filter(s => s.photo_url && !(currentUserId && s.seller_id === currentUserId))
.slice().sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')) || b.id - a.id)
.slice(0, 7);
if (!list.length){ box.innerHTML = `<div class="dt-empty">${esc(dict().dt_fresh_empty)}</div>`; return; }
box.innerHTML = list.map(s => {
const color = RARITY_COLOR[(typeof RARITY_CLASS !== 'undefined' && RARITY_CLASS[s.rarity]) || ''] || '#a855f7';
const img = typeof steamImg === 'function' ? steamImg(s.photo_url, 128, 96) : s.photo_url;
return `<button type="button" class="dt-fr" data-dt-open="${s.id}" style="--r:${color}"><img src="${esc(img)}" alt="" loading="lazy"><span><span class="dt-frn">${esc(s.title)}</span><span class="dt-frm"><b>${esc(formatCoins(s.price))}</b><span>${esc(agoText(s.created_at))}</span></span></span></button>`;
}).join('');
}
rail.addEventListener('click', (e) => {
const open = e.target.closest('[data-dt-open]');
if (open){
const skin = lastSkins.find(s => String(s.id) === open.dataset.dtOpen);
if (skin) openBuySheet(skin);
return;
}
if (e.target.closest('[data-dt-fresh-all]')){
const b = tabs.querySelector('[data-shop-tab="new"]');
if (b) b.click();
window.scrollTo({ top: (document.getElementById('shopTabs').getBoundingClientRect().top + window.scrollY) - 96, behavior: 'smooth' });
}
});

// Каталог обновился (сетка перерисована) — обновляем «Выгоду дня» и
// ленту. Следим за самой сеткой: каталог мог загрузиться раньше этого
// файла, и обёртка над renderSkins его бы пропустила.
let refreshTimer = null;
new MutationObserver(() => {
if (!on) return;
clearTimeout(refreshTimer);
refreshTimer = setTimeout(() => { renderHero(); renderFresh(); syncFromState(); }, 120);
}).observe(grid, { childList: true });

// Сменили язык — подписи, созданные скриптом, тоже.
if (typeof applyTranslations === 'function'){
const origT = applyTranslations;
applyTranslations = function(){
const out = origT.apply(this, arguments);
if (on){ heroKey = ''; renderHero(); renderFresh(); fillSort(); }
return out;
};
}

// ---------- карточки: наклон к курсору и блик ----------

let tiltCard = null;
grid.addEventListener('pointermove', (e) => {
if (!on || !fine.matches || reduce.matches) return;
const card = e.target.closest('.skin-card');
if (tiltCard && tiltCard !== card) resetTilt(tiltCard);
tiltCard = card;
if (!card) return;
const r = card.getBoundingClientRect();
const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
card.style.setProperty('--rx', ((x - 0.5) * 9).toFixed(2) + 'deg');
card.style.setProperty('--ry', ((0.5 - y) * 7).toFixed(2) + 'deg');
card.style.setProperty('--lx', (x * 100).toFixed(1) + '%');
card.style.setProperty('--ly', (y * 100).toFixed(1) + '%');
});
grid.addEventListener('pointerleave', () => { if (tiltCard) resetTilt(tiltCard); tiltCard = null; });
function resetTilt(card){ card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); }

sync();
})();
