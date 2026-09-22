// ============================================================
// МОИ СДЕЛКИ (трекинг без кастодии)
// ============================================================

function formatDealCountdown(releaseAtIso){
if (!releaseAtIso) return '';
const remainingMs = new Date(releaseAtIso).getTime() - Date.now();
if (remainingMs <= 0) return 'с минуты на минуту';
const totalMinutes = Math.floor(remainingMs / 60000);
const days = Math.floor(totalMinutes / 1440);
const hours = Math.floor((totalMinutes % 1440) / 60);
const minutes = totalMinutes % 60;
if (days > 0) return `${days}д ${hours}ч`;
if (hours > 0) return `${hours}ч ${minutes}м`;
return `${minutes}м`;
}

// ============================================================
// ТАЙМЛАЙН СДЕЛКИ — ПЯТЬ ШАГОВ ОТ ОПЛАТЫ ДО ВЫПЛАТЫ
//
// Шаги считаются из полей сделки (sent_at, confirmed_at,
// release_at, disputed_at), а точное время и финальные статусы
// (выплата, возврат, отмена) уточняются историей из
// order_status_history, когда она подгрузится.
// ============================================================

const DEAL_STEP_KEYS = ['paid', 'transfer', 'receive', 'hold', 'payout'];

// История статусов по сделкам — чтобы ежеминутная перерисовка
// карточек не теряла уже загруженные данные.
const dealHistoryCache = {};

