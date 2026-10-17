// ============================================================
// ПОДПИСКА PRO
//
// Бесплатно — «Поделиться» картинкой. С PRO — GIF и видео (3D-ролики
// лота) и публикация своего лота в канал маркета. Оплата — с баланса
// (/api/pro/buy). Карточка — в профиле; замки — в окне «Поделиться»
// (app-filters.js спрашивает isProActive / offerPro).
// ============================================================

let proStatus = null;

function isProActive(){
return !!(proStatus && proStatus.active);
}

function proDateText(iso){
if (!iso) return '';
const d = new Date(iso);
return d.toLocaleDateString(currentLang === 'en' ? 'en-GB' : 'ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Тарифы (как у API-сервисов): Free / Старт / PRO / Бизнес — отличаются
// лимитами; список, цены и лимиты присылает бот (/api/pro → tiers).
const PRO_TIER_IDS = ['start', 'pro', 'business', 'garant'];

function proTiers(){
return (proStatus && Array.isArray(proStatus.tiers)) ? proStatus.tiers : [];
}

function proTier(id){
return proTiers().find(t => t.id === id) || null;
}

function proTierName(id){
const dict = I18N[currentLang] || I18N.ru;
return dict['pro_tier_' + (id || 'free')] || id;
}

// Скидка на первый месяц (бот: first_discount, first_prices) — только
// при самой первой покупке подписки; продление — по полной цене.
const PRO_FIRST_T = {
ru: { badge: '−{p}% на первый месяц', note: '🎁 Первая подписка — скидка {p}% на первый месяц. Продление — по обычной цене.', confirm: ' Первый месяц со скидкой {p}% (обычная цена — {full}).' },
uz: { badge: 'Birinchi oyga −{p}%', note: "🎁 Birinchi obuna — birinchi oyga {p}% chegirma. Uzaytirish — oddiy narxda.", confirm: " Birinchi oy {p}% chegirma bilan (oddiy narx — {full})." },
en: { badge: '−{p}% first month', note: '🎁 First subscription — {p}% off the first month. Renewals at the regular price.', confirm: ' First month {p}% off (regular price — {full}).' },
};

function proFirstText(){
return PRO_FIRST_T[currentLang] || PRO_FIRST_T.ru;
}

function proFirstPercent(){
return (proStatus && proStatus.first_discount) || 0;
}

// Цена, которую человек заплатит сейчас (со скидкой первого месяца, если есть).
function proPayPrice(t){
const fp = proStatus && proStatus.first_prices;
return (proFirstPercent() && fp && fp[t.id] != null) ? fp[t.id] : t.price;
}

function proMinPrice(){
const prices = proTiers().map(proPayPrice);
return prices.length ? Math.min.apply(null, prices) : (proStatus ? proStatus.price : 0);
}

function renderProCard(){
const card = document.getElementById('profileProCard');
if (!card) return;
const dict = I18N[currentLang] || I18N.ru;
if (!proStatus){
card.style.display = 'none';
return;
}
card.style.display = '';
const badge = document.getElementById('proBadge');
const status = document.getElementById('proStatusText');
const btn = document.getElementById('proBuyBtn');
if (proStatus.admin){
// Админу покупать нечего, но окно тарифов он видит — как продавцы.
badge.textContent = dict.pro_badge_on;
status.textContent = dict.pro_status_admin;
btn.style.display = '';
btn.textContent = dict.pro_btn_view;
return;
}
btn.style.display = '';
if (proStatus.active){
badge.textContent = proTierName(proStatus.tier || 'pro');
status.textContent = dict.pro_status_until.replace('{name}', proTierName(proStatus.tier || 'pro')).replace('{date}', proDateText(proStatus.expires_at));
btn.textContent = dict.pro_btn_extend;
} else {
badge.textContent = '';
status.textContent = dict.pro_status_off.replace('{price}', formatCoins(proMinPrice())).replace('{days}', proStatus.days);
btn.textContent = dict.pro_btn_buy.replace('{price}', formatCoins(proMinPrice()));
}
}

function loadProStatus(){
if (!tg || !tg.initData) return Promise.resolve(null);
return fetch(API_BASE + '/api/pro?init_data=' + encodeURIComponent(tg.initData))
.then(r => r.ok ? r.json() : null)
.then(data => {
if (data && !data.error){
proStatus = data;
renderProCard();
if (proPlansOverlay && proPlansOverlay.classList.contains('show')) renderProPlans();
}
return proStatus;
})
.catch(() => null);
}

// ---------- Окно «Тарифы»: карточки + таблица сравнения ----------
const proPlansOverlay = document.getElementById('proPlansOverlay');

function openProPlans(){
if (!proPlansOverlay) return;
document.getElementById('proPlansStatus').textContent = '';
renderProPlans();
proPlansOverlay.classList.add('show');
// Свежие цены и срок — вдруг тариф сменили с другого устройства.
loadProStatus();
}

function closeProPlans(){
if (proPlansOverlay) proPlansOverlay.classList.remove('show');
}

function renderProPlans(){
if (!proStatus) return;
const dict = I18N[currentLang] || I18N.ru;
const days = proStatus.days;
const current = proStatus.active ? (proStatus.tier || 'pro') : 'free';
document.getElementById('proPlansHint').textContent = dict.pro_plans_hint.replace('{days}', days)
+ (proFirstPercent() ? ' ' + proFirstText().note.replace('{p}', proFirstPercent()) : '');
const cols = [{ id: 'free', price: 0, share_per_hour: proStatus.free_share_per_hour || 30, market_posts: 0, own_channels: 0, own_posts: 0, own_auctions: 0, own_raffles: 0 }]
.concat(PRO_TIER_IDS.map(proTier).filter(Boolean));

document.getElementById('proPlans').innerHTML = cols.map(t => {
const isCurrent = t.id === current;
const disc = t.id !== 'free' && proFirstPercent() && proPayPrice(t) < t.price;
const price = t.id === 'free' ? dict.pro_free_price : formatCoins(proPayPrice(t));
let action = '';
if (t.id !== 'free' && !proStatus.admin){
const label = isCurrent ? dict.pro_extend : (proStatus.active ? dict.pro_switch : dict.pro_pick);
action = `<button type="button" class="pf-btn pro-plan-btn" data-pro-tier="${t.id}">${escapeHtml(label)}</button>`;
// «Гарант» — сначала заявка: проверка продавца + одобрение админа.
const g = proStatus.garant || {};
if (t.approval && !isCurrent && g.status !== 'approved'){
if (g.status === 'pending'){
action = `<button type="button" class="pf-btn pro-plan-btn" disabled>${escapeHtml(dict.pro_garant_pending)}</button>`;
} else if (!g.verified_seller){
action = `<button type="button" class="pf-btn pro-plan-btn" disabled>${escapeHtml(dict.pro_garant_need_kyc)}</button>`;
} else {
action = `<button type="button" class="pf-btn pro-plan-btn" data-garant-apply="1">${escapeHtml(dict.pro_garant_apply)}</button>`;
}
}
}
const flag = isCurrent ? `<span class="pro-plan-flag current">${escapeHtml(dict.pro_current)}</span>`
: (t.popular ? `<span class="pro-plan-flag">${escapeHtml(dict.pro_popular)}</span>` : '');
return `<div class="pro-plan${t.popular ? ' popular' : ''}${isCurrent ? ' current' : ''}">
${flag}
<div class="pro-plan-name">${escapeHtml(proTierName(t.id))}</div>
<div class="pro-plan-price">${escapeHtml(price)}${disc ? ` <s style="opacity:.55;font-weight:600;font-size:13px;">${escapeHtml(formatCoins(t.price))}</s>` : ''}</div>
${disc ? `<div class="pro-plan-per" style="color:#7CF2A5;">${escapeHtml(proFirstText().badge.replace('{p}', proFirstPercent()))}</div>` : ''}
<div class="pro-plan-per">${t.id === 'free' ? '&nbsp;' : escapeHtml(dict.pro_per_days.replace('{days}', days))}</div>
<div class="pro-plan-tag">${escapeHtml(dict['pro_tag_' + t.id] || '')}</div>
${action}
</div>`;
}).join('');

const yes = '<span class="pro-yes">✓</span>';
const no = '<span class="pro-no">—</span>';
// null — без лимита (у «Гаранта» посты в канал маркета).
const num = v => (v === null ? '∞' : (v ? String(v) : no));
// Третий элемент — пояснение строки: открывается по ⓘ под самой строкой.
const rows = [
[dict.pro_cmp_buy, () => yes, dict.pro_help_buy],
[dict.pro_cmp_photo, () => yes, dict.pro_help_photo],
[dict.pro_cmp_3d, () => yes, dict.pro_help_3d],
[dict.pro_cmp_gif, t => (t.id === 'free' ? no : yes), dict.pro_help_gif],
[dict.pro_cmp_market, t => num(t.market_posts), dict.pro_help_market],
[dict.pro_cmp_channels, t => num(t.own_channels), dict.pro_help_channels],
[dict.pro_cmp_own_posts, t => num(t.own_posts), dict.pro_help_own_posts],
[dict.pro_cmp_auctions, t => num(t.own_auctions), dict.pro_help_auctions],
[dict.pro_cmp_raffles, t => num(t.own_raffles), dict.pro_help_raffles],
[dict.pro_cmp_share, t => String(t.share_per_hour), dict.pro_help_share],
[dict.pro_cmp_price.replace('{days}', days), t => (t.id === 'free' ? '0' : escapeHtml(formatCoins(t.price))), dict.pro_help_price],
];
document.getElementById('proCompare').innerHTML =
`<thead><tr><th></th>${cols.map(t => `<th class="${t.id === current ? 'current' : ''}">${escapeHtml(proTierName(t.id))}</th>`).join('')}</tr></thead>`
+ `<tbody>${rows.map(([label, cell, help], i) =>
`<tr${i === rows.length - 1 ? ' class="pro-cmp-total"' : ''}><td><button type="button" class="pro-cmp-label" data-pro-help="${i}" aria-expanded="false">${escapeHtml(label)} <span class="pro-cmp-i">ⓘ</span></button></td>${cols.map(t => `<td class="${t.id === current ? 'current' : ''}">${cell(t)}</td>`).join('')}</tr>`
+ `<tr class="pro-cmp-help" data-pro-help-row="${i}" hidden><td colspan="${cols.length + 1}">${escapeHtml(help || '')}</td></tr>`
).join('')}</tbody>`;
document.getElementById('proCompareHint').textContent = dict.pro_help_hint;
document.getElementById('proHowTitle').textContent = dict.pro_how_title;
document.getElementById('proHowText').textContent = dict.pro_how_text;
}

let proBuying = false;

function buyPro(tierId){
if (proBuying || !proStatus) return;
const dict = I18N[currentLang] || I18N.ru;
const tier = proTier(tierId || 'pro');
const price = formatCoins(tier ? proPayPrice(tier) : proStatus.price);
const name = proTierName(tierId || 'pro');
const days = proStatus.days;
let ask = dict.pro_confirm.replace('{name}', name).replace('{price}', price).replace('{days}', days);
const oldId = proStatus.tier || 'pro';
const oldTier = proTier(oldId);
if (proStatus.active && tier && oldId !== tier.id && proStatus.expires_at && oldTier){
// Тот же пересчёт, что делает бот: остаток × старая цена / новая цена.
const left = Math.max(0, new Date(proStatus.expires_at) - Date.now());
const conv = oldTier.price > 0 && tier.price > 0 ? left * oldTier.price / tier.price : left;
const until = new Date(Date.now() + conv + days * 86400000).toISOString();
ask = dict.pro_confirm_switch.replace('{name}', name).replace('{price}', price)
.replace('{old}', proTierName(oldId)).replace('{date}', proDateText(until));
}
if (tier && proFirstPercent() && proPayPrice(tier) < tier.price){
ask += proFirstText().confirm.replace('{p}', proFirstPercent()).replace('{full}', formatCoins(tier.price));
}
showConfirmDialog(ask, () => {
proBuying = true;
const plansStatus = document.getElementById('proPlansStatus');
fetch(API_BASE + '/api/pro/buy', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData, tier: tierId || 'pro' }),
})
.then(async r => {
const data = await r.json().catch(() => ({}));
if (!r.ok){
const msg = data.error === 'insufficient_funds'
? dict.pro_no_money.replace('{price}', price)
: errorMessage(data.error);
if (plansStatus) plansStatus.textContent = msg;
showAlert(msg);
return;
}
proStatus = data;
renderProCard();
renderProPlans();
renderProChannels();
loadProChannels();
if (typeof loadMe === 'function') loadMe();
showAlert(dict.pro_ok.replace('{name}', name).replace('{date}', proDateText(data.expires_at)));
})
.catch(() => showAlert(errorMessage('network')))
.finally(() => { proBuying = false; });
});
}

