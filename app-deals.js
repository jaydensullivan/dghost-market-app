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
${countdownHtml}
${statusHtml}
</div>
</div>
<div class="deal-actions" style="margin-top:8px;">${actionHtml}${messageBtn}</div>
<div style="display:flex; align-items:center; justify-content:center; gap:8px; margin:12px 0 4px; font-family:'Inter', sans-serif; font-size:11px; color:var(--silver);">
<div class="trade-party" style="flex:0 0 auto;"><div class="trade-party-dot">✓</div><div>${sellerLabel}</div></div>
<div class="${lineClass}" style="max-width:60px;"></div>
<div class="trade-party" style="flex:0 0 auto;"><div class="trade-party-dot" style="${isDone ? '' : 'background:rgba(255,255,255,0.05); border-color:var(--muted);'}">${isDone ? '✓' : ''}</div><div>${buyerLabel}</div></div>
</div>
<div id="dealTimeline-${deal.id}" style="font-size:11px; color:var(--muted); padding:0 4px;">Загрузка истории...</div>
</div>`;
}

function loadDealTimelineInline(orderCode, skinId){
if (!tg || !tg.initData) return;
const el = document.getElementById('dealTimeline-' + skinId);
if (!el) return;
fetch(API_BASE + '/api/deals/' + skinId + '/history?init_data=' + encodeURIComponent(tg.initData))
.then(r => r.json())
.then(data => {
const history = data.history || [];
if (!history.length){
el.innerHTML = '';
return;
}
el.innerHTML = (data.order_code ? `<div style="font-family:'JetBrains Mono', monospace; margin-bottom:4px;">${data.order_code}</div>` : '') + history.map(h => {
const t = h.created_at ? new Date(h.created_at).toLocaleString(currentLang === 'uz' ? 'uz-UZ' : (currentLang === 'en' ? 'en-US' : 'ru-RU'), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
const label = getOrderStatusLabel(h.status);
return `<div style="display:flex; justify-content:space-between; gap:8px; padding:2px 0;"><span>✓ ${label}</span><span>${t}</span></div>`;
}).join('');
})
.catch(() => {
el.innerHTML = '';
});
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
.catch(err => showAlert(friendlyErrorMessage(err)));
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
.catch(() => showAlert('Не удалось обновить статус.'));
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
.catch(() => showAlert('Не удалось обновить статус.'));
});
}

if (disputedBtn){
const id = disputedBtn.dataset.markDisputed;
showConfirm('Продавец отметил «Отправил», но предмет не пришёл? Админ получит уведомление и разберётся в споре.', () => {
fetch(API_BASE + '/api/skins/' + id + '/mark_disputed', {
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
.then(() => { showAlert('Спор создан, админ разберётся.'); loadDeals(); })
.catch(err => showAlert(err.message || 'Не удалось создать спор.'));
});
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
.catch(err => showAlert(friendlyErrorMessage(err)));
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
.catch(err => showAlert(friendlyErrorMessage(err)));
}
});