function dealDateLabel(iso){
if (!iso) return '';
const locale = currentLang === 'uz' ? 'uz-UZ' : (currentLang === 'en' ? 'en-US' : 'ru-RU');
return new Date(iso).toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function computeDealSteps(deal, history){
const dict = I18N[currentLang] || I18N.ru;
const hist = history || [];
const at = (status) => {
const row = hist.find(h => h.status === status);
return row ? row.created_at : null;
};
const has = (status) => hist.some(h => h.status === status);

const releasePassed = deal.release_at && new Date(deal.release_at).getTime() <= Date.now();
const payoutDone = has('PAYOUT_COMPLETED');

// Время завершения каждого шага (null — шаг ещё не пройден).
const doneAt = {
paid: at('PAYMENT_CONFIRMED') || at('RESERVED') || deal.sold_at || true,
transfer: deal.sent_at || null,
receive: deal.confirmed_at || at('DELIVERY_CONFIRMED') || null,
hold: (deal.confirmed_at && (releasePassed || payoutDone))
? (at('PAYOUT_PROCESSING') || at('PAYOUT_COMPLETED') || deal.release_at || true) : null,
payout: payoutDone ? at('PAYOUT_COMPLETED') : null,
};
// Подтверждение получения без отметки «Отправил» — передача тоже пройдена.
if (doneAt.receive && !doneAt.transfer) doneAt.transfer = true;

let currentIdx = DEAL_STEP_KEYS.findIndex(k => !doneAt[k]);
const allDone = currentIdx === -1;

// Ветки, которые обрывают обычный путь.
let failed = null;
if (has('REFUNDED')) failed = 'refunded';
else if (has('ORDER_CANCELLED')) failed = 'cancelled';
else if (deal.disputed_at && !deal.confirmed_at) failed = 'dispute';

const steps = DEAL_STEP_KEYS.map((key, i) => {
let state = 'upcoming';
if (allDone || i < currentIdx) state = 'done';
else if (i === currentIdx) state = failed ? 'failed' : 'current';
let label = dict['step_' + key];
if (state === 'failed') label = dict['step_' + failed];
const t = doneAt[key];
return { key, label, state, time: (state === 'done' && typeof t === 'string') ? t : null };
});

// Подсказка «что сейчас происходит» — своя для продавца и покупателя.
const selling = deal.role === 'selling';
const timeLeft = formatDealCountdown(deal.release_at);
let hint = '';
if (failed) hint = dict['hint_' + failed];
else if (allDone) hint = dict.hint_done;
else {
const key = DEAL_STEP_KEYS[currentIdx];
if (key === 'transfer') hint = selling ? dict.hint_seller_send : dict.hint_buyer_wait_send;
else if (key === 'receive') hint = selling ? dict.hint_seller_wait_confirm : dict.hint_buyer_confirm;
else if (key === 'hold') hint = (selling ? dict.hint_hold_seller : dict.hint_hold_buyer).replace('{time}', timeLeft);
else if (key === 'payout') hint = dict.hint_payout_wait;
}

return { steps, currentIdx: allDone ? DEAL_STEP_KEYS.length - 1 : currentIdx, allDone, failed, hint };
}

// Компактный вид для карточки: полоска из 5 сегментов,
// «Шаг N из 5 · название» и подсказка.
function dealProgressHtml(deal){
const dict = I18N[currentLang] || I18N.ru;
const info = computeDealSteps(deal, dealHistoryCache[deal.id]);
const segs = info.steps.map(s => `<div class="deal-progress-seg ${s.state}"></div>`).join('');
const cur = info.steps[info.currentIdx];
const count = dict.step_of.replace('{n}', info.currentIdx + 1).replace('{total}', info.steps.length);
return `<div class="deal-progress">${segs}</div>
<div class="deal-step-summary${info.failed ? ' failed' : ''}"><span>${escapeHtml(cur.label)}</span><span class="deal-step-count">${info.allDone ? '✓' : count}</span></div>
<div class="deal-hint">${escapeHtml(info.hint)}</div>`;
}

// Полный вертикальный таймлайн — для окна «Детали сделки».
function dealStepperHtml(deal, history){
const info = computeDealSteps(deal, history);
return '<div class="dstep-list">' + info.steps.map(s => {
const icon = s.state === 'done' ? '✓' : (s.state === 'failed' ? '!' : '');
const hint = (s.state === 'current' || s.state === 'failed') ? `<div class="dstep-hint">${escapeHtml(info.hint)}</div>` : '';
const time = s.time ? `<div class="dstep-time">${dealDateLabel(s.time)}</div>` : '';
return `<div class="dstep ${s.state}"><div class="dstep-dot">${icon}</div><div class="dstep-body"><div class="dstep-title">${escapeHtml(s.label)}</div>${time}${hint}</div></div>`;
}).join('') + '</div>';
}

function dealCardHtml(deal){
const dict = I18N[currentLang] || I18N.ru;

const photo = deal.photo_url
? `<img class="deal-photo" src="${deal.photo_url}" alt="">`
: `<div class="deal-photo" style="display:flex;align-items:center;justify-content:center;">${TARGET_ICON}</div>`;

let statusHtml = '';
let actionHtml = '';

if (deal.role === 'selling'){
if (deal.sent_at && deal.confirmed_at){
statusHtml = `<div class="deal-status sent">${dict.status_hold_running}</div>`;
} else if (deal.sent_at){
statusHtml = `<div class="deal-status sent">${dict.status_waiting_buyer_confirm}</div>`;
} else {
statusHtml = `<div class="deal-status pending">${dict.status_need_to_send}</div>`;
actionHtml = `<button class="deal-action" data-mark-sent="${deal.id}" type="button">${dict.btn_sent}</button>
<button class="deal-action secondary" data-cancel-sale="${deal.id}" type="button">${dict.btn_cancel_sale}</button>`;
if (deal.inspect_link){
actionHtml += `<button class="deal-action secondary" data-inspect-skin="${deal.id}" type="button">${dict.btn_inspect_item}</button>`;
}
}
} else {
if (deal.confirmed_at){
statusHtml = `<div class="deal-status done">${dict.status_confirmed}</div>`;
} else if (deal.disputed_at){
statusHtml = `<div class="deal-status pending" style="color:#e0555a;">${dict.status_disputed}</div>`;
actionHtml = `<button class="deal-action secondary" data-add-evidence="${deal.id}" type="button">${dict.btn_add_evidence}</button>`;
} else if (deal.sent_at){
statusHtml = `<div class="deal-status sent">${dict.status_seller_sent}</div>`;
actionHtml = `<button class="deal-action" data-mark-received="${deal.id}" type="button">${dict.btn_received}</button>
<button class="deal-action secondary" data-mark-disputed="${deal.id}" type="button">${dict.btn_not_received}</button>`;
} else {
statusHtml = `<div class="deal-status pending">${dict.status_waiting_send}</div>`;
}
}

const countdownLabel = deal.role === 'selling'
? dict.countdown_credit
: dict.countdown_hold;
const countdownHtml = deal.release_at
? `<div class="deal-meta">${countdownLabel}${formatDealCountdown(deal.release_at)}</div>`
: '';

const roleLabel = deal.role === 'selling' ? dict.role_selling : dict.role_buying;
const counterpartyLabel = deal.role === 'selling' ? dict.detail_buyer : dict.detail_seller;

const messageBtn = `<button class="deal-action secondary" data-relay="${deal.id}" type="button">${dict.btn_message}</button>`;

const sellerLabel = deal.role === 'selling' ? (I18N[currentLang] || I18N.ru).trade_you : (I18N[currentLang] || I18N.ru).trade_seller;
const buyerLabel = deal.role === 'buying' ? (I18N[currentLang] || I18N.ru).trade_you : (I18N[currentLang] || I18N.ru).trade_buyer;
const isDone = !!deal.confirmed_at;
const lineClass = isDone ? 'trade-party-line done' : 'trade-party-line';

return `
<div class="deal-card" style="flex-direction:column; align-items:stretch;">
<div style="display:flex; gap:10px;">
${photo}
<div class="deal-info">
<div class="deal-title">${escapeHtml(deal.title)}</div>
<div class="deal-meta">${roleLabel} · ${escapeHtml(counterpartyLabel)} · ${formatCoins(deal.price)}</div>
</div>
</div>
<div id="dealProgress-${deal.id}">${dealProgressHtml(deal)}</div>
<div class="deal-actions" style="margin-top:8px;">${actionHtml}${messageBtn}<button class="deal-action secondary" data-trade-details="${deal.id}" type="button">${dict.btn_deal_details}</button></div>
</div>`;
}

function loadDealTimelineInline(orderCode, skinId){
if (!tg || !tg.initData) return;
fetch(API_BASE + '/api/deals/' + skinId + '/history?init_data=' + encodeURIComponent(tg.initData))
.then(r => r.json())
.then(data => {
dealHistoryCache[skinId] = data.history || [];
const deal = lastDeals.find(d => d.id === skinId);
const el = document.getElementById('dealProgress-' + skinId);
if (deal && el) el.innerHTML = dealProgressHtml(deal);
})
.catch(() => {});
}

let lastDeals = [];

function loadDeals(){
const dict = I18N[currentLang] || I18N.ru;
const dealsList = document.getElementById('dealsList');
if (!tg || !tg.initData){
dealsList.innerHTML = `<div class="skins-empty" style="padding:16px 4px;">${dict.open_via_telegram}</div>`;
return;
}
fetch(API_BASE + '/api/deals?init_data=' + encodeURIComponent(tg.initData))
.then(r => r.json())
.then(data => {
lastDeals = (data && data.items) || [];
if (!lastDeals.length){
dealsList.innerHTML = `<div class="skins-empty" style="padding:16px 4px;">${dict.no_active_deals}</div>`;
return;
}
dealsList.innerHTML = lastDeals.map(dealCardHtml).join('');
lastDeals.forEach(deal => loadDealTimelineInline(null, deal.id));
})
.catch(() => {
dealsList.innerHTML = '<div class="skins-empty" style="padding:16px 4px;">Не удалось загрузить</div>';
});
}

// ---------------- Обмены ----------------

function tradeOfferCardHtml(offer){
const dict = I18N[currentLang] || I18N.ru;
const isIncoming = offer.role === 'incoming';
const myItem = isIncoming ? offer.to_skin_title : offer.from_skin_title;
const theirItem = isIncoming ? offer.from_skin_title : offer.to_skin_title;
let cashLine = '';
if (offer.cash_amount){
const iPay = (offer.cash_payer === 'from' && !isIncoming) || (offer.cash_payer === 'to' && isIncoming);
cashLine = `<div class="deal-meta">${iPay ? dict.trade_card_you_pay : dict.trade_card_they_pay}: ${formatCoins(offer.cash_amount)}</div>`;
}

let statusLine = '';
let actions = '';

if (offer.status === 'pending'){
if (isIncoming){
statusLine = `<div class="deal-meta">🔄 ${dict.trade_card_awaiting_you}</div>`;
actions = `<button class="deal-action" data-trade-accept="${offer.id}" type="button">✅ ${dict.trade_card_btn_accept}</button><button class="deal-action secondary" data-trade-decline="${offer.id}" type="button">❌ ${dict.trade_card_btn_decline}</button>`;
} else {
statusLine = `<div class="deal-meta">⏳ ${dict.trade_card_awaiting_other}</div>`;
actions = `<button class="deal-action secondary" data-trade-cancel="${offer.id}" type="button">${dict.trade_card_btn_cancel}</button>`;
}
} else if (offer.status === 'accepted'){
const mySent = isIncoming ? offer.to_sent_at : offer.from_sent_at;
const theirSent = isIncoming ? offer.from_sent_at : offer.to_sent_at;
const myConfirmed = isIncoming ? offer.to_confirmed_at : offer.from_confirmed_at;
statusLine = `<div class="deal-meta">✅ ${dict.trade_card_accepted}${theirSent ? ' ' + dict.trade_card_partner_sent : ''}</div>`;
if (!mySent){
actions = `<button class="deal-action" data-trade-sent="${offer.id}" type="button">📦 ${dict.trade_card_btn_sent}</button>`;
} else if (!myConfirmed){
actions = `<button class="deal-action" data-trade-received="${offer.id}" type="button">✅ ${dict.trade_card_btn_received}</button>`;
} else {
statusLine += `<div class="deal-meta">${dict.trade_card_waiting_partner}</div>`;
}
} else if (offer.status === 'completed'){
statusLine = `<div class="deal-meta" style="color:#7ec98a;">✅ ${dict.trade_card_completed}</div>`;
} else if (offer.status === 'declined'){
statusLine = `<div class="deal-meta">❌ ${dict.trade_card_declined}</div>`;
} else if (offer.status === 'cancelled'){
statusLine = `<div class="deal-meta">${dict.trade_card_cancelled}</div>`;
} else if (offer.status === 'expired'){
statusLine = `<div class="deal-meta">${dict.trade_card_expired}</div>`;
}

return `
<div class="deal-card">
<div class="deal-info">
<div class="deal-title">🔄 ${escapeHtml(theirItem || '—')} ↔ ${escapeHtml(myItem || '—')}</div>
<div class="deal-meta">${isIncoming ? dict.trade_card_they_offered : dict.trade_card_you_offered}</div>
${cashLine}
${statusLine}
</div>
<div class="deal-actions">${actions}</div>
</div>`;
}

function loadTradeOffers(){
const dict = I18N[currentLang] || I18N.ru;
const el = document.getElementById('tradeOffersList');
if (!tg || !tg.initData) return;
fetch(API_BASE + '/api/trade_offers?init_data=' + encodeURIComponent(tg.initData))
.then(r => r.json())
.then(data => {
const items = (data && data.items) || [];
const active = items.filter(o => o.status !== 'declined' && o.status !== 'cancelled' && o.status !== 'expired');
if (!active.length){
el.innerHTML = `<div class="skins-empty" style="padding:16px 4px;">${dict.trade_none}</div>`;
return;
}
el.innerHTML = active.map(tradeOfferCardHtml).join('');
})
.catch(() => {
el.innerHTML = `<div class="skins-empty" style="padding:16px 4px;">${dict.load_failed}</div>`;
});
}

document.getElementById('tradeOffersList').addEventListener('click', (e) => {
const dict = I18N[currentLang] || I18N.ru;
const acceptBtn = e.target.closest('[data-trade-accept]');
const declineBtn = e.target.closest('[data-trade-decline]');
const cancelBtn = e.target.closest('[data-trade-cancel]');
const sentBtn = e.target.closest('[data-trade-sent]');
const receivedBtn = e.target.closest('[data-trade-received]');

const callAction = (offerId, path, confirmMsg, successMsg) => {
const doCall = () => {
fetch(API_BASE + '/api/trade_offers/' + offerId + path, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData })
})
.then(async r => {
if (!r.ok){
const data = await r.json().catch(() => ({}));
throw new Error(errorMessage(data.error));
}
return r.json();
})
.then((data) => {
if (successMsg) showAlert(data.completed === false ? dict.trade_mark_saved : successMsg);
loadTradeOffers();
})
.catch(err => showErrorToast(err));
};
if (confirmMsg){
showConfirm(confirmMsg, doCall);
} else {
doCall();
}
};