if (proPlansOverlay){
document.getElementById('proPlans').addEventListener('click', (e) => {
if (e.target.closest('[data-garant-apply]')){
applyGarant();
return;
}
const btn = e.target.closest('[data-pro-tier]');
if (btn) buyPro(btn.dataset.proTier);
});
document.getElementById('proPlansCloseBtn').addEventListener('click', closeProPlans);
proPlansOverlay.addEventListener('click', (e) => { if (e.target === proPlansOverlay) closeProPlans(); });
document.getElementById('proCompare').addEventListener('click', (e) => {
const btn = e.target.closest('[data-pro-help]');
if (!btn) return;
const row = document.querySelector(`[data-pro-help-row="${btn.dataset.proHelp}"]`);
if (!row) return;
row.hidden = !row.hidden;
btn.setAttribute('aria-expanded', String(!row.hidden));
});
}

// Окно подтверждения: нативное в Telegram, своё — в браузере (app-web.js).
function showConfirmDialog(message, onOk){
showConfirm(message, onOk);
}

// Предложение PRO из окна «Поделиться» (замок на GIF / видео / канале).
function offerPro(statusEl, buttonEl){
const dict = I18N[currentLang] || I18N.ru;
const price = proStatus ? formatCoins(proMinPrice()) : '';
if (statusEl) statusEl.textContent = dict.pro_locked.replace('{price}', price);
if (buttonEl) buttonEl.style.display = '';
}

