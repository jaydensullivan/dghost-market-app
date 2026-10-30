// ============================================================
// НАТИВНЫЕ ЭЛЕМЕНТЫ TELEGRAM — СИСТЕМНАЯ КНОПКА «НАЗАД» И ВИБРООТКЛИК
//
// Подключается последним: к этому моменту вся разметка и логика
// остальных модулей уже на месте. Ничего в них не меняет — только
// нажимает уже существующие кнопки закрытия/«назад», поэтому вся
// их логика очистки (таймеры, сброс форм) срабатывает как обычно.
// ============================================================

const TG_HAS_V61 = !!(tg && tg.isVersionAtLeast && tg.isVersionAtLeast('6.1'));

// ---------- вибрация ----------

function haptic(kind){
if (!TG_HAS_V61 || !tg.HapticFeedback) return;
try {
if (kind === 'success' || kind === 'error' || kind === 'warning'){
tg.HapticFeedback.notificationOccurred(kind);
} else if (kind === 'select'){
tg.HapticFeedback.selectionChanged();
} else {
tg.HapticFeedback.impactOccurred(kind || 'light');
}
} catch(e) {}
}

// Лёгкий отклик на любое нажатие по кнопкам и карточкам — одним
// общим слушателем, а не по одному в каждом модуле.
const HAPTIC_TARGETS = 'button, .skin-card, .inv-item, [data-tab], .chip';
let lastHapticAt = 0;

document.addEventListener('click', (e) => {
const el = e.target.closest(HAPTIC_TARGETS);
if (!el || el.disabled) return;
const now = Date.now();
if (now - lastHapticAt < 60) return; // двойные события от одного тапа
lastHapticAt = now;
haptic('light');
}, true);

// ---------- системная кнопка «Назад» ----------

// Оверлеи, у которых «Назад» не должен работать: обязательные
// шаги (соглашение, Steam, онбординг) и сам главный экран.
const BACK_IGNORED_OVERLAYS = new Set([
'mandatoryAgreementOverlay', 'mandatorySteamOverlay',
'onboardingOverlay',
]);

// Кнопка закрытия каждого оверлея — та же, что пользователь нажал бы сам.
const OVERLAY_CLOSE_BTN = {
brRespondOverlay: 'brRespondCloseBtn',
kycOverlay: 'kycCloseBtn',
topupOverlay: 'topupCancel',
withdrawOverlay: 'withdrawCancel',
auctionBidOverlay: 'auctionBidCancel',
cartOverlay: 'cartCloseBtn',
tradeMakeOverlay: 'tradeMakeCloseBtn',
discountOverlay: 'discountCloseBtn',
tradeDetailsOverlay: 'tradeDetailsCloseBtn',
historyOverlay: 'historyCloseBtn',
filtersOverlay: 'filtersCloseBtn',
addSkinOverlay: 'addSkinCancel',
buyOverlay: 'buyClose',
setsOverlay: 'setsCloseBtn',
builderOverlay: 'builderCloseBtn',
quickSellOverlay: 'quickSellCloseBtn',
topupRejectOverlay: 'topupRejectCloseBtn',
inspectOverlay: 'inspectCloseBtn',
inventoryOverlay: 'inventoryCancel',
notificationsOverlay: 'notificationsCloseBtn',
disputeOverlay: 'disputeCancelBtn',
sellerProfileOverlay: 'sellerProfileCloseBtn',
reviewOverlay: 'reviewCancelBtn',
viewer3dOverlay: 'viewer3dCloseBtn',
legalOverlay: 'legalCloseBtn',
};

// Экранные «назад» внутри приложения — сначала более глубокие.
const SCREEN_BACK_BTNS = [
'dealsBackBtn', 'buyRequestsBackBtn',
'rfBackBtn', 'auctionsBackBtn', 'adminBackBtn',
];

function isShown(el){
return !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
}

function isOverlayOpen(id){
const el = document.getElementById(id);
return !!el && el.classList.contains('show');
}

function isBlockedByMandatory(){
return isOverlayOpen('mandatoryAgreementOverlay')
|| isOverlayOpen('mandatorySteamOverlay')
|| isOverlayOpen('onboardingOverlay');
}

// Верхний открытый оверлей — с наибольшим z-index, при равенстве
// тот, что ниже в разметке (он рисуется поверх).
function topOpenOverlay(){
let best = null, bestZ = -Infinity;
document.querySelectorAll('[id$="Overlay"].show').forEach(el => {
if (BACK_IGNORED_OVERLAYS.has(el.id)) return;
const z = parseInt(getComputedStyle(el).zIndex, 10) || 0;
if (z >= bestZ){ best = el; bestZ = z; }
});
return best;
}

function visibleScreenBackBtn(){
for (const id of SCREEN_BACK_BTNS){
const btn = document.getElementById(id);
if (isShown(btn)) return btn;
}
return null;
}