if (acceptBtn) callAction(acceptBtn.dataset.tradeAccept, '/accept', dict.trade_confirm_accept, dict.trade_accepted_ok);
if (declineBtn) callAction(declineBtn.dataset.tradeDecline, '/decline', dict.trade_confirm_decline, null);
if (cancelBtn) callAction(cancelBtn.dataset.tradeCancel, '/cancel', dict.trade_confirm_cancel, null);
if (sentBtn) callAction(sentBtn.dataset.tradeSent, '/mark_sent', null, dict.trade_marked_ok);
if (receivedBtn) callAction(receivedBtn.dataset.tradeReceived, '/mark_received', null, dict.trade_completed_alert);
});

// Раз в минуту перерисовываем отсчёт по уже загруженным сделкам —
// без лишних запросов к серверу
setInterval(() => {
if (lastDeals.length && currentTab === 'profile'){
document.getElementById('dealsList').innerHTML = lastDeals.map(dealCardHtml).join('');
}
}, 60000);

document.getElementById('dealsList').addEventListener('click', (e) => {
const sentBtn = e.target.closest('[data-mark-sent]');
const receivedBtn = e.target.closest('[data-mark-received]');
const disputedBtn = e.target.closest('[data-mark-disputed]');
const evidenceBtn = e.target.closest('[data-add-evidence]');
if (evidenceBtn){
openDisputeForm(Number(evidenceBtn.dataset.addEvidence), 'add');
return;
}
const cancelBtn = e.target.closest('[data-cancel-sale]');
const relayBtn = e.target.closest('[data-relay]');
const inspectBtn = e.target.closest('[data-inspect-skin]');
const detailsBtn = e.target.closest('[data-trade-details]');

if (detailsBtn){
openTradeDetails(Number(detailsBtn.dataset.tradeDetails));
return;
}

if (inspectBtn){
const id = inspectBtn.dataset.inspectSkin;
const overlay = document.getElementById('inspectOverlay');
const status = document.getElementById('inspectStatus');
const img = document.getElementById('inspectImage');
img.style.display = 'none';
status.style.display = '';
status.textContent = (I18N[currentLang] || I18N.ru).combo_loading_preview;
overlay.classList.add('show');
fetch(API_BASE + '/api/skins/' + id + '/inspect_screenshot')
.then(r => { if (!r.ok) throw new Error(); return r.blob(); })
.then(blob => {
img.src = URL.createObjectURL(blob);
img.style.display = '';
status.style.display = 'none';
})
.catch(() => { status.textContent = (I18N[currentLang] || I18N.ru).combo_preview_failed; });
return;
}

if (sentBtn){
const id = sentBtn.dataset.markSent;
showConfirm('Отметить, что скин отправлен покупателю?', () => {
fetch(API_BASE + '/api/skins/' + id + '/mark_sent', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData })
})
.then(r => { if (!r.ok) throw new Error(); return r.json(); })
.then(() => loadDeals())
.catch(() => showErrorToast(new Error('Не удалось обновить статус.')));
});
}