document.getElementById('proBuyBtn').addEventListener('click', openProPlans);

// ------------------------------------------------------------
// PRO: СВОИ КАНАЛЫ ПРОДАВЦА
//
// В карточке PRO — список подключённых каналов и поле «@канал».
// Бот должен быть админом канала (сервер это проверяет). В окне
// «Поделиться» своего лота — кнопка «📢 В <канал>» на каждый канал.
// ------------------------------------------------------------

let proChannels = [];
let proBotUsername = 'dghostmarketbot';
let proChannelMax = 5;

function proOwnChannel(id){
return proChannels.find(c => c.id === id) || null;
}

function proChannelName(ch){
return ch.username ? '@' + ch.username : (ch.title || String(ch.chat_id));
}

function proChannelError(data){
const dict = I18N[currentLang] || I18N.ru;
const map = {
channel_bad_ref: dict.pro_ch_err_bad,
channel_not_found: dict.pro_ch_err_not_found,
channel_not_owner: dict.pro_ch_err_owner,
channel_bot_not_admin: dict.pro_ch_err_bot,
channel_limit: dict.pro_ch_err_limit,
};
const text = map[data && data.error];
if (!text) return errorMessage(data && data.error);
return text.replace('{bot}', (data && data.bot_username) || proBotUsername).replace('{n}', (data && data.max) || proChannelMax);
}

