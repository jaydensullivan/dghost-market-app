// ============================================================
// МОИ СДЕЛКИ (трекинг без кастодии)
// ============================================================

function formatDealCountdown(releaseAtIso){
if (!releaseAtIso) return '';
const remainingMs = new Date(releaseAtIso).getTime() - Date.now();
const cd = I18N[currentLang] || I18N.ru;
if (remainingMs <= 0) return cd.deal_cd_soon;
const totalMinutes = Math.floor(remainingMs / 60000);
const days = Math.floor(totalMinutes / 1440);
const hours = Math.floor((totalMinutes % 1440) / 60);
const minutes = totalMinutes % 60;
if (days > 0) return cd.deal_cd_dh.replace('{d}', days).replace('{h}', hours);
if (hours > 0) return cd.deal_cd_hm.replace('{h}', hours).replace('{m}', minutes);
return cd.deal_cd_m.replace('{m}', minutes);
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
if (key === 'transfer'){
if (selling) hint = deal.trade_requested_at ? dict.hint_seller_accept : dict.hint_seller_send;
else if (deal.trade_requested_at) hint = dict.hint_buyer_requested;
else hint = deal.request_trade_url ? dict.hint_buyer_request : dict.hint_buyer_wait_send;
}
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

// Подтверждённый Steam собеседника — чтобы сверить ник с окном
// обмена в Steam и не попасть на подменённый аккаунт.
function partnerSteamHtml(deal){
const dict = I18N[currentLang] || I18N.ru;
const ps = deal.partner_steam;
if (!ps) return '';
if (!ps.steam_verified) return `<div class="deal-partner-steam">${dict.deal_partner_steam_unverified}</div>`;
const avatar = ps.steam_avatar ? `<img src="${escapeHtml(ps.steam_avatar)}" alt="">` : '';
return `<div class="deal-partner-steam">${avatar}<span>${dict.deal_partner_steam}: <b>${escapeHtml(ps.steam_persona || 'Steam')}</b> ✅</span></div>`;
}

// Памятка продавцу: в обмен могут подложить его другие предметы или
// прислать обмен с поддельного аккаунта. Проверить до «Принять».
function tradeSafetyHtml(deal){
const dict = I18N[currentLang] || I18N.ru;
const ps = deal.partner_steam;
const who = ps && ps.steam_verified && ps.steam_persona ? ps.steam_persona : dict.safety_buyer_fallback;
const items = [
dict.safety_only_item.replace('{title}', deal.title),
dict.safety_partner.replace('{name}', who),
dict.safety_no_strangers,
dict.safety_guard,
];
return `<div class="deal-safety">
<div class="deal-safety-title">${dict.safety_title}</div>
<ol>${items.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ol>
<div class="deal-safety-foot">${dict.safety_doubt}</div>
</div>`;
}

function dealCardHtml(deal){
const dict = I18N[currentLang] || I18N.ru;

const photo = deal.photo_url
? `<img class="deal-photo" src="${escapeHtml(deal.photo_url)}" alt="">`
: `<div class="deal-photo" style="display:flex;align-items:center;justify-content:center;">${TARGET_ICON}</div>`;

// Блоки под прогрессом: последний шаг, памятка, подсказки.
let extraHtml = '';
let actionHtml = '';

if (deal.role === 'selling'){
if (deal.sent_at && deal.confirmed_at){
} else if (deal.sent_at){
} else {
if (deal.trade_requested_at){
// Покупатель уже прислал обмен с этим предметом — продавцу только
// принять его в Steam и подтвердить в Steam Guard.
extraHtml += tradeSafetyHtml(deal);
actionHtml = `<button class="deal-action" data-open-incoming="${deal.id}" type="button">${dict.btn_open_incoming}</button>
<button class="deal-action" data-accepted-trade="${deal.id}" type="button">${dict.btn_accepted_trade}</button>`;
} else {
// Кнопка обмена — только если у покупателя есть ссылка. Иначе
// показываем причину, чтобы продавец не искал кнопку впустую.
if (deal.partner_trade_link){
extraHtml += tradeSafetyHtml(deal);
actionHtml = `<button class="deal-action" data-open-trade="${deal.id}" type="button">${dict.btn_open_trade}</button>`;
if (IS_DESKTOP && deal.asset_id){
extraHtml += `<div class="deal-hint">${dict.trade_ext_hint} <a href="#" data-trade-ext>${dict.trade_ext_link}</a></div>`;
}
} else {
extraHtml += `<div class="deal-hint">${dict.dlv_no_link}</div>`;
}
actionHtml += `<button class="deal-action" data-mark-sent="${deal.id}" type="button">${dict.btn_sent}</button>`;
}
actionHtml += `<button class="deal-action secondary" data-cancel-sale="${deal.id}" type="button">${dict.btn_cancel_sale}</button>`;
if (deal.inspect_link){
actionHtml += `<button class="deal-action secondary" data-inspect-skin="${deal.id}" type="button">${dict.btn_inspect_item}</button>`;
}
}
} else {
if (deal.confirmed_at){
actionHtml = deal.my_review
? `<div class="deal-my-review">${dict.rv_yours}: ${'★'.repeat(deal.my_review.rating)}${'☆'.repeat(5 - deal.my_review.rating)}</div>`
: `<button class="deal-action" data-rate-seller="${deal.id}" type="button">${dict.btn_rate_seller}</button>`;
} else if (deal.disputed_at){
actionHtml = `<button class="deal-action secondary" data-add-evidence="${deal.id}" type="button">${dict.btn_add_evidence}</button>`;
} else if (deal.sent_at){
actionHtml = `<button class="deal-action" data-mark-received="${deal.id}" type="button">${dict.btn_received}</button>
<button class="deal-action secondary" data-mark-disputed="${deal.id}" type="button">${dict.btn_not_received}</button>`;
} else {
if (deal.request_trade_url){
if (deal.trade_requested_at){
actionHtml = `<button class="deal-action secondary" data-request-trade="${deal.id}" type="button">${dict.btn_request_again}</button>`;
} else {
// Главный шаг покупателя после оплаты — отдельным заметным блоком.
extraHtml += `<div class="deal-last-step">
<div class="deal-last-step-title">${dict.last_step_title}</div>
<div class="deal-last-step-text">${dict.last_step_text}</div>
<button class="deal-action deal-last-step-btn" data-request-trade="${deal.id}" type="button">${dict.btn_request_trade}</button>
${tradeRequestOpened.has(deal.id) ? `<button class="deal-action" data-request-done="${deal.id}" type="button">${dict.btn_request_done}</button>` : ''}
</div>`;
}
}
}
}

const roleLabel = deal.role === 'selling' ? dict.role_selling : dict.role_buying;
const counterpartyLabel = deal.role === 'selling' ? dict.detail_buyer : dict.detail_seller;

const messageBtn = `<button class="deal-action secondary" data-relay="${deal.id}" type="button">${dict.btn_message}</button>`;

return `
<div class="deal-card" style="flex-direction:column; align-items:stretch;">
<div style="display:flex; gap:10px;">
${photo}
<div class="deal-info">
<div class="deal-title">${escapeHtml(deal.title)}</div>
<div class="deal-meta">${roleLabel} · ${escapeHtml(counterpartyLabel)} · ${formatCoins(deal.price)}</div>
${partnerSteamHtml(deal)}
</div>
</div>
<div id="dealProgress-${deal.id}">${dealProgressHtml(deal)}</div>
${extraHtml}
<div class="deal-actions" style="margin-top:8px;">${actionHtml}${messageBtn}<button class="deal-action secondary" data-trade-details="${deal.id}" type="button">${dict.btn_deal_details}</button><button class="deal-action secondary" data-deal-help="${deal.id}" type="button">${dict.deal_help}</button></div>
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

// Сделки, где покупатель уже открыл ссылку «Запросить предмет» — для
// них показываем кнопку «Я отправил запрос».
const tradeRequestOpened = new Set();

// Оплаты переводом покупателя: «на проверке» и недавно решённые —
// чтобы после отправки чека было видно, что с деньгами.
const P2P_STATUS_META = {
pending: { icon: '⏳', cls: 'pending' },
approved: { icon: '✅', cls: 'done' },
rejected: { icon: '❌', cls: 'failed' },
refund_due: { icon: '↩️', cls: 'pending' },
refunded: { icon: '↩️', cls: 'done' },
};
function p2pStatusCardHtml(o){
const dict = I18N[currentLang] || I18N.ru;
const meta = P2P_STATUS_META[o.status] || P2P_STATUS_META.pending;
const mins = Math.max(0, Math.round((Date.now() - new Date(o.created_at).getTime()) / 60000));
const ago = mins < 60 ? dict.p2p_st_ago_min.replace('{n}', mins) : dict.p2p_st_ago_h.replace('{n}', Math.round(mins / 60));
return `<div class="deal-card p2p-status-card ${meta.cls}" style="flex-direction:column; align-items:stretch;">
<div class="deal-info">
<div class="deal-title">${meta.icon} ${escapeHtml(dict['p2p_st_' + o.status] || o.status)}</div>
<div class="deal-meta">${escapeHtml(o.skin_title || ('#' + o.skin_id))} · ${formatCoins(o.amount)} · ${escapeHtml(ago)}</div>
<div class="deal-hint">${escapeHtml(dict['p2p_st_hint_' + o.status] || '')}</div>
</div>
</div>`;
}

function loadP2pStatus(){
const box = document.getElementById('p2pStatusList');
if (!box || !tg || !tg.initData) return;
fetch(API_BASE + '/api/p2p_skin_orders/mine?init_data=' + encodeURIComponent(tg.initData))
.then(r => r.ok ? r.json() : { items: [] })
.then(data => {
const items = (data && data.items) || [];
const dict = I18N[currentLang] || I18N.ru;
box.innerHTML = items.length
? `<div class="profile-section-title" style="margin:0 0 8px;">${dict.p2p_st_title}</div>` + items.map(p2pStatusCardHtml).join('') + '<div style="height:10px"></div>'
: '';
})
.catch(() => { box.innerHTML = ''; });
}

function loadDeals(){
const dict = I18N[currentLang] || I18N.ru;
const dealsList = document.getElementById('dealsList');
loadP2pStatus();
if (!tg || !tg.initData){
dealsList.innerHTML = `<div class="skins-empty skins-empty-md">${dict.open_via_telegram}</div>`;
return;
}
fetch(API_BASE + '/api/deals?init_data=' + encodeURIComponent(tg.initData))
.then(r => r.json())
.then(data => {
lastDeals = (data && data.items) || [];
if (!lastDeals.length){
dealsList.innerHTML = `<div class="skins-empty skins-empty-md">${dict.no_active_deals}</div>`;
return;
}
dealsList.innerHTML = lastDeals.map(dealCardHtml).join('');
lastDeals.forEach(deal => loadDealTimelineInline(null, deal.id));
})
.catch(() => {
dealsList.innerHTML = '<div class="skins-empty skins-empty-md">' + (I18N[currentLang] || I18N.ru).deals_load_failed + '</div>';
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
el.innerHTML = `<div class="skins-empty skins-empty-md">${dict.trade_none}</div>`;
return;
}
el.innerHTML = active.map(tradeOfferCardHtml).join('');
})
.catch(() => {
el.innerHTML = `<div class="skins-empty skins-empty-md">${dict.load_failed}</div>`;
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
const rateBtn = e.target.closest('[data-rate-seller]');
if (rateBtn){
openReviewForm(Number(rateBtn.dataset.rateSeller));
return;
}
if (evidenceBtn){
openDisputeForm(Number(evidenceBtn.dataset.addEvidence), 'add');
return;
}
const cancelBtn = e.target.closest('[data-cancel-sale]');
const relayBtn = e.target.closest('[data-relay]');
const inspectBtn = e.target.closest('[data-inspect-skin]');
const detailsBtn = e.target.closest('[data-trade-details]');
const helpBtn = e.target.closest('[data-deal-help]');

// Поддержка по этой сделке — тема и номер лота подставлены сами.
if (helpBtn){
openSupport({ topic: 'deal', skinId: Number(helpBtn.dataset.dealHelp) });
return;
}

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
.then(async r => {
if (!r.ok){
// Показываем код и текст ответа: иначе любая причина
// выглядит одинаково и разбираться не с чем.
const detail = await r.text().catch(() => '');
throw new Error(`HTTP ${r.status}${detail ? ' · ' + detail.slice(0, 80) : ''}`);
}
return r.blob();
})
.then(blob => {
img.src = URL.createObjectURL(blob);
img.style.display = '';
status.style.display = 'none';
})
.catch(err => {
status.textContent = (I18N[currentLang] || I18N.ru).combo_preview_failed
+ (err && err.message ? ' · ' + err.message : '');
console.error('Превью предмета:', err);
});
return;
}

if (sentBtn){
const id = sentBtn.dataset.markSent;
showConfirm((I18N[currentLang] || I18N.ru).deal_confirm_sent, () => {
fetch(API_BASE + '/api/skins/' + id + '/mark_sent', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData })
})
.then(r => { if (!r.ok) throw new Error(); return r.json(); })
.then(() => loadDeals())
.catch(() => showErrorToast(new Error((I18N[currentLang] || I18N.ru).deal_status_update_failed)));
});
}

if (receivedBtn){
const id = receivedBtn.dataset.markReceived;
showConfirm((I18N[currentLang] || I18N.ru).deal_confirm_received, () => {
fetch(API_BASE + '/api/skins/' + id + '/mark_received', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData })
})
.then(r => { if (!r.ok) throw new Error(); return r.json(); })
.then(() => loadDeals())
.catch(() => showErrorToast(new Error((I18N[currentLang] || I18N.ru).deal_status_update_failed)));
});
}

if (disputedBtn){
openDisputeForm(Number(disputedBtn.dataset.markDisputed), 'open');
}

if (cancelBtn){
const id = cancelBtn.dataset.cancelSale;
showConfirm((I18N[currentLang] || I18N.ru).deal_confirm_cancel_sale, () => {
fetch(API_BASE + '/api/skins/' + id + '/cancel_sale', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData })
})
.then(async r => {
if (!r.ok){
const data = await r.json().catch(() => ({}));
if (data.error === 'already_sent') throw new Error((I18N[currentLang] || I18N.ru).deal_cancel_already_sent);
throw new Error((I18N[currentLang] || I18N.ru).deal_cancel_failed);
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
showAlert(data.role_label === 'продавца' ? (I18N[currentLang] || I18N.ru).relay_to_seller : (I18N[currentLang] || I18N.ru).relay_to_buyer);
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


// ============================================================
// ОБМЕН В ОДИН ШАГ И АВТОПОДТВЕРЖДЕНИЕ ДОСТАВКИ
//
// Ссылка вида steamcommunity.com/tradeoffer/new/?partner=…&token=…
// открывает окно обмена сразу с нужным человеком. Подставить в неё
// конкретный предмет Steam не даёт — скин продавец выбирает сам.
//
// Зато после возвращения в приложение проверять на слово никого не
// нужно: сервер сверяет инвентари по asset_id и сам двигает сделку.
// ============================================================

let pendingDeliveryCheck = null;

// Ссылку на обмен пользователь вставляет сам — бывает без «https://»
// или с лишним текстом вокруг. Telegram такую не открывает (openLink
// бросает ошибку, и кнопка «молчит»), поэтому собираем ссылку заново
// из partner, token и for_item.
function steamTradeUrl(raw){
const s = String(raw || '');
const partner = (s.match(/partner=(\d+)/) || [])[1];
if (!partner) return null;
const token = (s.match(/token=([\w-]+)/) || [])[1];
const forItem = (s.match(/for_item=([\d_]+)/) || [])[1];
let url = 'https://steamcommunity.com/tradeoffer/new/?partner=' + partner;
if (token) url += '&token=' + token;
if (forItem) url += '&for_item=' + forItem;
return url;
}

// Открыть внешнюю ссылку; если не вышло — скопировать её и сказать об этом.
// На телефоне ссылки Steam идут через go.html: на iPhone с приложением
// Steam Telegram отдаёт ссылку обмена приложению, и она молча теряется,
// а переход со своей страницы остаётся в браузере.
function openSteamLink(url){
const dict = I18N[currentLang] || I18N.ru;
if (!IS_DESKTOP && /^https:\/\/steamcommunity\.com\//.test(url)){
url = location.origin + '/go.html?to=' + encodeURIComponent(url);
}
try {
if (tg && tg.openLink) tg.openLink(url);
else window.open(url, '_blank');
return;
} catch (e) {}
navigator.clipboard?.writeText(url).catch(() => {});
showToast(dict.steam_link_copied, { type: 'error', duration: 7000 });
}

// Расширение DGhost Trade (extension/) на компьютере находит предмет по
// dghost_asset и создаёт обмен само; Steam лишние параметры игнорирует.
const IS_DESKTOP = !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
const TRADE_EXTENSION_URL = 'https://app.dghostmarket.com/extension/';

function openSteamTrade(deal){
let url = steamTradeUrl(deal.partner_trade_link);
if (url && deal.asset_id){
url += '&dghost_asset=' + encodeURIComponent(deal.asset_id) + '&dghost_deal=' + encodeURIComponent(deal.id);
}
const dict = I18N[currentLang] || I18N.ru;
if (!url){
showToast(dict.dlv_no_link, { type: 'error', duration: 6000 });
return;
}
pendingDeliveryCheck = deal.id;
haptic('light');
showToast(dict.dlv_hint, { type: 'info', duration: 5000 });
showTradeLinkFallback(deal.id, url);
openSteamLink(url);
}

// Запасной путь: на части телефонов Telegram молча не открывает ссылку
// Steam. Под кнопкой появляется «Скопировать ссылку» — её можно вставить
// в браузер или открыть из чата.
const tradeLinkFallbacks = {};
function showTradeLinkFallback(dealId, url){
tradeLinkFallbacks[dealId] = url;
const btn = document.querySelector(`[data-open-trade="${dealId}"]`);
if (!btn || document.querySelector(`[data-copy-trade="${dealId}"]`)) return;
const dict = I18N[currentLang] || I18N.ru;
btn.insertAdjacentHTML('afterend',
`<button class="deal-action secondary" data-copy-trade="${dealId}" type="button">${dict.btn_copy_trade_link}</button>`);
}

document.addEventListener('click', (e) => {
const btn = e.target.closest('[data-copy-trade]');
if (!btn) return;
const dict = I18N[currentLang] || I18N.ru;
const url = tradeLinkFallbacks[btn.dataset.copyTrade];
if (!url) return;
const done = () => showToast(dict.trade_link_copied, { type: 'success', duration: 7000 });
if (navigator.clipboard && navigator.clipboard.writeText){
navigator.clipboard.writeText(url).then(done).catch(() => showAlert(url));
} else {
showAlert(url);
}
});

function checkDelivery(skinId, silent){
const dict = I18N[currentLang] || I18N.ru;
if (!tg || !tg.initData) return;
if (!silent) showToast(dict.dlv_checking, { type: 'info', duration: 2500 });

fetch(API_BASE + '/api/skins/' + skinId + '/check_delivery', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData })
})
.then(r => r.json())
.then(data => {
if (data.state === 'delivered'){
showToast(dict.dlv_delivered, { type: 'success' });
loadDeals();
} else if (!silent){
showToast(
data.state === 'pending' ? dict.dlv_pending : dict.dlv_unknown,
{ type: data.state === 'pending' ? 'info' : 'error' }
);
}
})
.catch(() => {});
}

document.addEventListener('click', (e) => {
const link = e.target.closest('[data-trade-ext]');
if (!link) return;
e.preventDefault();
openSteamLink(TRADE_EXTENSION_URL);
});

document.addEventListener('click', (e) => {
const btn = e.target.closest('[data-open-trade]');
if (!btn) return;
const deal = lastDeals.find(d => d.id === Number(btn.dataset.openTrade));
if (deal) openSteamTrade(deal);
});

// Вернулись из Steam — сразу проверяем, доехал ли предмет.
document.addEventListener('visibilitychange', () => {
if (document.hidden || !pendingDeliveryCheck) return;
const skinId = pendingDeliveryCheck;
pendingDeliveryCheck = null;
// Небольшая пауза: Steam не мгновенно обновляет инвентарь.
setTimeout(() => checkDelivery(skinId, false), 3000);
});


// ============================================================
// ЗАПРОС ПРЕДМЕТА ПОКУПАТЕЛЕМ
//
// Покупатель открывает обмен с продавцом по ссылке с for_item —
// проданный предмет уже указан, остаётся нажать «Предложить обмен».
// Продавцу приходит входящий обмен: принять и подтвердить в Steam
// Guard, без выбора предмета. Если Steam предмет сам не выберет,
// покупатель найдёт его в инвентаре продавца — по его ответу мы
// узнаём, работает ли for_item.
// ============================================================

function postTradeRequested(skinId, preselected){
const dict = I18N[currentLang] || I18N.ru;
fetch(API_BASE + '/api/skins/' + skinId + '/trade_requested', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData, preselected: preselected })
})
.then(r => { if (!r.ok) throw new Error(); return r.json(); })
.then(() => {
tradeRequestOpened.delete(skinId);
showToast(dict.req_sent_ok, { type: 'success' });
loadDeals();
})
.catch(() => showErrorToast(new Error(dict.load_failed)));
}

document.addEventListener('click', (e) => {
const dict = I18N[currentLang] || I18N.ru;

const reqBtn = e.target.closest('[data-request-trade]');
if (reqBtn){
const deal = lastDeals.find(d => d.id === Number(reqBtn.dataset.requestTrade));
if (!deal || !deal.request_trade_url) return;
haptic('light');
showToast(dict.req_open_hint, { type: 'info', duration: 7000 });
if (!deal.trade_requested_at){
tradeRequestOpened.add(deal.id);
reqBtn.insertAdjacentHTML('afterend', `<button class="deal-action" data-request-done="${deal.id}" type="button">${dict.btn_request_done}</button>`);
}
openSteamLink(steamTradeUrl(deal.request_trade_url) || deal.request_trade_url);
return;
}

const doneBtn = e.target.closest('[data-request-done]');
if (doneBtn){
const skinId = Number(doneBtn.dataset.requestDone);
showPopupSafe({
message: dict.req_preselected_q,
buttons: [
{ id: 'yes', type: 'default', text: dict.req_yes },
{ id: 'no', type: 'default', text: dict.req_no },
{ id: 'cancel', type: 'cancel' },
]
}, (id) => {
if (id === 'yes') postTradeRequested(skinId, true);
else if (id === 'no') postTradeRequested(skinId, false);
});
return;
}

const incomingBtn = e.target.closest('[data-open-incoming]');
if (incomingBtn){
const deal = lastDeals.find(d => d.id === Number(incomingBtn.dataset.openIncoming));
if (!deal || !deal.incoming_offers_url) return;
haptic('light');
showToast(dict.hint_seller_accept, { type: 'info', duration: 7000 });
openSteamLink(deal.incoming_offers_url);
return;
}

const acceptedBtn = e.target.closest('[data-accepted-trade]');
if (acceptedBtn){
const skinId = Number(acceptedBtn.dataset.acceptedTrade);
showConfirm(dict.accepted_confirm, () => {
fetch(API_BASE + '/api/skins/' + skinId + '/mark_sent', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData, accepted: true })
})
.then(r => { if (!r.ok) throw new Error(); return r.json(); })
.then(() => {
loadDeals();
// Предмет уже у покупателя — сразу пробуем засчитать передачу.
setTimeout(() => checkDelivery(skinId, true), 4000);
})
.catch(() => showErrorToast(new Error(dict.load_failed)));
});
}
});