if (receivedBtn){
const id = receivedBtn.dataset.markReceived;
showConfirm('Подтвердить получение? Это просто отметка для истории — деньги продавцу всё равно уйдут по истечении 8-дневного холда.', () => {
fetch(API_BASE + '/api/skins/' + id + '/mark_received', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData })
})
.then(r => { if (!r.ok) throw new Error(); return r.json(); })
.then(() => loadDeals())
.catch(() => showErrorToast(new Error('Не удалось обновить статус.')));
});
}

if (disputedBtn){
openDisputeForm(Number(disputedBtn.dataset.markDisputed), 'open');
}

if (cancelBtn){
const id = cancelBtn.dataset.cancelSale;
showConfirm('Отменить продажу? Деньги вернутся покупателю, лот больше не будет считаться проданным. Отменить можно только пока предмет ещё не отправлен.', () => {
fetch(API_BASE + '/api/skins/' + id + '/cancel_sale', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData })
})
.then(async r => {
if (!r.ok){
const data = await r.json().catch(() => ({}));
if (data.error === 'already_sent') throw new Error('Уже отмечено как отправленное — отменить нельзя.');
throw new Error('Не удалось отменить продажу.');
}
return r.json();
})
.then(() => loadDeals())
.catch(err => showErrorToast(err));
});
}