function applyProChannelsData(data){
if (!data || !Array.isArray(data.items)) return;
proChannels = data.items;
if (data.bot_username) proBotUsername = data.bot_username;
if (data.max) proChannelMax = data.max;
renderProChannels();
}

function renderProChannels(){
const box = document.getElementById('proChannels');
if (!box) return;
const dict = I18N[currentLang] || I18N.ru;
// Блок виден с активным PRO (или если каналы уже подключены).
const show = !!(proStatus && (proStatus.active || proChannels.length));
box.style.display = show ? '' : 'none';
if (!show) return;
document.getElementById('proChannelsHint').textContent = dict.pro_ch_hint.replace('{bot}', proBotUsername);
document.getElementById('proChannelInput').placeholder = dict.pro_ch_ph;
const list = document.getElementById('proChannelsList');
list.innerHTML = proChannels.length
? proChannels.map(c => `<div class="pro-channel-row"><span>${escapeHtml(c.title || '')} <b>${escapeHtml(proChannelName(c))}</b></span><button type="button" data-pro-ch-remove="${c.id}">✕</button></div>`).join('')
: `<div class="pro-channels-empty">${escapeHtml(dict.pro_ch_empty)}</div>`;
}

function loadProChannels(){
if (!tg || !tg.initData) return;
fetch(API_BASE + '/api/pro/channels?init_data=' + encodeURIComponent(tg.initData))
.then(r => r.ok ? r.json() : null)
.then(applyProChannelsData)
.catch(() => {});
}

