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
'onboardingOverlay', 'welcomeOverlay',
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
editOverlay: 'editCancel',
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
};

// Экранные «назад» внутри приложения — сначала более глубокие.
const SCREEN_BACK_BTNS = [
'categoryPickerBack', 'dealsBackBtn', 'buyRequestsBackBtn',
'shopBackBtn', 'profileBackBtn', 'auctionsBackBtn', 'adminBackBtn',
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
if (isOverlayOpen('welcomeOverlay')) return null;
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