if (relayBtn){
const id = relayBtn.dataset.relay;
fetch(API_BASE + '/api/skins/' + id + '/relay_start', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData })
})
.then(async r => {
if (!r.ok){
const data = await r.json().catch(() => ({}));
throw new Error(errorMessage(data.error));
}
return r.json();
})
.then((data) => {
showAlert(`Открой чат с ботом и напиши сообщение следующим — оно уйдёт ${data.role_label} анонимно, без обмена личными контактами.`);
})
.catch(err => showErrorToast(err));
}
});



// ============================================================
// СПОР С ДОКАЗАТЕЛЬСТВАМИ
//
// mode 'open' — покупатель открывает спор («Не получил»):
// описание обязательно, Trade ID и скриншот по желанию.
// mode 'add' — дополнительные доказательства по уже открытому
// спору, доступно и покупателю, и продавцу.
// ============================================================

const disputeOverlay = document.getElementById('disputeOverlay');
const disputeReason = document.getElementById('disputeReason');
const disputeTradeId = document.getElementById('disputeTradeId');
const disputePhotoInput = document.getElementById('disputePhotoInput');
const disputePhotoPreview = document.getElementById('disputePhotoPreview');
const disputeStatus = document.getElementById('disputeStatus');
const disputeSubmitBtn = document.getElementById('disputeSubmitBtn');