function postProChannels(payload){
return fetch(API_BASE + '/api/pro/channels', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(Object.assign({ init_data: tg.initData }, payload)),
}).then(async r => {
const data = await r.json().catch(() => ({}));
if (!r.ok) throw data;
applyProChannelsData(data);
return data;
});
}

document.getElementById('proChannelAddBtn').addEventListener('click', () => {
const dict = I18N[currentLang] || I18N.ru;
const input = document.getElementById('proChannelInput');
const status = document.getElementById('proChannelsStatus');
const btn = document.getElementById('proChannelAddBtn');
const value = input.value.trim();
if (!value || !tg || !tg.initData) return;
btn.disabled = true;
status.textContent = '...';
postProChannels({ channel: value })
.then(() => { input.value = ''; status.textContent = dict.pro_ch_added; })
.catch(data => {
status.textContent = data && data.error === 'pro_required' ? dict.pro_locked.replace('{price}', formatCoins(proMinPrice())) : proChannelError(data);
})
.finally(() => { btn.disabled = false; });
});

document.getElementById('proChannelsList').addEventListener('click', (e) => {
const btn = e.target.closest('[data-pro-ch-remove]');
if (!btn) return;
btn.disabled = true;
postProChannels({ remove: Number(btn.dataset.proChRemove) })
.catch(data => { document.getElementById('proChannelsStatus').textContent = proChannelError(data); });
});

// Окно «Поделиться» своего лота: кнопка на каждый свой канал.
function renderShareOwnChannels(show, pro){
const box = document.getElementById('shareOwnChannels');
if (!box) return;
const dict = I18N[currentLang] || I18N.ru;
if (!show || !proChannels.length){
box.innerHTML = '';
return;
}
box.innerHTML = proChannels.map(c =>
`<button type="button" class="save${pro ? '' : ' pro-locked'}" data-share-own-ch="${c.id}">${escapeHtml(dict.pro_ch_btn.replace('{name}', proChannelName(c)))}</button>`
).join('');
}