function handleTgBack(){
const overlay = topOpenOverlay();
if (overlay){
const btn = document.getElementById(OVERLAY_CLOSE_BTN[overlay.id]);
if (btn) btn.click();
else overlay.classList.remove('show');
return;
}
const screenBtn = visibleScreenBackBtn();
if (screenBtn) screenBtn.click();
}

let backSyncQueued = false;

function syncTgBackButton(){
backSyncQueued = false;
if (!TG_HAS_V61 || !tg.BackButton) return;
const needed = !isBlockedByMandatory() && (topOpenOverlay() || visibleScreenBackBtn());
try {
if (needed && !tg.BackButton.isVisible) tg.BackButton.show();
if (!needed && tg.BackButton.isVisible) tg.BackButton.hide();
} catch(e) {}
}

function queueBackSync(){
if (backSyncQueued) return;
backSyncQueued = true;
requestAnimationFrame(syncTgBackButton);
}

if (TG_HAS_V61 && tg.BackButton){
tg.BackButton.onClick(handleTgBack);
// Следим только за class/style — именно ими модули открывают и
// закрывают экраны. Текст (таймеры аукционов) сюда не попадает.
new MutationObserver(queueBackSync).observe(document.body, {
subtree: true, attributes: true, attributeFilter: ['class', 'style'],
});
queueBackSync();
}

// ---------------- Переход с сайта ----------------
// Ссылки с сайта dghostmarket.uz несут ?src=site_<страница>. Шлём метку боту
// (/api/visit) для «Аналитика»: сколько пришло с сайта и что сделали
// дальше. visitor — случайный id браузера; когда человек вошёл, шлём
// ещё раз с init_data — переход привязывается к аккаунту.
(function trackSiteVisit(){
let src = null, target = null;
try {
const p = new URLSearchParams(location.search);
src = p.get('src'); target = p.get('open');
} catch(e) {}
const store = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch(e) {} };
const load = k => { try { return localStorage.getItem(k); } catch(e) { return null; } };
let saved = null;
try { saved = JSON.parse(load('dg_src') || 'null'); } catch(e) {}
if (src && /^site_[a-z0-9_]{1,30}$/.test(src)){
saved = { src: src, target: target || '', at: Date.now(), linked: false };
} else if (!saved || Date.now() - saved.at > 30 * 864e5 || saved.linked || !(tg && tg.initData)){
return;
}
let vid = load('dg_vid');
if (!vid || !/^[A-Za-z0-9_-]{8,40}$/.test(vid)){
vid = Array.from({ length: 16 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
store('dg_vid', vid);
}
const initData = (tg && tg.initData) || '';
if (initData) saved.linked = true;
store('dg_src', JSON.stringify(saved));
fetch(API_BASE + '/api/visit', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ visitor: vid, src: saved.src, target: saved.target, init_data: initData }),
}).catch(() => {});
})();

// ---------------- Запуск сразу на нужном экране ----------------
// Кнопки бота «Мои сделки» / «Продать скин» открывают мини-апп с
// ?open=deals|sell (web_app-кнопка), а ссылки t.me/<бот>/<app> — с
// startapp=deals|sell. Чуть ждём, пока остальные модули отрисуют
// стартовый экран, и переключаемся.
(function openScreenFromLaunch(){
let target = null;
try { target = new URLSearchParams(location.search).get('open'); } catch(e) {}
if (!target && tg && tg.initDataUnsafe && typeof tg.initDataUnsafe.start_param === 'string') target = tg.initDataUnsafe.start_param;
if (target !== 'deals' && target !== 'sell' && target !== 'wants' && target !== 'search' && target !== 'pro') return;
setTimeout(() => {
if (target === 'deals'){
switchTab('deals');
} else if (target === 'pro'){
// С сайта (тарифы PRO): кабинет, если подписка есть, иначе окно тарифов.
if (document.getElementById('proCabinetBtn').hidden) openProPlans();
else goToScreen('pro');
} else if (target === 'search'){
// С главной сайта: поиск скина (?open=search&q=…) — каталог с запросом.
let q = '';
try { q = new URLSearchParams(location.search).get('q') || ''; } catch(e) {}
goToScreen('shop');
skinSearch.value = q.slice(0, 120);
skinSearch.dispatchEvent(new Event('input'));
} else if (target === 'wants'){
// С сайта (страница цены скина): «Сообщить, когда появится» —
// «Хочу» с уже вписанным названием (?open=wants&q=…).
goToScreen('buyRequests');
if (typeof setWantsTab === 'function') setWantsTab('watch');
let q = '';
try { q = new URLSearchParams(location.search).get('q') || ''; } catch(e) {}
const input = document.getElementById('wishlistQueryInput');
if (input && q) input.value = q.slice(0, 120);
} else {
goToScreen('lots');
setTimeout(() => { const btn = document.getElementById('addSkinBtn'); if (btn) btn.click(); }, 150);
}
}, 400);
})();