let disputeSkinId = null;
let disputeMode = 'open';
let disputePhotoBase64 = null;

function openDisputeForm(skinId, mode){
const dict = I18N[currentLang] || I18N.ru;
disputeSkinId = skinId;
disputeMode = mode;
disputePhotoBase64 = null;
disputeReason.value = '';
disputeTradeId.value = '';
disputePhotoInput.value = '';
disputePhotoPreview.style.display = 'none';
disputeStatus.textContent = '';
disputeSubmitBtn.disabled = false;

document.getElementById('disputeTitle').textContent = mode === 'open' ? dict.dispute_title_open : dict.dispute_title_add;
document.getElementById('disputeIntro').textContent = mode === 'open' ? dict.dispute_intro_open : dict.dispute_intro_add;
document.getElementById('disputeReasonLabel').textContent = dict.dispute_reason_label;
disputeReason.placeholder = dict.dispute_reason_ph;
document.getElementById('disputeTradeLabel').textContent = dict.dispute_trade_label;
document.getElementById('disputeTradeHint').textContent = dict.dispute_trade_hint;
document.getElementById('disputePhotoLabel').textContent = dict.dispute_photo_label;
disputeSubmitBtn.textContent = mode === 'open' ? dict.dispute_submit_open : dict.dispute_submit_add;

disputeOverlay.classList.add('show');
}