document.getElementById('shareOwnChannels').addEventListener('click', (e) => {
const btn = e.target.closest('[data-share-own-ch]');
if (!btn || shareBusy || !shareSkin) return;
const dict = I18N[currentLang] || I18N.ru;
if (!isProActive()){
offerPro(shareStatus, document.getElementById('shareProBtn'));
return;
}
const ch = proOwnChannel(Number(btn.dataset.shareOwnCh));
if (!ch) return;
shareTarget = 'own:' + ch.id;
document.getElementById('shareSendBtn').style.display = 'none';
shareStatus.textContent = dict.pro_ch_pick.replace('{name}', proChannelName(ch));
});

// Смена языка — перерисовать карточку (тексты в ней собираются из шаблонов).
const proBaseApplyTranslations = applyTranslations;
applyTranslations = function(){
proBaseApplyTranslations.apply(this, arguments);
renderProCard();
renderProChannels();
};

loadProStatus().then(() => {
renderProChannels();
loadProChannels();
});

// ------------------------------------------------------------
// ТАРИФ «ГАРАНТ»: АУКЦИОНЫ И РОЗЫГРЫШИ В СВОЁМ КАНАЛЕ
//
// Заявка на тариф (кнопка в окне тарифов), окно запуска события из
// «Поделиться» своего лота и список своих событий в карточке PRO.
// ------------------------------------------------------------

function garantInfo(){
return (proStatus && proStatus.garant) || {};
}

function isGarantActive(){
// Аукционы и розыгрыши в своём канале — в Pro, Business и «Гаранте»: бот
// присылает garant.active, если в тарифе есть лимит на события.
return !!(proStatus && (proStatus.admin || (proStatus.garant && proStatus.garant.active)));
}

function applyGarant(){
const dict = I18N[currentLang] || I18N.ru;
const status = document.getElementById('proPlansStatus');
fetch(API_BASE + '/api/pro/garant_request', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData }),
})
.then(async r => {
const data = await r.json().catch(() => ({}));
if (!r.ok) throw data;
if (proStatus){
proStatus.garant = Object.assign({}, proStatus.garant, { status: data.status });
}
renderProPlans();
status.textContent = dict.pro_garant_applied;
})
.catch(data => { status.textContent = errorMessage(data && data.error); });
}

// Окно «Поделиться» своего лота: «🔨 Аукцион в канал», «🎁 Розыгрыш в канал».
function renderShareEvents(show){
const box = document.getElementById('shareEventBtns');
if (!box) return;
const dict = I18N[currentLang] || I18N.ru;
if (!show || !proStatus){
box.innerHTML = '';
return;
}
const locked = isGarantActive() ? '' : ' pro-locked';
box.innerHTML = `<button type="button" class="save${locked}" data-share-event="auction">${escapeHtml(dict.ev_auction_btn)}</button>`
+ `<button type="button" class="save${locked}" data-share-event="raffle">${escapeHtml(dict.ev_raffle_btn)}</button>`;
}

const proEventOverlay = document.getElementById('proEventOverlay');
let proEventKind = 'auction';
let proEventSkin = null;

function proDurationLabel(minutes){
const dict = I18N[currentLang] || I18N.ru;
const h = minutes / 60;
return h >= 24 && h % 24 === 0 ? dict.ev_days.replace('{n}', h / 24) : dict.ev_hours.replace('{n}', h);
}

