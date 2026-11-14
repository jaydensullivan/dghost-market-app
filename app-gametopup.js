// ---------------- Пополнения игр, Steam и Telegram (Arcadezy) ----------------
// Плитки в «Маркете» → экран каталога → карточка игры (пакет, логин/ID,
// оплата с баланса) → заказы во вкладке «Сделки». Бот: game_topups.py.
// Раздел выключен в админке — плиток нет, экран пишет «недоступно».

let gtEnabled = false;
let gtItems = [];
let gtTypes = [];
let gtType = '';
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
return `<button type="button" class="gt-tile" data-gt-slug="${escapeHtml(c.slug)}">${gtCoverHtml(c, 'gt-tile-cover')}<span class="gt-tile-shade"></span><span class="gt-tile-body"><span class="gt-tile-name">${escapeHtml(c.name)}</span>${from}</span></button>`;
}

// Сервисы (Steam, Telegram, карты) — компактными карточками сверху,
// игры — большими обложками ниже. Переключатели: Все · Сервисы · Игры.
const GT_SERVICE_TYPES = ['steam', 'telegram', 'giftcard'];

function gtIsService(c){ return GT_SERVICE_TYPES.includes(c.type); }

function loadTopupCatalog(){
const params = new URLSearchParams();
const q = (document.getElementById('gtSearch').value || '').trim();
if (q) params.set('q', q);
return fetch(API_BASE + '/api/game_topup/catalog?' + params.toString())
.then(r => r.json())
.then(data => {
gtEnabled = !!data.enabled;
gtTypes = data.types || [];
if (!q) gtItems = data.items || [];
renderTopupStrip();
renderTopupCatalog(data.items || []);
})
.catch(() => renderTopupCatalog(null));
}

function renderTopupStrip(){
const strip = document.getElementById('gtStrip');
strip.hidden = !gtEnabled || !gtItems.length;
if (strip.hidden) return;
document.getElementById('gtStripRow').innerHTML = gtItems.slice(0, 8).map(c => gtTileHtml(c, true)).join('')
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
const games = gtType === 'services' ? [] : items.filter(c => !gtIsService(c));
let html = '';
if (services.length){
html += `<div class="gt-section-title">${escapeHtml(d.gt_section_services)}</div><div class="gt-svc-grid">${services.map(gtServiceCardHtml).join('')}</div>`;
}
if (games.length){
html += `<div class="gt-section-title">${escapeHtml(d.gt_section_games)}</div><div class="gt-games-grid">${games.map(c => gtTileHtml(c, false)).join('')}</div>`;
}
grid.innerHTML = html || `<div class="skins-empty skins-empty-md">${d.gt_nothing_found}</div>`;
}

function showTopupView(detail){
document.getElementById('gtCatalogView').hidden = detail;
document.getElementById('gtDetailView').hidden = !detail;
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
document.getElementById('gtFields').innerHTML = '';
document.getElementById('gtStatus').textContent = '';
document.getElementById('gtPayBox').hidden = true;
fetch(API_BASE + '/api/game_topup/category/' + encodeURIComponent(slug))
.then(r => r.ok ? r.json() : Promise.reject(r.status))
.then(data => {
gtCurrent = data;
const c = data.category || {};
const known = gtItems.find(x => x.slug === slug) || {};
const name = c.name || known.name || slug;
const image = c.image || known.image;
const cover = { slug: slug, name: name, image: image, type: c.type || known.type };
document.getElementById('gtDetailHead').innerHTML = `
${image ? `<img class="gt-head-bg" src="${escapeHtml(image)}" alt="">` : ''}
<div class="gt-head-inner">${gtCoverHtml(cover, 'gt-head-img')}
<div><div class="gt-head-name">${escapeHtml(name)}</div><div class="gt-head-badges"><span class="gt-pill">⚡ ${escapeHtml(d.gt_fast)}</span><span class="gt-pill">🛡 ${escapeHtml(d.gt_refund_badge)}</span></div></div></div>`;
document.getElementById('gtOffers').innerHTML = (data.offers || []).map(o =>
`<button type="button" class="gt-offer" data-gt-offer="${escapeHtml(o.id)}" ${o.in_stock ? '' : 'disabled'}>
<span class="gt-offer-check" aria-hidden="true">✓</span>
<span class="gt-offer-name">${escapeHtml(o.name)}</span>
<span class="gt-offer-price">${o.in_stock ? formatCoins(o.price_uzs) : escapeHtml(d.gt_out_of_stock)}</span></button>`).join('')
|| `<div class="skins-empty skins-empty-md">${d.gt_nothing_found}</div>`;
renderTopupFields((data.fields || []));
})
.catch(() => {
document.getElementById('gtDetailHead').innerHTML = `<div class="skins-empty skins-empty-md">${d.gt_load_failed}</div>`;
});
}