// Сжатие фото — как у чека P2P: телефонные снимки весят мегабайты.
disputePhotoInput.addEventListener('change', () => {
const dict = I18N[currentLang] || I18N.ru;
const file = disputePhotoInput.files[0];
disputePhotoBase64 = null;
disputePhotoPreview.style.display = 'none';
if (!file) return;
disputeStatus.textContent = dict.status_processing_photo;
const reader = new FileReader();
reader.onload = () => {
const img = new Image();
img.onload = () => {
const MAX_SIDE = 1600;
let { width, height } = img;
if (width > MAX_SIDE || height > MAX_SIDE){
const scale = MAX_SIDE / Math.max(width, height);
width = Math.round(width * scale);
height = Math.round(height * scale);
}
const canvas = document.createElement('canvas');
canvas.width = width;
canvas.height = height;
canvas.getContext('2d').drawImage(img, 0, 0, width, height);
disputePhotoBase64 = canvas.toDataURL('image/jpeg', 0.82);
disputePhotoPreview.src = disputePhotoBase64;
disputePhotoPreview.style.display = 'block';
disputeStatus.textContent = '';
};
img.onerror = () => { disputeStatus.textContent = dict.status_photo_failed; };
img.src = reader.result;
};
reader.readAsDataURL(file);
});

disputeTradeId.addEventListener('input', () => {
disputeTradeId.value = disputeTradeId.value.replace(/\D/g, '');
});

disputeSubmitBtn.addEventListener('click', () => {
const dict = I18N[currentLang] || I18N.ru;
if (!disputeSkinId || !tg || !tg.initData) return;
const reason = disputeReason.value.trim();
const tradeId = disputeTradeId.value.trim();

if (disputeMode === 'open' && reason.length < 10){
disputeStatus.textContent = dict.dispute_reason_short;
haptic('error');
return;
}
if (disputeMode === 'add' && !reason && !tradeId && !disputePhotoBase64){
disputeStatus.textContent = errorMessage('evidence_empty');
haptic('error');
return;
}

const endpoint = disputeMode === 'open' ? 'mark_disputed' : 'dispute_evidence';
disputeSubmitBtn.disabled = true;
disputeStatus.textContent = '';

fetch(API_BASE + '/api/skins/' + disputeSkinId + '/' + endpoint, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
init_data: tg.initData,
reason,
trade_id: tradeId,
photo_base64: disputePhotoBase64,
})
})
.then(async r => {
if (!r.ok){
const data = await r.json().catch(() => ({}));
throw new Error(errorMessage(data.error));
}
return r.json();
})
.then(() => {
disputeOverlay.classList.remove('show');
showToast(disputeMode === 'open' ? dict.dispute_opened_ok : dict.dispute_evidence_ok, { type: 'success' });
loadDeals();
})
.catch(err => {
disputeStatus.textContent = friendlyErrorMessage(err);
})
.finally(() => {
disputeSubmitBtn.disabled = false;
});
});

document.getElementById('disputeCancelBtn').addEventListener('click', () => {
disputeOverlay.classList.remove('show');
});