function openProEvent(kind, skin){
const dict = I18N[currentLang] || I18N.ru;
const g = garantInfo();
proEventKind = kind;
proEventSkin = skin;
document.getElementById('proEventTitle').textContent = kind === 'auction' ? dict.ev_title_auction : dict.ev_title_raffle;
document.getElementById('proEventLot').textContent = (skin.stattrak ? 'StatTrak™ ' : '') + skin.title + (skin.wear ? ' · ' + skin.wear : '');
document.getElementById('proEventChannel').innerHTML = proChannels.map(c =>
`<option value="${c.id}">${escapeHtml(proChannelName(c))}</option>`).join('');
const options = kind === 'auction'
? (g.auction_minutes || [60, 180, 360, 720, 1440, 2880])
: (g.raffle_hours || [6, 12, 24, 48, 72, 168]).map(h => h * 60);
document.getElementById('proEventDuration').innerHTML = options.map(m =>
`<option value="${m}">${escapeHtml(proDurationLabel(m))}</option>`).join('');
document.getElementById('proEventDuration').value = String(kind === 'auction' ? 1440 : 1440);
document.getElementById('proEventAuctionFields').hidden = kind !== 'auction';
const start = Math.max(1000, Math.round((skin.price || 0) * 0.7 / 1000) * 1000);
document.getElementById('proEventStart').value = start;
document.getElementById('proEventStep').value = Math.max(1000, Math.round(start * 0.05 / 1000) * 1000);
document.getElementById('proEventHint').textContent = kind === 'auction' ? dict.ev_auction_hint : dict.ev_raffle_hint;
const left = kind === 'auction' ? g.auctions_left : g.raffles_left;
document.getElementById('proEventLeft').textContent = proStatus.admin ? '' : dict.ev_left.replace('{n}', left || 0);
document.getElementById('proEventSubmit').textContent = kind === 'auction' ? dict.ev_submit_auction : dict.ev_submit_raffle;
document.getElementById('proEventSubmit').disabled = !proChannels.length;
document.getElementById('proEventStatus').textContent = proChannels.length ? '' : dict.ev_no_channels;
proEventOverlay.classList.add('show');
}

function closeProEvent(){
proEventOverlay.classList.remove('show');
}

document.getElementById('shareEventBtns').addEventListener('click', (e) => {
const btn = e.target.closest('[data-share-event]');
if (!btn || !shareSkin) return;
const dict = I18N[currentLang] || I18N.ru;
if (!isGarantActive()){
shareStatus.textContent = dict.pro_garant_locked;
document.getElementById('shareProBtn').style.display = '';
return;
}
openProEvent(btn.dataset.shareEvent, shareSkin);
});

document.getElementById('proEventCloseBtn').addEventListener('click', closeProEvent);
proEventOverlay.addEventListener('click', (e) => { if (e.target === proEventOverlay) closeProEvent(); });

function proEventError(data){
const dict = I18N[currentLang] || I18N.ru;
if (data && data.error === 'event_limit') return dict.ev_limit.replace('{n}', data.limit || 0);
if (data && /^channel_/.test(data.error || '')) return proChannelError(data);
return errorMessage(data && data.error);
}

document.getElementById('proEventSubmit').addEventListener('click', () => {
if (!proEventSkin || !tg || !tg.initData) return;
const dict = I18N[currentLang] || I18N.ru;
const btn = document.getElementById('proEventSubmit');
const status = document.getElementById('proEventStatus');
const channelId = Number(document.getElementById('proEventChannel').value);
const minutes = Number(document.getElementById('proEventDuration').value);
const payload = { init_data: tg.initData, skin_id: proEventSkin.id, channel_id: channelId };
let url = '/api/pro/raffle';
if (proEventKind === 'auction'){
url = '/api/pro/auction';
payload.start_price = Number(document.getElementById('proEventStart').value);
payload.step = Number(document.getElementById('proEventStep').value);
payload.minutes = minutes;
} else {
payload.hours = Math.round(minutes / 60);
}
btn.disabled = true;
status.textContent = '...';
fetch(API_BASE + url, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(payload),
})
.then(async r => {
const data = await r.json().catch(() => ({}));
if (!r.ok) throw data;
if (proStatus && data.garant) proStatus.garant = data.garant;
const ch = proOwnChannel(channelId);
const msg = (proEventKind === 'auction' ? dict.ev_done_auction : dict.ev_done_raffle).replace('{name}', ch ? proChannelName(ch) : '');
closeProEvent();
if (typeof shareOverlay !== 'undefined') shareOverlay.classList.remove('show');
showAlert(msg);
loadProEvents();
if (typeof loadSkins === 'function') loadSkins();
})
.catch(data => { status.textContent = proEventError(data); })
.finally(() => { btn.disabled = false; });
});