function renderTopupFields(fields){
const d = gtDict();
document.getElementById('gtFields').innerHTML = fields.map(f => `
<div class="edit-field">
<label>${escapeHtml(f.label)}${f.required ? ' *' : ''}</label>
<div class="gt-field-row">
<input type="text" data-gt-field="${escapeHtml(f.key)}" placeholder="${escapeHtml(f.placeholder || '')}" autocomplete="off" autocapitalize="off" spellcheck="false">
</div>
</div>`).join('')
+ (fields.length ? `<button type="button" class="steam-link-btn secondary gt-check-btn" id="gtCheckBtn">${d.gt_check}</button><div class="shop-hint" id="gtCheckResult"></div>` : '')
+ `<div class="gt-warn">⚠️ ${d.gt_warn}</div>`;
}

function gtCollectFields(){
const out = {};
document.querySelectorAll('#gtFields [data-gt-field]').forEach(i => { out[i.dataset.gtField] = i.value.trim(); });
return out;
}

function gtSelectOffer(id){
gtOffer = ((gtCurrent && gtCurrent.offers) || []).find(o => o.id === id) || null;
document.querySelectorAll('#gtOffers [data-gt-offer]').forEach(b => b.classList.toggle('active', b.dataset.gtOffer === id));
updateTopupPayBox();
}

function updateTopupPayBox(){
const d = gtDict();
const box = document.getElementById('gtPayBox');
box.hidden = !gtOffer;
if (!gtOffer) return;
const payBtn = document.getElementById('gtPayBtn');
payBtn.textContent = d.gt_pay.replace('{price}', formatCoins(gtOffer.price_uzs));
const balEl = document.getElementById('gtBalance');
const topupBtn = document.getElementById('gtTopupBtn');
if (!tg || !tg.initData){
balEl.textContent = '';
topupBtn.hidden = true;
return;
}
fetch(API_BASE + '/api/me?init_data=' + encodeURIComponent(tg.initData))
.then(r => r.json())
.then(me => {
const available = Number(me.available) || 0;
const missing = gtOffer ? gtOffer.price_uzs - available : 0;
balEl.textContent = d.gt_balance.replace('{balance}', formatCoins(available));
balEl.classList.toggle('cart-short', missing > 0);
const openTopup = document.getElementById('openTopupBtn');
topupBtn.hidden = !(missing > 0 && openTopup && openTopup.style.display !== 'none');
topupBtn.textContent = d.gt_topup_missing.replace('{missing}', formatCoins(Math.max(missing, 0)));
payBtn.disabled = missing > 0;
})
.catch(() => {});
}

function gtErrorText(code){
const d = gtDict();
return d['gt_err_' + code] || d.gt_err_generic;
}

function payTopup(){
const d = gtDict();
if (gtBusy || !gtCurrent || !gtOffer) return;
if (!tg || !tg.initData){ showToast(d.gt_err_unauthorized); return; }
const fields = gtCollectFields();
const status = document.getElementById('gtStatus');
gtBusy = true;
document.getElementById('gtPayBtn').disabled = true;
status.textContent = d.gt_paying;
fetch(API_BASE + '/api/game_topup/order', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData, slug: gtCurrent.category.slug, offer_id: gtOffer.id, fields: fields }),
})
.then(r => r.json().then(data => ({ ok: r.ok, data })))
.then(({ ok, data }) => {
if (!ok){
status.textContent = gtErrorText(data.error);
updateTopupPayBox();
return;
}
const o = data.order || {};
status.textContent = o.status === 'refunded' ? d.gt_refunded : (o.status === 'completed' ? d.gt_done : d.gt_accepted);
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
if (seg === 'topup') loadTopupOrders();
}

function openTopupOrders(){
goToScreen('deals');
setDealsSeg('topup');
}

function gtStatusBadge(s){
const d = gtDict();
const cls = s === 'completed' ? 'ok' : (s === 'refunded' ? 'bad' : 'wait');
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
const tile = e.target.closest('[data-gt-slug]');
if (tile){ openTopupCategory(tile.dataset.gtSlug); return; }
// Любое место полосы в «Маркете», кроме плитки игры, — весь каталог.
if (e.target.closest('[data-gt-open-all]') || e.target.closest('#gtStrip')){ gtType = ''; goToScreen('topup'); return; }
const type = e.target.closest('[data-gt-type]');
if (type){ gtType = type.dataset.gtType; if ((document.getElementById('gtSearch').value || '').trim()) loadTopupCatalog(); else renderTopupCatalog(gtItems); return; }
const offer = e.target.closest('[data-gt-offer]');
if (offer){ gtSelectOffer(offer.dataset.gtOffer); return; }
if (e.target.closest('#gtCheckBtn')){ checkTopupId(); return; }
const seg = e.target.closest('#dealsSeg [data-deals-seg]');
if (seg){ setDealsSeg(seg.dataset.dealsSeg); return; }
const copy = e.target.closest('[data-gt-copy]');
if (copy && navigator.clipboard){
navigator.clipboard.writeText(copy.dataset.gtCopy).then(() => showToast(gtDict().gt_copied)).catch(() => {});
}
});

document.getElementById('gtPayBtn').addEventListener('click', payTopup);
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
loadTopupCatalog();
document.getElementById('gtStrip').addEventListener('keydown', (e) => {
if ((e.key === 'Enter' || e.key === ' ') && e.target.id === 'gtStrip'){ e.preventDefault(); gtType = ''; goToScreen('topup'); }
});