// Карточка PRO: свои аукционы и розыгрыши.
let proEvents = [];

function renderProEvents(){
const box = document.getElementById('proEvents');
if (!box) return;
const dict = I18N[currentLang] || I18N.ru;
const g = garantInfo();
box.hidden = !(isGarantActive() || proEvents.length);
if (box.hidden) return;
document.getElementById('proEventsLeft').textContent = proStatus && proStatus.admin ? ''
: dict.ev_left_both.replace('{a}', g.auctions_left || 0).replace('{r}', g.raffles_left || 0);
const list = document.getElementById('proEventsList');
if (!proEvents.length){
list.innerHTML = `<div class="pro-channels-empty">${escapeHtml(dict.ev_empty)}</div>`;
return;
}
list.innerHTML = proEvents.map(ev => {
let info = '';
let cancel = '';
if (ev.kind === 'auction'){
info = dict.ev_status_bids.replace('{n}', ev.bids).replace('{price}', formatCoins(ev.price)) + ' · ' + dict.ev_until.replace('{date}', proDateTimeText(ev.ends_at));
if (!ev.bids) cancel = `<button type="button" data-pro-ev-cancel="auction:${ev.id}">${escapeHtml(dict.ev_cancel)}</button>`;
} else if (ev.status === 'active'){
info = dict.ev_status_entries.replace('{n}', ev.entries) + ' · ' + dict.ev_until.replace('{date}', proDateTimeText(ev.ends_at));
if (!ev.entries) cancel = `<button type="button" data-pro-ev-cancel="raffle:${ev.id}">${escapeHtml(dict.ev_cancel)}</button>`;
} else if (ev.status === 'drawn'){
info = dict.ev_raffle_won.replace('{name}', ev.winner || '');
} else if (ev.status === 'empty'){
info = dict.ev_raffle_empty;
} else {
info = dict.ev_raffle_cancelled;
}
const icon = ev.kind === 'auction' ? '🔨' : '🎁';
return `<div class="pro-channel-row"><span>${icon} ${escapeHtml(ev.title || '')}<br><small>${escapeHtml(info)}</small></span>${cancel}</div>`;
}).join('');
}

function proDateTimeText(iso){
if (!iso) return '';
const d = new Date(iso);
return d.toLocaleString(currentLang === 'en' ? 'en-GB' : 'ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function loadProEvents(){
if (!tg || !tg.initData) return;
fetch(API_BASE + '/api/pro/events?init_data=' + encodeURIComponent(tg.initData))
.then(r => r.ok ? r.json() : null)
.then(data => {
if (!data) return;
proEvents = Array.isArray(data.items) ? data.items : [];
if (proStatus && data.garant) proStatus.garant = data.garant;
renderProEvents();
})
.catch(() => {});
}

document.getElementById('proEventsList').addEventListener('click', (e) => {
const btn = e.target.closest('[data-pro-ev-cancel]');
if (!btn) return;
const dict = I18N[currentLang] || I18N.ru;
const [kind, id] = btn.dataset.proEvCancel.split(':');
showConfirmDialog(dict.ev_cancel_confirm, () => {
btn.disabled = true;
fetch(API_BASE + '/api/pro/events/cancel', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData, kind, id: Number(id) }),
})
.then(async r => {
const data = await r.json().catch(() => ({}));
if (!r.ok) throw data;
loadProEvents();
if (typeof loadSkins === 'function') loadSkins();
})
.catch(data => {
document.getElementById('proEventsStatus').textContent = errorMessage(data && data.error);
btn.disabled = false;
});
});
});

const proEventsBaseApply = applyTranslations;
applyTranslations = function(){
proEventsBaseApply.apply(this, arguments);
renderProEvents();
};

loadProStatus().then(loadProEvents);
