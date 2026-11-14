// ============================================================
// ПАНЕЛЬ АДМИНИСТРАТОРА
// ============================================================

function adminApiFetch(path, opts){
opts = opts || {};
if (!tg || !tg.initData){
return Promise.reject(new Error(errorMessage('unauthorized')));
}
const isGet = !opts.method || opts.method === 'GET';
const url = isGet
? API_BASE + path + (path.includes('?') ? '&' : '?') + 'init_data=' + encodeURIComponent(tg.initData)
: API_BASE + path;
const fetchOpts = {
method: opts.method || 'GET',
};
if (!isGet){
fetchOpts.headers = { 'Content-Type': 'application/json' };
fetchOpts.body = JSON.stringify(Object.assign({ init_data: tg.initData }, opts.body || {}));
}
return fetch(url, fetchOpts).then(async r => {
if (!r.ok){
const data = await r.json().catch(() => ({}));
throw new Error(errorMessage(data.error) || 'Ошибка');
}
return r.json();
});
}

const ADMIN_ONLY_SECTIONS = new Set([
'adminKycSection','adminTopupsSection','adminP2pSection','adminDepositsSection','adminWithdrawalsSection','adminTopupDetailsSection',
'adminCommissionSection','adminFinanceSummarySection','adminPromoSection','adminReferralSection',
'adminPeopleSection','adminDealsSection','adminBalanceSection',
'adminHoldsSection','adminReportSection','adminDisputesSection',
'adminClientsSection','adminFraudSection',
'adminStatusSection','adminGiveawaySection','adminReelsSection'
]);

function hasChipPermission(chip){
if (isOwner) return true;
// «Поддержка» — и операторам поддержки (роль support_admins, не полные админы); сервер решает сам.
if (chip === 'support' && isSupportStaff) return true;
if (!isAdmin) return false;
// Владелец видит все чипы всегда. Организатор аукционов
// (isAuctioneer, не полный админ) — только "Аукцион", без
// системы прав (это отдельная, более старая роль).
if (!adminPermissions.length && isAuctioneer && !isAdmin) return chip === 'auction';
return adminPermissions.includes(chip);
}

// Раздел админки (кнопка сверху) и права — разные вещи: блок лежит в
// разделе data-view, а доступ к нему даёт право data-group (как на
// сервере). Например, «Витрина» собирает аукционы, раздачу и сеты —
// у каждого своё право; кнопка видна, если доступен хоть один блок.
function sectionAllowed(el){
return (!ADMIN_ONLY_SECTIONS.has(el.id) || isAdmin) && hasChipPermission(el.dataset.group);
}

function chipAllowed(view){
return [...document.querySelectorAll('.admin-group')].some(el => (el.dataset.view || el.dataset.group) === view && sectionAllowed(el));
}

function applyChipVisibility(){
document.querySelectorAll('#adminChips [data-admin-group]').forEach(chip => {
chip.style.display = chipAllowed(chip.dataset.adminGroup) ? '' : 'none';
});
}

let currentAdminChip = 'overview';

function applyAdminChipFilter(group){
currentAdminChip = group;
document.querySelectorAll('.admin-group').forEach(el => {
const matchesView = (el.dataset.view || el.dataset.group) === group;
el.style.display = (matchesView && sectionAllowed(el)) ? '' : 'none';
});
}

document.getElementById('adminChips').addEventListener('click', (e) => {
const chip = e.target.closest('[data-admin-group]');
if (!chip) return;
document.querySelectorAll('#adminChips .category-chip').forEach(c => c.classList.remove('active'));
chip.classList.add('active');
applyAdminChipFilter(chip.dataset.adminGroup);
loadAdminCounts();
if (chip.dataset.adminGroup === 'support') loadAdminSupport();
if (chip.dataset.adminGroup === 'overview' && isAdmin){
startAdminStatsLive();
} else {
stopAdminStatsLive();
}
});

// ---------------- Сеты оружия (админка) ----------------

let adminSetSelectedSkinIds = new Set();
let adminSetSkinsPool = [];
let adminSetDiscountType = 'percent';

function loadAdminSetSkinPicker(){
const picker = document.getElementById('setSkinPicker');
adminApiFetch('/api/admin/skins_for_sets')
.then(data => {
adminSetSkinsPool = data.items || [];
if (!adminSetSkinsPool.length){
picker.innerHTML = `<div class="skins-empty skins-empty-sm">${(I18N[currentLang] || I18N.ru).admin_no_lots}</div>`;
return;
}
picker.innerHTML = adminSetSkinsPool.map(s => {
const photo = s.photo_url ? `<img src="${escapeHtml(s.photo_url)}" alt="" onerror="this.style.display='none'">` : '';
const title = (s.stattrak ? 'StatTrak™ ' : '') + escapeHtml(s.title);
return `<div class="admin-skin-picker-item" data-skin-id="${s.id}">
${photo}
<div class="admin-skin-picker-name">${title}</div>
<div class="admin-skin-picker-price">${formatCoins(s.price)}</div>
</div>`;
}).join('');
})
.catch(() => {
picker.innerHTML = `<div class="skins-empty skins-empty-sm">${(I18N[currentLang] || I18N.ru).load_failed}</div>`;
});
}

document.getElementById('setSkinPicker').addEventListener('click', (e) => {
const item = e.target.closest('.admin-skin-picker-item');
if (!item) return;
const skinId = Number(item.dataset.skinId);
if (adminSetSelectedSkinIds.has(skinId)){
adminSetSelectedSkinIds.delete(skinId);
item.classList.remove('selected');
} else {
adminSetSelectedSkinIds.add(skinId);
item.classList.add('selected');
}
});

document.querySelectorAll('.set-discount-type-btn').forEach(btn => {
btn.addEventListener('click', () => {
adminSetDiscountType = btn.dataset.discountType;
document.querySelectorAll('.set-discount-type-btn').forEach(b => b.classList.toggle('active', b === btn));
document.getElementById('setDiscountValue').placeholder =
adminSetDiscountType === 'percent' ? '10 (значит -10%)' : 'Итоговая цена сета, сум';
});
});

document.getElementById('setCreateBtn').addEventListener('click', () => {
const status = document.getElementById('setCreateStatus');
const title = document.getElementById('setTitle').value.trim();
const description = document.getElementById('setDescription').value.trim();
const discountValue = Number(document.getElementById('setDiscountValue').value);
const skinIds = Array.from(adminSetSelectedSkinIds);

if (!title){ status.textContent = (I18N[currentLang] || I18N.ru).admin_need_title; return; }
if (skinIds.length < 2){ status.textContent = (I18N[currentLang] || I18N.ru).admin_need_min_2_lots; return; }
if (!discountValue || discountValue < 0){ status.textContent = (I18N[currentLang] || I18N.ru).admin_need_discount; return; }

status.textContent = '...';

adminApiFetch('/api/admin/sets', {
method: 'POST',
body: {
title, description,
discount_type: adminSetDiscountType,
discount_value: discountValue,
skin_ids: skinIds,
}
})
.then(data => {
if (!data.ok) throw data;
status.textContent = '✅ Сет создан';
document.getElementById('setTitle').value = '';
document.getElementById('setDescription').value = '';
document.getElementById('setDiscountValue').value = '';
adminSetSelectedSkinIds.clear();
loadAdminSetSkinPicker();
loadAdminSetsList();
})
.catch(err => { status.textContent = friendlyErrorMessage(err); });
});

function loadAdminSetsList(){
const list = document.getElementById('adminSetsList');
adminApiFetch('/api/admin/sets')
.then(data => {
const items = data.items || [];
if (!items.length){
list.innerHTML = `<div class="skins-empty skins-empty-sm">${(I18N[currentLang] || I18N.ru).admin_no_sets}</div>`;
return;
}
list.innerHTML = items.map(it => `
<div class="deal-card" style="flex-direction:column; align-items:stretch;">
<div class="deal-info">
<div class="deal-title">${escapeHtml(it.title)} ${it.is_active ? '' : `(${(I18N[currentLang] || I18N.ru).admin_set_deactivated})`}</div>
<div class="deal-meta">${formatCoins(it.set_price)} вместо ${formatCoins(it.individual_total)} (-${it.discount_percent}%)</div>
</div>
${it.is_active ? `<div class="deal-actions"><button class="deal-action secondary" data-deactivate-set="${it.id}" type="button">${(I18N[currentLang] || I18N.ru).admin_btn_deactivate_set}</button></div>` : ''}
</div>`).join('');
})
.catch(() => {
list.innerHTML = `<div class="skins-empty skins-empty-sm">${(I18N[currentLang] || I18N.ru).load_failed}</div>`;
});
}

document.getElementById('adminSetsList').addEventListener('click', (e) => {
const btn = e.target.closest('[data-deactivate-set]');
if (!btn) return;
showConfirm((I18N[currentLang] || I18N.ru).admin_confirm_deactivate_set, () => {
adminApiFetch('/api/admin/sets/' + btn.dataset.deactivateSet + '/deactivate', { method: 'POST' })
.then(() => { loadAdminSetsList(); loadAdminSetSkinPicker(); loadSkins(); })
.catch(err => showErrorToast(err));
});
});

// ---------------- История аукционов / розыгрышей ----------------

function eventStatusLabel(status){
const labels = {
completed: '🏆 Завершён',
no_bids: '❌ Без ставок',
cancelled: '🚫 Отменён',
ended: '⏹ Завершился',
winner_picked: 'Победитель выбран',
};
return labels[status] || status;
}

function formatHistoryDate(iso){
if (!iso) return '';
try {
const d = new Date(iso);
return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
} catch(e){ return ''; }
}

function renderHistoryList(items){
if (!items.length){
return `<div class="skins-empty skins-empty-sm">${(I18N[currentLang] || I18N.ru).admin_empty}</div>`;
}
return items.map(it => `
<div class="deal-card" style="flex-direction:column; align-items:stretch;">
<div class="deal-info">
<div class="deal-title">${escapeHtml(it.title || '—')}</div>
<div class="deal-meta">${eventStatusLabel(it.status)}${it.final_value ? ' · ' + escapeHtml(it.final_value) : ''}</div>
${it.winner_username ? `<div class="deal-meta">${escapeHtml(it.winner_username)}</div>` : ''}
<div class="deal-meta">${formatHistoryDate(it.ended_at)}</div>
</div>
</div>`).join('');
}

function loadAdminEventsHistory(){
adminApiFetch('/api/admin/events/history')
.then(data => {
const items = data.items || [];
const auctionItems = items.filter(it => it.event_type === 'auction');
const auctionEl = document.getElementById('adminAuctionHistoryList');
if (auctionEl) auctionEl.innerHTML = renderHistoryList(auctionItems);
})
.catch(() => {});
}

function loadAdminPanel(){
applyChipVisibility();

if (!chipAllowed(currentAdminChip)){
const firstAllowed = document.querySelector('#adminChips [data-admin-group]:not([style*="display: none"])');
if (firstAllowed){
document.querySelectorAll('#adminChips .category-chip').forEach(c => c.classList.remove('active'));
firstAllowed.classList.add('active');
currentAdminChip = firstAllowed.dataset.adminGroup;
}
}

applyAdminChipFilter(currentAdminChip);

if (hasChipPermission('support') && !applySupportStaffDeepLink()) loadAdminSupport();

// Оператор поддержки (только поддержка) — остальные разделы ему не нужны.
if (!isAdmin && !isAuctioneer) return;

loadAdminSkinPicker();
loadAdminActiveAuctions();
loadAdminStatus();

if (isAdmin || isAuctioneer){
loadSavedEmojis(null);
}

if (currentAdminChip === 'overview' && isAdmin){
startAdminStatsLive();
}

if (!isAdmin) return;

if (currentAdminChip === 'reels') loadAdminReels();

loadAdminDeals();
loadAdminHolds();
loadAdminGiveawayPanel();
loadAdminEventsHistory();
loadAdminSetSkinPicker();
loadAdminSetsList();
loadAdminKyc();
loadAdminTopups();
loadAdminP2pOrders();
loadAdminDeposits();
loadAdminWithdrawals();
loadAdminDisputes();
loadAdminFraud();
loadAdminCounts();
loadAdminSettings();
loadAdminPeople();
loadAdminSellers();
}

// ---------------- Создание аукциона ----------------

// ---------------- Выбор лота для аукциона ----------------

let adminSelectedSkinId = null;
let adminAuctionSkins = [];

function loadAdminSkinPicker(){
const picker = document.getElementById('adminSkinPicker');
adminApiFetch('/api/admin/skins_for_auction')
.then(data => {
adminAuctionSkins = data.items || [];
if (!adminAuctionSkins.length){
picker.innerHTML = `<div class="skins-empty skins-empty-sm">${(I18N[currentLang] || I18N.ru).admin_no_skins}</div>`;
return;
}
picker.innerHTML = adminAuctionSkins.map(s => {
const photo = s.photo_url
? `<img src="${escapeHtml(s.photo_url)}" alt="" onerror="this.style.display='none'">`
: '';
const title = (s.stattrak ? 'StatTrak™ ' : '') + escapeHtml(s.title);
return `<div class="admin-skin-picker-item" data-skin-id="${s.id}">
${photo}
<div class="admin-skin-picker-name">${title}</div>
<div class="admin-skin-picker-price">${formatCoins(s.price)}</div>
</div>`;
}).join('');
})
.catch(() => {
picker.innerHTML = `<div class="skins-empty skins-empty-sm">${(I18N[currentLang] || I18N.ru).load_failed}</div>`;
});
}

document.getElementById('adminSkinPicker').addEventListener('click', (e) => {
const item = e.target.closest('.admin-skin-picker-item');
if (!item) return;

adminSelectedSkinId = Number(item.dataset.skinId);

document.querySelectorAll('.admin-skin-picker-item').forEach(el => {
el.classList.toggle('selected', Number(el.dataset.skinId) === adminSelectedSkinId);
});

const skin = adminAuctionSkins.find(s => s.id === adminSelectedSkinId);
const box = document.getElementById('adminSelectedSkin');
if (skin){
const photo = skin.photo_url
? `<img src="${escapeHtml(skin.photo_url)}" alt="" onerror="this.style.display='none'">`
: '';
const title = (skin.stattrak ? 'StatTrak™ ' : '') + escapeHtml(skin.title);
box.innerHTML = `${photo}<div><div class="admin-skin-picker-name">${title}</div><div class="admin-skin-picker-price">${formatCoins(skin.price)}</div></div>`;
box.style.display = 'flex';
}
});

// ---------------- Отправка предложения продавцу ----------------

document.getElementById('adminCreateAuctionBtn').addEventListener('click', () => {
const btn = document.getElementById('adminCreateAuctionBtn');
const status = document.getElementById('adminAuctionStatus');
const dict = I18N[currentLang] || I18N.ru;

const startPrice = Number(document.getElementById('aStartPrice').value);
const step = Number(document.getElementById('aStep').value);
const minutes = Number(document.getElementById('aMinutes').value);

if (!adminSelectedSkinId){
status.textContent = dict.admin_pick_skin_first;
return;
}

if (!startPrice || !step || !minutes){
status.textContent = dict.admin_fill_all_fields;
return;
}

const aCustomText = document.getElementById('aCustomPostText').value.trim();

if (!aCustomText){
status.textContent = (I18N[currentLang] || I18N.ru).admin_need_auction_post;
return;
}

btn.disabled = true;
status.textContent = dict.admin_sending_request;

const gwEmoji = getSelectedEmoji('aEmoji');

adminApiFetch('/api/admin/auction/propose', {
method: 'POST',
body: { skin_id: adminSelectedSkinId, start_price: startPrice, step: step, minutes: minutes, emoji: gwEmoji.emoji_char, emoji_id: gwEmoji.emoji_id, custom_post_text: aCustomText }
})
.then(() => {
status.textContent = dict.admin_request_sent;
document.getElementById('aStartPrice').value = '';
document.getElementById('aStep').value = '';
document.getElementById('aMinutes').value = '';
document.getElementById('aEmoji').value = '';
document.getElementById('aCustomPostText').value = '';
document.getElementById('aPreviewBox').style.display = 'none';
document.getElementById('adminSelectedSkin').style.display = 'none';
adminSelectedSkinId = null;
loadAdminSkinPicker();
loadAdminActiveAuctions();
})
.catch(err => { status.textContent = friendlyErrorMessage(err); })
.finally(() => { btn.disabled = false; });
});

// ---------------- Активные аукционы / отмена ----------------

function auctionBidsListHtml(bids, dict){
if (!bids || !bids.length){
return `<div class="skins-empty" style="padding:6px 4px; font-size:11px;">${dict.admin_no_bids_yet}</div>`;
}
return bids.map(b => `
<div class="admin-bid-row${b.is_leader ? ' leader' : ''}">
<span>${b.is_leader ? '👑 ' : ''}${escapeHtml(b.username)}</span>
<span>${formatCoins(b.amount)}</span>
</div>`).join('');
}

function loadAdminActiveAuctions(){
const activeList = document.getElementById('adminActiveAuctionsList');
const proposalsList = document.getElementById('adminPendingProposalsList');
const dict = I18N[currentLang] || I18N.ru;

adminApiFetch('/api/admin/auction/active')
.then(data => {
const active = data.active || [];
const proposals = data.proposals || [];

if (!active.length){
activeList.innerHTML = `<div class="skins-empty skins-empty-sm">${dict.admin_none_active}</div>`;
} else {
activeList.innerHTML = active.map(a => `
<div class="deal-card" style="flex-direction:column; align-items:stretch;">
<div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
<div class="deal-info">
<div class="deal-title">${escapeHtml(a.title)}</div>
<div class="deal-meta">${formatCoins(a.current_price)} · ${a.bid_count} ${dict.admin_bids_word}</div>
</div>
<div class="deal-actions">
<button class="deal-action secondary" data-cancel-active="${a.auction_id}" type="button">${dict.admin_btn_cancel}</button>
</div>
</div>
<div class="admin-bids-list">
${auctionBidsListHtml(a.bids, dict)}
</div>
</div>`).join('');
}

if (!proposals.length){
proposalsList.innerHTML = `<div class="skins-empty skins-empty-sm">${dict.admin_none_pending}</div>`;
} else {
proposalsList.innerHTML = proposals.map(p => `
<div class="deal-card">
<div class="deal-info">
<div class="deal-title">${escapeHtml(p.title)}</div>
</div>
<div class="deal-actions">
<button class="deal-action secondary" data-cancel-proposal="${p.skin_id}" type="button">${dict.admin_btn_cancel}</button>
</div>
</div>`).join('');
}
})
.catch(() => {
activeList.innerHTML = `<div class="skins-empty skins-empty-sm">${dict.load_failed}</div>`;
proposalsList.innerHTML = '';
});
}

document.getElementById('adminActiveAuctionsList').addEventListener('click', (e) => {
const btn = e.target.closest('[data-cancel-active]');
if (!btn) return;
showConfirm((I18N[currentLang] || I18N.ru).admin_confirm_cancel_active, () => {
adminApiFetch('/api/admin/auction/' + btn.dataset.cancelActive + '/cancel', { method: 'POST' })
.then(() => { loadAdminActiveAuctions(); loadAuctionsList(); loadAdminSkinPicker(); loadAdminEventsHistory(); })
.catch(err => showErrorToast(err));
});
});

document.getElementById('adminPendingProposalsList').addEventListener('click', (e) => {
const btn = e.target.closest('[data-cancel-proposal]');
if (!btn) return;
showConfirm((I18N[currentLang] || I18N.ru).admin_confirm_cancel_proposal, () => {
adminApiFetch('/api/admin/auction/proposal/' + btn.dataset.cancelProposal + '/cancel', { method: 'POST' })
.then(() => { loadAdminActiveAuctions(); loadAdminSkinPicker(); })
.catch(err => showErrorToast(err));
});
});

// ---------------- Активные сделки ----------------

let adminDealsData = [];
let adminDealsGroupMode = 'flat';

function dealStatusLabel(status){
const dict = I18N[currentLang] || I18N.ru;
if (status === 'confirmed') return dict.admin_deal_status_confirmed;
if (status === 'sent') return dict.admin_deal_status_sent;
return dict.admin_deal_status_pending;
}

function adminDealCardHtml(d){
const dict = I18N[currentLang] || I18N.ru;
return `<div class="deal-card">
<div class="deal-info">
<div class="deal-title">${escapeHtml(d.title)} — ${formatCoins(d.price)}</div>
<div class="deal-meta">${dict.admin_deal_seller}: ${escapeHtml(d.seller_username || String(d.seller_id))} · ${dict.admin_deal_buyer}: ${escapeHtml(d.buyer_username || String(d.buyer_id))}</div>
<div class="deal-meta">${dealStatusLabel(d.status)}${d.remaining ? ' · ' + d.remaining : ''}</div>
${d.risky_hold ? `<div class="deal-meta">⏳ ${escapeHtml(dict.admin_deal_hold_risky.replace('{reason}', d.hold_reason || dict.admin_deal_hold_reason_default))}</div>` : ''}
${d.paid_offline ? `<div class="deal-meta">${escapeHtml(dict.admin_deal_paid_offline.replace('{amount}', formatCoins(d.paid_offline)))}</div>` : ''}
</div>
<div class="deal-actions">
<button class="deal-action" data-finalize-deal="${d.skin_id}" type="button">${dict.admin_btn_finalize}</button>
<button class="deal-action secondary" data-refund-deal="${d.skin_id}" type="button">${dict.admin_btn_refund}</button>
${!d.paid_offline && !d.direct ? `<button class="deal-action secondary" data-paid-offline-deal="${d.skin_id}" type="button">${dict.admin_btn_paid_offline}</button>` : ''}
</div>
</div>`;
}

function renderAdminDeals(){
const list = document.getElementById('adminDealsList');
const dict = I18N[currentLang] || I18N.ru;

if (!adminDealsData.length){
list.innerHTML = `<div class="skins-empty skins-empty-sm">${dict.admin_deals_empty}</div>`;
return;
}

if (adminDealsGroupMode === 'flat'){
list.innerHTML = adminDealsData.map(adminDealCardHtml).join('');
return;
}

const byUser = {};
adminDealsData.forEach(d => {
const key = d.buyer_username || String(d.buyer_id);
if (!byUser[key]) byUser[key] = [];
byUser[key].push(d);
});

list.innerHTML = Object.keys(byUser).map(user => `
<div class="profile-section-title" style="font-size:13px; margin:12px 0 6px;">${escapeHtml(user)}</div>
${byUser[user].map(adminDealCardHtml).join('')}
`).join('');
}

function loadAdminDeals(){
adminApiFetch('/api/admin/active_deals')
.then(data => {
adminDealsData = data.items || [];
renderAdminDeals();
})
.catch(() => {
document.getElementById('adminDealsList').innerHTML = `<div class="skins-empty skins-empty-sm">${(I18N[currentLang] || I18N.ru).load_failed}</div>`;
});
}

document.getElementById('adminDealsGroupFlat').addEventListener('click', () => {
adminDealsGroupMode = 'flat';
document.getElementById('adminDealsGroupFlat').classList.add('active');
document.getElementById('adminDealsGroupByUser').classList.remove('active');
renderAdminDeals();
});

document.getElementById('adminDealsGroupByUser').addEventListener('click', () => {
adminDealsGroupMode = 'byUser';
document.getElementById('adminDealsGroupByUser').classList.add('active');
document.getElementById('adminDealsGroupFlat').classList.remove('active');
renderAdminDeals();
});

document.getElementById('adminDealsList').addEventListener('click', (e) => {
const dict = I18N[currentLang] || I18N.ru;

const finalizeBtn = e.target.closest('[data-finalize-deal]');
if (finalizeBtn){
// Раньше срока — отдельное предупреждение: сделка отмечается «выплачено
// досрочно», и проблемы по ней (откат обмена, спор) решает этот админ.
const deal = adminDealsData.find(d => String(d.skin_id) === finalizeBtn.dataset.finalizeDeal);
const early = !!(deal && deal.early);
showConfirm(early ? dict.admin_confirm_finalize_early : dict.admin_confirm_finalize, () => {
adminApiFetch('/api/admin/deals/' + finalizeBtn.dataset.finalizeDeal + '/finalize', { method: 'POST', body: { early_ack: early } })
.then(() => loadAdminDeals())
.catch(err => showErrorToast(err));
});
return;
}

// Перевёл продавцу на карту до конца холда: сделка остаётся в холде,
// а после него выплата зачислится и сразу спишется с баланса продавца.
const paidBtn = e.target.closest('[data-paid-offline-deal]');
if (paidBtn){
const deal = adminDealsData.find(d => String(d.skin_id) === paidBtn.dataset.paidOfflineDeal);
const amount = deal ? deal.payout : 0;
showConfirm(dict.admin_confirm_paid_offline.replace('{amount}', formatCoins(amount)), () => {
adminApiFetch('/api/admin/deals/' + paidBtn.dataset.paidOfflineDeal + '/paid_offline', { method: 'POST', body: { amount } })
.then(() => loadAdminDeals())
.catch(err => showErrorToast(err));
});
return;
}

const refundBtn = e.target.closest('[data-refund-deal]');
if (refundBtn){
showConfirm(dict.admin_confirm_refund, () => {
adminApiFetch('/api/admin/deals/' + refundBtn.dataset.refundDeal + '/refund', { method: 'POST' })
.then(() => loadAdminDeals())
.catch(err => showErrorToast(err));
});
}
});

// ---------------- Пополнения игр (Arcadezy) ----------------
// Только владелец: включить/выключить раздел, наценка, курс, категории.

const GT_ADMIN_TYPES = ['steam', 'telegram', 'topup', 'giftcard', 'gamekey'];

function loadAdminGameTopup(){
const dict = I18N[currentLang] || I18N.ru;
adminApiFetch('/api/admin/game_topup/settings')
.then(d => {
document.getElementById('adminGtEnabled').checked = !!d.enabled;
document.getElementById('adminGtMarkup').value = d.markup;
document.getElementById('adminGtRate').value = d.rate || '';
document.getElementById('adminGtRate').placeholder = d.rate_effective ? String(Math.round(d.rate_effective)) : '';
document.getElementById('adminGtTypes').innerHTML = GT_ADMIN_TYPES.map(t =>
`<label class="admin-perm-chip"><input type="checkbox" data-gt-admin-type="${t}" ${(d.types || []).includes(t) ? 'checked' : ''}> ${escapeHtml(dict['gt_type_' + t] || t)}</label>`).join('');
const o = d.orders_30d || {};
const state = !d.configured ? dict.admin_gt_no_key
: dict.admin_gt_state
.replace('{balance}', d.balance_usd == null ? '—' : '$' + Number(d.balance_usd).toFixed(2))
.replace('{done}', o.completed || 0)
.replace('{wait}', (o.processing || 0) + (o.submitting || 0))
.replace('{refunded}', o.refunded || 0);
const profit = d.configured ? '\n' + dict.admin_gt_profit
.replace('{revenue}', formatCoins(d.revenue_30d || 0))
.replace('{cost}', formatCoins(d.cost_uzs_30d || 0))
.replace('{usd}', '$' + Number(d.cost_usd_30d || 0).toFixed(2))
.replace('{profit}', ((d.profit_30d || 0) >= 0 ? '+' : '−') + formatCoins(Math.abs(d.profit_30d || 0)))
+ '\n' + (d.webhook ? dict.admin_gt_webhook_on : dict.admin_gt_webhook_off) : '';
const stateEl = document.getElementById('adminGtState');
stateEl.style.whiteSpace = 'pre-line';
stateEl.textContent = state + profit;
})
.catch(() => {});
}

document.getElementById('adminGtSaveBtn').addEventListener('click', () => {
const dict = I18N[currentLang] || I18N.ru;
const status = document.getElementById('adminGtSaveStatus');
const body = {
enabled: document.getElementById('adminGtEnabled').checked,
markup: Number(document.getElementById('adminGtMarkup').value) || 0,
rate: document.getElementById('adminGtRate').value.trim(),
types: [...document.querySelectorAll('[data-gt-admin-type]:checked')].map(i => i.dataset.gtAdminType),
};
adminApiFetch('/api/admin/game_topup/settings', { method: 'POST', body: body })
.then(() => {
status.textContent = dict.admin_gt_saved;
loadAdminGameTopup();
if (typeof loadTopupCatalog === 'function') loadTopupCatalog();
})
.catch(err => { status.textContent = err.message; });
});

// ---------------- Холды ----------------

function loadAdminHolds(){
adminApiFetch('/api/admin/holds')
.then(data => {
const list = document.getElementById('adminHoldsList');
const dict = I18N[currentLang] || I18N.ru;
const items = data.items || [];
if (!items.length){
list.innerHTML = `<div class="skins-empty skins-empty-sm">${dict.admin_holds_empty}</div>`;
return;
}
list.innerHTML = items.map(h => `
<div class="deal-card">
<div class="deal-info">
<div class="deal-title">${escapeHtml(h.username || String(h.user_id))}</div>
<div class="deal-meta">${formatCoins(h.held)}</div>
</div>
</div>`).join('');
})
.catch(() => {
document.getElementById('adminHoldsList').innerHTML = `<div class="skins-empty skins-empty-sm">${(I18N[currentLang] || I18N.ru).load_failed}</div>`;
});
}

// ---------------- Сводка (Обзор) ----------------

function adminStatusBoxHtml(value, label, attention){
return `<div class="admin-status-box${attention ? ' attention' : ''}">
<div class="admin-status-value">${value}</div>
<div class="admin-status-label">${label}</div>
</div>`;
}

function loadAdminStatus(){
const grid = document.getElementById('adminStatusGrid');
adminApiFetch('/api/admin/status')
.then(data => {
const dict = I18N[currentLang] || I18N.ru;
const gw = data.giveaway || {};
const gwLabel = gw.active ? dict.admin_status_gw_active : dict.admin_status_gw_idle;
grid.innerHTML = [
adminStatusBoxHtml(data.active_auctions, dict.admin_status_auctions, data.active_auctions > 0),
adminStatusBoxHtml(data.pending_proposals, dict.admin_status_proposals, data.pending_proposals > 0),
adminStatusBoxHtml(gwLabel, dict.admin_status_giveaway, gw.active),
adminStatusBoxHtml(data.active_deals, dict.admin_status_deals, false),
adminStatusBoxHtml(data.pending_topups, dict.admin_status_topups, data.pending_topups > 0),
adminStatusBoxHtml(data.pending_withdrawals, dict.admin_status_withdrawals, data.pending_withdrawals > 0),
].join('');
})
.catch(() => {
grid.innerHTML = `<div class="skins-empty skins-empty-sm">${(I18N[currentLang] || I18N.ru).load_failed}</div>`;
});
}

// ---------------- Статистика (живая) ----------------

function loadAdminStats(){
const grid = document.getElementById('adminStatsGrid');
adminApiFetch('/api/admin/stats')
.then(data => {
const dict = I18N[currentLang] || I18N.ru;
grid.innerHTML = [
adminStatusBoxHtml(data.total_users, dict.admin_stats_total_users, false),
adminStatusBoxHtml(data.new_today, dict.admin_stats_new_today, false),
adminStatusBoxHtml(data.active_today, dict.admin_stats_active_today, false),
adminStatusBoxHtml(data.active_week, dict.admin_stats_active_week, false),
adminStatusBoxHtml(data.active_listings, dict.admin_stats_listings, false),
adminStatusBoxHtml(data.sold_listings, dict.admin_stats_sold, false),
].join('');
})
.catch(() => {
grid.innerHTML = `<div class="skins-empty skins-empty-sm">${(I18N[currentLang] || I18N.ru).load_failed}</div>`;
});
}

function startAdminStatsLive(){
stopAdminStatsLive();
loadAdminStats();
// Обновляем не слишком часто — это счётчики за сутки/неделю,
// секундная точность не нужна, а лишние запросы ни к чему.
adminStatsLiveTimer = setInterval(loadAdminStats, 15000);
}

function stopAdminStatsLive(){
if (adminStatsLiveTimer){ clearInterval(adminStatsLiveTimer); adminStatsLiveTimer = null; }
}

// ---------------- Список сохранённых premium-эмодзи (общий пикер) ----------------

let savedEmojisList = [];

function renderEmojiInsertRow(rowId, textareaId){
const row = document.getElementById(rowId);
if (!row) return;
if (!savedEmojisList.length){
row.innerHTML = '';
return;
}
row.innerHTML = savedEmojisList.map(e =>
`<button type="button" class="admin-emoji-insert-btn" data-insert-emoji="${escapeHtml(e.emoji_char)}" data-target="${textareaId}">${escapeHtml(e.emoji_char)}</button>`
).join('');
}

document.addEventListener('click', (e) => {
const btn = e.target.closest('[data-insert-emoji]');
if (!btn) return;
const ta = document.getElementById(btn.dataset.target);
if (!ta) return;
const start = ta.selectionStart || 0;
const end = ta.selectionEnd || 0;
const char = btn.dataset.insertEmoji;
ta.value = ta.value.slice(0, start) + char + ta.value.slice(end);
const newPos = start + char.length;
ta.focus();
ta.setSelectionRange(newPos, newPos);
});

function renderPostPreview(boxId, text){
const box = document.getElementById(boxId);
if (!text || !text.trim()){
box.style.display = 'none';
return;
}
box.textContent = text;
box.style.display = '';
}

document.getElementById('aPreviewBtn').addEventListener('click', () => {
renderPostPreview('aPreviewBox', document.getElementById('aCustomPostText').value);
});

function populateEmojiSelect(selectId, selectedEmojiId){
const el = document.getElementById(selectId);
const dict = I18N[currentLang] || I18N.ru;
const current = selectedEmojiId || '';
el.innerHTML = `<option value="" data-char="">${dict.admin_emoji_none}</option>` +
savedEmojisList.map(e => `<option value="${e.emoji_id}" data-char="${escapeHtml(e.emoji_char)}">${escapeHtml(e.emoji_char)} — ${e.emoji_id}</option>`).join('');
el.value = current;
}

function getSelectedEmoji(selectId){
const el = document.getElementById(selectId);
const opt = el.options[el.selectedIndex];
return {
emoji_id: el.value || '',
emoji_char: opt ? (opt.dataset.char || '') : '',
};
}

function loadSavedEmojis(preselectAuction){
adminApiFetch('/api/admin/emojis')
.then(data => {
savedEmojisList = data.items || [];
populateEmojiSelect('aEmoji', preselectAuction);
renderEmojiInsertRow('aEmojiInsertRow', 'aCustomPostText');
})
.catch(() => {});
}

// ---------- приз розыгрыша из инвентаря ----------
// Кнопка открывает то же окно инвентаря Steam, что и при выставлении
// лота, но в режиме выбора приза: нажатый предмет становится призом.
let adminGwPrizeSkin = null;

function setAdminGwPrizeSkin(ps){
adminGwPrizeSkin = ps && ps.title ? ps : null;
const box = document.getElementById('adminGwPrizeSkin');
if (!adminGwPrizeSkin){
box.style.display = 'none';
box.innerHTML = '';
updateAdminGwMediaHint();
return;
}
box.innerHTML = prizeSkinHtml(adminGwPrizeSkin, true);
box.style.display = '';
const titleInput = document.getElementById('adminRfTitle');
if (!titleInput.value.trim() || titleInput.dataset.auto === '1'){
titleInput.value = adminGwPrizeSkin.title.slice(0, 100);
titleInput.dataset.auto = '1';
}
updateAdminGwMediaHint();
}

document.getElementById('adminGwPrizeSkin').addEventListener('click', (e) => {
if (e.target.closest('[data-gps-clear]')) setAdminGwPrizeSkin(null);
});

document.getElementById('adminRfTitle').addEventListener('input', (e) => {
e.target.dataset.auto = '';
});

document.getElementById('adminGwPickPrizeBtn').addEventListener('click', () => {
if (!tg || !tg.initData) return;
inventoryPickHandler = (item) => {
setAdminGwPrizeSkin({
title: (item.stattrak ? 'StatTrak™ ' : '') + (item.title || ''),
photo_url: item.photo_url || null,
float_value: item.float_value ?? null,
wear: item.wear || null,
stattrak: !!item.stattrak,
rarity: item.rarity || null,
});
};
openInventory();
});

// ---------- GIF с 3D-рендером приза ----------
// Рендерим здесь и загружаем боту перед запуском: GIF показывается на
// странице розыгрыша, в приглашениях и в посте.
let adminGwGif = null; // { key, bytes }

function adminGwPrizeEntry(){
if (!adminGwPrizeSkin || typeof loadModelIndex !== 'function') return Promise.resolve(null);
return loadModelIndex().then(map => map[modelIndexKey(adminGwPrizeSkin.title)] || null);
}

function updateAdminGwMediaHint(){
const dict = I18N[currentLang] || I18N.ru;
const hint = document.getElementById('adminGwMediaHint');
if (!document.getElementById('adminRfUseGif').checked){ hint.textContent = ''; return; }
if (!adminGwPrizeSkin){ hint.textContent = dict.admin_gw_media_need_prize; return; }
adminGwPrizeEntry().then(entry => {
hint.textContent = entry ? dict.admin_gw_media_hint_gif : dict.admin_gw_media_no_3d;
});
}

document.getElementById('adminRfUseGif').addEventListener('change', updateAdminGwMediaHint);

// Возвращает true, если GIF загружен боту.
function ensureAdminGwGif(status){
const dict = I18N[currentLang] || I18N.ru;
if (!document.getElementById('adminRfUseGif').checked || !adminGwPrizeSkin) return Promise.resolve(false);
const key = JSON.stringify([adminGwPrizeSkin.title, adminGwPrizeSkin.float_value]);
return adminGwPrizeEntry().then(entry => {
if (!entry) return null;
if (adminGwGif && adminGwGif.key === key) return adminGwGif.bytes;
return render3DGif(entry, Number(adminGwPrizeSkin.float_value) || 0, adminGwPrizeSkin.title,
p => { status.textContent = dict.share_gif_preparing.replace('{p}', Math.round(p * 100)); }, adminGwPrizeSkin.pattern, false, adminGwPrizeSkin.stickers)
.then(bytes => { adminGwGif = { key, bytes }; return bytes; });
})
.then(bytes => {
if (!bytes) return false;
const preview = document.getElementById('adminGwGifPreview');
preview.src = URL.createObjectURL(new Blob([bytes], { type: 'image/gif' }));
preview.style.display = '';
status.textContent = '...';
return adminApiFetch('/api/admin/giveaway/gif', { method: 'POST', body: { gif_base64: bytesToBase64(bytes) } })
.then(() => true);
});
}

// ---------- очистка истории ----------
document.querySelectorAll('[data-clear-history]').forEach(btn => {
btn.addEventListener('click', () => {
const dict = I18N[currentLang] || I18N.ru;
const type = btn.dataset.clearHistory;
showConfirm(type === 'auction' ? dict.admin_history_clear_confirm_auction : dict.admin_history_clear_confirm_giveaway, () => {
adminApiFetch('/api/admin/events/history/clear', { method: 'POST', body: { event_type: type } })
.then(() => {
showToast(dict.status_done_ok);
loadAdminEventsHistory();
if (type === 'giveaway') loadAdminGiveawayPanel();
})
.catch(err => showErrorToast(err));
});
});
});

// ---------- розыгрыш: текущий, запуск, история ----------

let adminRfTimer = null;

function adminRfStatusLabel(status){
const dict = I18N[currentLang] || I18N.ru;
return status === 'finished' ? dict.admin_rf_status_finished
: status === 'cancelled' ? dict.admin_rf_status_cancelled : status;
}

function renderAdminRaffleActive(data){
const dict = I18N[currentLang] || I18N.ru;
const box = document.getElementById('adminRfActive');
const a = data.active;
if (adminRfTimer){ clearInterval(adminRfTimer); adminRfTimer = null; }
document.getElementById('adminRfCreate').style.display = a ? 'none' : '';
if (!a){
box.innerHTML = `<div class="shop-hint" style="margin-bottom:10px;">${dict.admin_rf_none}</div>`;
return;
}
const participants = data.participants || [];
box.innerHTML = `<div class="admin-rf-active">
<div class="admin-rf-title">🎁 ${escapeHtml(a.title)}</div>
<div class="shop-hint">${dict.admin_rf_left} <b id="adminRfLeft">—</b></div>
<div class="shop-hint">${dict.admin_rf_counts.replace('{p}', a.participants).replace('{t}', a.tickets).replace('{w}', data.pending_invites || 0)}</div>
<div class="edit-row" style="margin-top:8px;">
<button type="button" class="steam-link-btn" id="adminRfFinishBtn">${dict.admin_rf_finish_now}</button>
<button type="button" class="steam-link-btn secondary" id="adminRfCancelBtn">${dict.admin_rf_cancel}</button>
</div>
<div class="edit-status" id="adminRfActiveStatus"></div>
<div class="profile-section-title" style="font-size:13px; margin-top:12px;">${dict.admin_gw_participants}</div>
${participants.length ? participants.map(p => `<div class="history-row"><span class="history-row-note">#${p.entry} ${escapeHtml(p.username || String(p.user_id))}</span><span>👥 ${p.invites} · 🎟 ${p.tickets}</span></div>`).join('')
: `<div class="skins-empty skins-empty-sm">${dict.admin_gw_no_participants}</div>`}
</div>`;
const tick = () => {
const el = document.getElementById('adminRfLeft');
if (!el){ clearInterval(adminRfTimer); return; }
el.textContent = formatRaffleLeft(new Date(a.ends_at).getTime() - Date.now());
};
tick();
adminRfTimer = setInterval(tick, 1000);
document.getElementById('adminRfFinishBtn').onclick = () => {
showConfirm(dict.admin_rf_confirm_finish, () => {
const status = document.getElementById('adminRfActiveStatus');
status.textContent = '...';
adminApiFetch('/api/admin/giveaway/finish_now', { method: 'POST' })
.then(res => {
const r = res.raffle || {};
showToast(r.winner ? `${dict.admin_gw_winner_is} ${r.winner}` : dict.status_done_ok);
loadAdminGiveawayPanel(); loadAdminStatus();
if (typeof loadRaffle === 'function') loadRaffle();
})
.catch(err => { status.textContent = friendlyErrorMessage(err); });
});
};
document.getElementById('adminRfCancelBtn').onclick = () => {
showConfirm(dict.admin_rf_confirm_cancel, () => {
adminApiFetch('/api/admin/giveaway/cancel', { method: 'POST' })
.then(() => { showToast(dict.status_done_ok); loadAdminGiveawayPanel(); loadAdminStatus(); })
.catch(err => showErrorToast(err));
});
};
}

function renderAdminRaffleHistory(items){
const dict = I18N[currentLang] || I18N.ru;
const box = document.getElementById('adminGiveawayHistoryList');
if (!items || !items.length){
box.innerHTML = `<div class="skins-empty skins-empty-sm">${dict.admin_rf_history_empty}</div>`;
return;
}
box.innerHTML = items.map(h => `
<div class="deal-card" style="flex-direction:column; align-items:stretch;">
<div class="deal-info">
<div class="deal-title">#${h.id} ${escapeHtml(h.title)}</div>
<div class="deal-meta">${adminRfStatusLabel(h.status)} · 👥 ${h.participants} · 🎟 ${h.tickets}</div>
${h.winner ? `<div class="deal-meta">🏆 ${escapeHtml(h.winner)}${h.winner_id ? ' · ID ' + h.winner_id : ''}</div>` : ''}
<div class="deal-meta">${formatHistoryDate(h.drawn_at || h.ends_at)}</div>
${h.winner_id ? (h.delivered
? `<div class="deal-meta">✅ ${dict.admin_rf_delivered}</div>`
: `<button type="button" class="steam-link-btn secondary" style="margin-top:6px;" data-rf-delivered="${h.id}">${dict.admin_rf_mark_delivered}</button>`) : ''}
</div>
</div>`).join('');
}

document.getElementById('adminGiveawayHistoryList').addEventListener('click', (e) => {
const btn = e.target.closest('[data-rf-delivered]');
if (!btn) return;
btn.disabled = true;
adminApiFetch('/api/admin/giveaway/delivered', { method: 'POST', body: { id: Number(btn.dataset.rfDelivered) } })
.then(() => { showToast((I18N[currentLang] || I18N.ru).status_done_ok); loadAdminGiveawayPanel(); })
.catch(err => { btn.disabled = false; showErrorToast(err); });
});

function loadAdminGiveawayPanel(){
adminApiFetch('/api/admin/giveaway')
.then(data => {
renderAdminRaffleActive(data);
renderAdminRaffleHistory(data.history);
})
.catch(() => {});
}

document.getElementById('adminGwStartBtn').addEventListener('click', () => {
const dict = I18N[currentLang] || I18N.ru;
const status = document.getElementById('adminGwStatus');
const btn = document.getElementById('adminGwStartBtn');
const title = document.getElementById('adminRfTitle').value.trim();
const hours = Number(document.getElementById('adminRfDays').value || 0) * 24
+ Number(document.getElementById('adminRfHours').value || 0);
if (!adminGwPrizeSkin && !title){ status.textContent = dict.admin_gw_media_need_prize; return; }
if (!(hours > 0)){ status.textContent = dict.admin_rf_need_duration; return; }
const post = document.getElementById('adminRfPost').checked;
const media = document.getElementById('adminGwPostMedia').value;
btn.disabled = true;
status.textContent = '...';
ensureAdminGwGif(status)
.then(hasGif => adminApiFetch('/api/admin/giveaway/create', {
method: 'POST',
body: {
title: title || undefined,
prize_skin: adminGwPrizeSkin,
prize_value: Number(document.getElementById('adminRfValue').value) || null,
hours,
use_gif: hasGif,
post_to_channels: post,
require_sub: document.getElementById('adminRfRequireSub').checked,
post_media: media === 'gif' && !hasGif ? 'card' : media,
}
}))
.then(res => {
status.textContent = res.post_failed ? dict.admin_rf_post_failed : dict.status_done_ok;
setAdminGwPrizeSkin(null);
document.getElementById('adminRfTitle').value = '';
document.getElementById('adminRfValue').value = '';
document.getElementById('adminGwGifPreview').style.display = 'none';
loadAdminGiveawayPanel(); loadAdminStatus();
if (typeof loadRaffle === 'function') loadRaffle();
})
.catch(err => { status.textContent = friendlyErrorMessage(err); })
.finally(() => { btn.disabled = false; });
});

// ---------------- Балансы ----------------

function adminAdjustBalance(direction){
const status = document.getElementById('adminBalanceStatus');
const userId = document.getElementById('adminBalanceUserId').value.trim();
const amount = Number(document.getElementById('adminBalanceAmount').value);

if (!userId || !amount || amount <= 0){
status.textContent = (I18N[currentLang] || I18N.ru).admin_balance_fill_required;
return;
}

const reason = document.getElementById('adminBalanceReason').value.trim();
if (reason.length < 3){
status.textContent = errorMessage('reason_required');
return;
}

status.textContent = '...';

adminApiFetch('/api/admin/balance/adjust', {
method: 'POST',
body: { user_id: Number(userId), amount: amount, direction: direction, reason: reason }
})
.then(() => {
status.textContent = (I18N[currentLang] || I18N.ru).status_done_ok;
document.getElementById('adminBalanceAmount').value = '';
document.getElementById('adminBalanceReason').value = '';
loadAdminHolds();
loadAdminSellers();
})
.catch(err => { status.textContent = friendlyErrorMessage(err); });
}

document.getElementById('adminBalanceAddBtn').addEventListener('click', () => adminAdjustBalance('add'));
document.getElementById('adminBalanceRemoveBtn').addEventListener('click', () => adminAdjustBalance('remove'));

// ---------------- Продавцы и балансы ----------------

function loadAdminSellers(){
const list = document.getElementById('adminSellersList');
const totals = document.getElementById('adminSellersTotals');
const dict = I18N[currentLang] || I18N.ru;
const q = document.getElementById('adminSellersSearch').value.trim();
adminApiFetch('/api/admin/finance/sellers' + (q ? '?q=' + encodeURIComponent(q) : ''))
.then(data => {
const items = data.items || [];
totals.textContent = dict.admin_sellers_totals
.replace('{n}', items.length)
.replace('{sum}', formatCoins(data.total_balance || 0))
.replace('{held}', formatCoins(data.total_held || 0));
if (!items.length){
list.innerHTML = `<div class="skins-empty skins-empty-sm">${dict.admin_empty}</div>`;
return;
}
list.innerHTML = items.map(s => {
const name = s.kyc_name || s.username || ('ID ' + s.user_id);
const badges = [
s.verified ? '✅ ' + dict.admin_sellers_verified : '',
s.blocked ? '🚫 ' + dict.admin_sellers_blocked : '',
s.open_flags ? '⚠️ ' + dict.admin_sellers_flags.replace('{n}', s.open_flags) : '',
].filter(Boolean).join(' · ');
const t = s.last_tx;
const last = t ? `<div class="deal-meta">${escapeHtml(dict.admin_sellers_last)}: ${t.amount >= 0 ? '+' : ''}${formatCoins(t.amount)} · ${escapeHtml(t.type)}${t.note ? ' · ' + escapeHtml(t.note) : ''} · ${escapeHtml(new Date(t.created_at).toLocaleString())}</div>` : '';
return `
<div class="deal-card" style="flex-direction:column; align-items:stretch;">
<div class="deal-info">
<div class="deal-title">${escapeHtml(name)}</div>
<div class="deal-meta">${[s.username ? escapeHtml(s.username) : '', badges].filter(Boolean).join(' · ')}</div>
<button type="button" class="seller-id-copy" data-copy-id="${s.user_id}">ID ${s.user_id} <svg class="gi" width="14" height="14" aria-hidden="true"><use href="#gi-copy"/></svg></button>
<div class="deal-meta"><b>${formatCoins(s.balance)}</b> · ${escapeHtml(dict.admin_sellers_held)} ${formatCoins(s.held)} · ${escapeHtml(dict.admin_sellers_available)} ${formatCoins(s.available)}</div>
<div class="deal-meta">${escapeHtml(dict.admin_sellers_stats.replace('{trades}', s.trades).replace('{lots}', s.active_lots))}</div>
${last}
</div>
<div class="deal-actions" style="margin-top:8px;">
<button class="deal-action secondary" data-seller-history="${s.user_id}" type="button">${dict.admin_sellers_history}</button>
<button class="deal-action secondary" data-seller-adjust="${s.user_id}" type="button">${dict.admin_sellers_adjust}</button>
</div>
</div>`;
}).join('');
})
.catch(err => { list.innerHTML = `<div class="shop-hint">${friendlyErrorMessage(err)}</div>`; });
}

let adminSellersSearchTimer = null;
document.getElementById('adminSellersSearch').addEventListener('input', () => {
clearTimeout(adminSellersSearchTimer);
adminSellersSearchTimer = setTimeout(loadAdminSellers, 400);
});

document.getElementById('adminSellersList').addEventListener('click', (e) => {
const dict = I18N[currentLang] || I18N.ru;
const copyBtn = e.target.closest('[data-copy-id]');
if (copyBtn){
const id = copyBtn.dataset.copyId;
const done = () => showToast(dict.admin_sellers_id_copied.replace('{id}', id), { type: 'success', duration: 2500 });
if (navigator.clipboard && navigator.clipboard.writeText){
navigator.clipboard.writeText(id).then(done).catch(() => showAlert(id));
} else {
showAlert(id);
}
return;
}
const historyBtn = e.target.closest('[data-seller-history]');
if (historyBtn){
document.getElementById('adminClientHistoryId').value = historyBtn.dataset.sellerHistory;
document.getElementById('adminClientHistoryBtn').click();
document.getElementById('adminClientsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
return;
}
const adjustBtn = e.target.closest('[data-seller-adjust]');
if (adjustBtn){
document.getElementById('adminBalanceUserId').value = adjustBtn.dataset.sellerAdjust;
document.getElementById('adminBalanceSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
document.getElementById('adminBalanceAmount').focus();
}
});

// ---------------- Заявки на пополнение ----------------

function loadAdminTopups(){
const list = document.getElementById('adminTopupsList');
adminApiFetch('/api/admin/topups')
.then(data => {
const items = data.items || [];
if (!items.length){
list.innerHTML = `<div class="skins-empty skins-empty-sm">${(I18N[currentLang] || I18N.ru).admin_no_requests}</div>`;
return;
}
list.innerHTML = items.map(t => `
<div class="deal-card">
<div class="deal-info">
<div class="deal-title">${escapeHtml(t.username || ('ID ' + t.user_id))}</div>
<div class="deal-meta">${formatCoins(t.amount)}${t.photo_file_id ? ' · 📎 чек есть' : ' · ⚠️ чека нет'}</div>
</div>
<div class="deal-actions">
<button class="deal-action" data-topup-approve="${t.id}" type="button">${(I18N[currentLang] || I18N.ru).admin_btn_approve}</button>
<button class="deal-action secondary" data-topup-reject="${t.id}" data-has-receipt="${t.photo_file_id ? '1' : '0'}" type="button">${(I18N[currentLang] || I18N.ru).admin_btn_reject}</button>
</div>
</div>`).join('');
})
.catch(() => { list.innerHTML = '<div class="skins-empty skins-empty-sm">Не удалось загрузить</div>'; });
}

document.getElementById('adminTopupsList').addEventListener('click', (e) => {
const approveBtn = e.target.closest('[data-topup-approve]');
const rejectBtn = e.target.closest('[data-topup-reject]');
if (approveBtn){
adminApiFetch('/api/admin/topups/' + approveBtn.dataset.topupApprove + '/approve', { method: 'POST' })
.then(loadAdminTopups)
.catch(err => showErrorToast(err));
}
if (rejectBtn){
const hasReceipt = rejectBtn.dataset.hasReceipt === '1';
document.getElementById('topupRejectComment').value = hasReceipt
? ''
: 'Не вижу скриншот чека об оплате — пришли его, пожалуйста, следующим сообщением боту.';
document.getElementById('topupRejectStatus').textContent = '';
document.getElementById('topupRejectOverlay').dataset.topupId = rejectBtn.dataset.topupReject;
document.getElementById('topupRejectOverlay').classList.add('show');
}
});

document.getElementById('topupRejectCloseBtn').addEventListener('click', () => {
document.getElementById('topupRejectOverlay').classList.remove('show');
});

document.getElementById('topupRejectConfirmBtn').addEventListener('click', () => {
const overlay = document.getElementById('topupRejectOverlay');
const topupId = overlay.dataset.topupId;
const comment = document.getElementById('topupRejectComment').value.trim();
const status = document.getElementById('topupRejectStatus');
status.textContent = (I18N[currentLang] || I18N.ru).admin_declining;
adminApiFetch('/api/admin/topups/' + topupId + '/reject', { method: 'POST', body: { comment: comment } })
.then(() => {
overlay.classList.remove('show');
loadAdminTopups();
})
.catch(err => { status.textContent = friendlyErrorMessage(err); });
});

// ---------------- Оплаты картой за лоты (П2П) ----------------
// Покупатель оплатил лот переводом на карту и приложил чек. Раньше
// решение было только кнопками под сообщением в чате — если его
// пропустить, заявка висела неделями. Теперь они видны и здесь.

// Депозиты «Гаранта»: кто внёс, сколько покрыто открытыми сделками.
function loadAdminDeposits(){
const list = document.getElementById('adminDepositsList');
if (!list) return;
const dict = I18N[currentLang] || I18N.ru;
adminApiFetch('/api/admin/garant_deposits')
.then(data => {
const items = (data && data.items) || [];
if (!items.length){
list.innerHTML = `<div class="skins-empty skins-empty-md">${escapeHtml(dict.admin_dep_empty)}</div>`;
return;
}
list.innerHTML = items.map(d => `
<div class="deal-card">
<div class="deal-title">${escapeHtml(d.username || ('ID ' + d.user_id))} · ${formatCoins(d.amount)}</div>
<div class="deal-meta">${escapeHtml(dict.admin_dep_cover.replace('{free}', formatCoins(d.free_cover)).replace('{open}', formatCoins(d.open_exposure)))}</div>
<div class="deal-meta">${escapeHtml(d.card_masked || '—')}${d.card_holder ? ' · ' + escapeHtml(d.card_holder) : ''} · ${escapeHtml(d.active ? dict.admin_dep_on : dict.admin_dep_off)}</div>
</div>`).join('');
})
.catch(err => { list.innerHTML = `<div class="skins-empty skins-empty-md">${escapeHtml(friendlyErrorMessage(err))}</div>`; });
}

function loadAdminP2pOrders(){
const list = document.getElementById('adminP2pList');
const dict = I18N[currentLang] || I18N.ru;
adminApiFetch('/api/admin/p2p_orders')
.then(data => {
const items = data.items || [];
if (!items.length){
list.innerHTML = `<div class="skins-empty skins-empty-sm">${dict.admin_no_requests}</div>`;
return;
}
list.innerHTML = items.map(o => {
const hours = Math.max(0, Math.floor((Date.now() - new Date(o.created_at).getTime()) / 3600000));
const receipt = o.has_receipt
? `<div class="kyc-shots" style="grid-template-columns:1fr; max-width:220px; margin-top:6px;"><figure><img src="${escapeHtml(withAdmin2fa(API_BASE + '/api/admin/p2p_orders/receipt?id=' + o.id + '&init_data=' + encodeURIComponent(tg.initData)))}" data-p2p-zoom alt=""><figcaption>${dict.admin_p2p_receipt}</figcaption></figure></div>`
: `<div class="deal-meta">⚠️ ${escapeHtml(dict.admin_p2p_no_receipt.replace('{id}', o.skin_id))}</div>`;
const gone = o.skin_status && o.skin_status !== 'reserved' && o.skin_status !== 'available'
? `<div class="deal-meta">⚠️ ${escapeHtml(dict.admin_p2p_skin_gone)}</div>` : '';
return `
<div class="deal-card" style="flex-direction:column; align-items:stretch;">
<div class="deal-info">
<div class="deal-title">#${o.id} · ${escapeHtml(dict.admin_p2p_lot.replace('{id}', o.skin_id))} ${escapeHtml(o.skin_title || '')}</div>
<div class="deal-meta">${escapeHtml(o.buyer_username || ('ID ' + o.buyer_id))} · ${formatCoins(o.amount)} · ${escapeHtml(dict.admin_p2p_waiting.replace('{h}', hours))}</div>
${o.payer_name ? `<div class="deal-meta">${escapeHtml(dict.admin_p2p_payer.replace('{name}', o.payer_name))}${o.payer_mismatch ? ' · ⚠️ ' + escapeHtml(dict.admin_p2p_payer_mismatch) : ''}</div>` : ''}
${gone}
${receipt}
</div>
<div class="deal-actions" style="margin-top:8px;">
<button class="deal-action" data-p2p-decide="approve" data-p2p-id="${o.id}" type="button">${dict.admin_btn_approve}</button>
<button class="deal-action secondary" data-p2p-decide="reject" data-p2p-id="${o.id}" type="button">${dict.admin_btn_reject}</button>
</div>
</div>`;
}).join('');
})
.catch(() => { list.innerHTML = `<div class="skins-empty skins-empty-sm">${dict.load_failed}</div>`; });
}

document.getElementById('adminP2pList').addEventListener('click', (e) => {
const zoom = e.target.closest('[data-p2p-zoom]');
if (zoom){
document.getElementById('kycLightboxImg').src = zoom.src;
document.getElementById('kycLightbox').hidden = false;
return;
}
const btn = e.target.closest('[data-p2p-decide]');
if (!btn) return;
const dict = I18N[currentLang] || I18N.ru;
const approve = btn.dataset.p2pDecide === 'approve';
const id = btn.dataset.p2pId;
const ask = (approve ? dict.admin_p2p_confirm_approve : dict.admin_p2p_confirm_reject).replace('{id}', id);
showConfirm(ask, () => {
btn.disabled = true;
adminApiFetch('/api/admin/p2p_orders/' + id + '/' + (approve ? 'approve' : 'reject'), { method: 'POST' })
.then(data => { if (data && data.message) showToast(data.message); loadAdminP2pOrders(); loadAdminCounts(); })
.catch(err => { btn.disabled = false; showErrorToast(err); loadAdminP2pOrders(); });
});
});

// ---------------- Счётчики «ждёт решения» на кнопках разделов ----------------

function loadAdminCounts(){
adminApiFetch('/api/admin/pending_counts')
.then(data => {
document.querySelectorAll('#adminChips [data-badge]').forEach(badge => {
const group = data[badge.dataset.badge] || {};
const total = Object.values(group).reduce((a, b) => a + (Number(b) || 0), 0);
badge.textContent = total > 99 ? '99+' : String(total);
badge.hidden = !total;
});
})
.catch(() => {});
}

function adminAgeLabel(iso){
const dict = I18N[currentLang] || I18N.ru;
const hours = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 3600000));
return hours >= 48 ? dict.admin_age_days.replace('{n}', Math.floor(hours / 24)) : dict.admin_age_hours.replace('{n}', hours);
}

// ---------------- Споры ----------------
// Сделки, где покупатель открыл спор. Решение: вернуть деньги
// покупателю, выплатить продавцу или отклонить спор (сделка идёт
// дальше как обычно).

function loadAdminDisputes(){
const list = document.getElementById('adminDisputesList');
const dict = I18N[currentLang] || I18N.ru;
adminApiFetch('/api/admin/deals/disputes')
.then(data => {
const items = data.items || [];
if (!items.length){
list.innerHTML = `<div class="skins-empty skins-empty-sm">${dict.admin_no_disputes}</div>`;
return;
}
list.innerHTML = items.map(d => {
const evidence = (d.evidence || []).map(ev => `
<div class="deal-meta">• ${escapeHtml(ev.role === 'seller' ? dict.admin_dispute_seller : dict.admin_dispute_buyer)}: ${escapeHtml(ev.reason || '—')}${ev.trade_id ? ' · Trade ID ' + escapeHtml(ev.trade_id) : ''}${ev.has_photo ? ' · 📷 ' + escapeHtml(dict.admin_dispute_photo_in_chat) : ''}</div>`).join('');
return `
<div class="deal-card" style="flex-direction:column; align-items:stretch;">
<div class="deal-info">
<div class="deal-title">#${d.id} · ${escapeHtml(d.title)}</div>
<div class="deal-meta">${formatCoins(d.price)} · ${escapeHtml(d.seller_username || ('ID ' + d.seller_id))} → ${escapeHtml(d.buyer_username || ('ID ' + d.buyer_id))}</div>
<div class="deal-meta">⚠️ ${escapeHtml(dict.admin_dispute_opened.replace('{age}', adminAgeLabel(d.disputed_at)))}${d.sent_at ? '' : ' · ' + escapeHtml(dict.admin_dispute_not_sent)}</div>
${evidence}
</div>
<div class="deal-actions" style="margin-top:8px; flex-wrap:wrap;">
<button class="deal-action" data-dispute-action="refund" data-dispute-id="${d.id}" type="button">${dict.admin_dispute_btn_refund}</button>
<button class="deal-action secondary" data-dispute-action="finalize" data-dispute-id="${d.id}" type="button">${dict.admin_dispute_btn_finalize}</button>
<button class="deal-action secondary" data-dispute-action="dismiss_dispute" data-dispute-id="${d.id}" type="button">${dict.admin_dispute_btn_dismiss}</button>
</div>
</div>`;
}).join('');
})
.catch(() => { list.innerHTML = `<div class="skins-empty skins-empty-sm">${dict.load_failed}</div>`; });
}

document.getElementById('adminDisputesList').addEventListener('click', (e) => {
const btn = e.target.closest('[data-dispute-action]');
if (!btn) return;
const dict = I18N[currentLang] || I18N.ru;
const action = btn.dataset.disputeAction;
showConfirm(dict['admin_dispute_confirm_' + action].replace('{id}', btn.dataset.disputeId), () => {
btn.disabled = true;
adminApiFetch('/api/admin/deals/' + btn.dataset.disputeId + '/' + action, { method: 'POST' })
.then(() => showToast(dict.admin_done))
.catch(err => showErrorToast(err))
.finally(() => { loadAdminDisputes(); loadAdminDeals(); loadAdminCounts(); });
});
});

// ---------------- Антифрод ----------------
// Флаги, которые бот ставит сам (связанные аккаунты, сделка с собой,
// рискованный вывод…). Раньше их было не видно вовсе.

function loadAdminFraud(){
const list = document.getElementById('adminFraudList');
const dict = I18N[currentLang] || I18N.ru;
adminApiFetch('/api/admin/fraud_flags')
.then(data => {
const items = (data.items || []).filter(f => !f.resolved_at);
if (!items.length){
list.innerHTML = `<div class="skins-empty skins-empty-sm">${dict.admin_no_fraud}</div>`;
return;
}
list.innerHTML = items.map(f => `
<div class="deal-card">
<div class="deal-info">
<div class="deal-title">${escapeHtml(dict['admin_fraud_' + f.flag_type] || f.flag_type)}</div>
<div class="deal-meta">ID ${escapeHtml(String(f.user_id || '—'))}${f.related_user_id ? ' ↔ ID ' + escapeHtml(String(f.related_user_id)) : ''}${f.skin_id ? ' · ' + escapeHtml(dict.admin_p2p_lot.replace('{id}', f.skin_id)) : ''} · ${escapeHtml(adminAgeLabel(f.created_at))}</div>
${f.details ? `<div class="deal-meta">${escapeHtml(f.details)}</div>` : ''}
</div>
<div class="deal-actions">
<button class="deal-action secondary" data-fraud-resolve="${f.id}" type="button">${dict.admin_fraud_btn_resolve}</button>
</div>
</div>`).join('');
})
.catch(() => { list.innerHTML = `<div class="skins-empty skins-empty-sm">${dict.load_failed}</div>`; });
}

document.getElementById('adminFraudList').addEventListener('click', (e) => {
const btn = e.target.closest('[data-fraud-resolve]');
if (!btn) return;
btn.disabled = true;
adminApiFetch('/api/admin/fraud_flags/' + btn.dataset.fraudResolve + '/resolve', { method: 'POST' })
.catch(err => showErrorToast(err))
.finally(() => { loadAdminFraud(); loadAdminCounts(); });
});

// ---------------- Заявки на вывод ----------------

function loadAdminWithdrawals(){
const list = document.getElementById('adminWithdrawalsList');
adminApiFetch('/api/admin/withdrawals')
.then(data => {
const items = data.items || [];
if (!items.length){
list.innerHTML = `<div class="skins-empty skins-empty-sm">${(I18N[currentLang] || I18N.ru).admin_no_requests}</div>`;
return;
}
list.innerHTML = items.map(w => `
<div class="deal-card">
<div class="deal-info">
<div class="deal-title">${escapeHtml(w.username || ('ID ' + w.user_id))}</div>
<div class="deal-meta">${formatCoins(w.amount)}</div>
<div class="deal-meta">${escapeHtml(w.payment_details)}</div>
</div>
<div class="deal-actions">
<button class="deal-action" data-w-approve="${w.id}" type="button">${(I18N[currentLang] || I18N.ru).admin_btn_approve}</button>
<button class="deal-action secondary" data-w-reject="${w.id}" type="button">${(I18N[currentLang] || I18N.ru).admin_btn_reject}</button>
</div>
</div>`).join('');
})
.catch(() => { list.innerHTML = '<div class="skins-empty skins-empty-sm">Не удалось загрузить</div>'; });
}

document.getElementById('adminWithdrawalsList').addEventListener('click', (e) => {
const approveBtn = e.target.closest('[data-w-approve]');
const rejectBtn = e.target.closest('[data-w-reject]');
if (approveBtn){
showConfirm((I18N[currentLang] || I18N.ru).admin_confirm_withdraw_approve, () => {
adminApiFetch('/api/admin/withdrawals/' + approveBtn.dataset.wApprove + '/approve', { method: 'POST' })
.then(loadAdminWithdrawals)
.catch(err => showErrorToast(err));
});
}
if (rejectBtn){
showConfirm((I18N[currentLang] || I18N.ru).admin_confirm_reject_withdraw, () => {
adminApiFetch('/api/admin/withdrawals/' + rejectBtn.dataset.wReject + '/reject', { method: 'POST' })
.then(loadAdminWithdrawals)
.catch(err => showErrorToast(err));
});
}
});

// ---------------- Настройки (реквизиты, промо, реферал) ----------------

function loadAdminSettings(){
adminApiFetch('/api/admin/settings')
.then(data => {
document.getElementById('adminCardHolder').value = '';
document.getElementById('adminCardNumber').value = data.topup_details || '';
document.getElementById('adminPromoLimit').value = data.promo_limit || 0;
document.getElementById('adminPromoStatus2').textContent = `${(I18N[currentLang] || I18N.ru).admin_promo_used_label} ${data.promo_used || 0} ${(I18N[currentLang] || I18N.ru).admin_promo_of} ${data.promo_limit || 0}`;
document.getElementById('adminReferralPercent').value = data.referral_bonus_percent || 0;
document.getElementById('adminCommissionSale').textContent = formatCoins(data.commission_sale_total || 0);
document.getElementById('adminCommissionWithdraw').textContent = formatCoins(data.commission_withdraw_total || 0);
document.getElementById('adminFeatureTogglesSection').style.display = data.is_owner ? '' : 'none';
document.getElementById('adminGameTopupSection').style.display = data.is_owner ? '' : 'none';
if (data.is_owner) loadAdminGameTopup();
document.getElementById('toggleTopupCard').checked = data.topup_card_enabled !== false;
document.getElementById('toggleWithdrawCard').checked = data.withdraw_card_enabled !== false;
document.getElementById('toggleDirectP2pPurchase').checked = data.direct_p2p_purchase_enabled === true;
// Эквайринг банка: переключатель работает, только когда ключи заданы в Railway.
const octoToggle = document.getElementById('toggleOcto');
octoToggle.checked = data.octo_enabled !== false;
octoToggle.disabled = !data.octo_configured;
document.getElementById('adminOctoState').textContent = (I18N[currentLang] || I18N.ru)[
!data.octo_configured ? 'admin_octo_no_keys' : (data.octo_test ? 'admin_octo_test' : 'admin_octo_live')];
})
.catch(() => {});
loadAdminFinanceSummary();

[
['toggleTopupCard', 'topup_card'],
['toggleWithdrawCard', 'withdraw_card'],
['toggleDirectP2pPurchase', 'direct_p2p_purchase'],
['toggleOcto', 'octo'],
].forEach(([elId, feature]) => {
document.getElementById(elId).addEventListener('change', (e) => {
const checkbox = e.target;
adminApiFetch('/api/admin/toggle_feature', { method: 'POST', body: { feature: feature, enabled: checkbox.checked } })
.then(() => { loadProfile(); })
.catch(() => { checkbox.checked = !checkbox.checked; showAlert((I18N[currentLang] || I18N.ru).admin_change_failed); });
});
});

loadAdminTopTopupers();
}

function loadAdminFinanceSummary(){
adminApiFetch('/api/admin/finance/summary')
.then(data => {
document.getElementById('adminTotalTopped').textContent = formatCoins(data.total_topped_up || 0);
document.getElementById('adminTotalWithdrawn').textContent = formatCoins(data.total_withdrawn || 0);
})
.catch(() => {});
}

function loadAdminTopTopupers(){
const list = document.getElementById('adminTopTopupersList');
adminApiFetch('/api/admin/finance/top_topupers')
.then(data => {
const items = data.items || [];
if (!items.length){
list.innerHTML = `<div class="skins-empty skins-empty-sm">${(I18N[currentLang] || I18N.ru).admin_empty}</div>`;
return;
}
list.innerHTML = items.map((it, i) => `
<div class="deal-card" style="padding:8px 12px;">
<div class="deal-info">
<div class="deal-title" style="font-size:13px;">#${i + 1} · ${escapeHtml(it.username || ('ID ' + it.user_id))}</div>
<div class="deal-meta">${formatCoins(it.total)} · ${it.count} попол.</div>
</div>
</div>`).join('');
})
.catch(() => { list.innerHTML = `<div class="skins-empty skins-empty-sm">${(I18N[currentLang] || I18N.ru).load_failed}</div>`; });
}

document.getElementById('adminClientHistoryBtn').addEventListener('click', () => {
const result = document.getElementById('adminClientHistoryResult');
const id = Number(document.getElementById('adminClientHistoryId').value);
if (!id){ result.innerHTML = '<div class="shop-hint">Укажи user_id.</div>'; return; }
result.innerHTML = '<div class="skins-empty skins-empty-sm">Загрузка...</div>';
adminApiFetch('/api/admin/finance/client_history?user_id=' + id)
.then(data => {
const items = data.items || [];
const header = `<div class="deal-meta" style="margin-bottom:8px;">${escapeHtml(data.username || ('ID ' + data.user_id))} · баланс ${formatCoins(data.balance)} (в холде ${formatCoins(data.held)})</div>`;
if (!items.length){
result.innerHTML = header + `<div class="skins-empty skins-empty-sm">Транзакций нет</div>`;
return;
}
const rows = items.map(t => `
<div class="deal-card" style="padding:8px 12px;">
<div class="deal-info">
<div class="deal-title" style="font-size:12px;">${escapeHtml(t.type)}</div>
<div class="deal-meta">${t.amount >= 0 ? '+' : ''}${formatCoins(t.amount)} · ${escapeHtml(t.note || '')}</div>
</div>
</div>`).join('');
result.innerHTML = header + rows;
})
.catch(err => { result.innerHTML = `<div class="shop-hint">${friendlyErrorMessage(err)}</div>`; });
});

document.getElementById('adminSaveTopupDetailsBtn').addEventListener('click', () => {
const status = document.getElementById('adminTopupDetailsStatus');
const cardNumber = document.getElementById('adminCardNumber').value.trim();
const holder = document.getElementById('adminCardHolder').value.trim();
if (!cardNumber){ status.textContent = (I18N[currentLang] || I18N.ru).admin_need_card_number; return; }
status.textContent = (I18N[currentLang] || I18N.ru).discount_saving;
adminApiFetch('/api/admin/topup_details', { method: 'POST', body: { card_number: cardNumber, holder: holder } })
.then(() => { status.textContent = (I18N[currentLang] || I18N.ru).status_saved_ok; loadAdminSettings(); })
.catch(err => { status.textContent = friendlyErrorMessage(err); });
});

document.getElementById('adminSavePromoBtn').addEventListener('click', () => {
const status = document.getElementById('adminPromoStatus');
const limit = Number(document.getElementById('adminPromoLimit').value);
status.textContent = (I18N[currentLang] || I18N.ru).discount_saving;
adminApiFetch('/api/admin/promo_limit', { method: 'POST', body: { limit: limit } })
.then(() => { status.textContent = (I18N[currentLang] || I18N.ru).status_saved_ok; loadAdminSettings(); })
.catch(err => { status.textContent = friendlyErrorMessage(err); });
});

document.getElementById('adminSaveReferralPercentBtn').addEventListener('click', () => {
const status = document.getElementById('adminReferralPercentStatus');
const percent = Number(document.getElementById('adminReferralPercent').value);
if (percent < 0 || percent > 100 || Number.isNaN(percent)){
status.textContent = (I18N[currentLang] || I18N.ru).admin_need_valid_percent;
return;
}
status.textContent = (I18N[currentLang] || I18N.ru).discount_saving;
adminApiFetch('/api/admin/referral_percent', { method: 'POST', body: { percent: percent } })
.then(() => { status.textContent = (I18N[currentLang] || I18N.ru).status_saved_ok; loadAdminSettings(); })
.catch(err => { status.textContent = friendlyErrorMessage(err); });
});

// ---------------- Люди (админы / поддержка; старых организаторов аукционов можно только снять) ----------------

function loadAdminPeople(){
const list = document.getElementById('adminPeopleList');
adminApiFetch('/api/admin/people')
.then(data => {
const rows = [];
rows.push(`<div class="deal-meta" style="margin-bottom:8px;">${(I18N[currentLang] || I18N.ru).admin_owner_label} ${data.owner_id}</div>`);
const chipLabels = data.chip_labels || {};
const permsMap = data.permissions || {};
(data.admins || []).forEach(id => {
const perms = permsMap[String(id)] || [];
let chipsHtml = '';
if (data.is_owner){
chipsHtml = `<div class="admin-perm-chips" style="margin-top:8px;">` +
Object.keys(chipLabels).map(chip => {
const checked = perms.includes(chip) ? 'checked' : '';
return `<label class="admin-perm-chip"><input type="checkbox" data-perm-user="${id}" data-perm-chip="${chip}" ${checked}> ${escapeHtml(chipLabels[chip])}</label>`;
}).join('') +
`</div>`;
}
rows.push(`<div class="deal-card" style="padding:8px 12px; flex-direction:column; align-items:stretch;"><div style="display:flex; justify-content:space-between; align-items:center;"><div class="deal-info"><div class="deal-title" style="font-size:13px;">Админ · ${id}</div></div>${data.is_owner ? `<div class="deal-actions"><button class="deal-action secondary" data-remove-admin="${id}" type="button">Снять</button></div>` : ''}</div>${chipsHtml}</div>`);
});
(data.auctioneers || []).forEach(id => {
rows.push(`<div class="deal-card" style="padding:8px 12px;"><div class="deal-info"><div class="deal-title" style="font-size:13px;">${(I18N[currentLang] || I18N.ru).admin_organizer_label} ${id}</div></div>${data.is_owner ? `<div class="deal-actions"><button class="deal-action secondary" data-remove-auctioneer="${id}" type="button">Снять</button></div>` : ''}</div>`);
});
(data.support_admins || []).forEach(id => {
rows.push(`<div class="deal-card" style="padding:8px 12px;"><div class="deal-info"><div class="deal-title" style="font-size:13px;">${(I18N[currentLang] || I18N.ru).admin_pult_label} ${id}</div></div>${data.is_owner ? `<div class="deal-actions"><button class="deal-action secondary" data-remove-support-admin="${id}" type="button">Снять</button></div>` : ''}</div>`);
});
(data.blocked_users || []).forEach(id => {
rows.push(`<div class="deal-card" style="padding:8px 12px;"><div class="deal-info"><div class="deal-title" style="font-size:13px; color:#e0555a;">🚫 Заблокирован · ${id}</div></div><div class="deal-actions"><button class="deal-action secondary" data-unblock-user="${id}" type="button">Разблокировать</button></div></div>`);
});
list.innerHTML = rows.join('');
document.getElementById('adminAddAdminBtn').style.display = data.is_owner ? '' : 'none';
document.getElementById('adminAddSupportAdminBtn').style.display = data.is_owner ? '' : 'none';
})
.catch(() => {});
}

document.getElementById('adminPeopleList').addEventListener('change', (e) => {
const checkbox = e.target.closest('[data-perm-user]');
if (!checkbox) return;
adminApiFetch('/api/admin/people/set_permission', {
method: 'POST',
body: {
user_id: Number(checkbox.dataset.permUser),
chip: checkbox.dataset.permChip,
enabled: checkbox.checked,
}
})
.catch(() => { checkbox.checked = !checkbox.checked; showAlert((I18N[currentLang] || I18N.ru).admin_change_right_failed); });
});

document.getElementById('adminPeopleList').addEventListener('click', (e) => {
const removeAdminBtn = e.target.closest('[data-remove-admin]');
const removeAuctBtn = e.target.closest('[data-remove-auctioneer]');
if (removeAdminBtn){
adminApiFetch('/api/admin/people/remove_admin', { method: 'POST', body: { user_id: Number(removeAdminBtn.dataset.removeAdmin) } })
.then(loadAdminPeople)
.catch(err => showErrorToast(err));
}
if (removeAuctBtn){
adminApiFetch('/api/admin/people/remove_auctioneer', { method: 'POST', body: { user_id: Number(removeAuctBtn.dataset.removeAuctioneer) } })
.then(loadAdminPeople)
.catch(err => showErrorToast(err));
}
const removeSupportBtn = e.target.closest('[data-remove-support-admin]');
if (removeSupportBtn){
adminApiFetch('/api/admin/people/remove_support_admin', { method: 'POST', body: { user_id: Number(removeSupportBtn.dataset.removeSupportAdmin) } })
.then(loadAdminPeople)
.catch(err => showErrorToast(err));
}
const unblockBtn = e.target.closest('[data-unblock-user]');
if (unblockBtn){
adminApiFetch('/api/admin/people/unblock_user', { method: 'POST', body: { user_id: Number(unblockBtn.dataset.unblockUser) } })
.then(loadAdminPeople)
.catch(err => showErrorToast(err));
}
});

document.getElementById('adminAddAdminBtn').addEventListener('click', () => {
const status = document.getElementById('adminPeopleStatus');
const id = Number(document.getElementById('adminNewPersonId').value);
if (!id){ status.textContent = (I18N[currentLang] || I18N.ru).admin_need_user_id; return; }
adminApiFetch('/api/admin/people/add_admin', { method: 'POST', body: { user_id: id } })
.then(() => { status.textContent = (I18N[currentLang] || I18N.ru).status_done_ok; document.getElementById('adminNewPersonId').value = ''; loadAdminPeople(); })
.catch(err => { status.textContent = friendlyErrorMessage(err); });
});

document.getElementById('adminAddSupportAdminBtn').addEventListener('click', () => {
const status = document.getElementById('adminPeopleStatus');
const id = Number(document.getElementById('adminNewPersonId').value);
if (!id){ status.textContent = (I18N[currentLang] || I18N.ru).admin_need_user_id; return; }
adminApiFetch('/api/admin/people/add_support_admin', { method: 'POST', body: { user_id: id } })
.then(() => { status.textContent = (I18N[currentLang] || I18N.ru).status_done_ok; document.getElementById('adminNewPersonId').value = ''; loadAdminPeople(); })
.catch(err => { status.textContent = friendlyErrorMessage(err); });
});

document.getElementById('adminBlockUserBtn').addEventListener('click', () => {
const status = document.getElementById('adminPeopleStatus');
const id = Number(document.getElementById('adminNewPersonId').value);
if (!id){ status.textContent = (I18N[currentLang] || I18N.ru).admin_need_user_id; return; }
showConfirm((I18N[currentLang] || I18N.ru).admin_confirm_block_user, () => {
adminApiFetch('/api/admin/people/block_user', { method: 'POST', body: { user_id: id } })
.then(() => { status.textContent = (I18N[currentLang] || I18N.ru).status_done_ok; document.getElementById('adminNewPersonId').value = ''; loadAdminPeople(); })
.catch(err => { status.textContent = friendlyErrorMessage(err); });
});
});

// ---------- отчёт в Excel ----------

function adminSendReport(day, btn, period){
const dict = I18N[currentLang] || I18N.ru;
const status = document.getElementById('adminReportStatus');
btn.disabled = true;
status.textContent = dict.admin_report_sending;
adminApiFetch('/api/admin/finance/report_send', { method: 'POST', body: period || { day: day } })
.then(data => {
status.textContent = data.to_channel ? dict.admin_report_sent_channel : dict.admin_report_sent_dm;
})
.catch(err => { status.textContent = friendlyErrorMessage(err); })
.finally(() => { btn.disabled = false; });
}

document.getElementById('adminReportTodayBtn').addEventListener('click', (e) => adminSendReport('today', e.currentTarget));
document.getElementById('adminReportYesterdayBtn').addEventListener('click', (e) => adminSendReport('yesterday', e.currentTarget));

// Период — даты по Ташкенту, обе включительно.
function tashkentToday(){
return new Date(Date.now() + (5 * 60 + new Date().getTimezoneOffset()) * 60000);
}

function isoDate(d){
return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function setReportPeriod(preset){
const today = tashkentToday();
let from = new Date(today), to = new Date(today);
if (preset === '7'){
from.setDate(from.getDate() - 6);
} else if (preset === 'month'){
from = new Date(today.getFullYear(), today.getMonth(), 1);
} else if (preset === 'prev_month'){
from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
to = new Date(today.getFullYear(), today.getMonth(), 0);
}
document.getElementById('adminReportFrom').value = isoDate(from);
document.getElementById('adminReportTo').value = isoDate(to);
document.getElementById('adminReportFrom').max = isoDate(today);
document.getElementById('adminReportTo').max = isoDate(today);
}

setReportPeriod('month');

document.querySelector('.report-presets').addEventListener('click', (e) => {
const b = e.target.closest('[data-report-preset]');
if (b) setReportPeriod(b.dataset.reportPreset);
});

document.getElementById('adminReportPeriodBtn').addEventListener('click', (e) => {
const dict = I18N[currentLang] || I18N.ru;
const from = document.getElementById('adminReportFrom').value;
const to = document.getElementById('adminReportTo').value;
if (!from || !to || from > to){
document.getElementById('adminReportStatus').textContent = dict.admin_report_bad_period;
return;
}
adminSendReport(null, e.currentTarget, { date_from: from, date_to: to });
});


// ---------------- Заявки продавцов (KYC) ----------------
// Фото документов грузятся прямо с сервера по запросу админа и в
// Telegram не пересылаются; решение принимается здесь.

function kycPhotoUrl(id, kind){
return withAdmin2fa(API_BASE + '/api/admin/kyc/photo?id=' + id + '&kind=' + kind + '&init_data=' + encodeURIComponent(tg.initData));
}

function kycDateLabel(iso){
return iso ? new Date(iso).toLocaleString(currentLang === 'en' ? 'en-US' : 'ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
}

function loadAdminKyc(){
const dict = I18N[currentLang] || I18N.ru;
const list = document.getElementById('adminKycList');
const recentBox = document.getElementById('adminKycRecent');
adminApiFetch('/api/admin/kyc/list')
.then(data => {
const pending = data.pending || [];
list.innerHTML = pending.length ? pending.map(k => `
<div class="deal-card kyc-card">
<div class="deal-title">#${k.id} · ${escapeHtml(k.username || '')} <span class="deal-meta">id ${k.user_id} · ${kycDateLabel(k.submitted_at)}</span></div>
<dl class="kyc-fields">
<dt>${dict.kyc_label_fullname}</dt><dd>${escapeHtml(k.full_name)}</dd>
<dt>${dict.kyc_label_phone}</dt><dd>${escapeHtml(k.phone)}</dd>
<dt>${dict.kyc_label_country}</dt><dd>${escapeHtml(k.country)}</dd>
<dt>${dict.kyc_label_address}</dt><dd>${escapeHtml(k.address)}</dd>
<dt>${dict.kyc_label_legal}</dt><dd>${escapeHtml(dict['kyc_legal_' + (k.legal_status || 'individual')] || k.legal_status || '')}${k.tin ? ' · ' + escapeHtml(k.tin) : ''}</dd>
</dl>
${k.checks ? `<div class="kyc-checks">${escapeHtml(k.checks)}</div>` : ''}
${k.has_photos ? `<div class="kyc-shots">
<figure><img src="${escapeHtml(kycPhotoUrl(k.id, 'doc'))}" data-kyc-zoom alt=""><figcaption>${dict.kyc_photo_doc}</figcaption></figure>
<figure><img src="${escapeHtml(kycPhotoUrl(k.id, 'selfie'))}" data-kyc-zoom alt=""><figcaption>${dict.kyc_photo_selfie}</figcaption></figure>
</div>` : `<div class="deal-hint">${dict.admin_kyc_no_photos}</div>`}
<div class="deal-actions">
<button class="deal-action" data-kyc-decide="approve" data-kyc-id="${k.id}" type="button">${dict.admin_btn_approve}</button>
<button class="deal-action secondary" data-kyc-decide="reject" data-kyc-id="${k.id}" type="button">${dict.admin_btn_reject}</button>
</div>
</div>`).join('') : `<div class="skins-empty skins-empty-sm">${dict.admin_no_requests}</div>`;
const recent = data.recent || [];
recentBox.innerHTML = recent.length
? `<div class="kyc-recent"><b>${dict.admin_kyc_recent}</b><br>` + recent.map(k =>
`#${k.id} · id ${k.user_id} · ${k.status === 'verified' ? '✅' : '❌'} ${kycDateLabel(k.reviewed_at)}`).join('<br>') + '</div>'
: '';
})
.catch(() => { list.innerHTML = `<div class="skins-empty skins-empty-sm">${dict.load_failed}</div>`; });
}

document.getElementById('adminKycList').addEventListener('click', (e) => {
const zoom = e.target.closest('[data-kyc-zoom]');
if (zoom){
document.getElementById('kycLightboxImg').src = zoom.src;
document.getElementById('kycLightbox').hidden = false;
return;
}
const btn = e.target.closest('[data-kyc-decide]');
if (!btn) return;
const dict = I18N[currentLang] || I18N.ru;
const approve = btn.dataset.kycDecide === 'approve';
const ask = (approve ? dict.admin_kyc_confirm_approve : dict.admin_kyc_confirm_reject).replace('{id}', btn.dataset.kycId);
const go = () => {
btn.disabled = true;
adminApiFetch('/api/admin/kyc/decide', { method: 'POST', body: { id: Number(btn.dataset.kycId), decision: btn.dataset.kycDecide } })
.then(loadAdminKyc)
.catch(err => { btn.disabled = false; showErrorToast(err); });
};
showConfirm(ask, go);
});

document.getElementById('kycLightbox').addEventListener('click', () => {
document.getElementById('kycLightbox').hidden = true;
document.getElementById('kycLightboxImg').removeAttribute('src');
});

// Кнопка «Открыть заявку» в уведомлении бота ведёт сюда (startapp=admin_kyc).
(function openKycFromDeepLink(){
if (!(tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param === 'admin_kyc')) return;
let tries = 0;
const timer = setInterval(() => {
if (++tries > 40){ clearInterval(timer); return; }
if (!isAdmin) return;
clearInterval(timer);
currentAdminChip = 'requests';
document.querySelectorAll('#adminChips .category-chip').forEach(c => c.classList.toggle('active', c.dataset.adminGroup === 'requests'));
goToScreen('admin');
setTimeout(() => {
const sec = document.getElementById('adminKycSection');
if (sec && sec.style.display !== 'none') sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
}, 600);
}, 250);
})();

// ---------------- Рилс: ролик из шаблона или по команде ----------------
// Владелец выбирает шаблон, лоты, язык надписей и озвучки, голос и музыку
// (с прослушиванием), может написать команду для ИИ. Бот запускает сборку
// в GitHub Actions; готовый ролик приходит в бота черновиком, здесь — ход.

let reelsOptions = null;
const reelsState = { template: null, lots: [], lang: 'uz', voice_lang: 'uz', voice: 'male', music: '' };
let reelsAudio = null;
let reelsPollTimer = null;

function reelsDict(){ return I18N[currentLang] || I18N.ru; }

function reelsTemplate(){
return (reelsOptions && reelsOptions.templates || []).find(t => t.id === reelsState.template) || null;
}

function reelsTplName(t){
return currentLang === 'uz' ? t.name_uz : t.name_ru;
}

function loadAdminReels(){
if (!isOwner) return;
const promise = reelsOptions ? Promise.resolve(reelsOptions) : adminApiFetch('/api/admin/reels/options');
promise.then(opts => {
reelsOptions = opts;
if (!reelsState.template && opts.templates.length) reelsState.template = opts.templates[0].id;
renderReelsForm();
loadReelsList();
}).catch(err => {
document.getElementById('reelsStatusLine').textContent = err.message;
});
}

function reelsSeg(id, options, key){
const box = document.getElementById(id);
box.innerHTML = options.map(([value, label]) =>
`<button type="button" role="radio" aria-checked="${reelsState[key] === value}" class="${reelsState[key] === value ? 'active' : ''}" data-value="${escapeHtml(value)}">${escapeHtml(label)}</button>`
).join('');
box.onclick = (e) => {
const btn = e.target.closest('button[data-value]');
if (!btn) return;
reelsState[key] = btn.dataset.value;
reelsSeg(id, options, key);
};
}

function renderReelsForm(){
const dict = reelsDict();
const opts = reelsOptions;
const status = document.getElementById('reelsStatusLine');
status.textContent = opts.configured
? dict.reels_today.replace('{n}', opts.used_today).replace('{max}', opts.max_per_day)
: dict.reels_not_configured_hint;
document.getElementById('reelsCreateBtn').disabled = !opts.configured;

const grid = document.getElementById('reelsTemplates');
grid.innerHTML = opts.templates.map(t =>
`<button type="button" class="reels-tpl${t.id === reelsState.template ? ' active' : ''}" data-tpl="${escapeHtml(t.id)}" aria-pressed="${t.id === reelsState.template}"><b>${escapeHtml(reelsTplName(t))}</b><span>${escapeHtml(t.about)}</span></button>`
).join('');
grid.onclick = (e) => {
const btn = e.target.closest('[data-tpl]');
if (!btn) return;
reelsState.template = btn.dataset.tpl;
reelsState.lots = reelsState.lots.slice(0, (reelsTemplate() || {}).lots || 0);
renderReelsForm();
};

renderReelsLots();
reelsSeg('reelsLang', [['uz', "O'zbekcha"], ['ru', 'Русский']], 'lang');
reelsSeg('reelsVoiceLang', [['uz', "🎙 O'zbekcha"], ['ru', '🎙 Русский']], 'voice_lang');
reelsSeg('reelsVoice', [['male', dict.reels_voice_male], ['female', dict.reels_voice_female], ['none', dict.reels_voice_none]], 'voice');
renderReelsMusic();
}

function renderReelsLots(){
const dict = reelsDict();
const t = reelsTemplate();
const field = document.getElementById('reelsLotsField');
const need = t ? t.lots : 0;
field.hidden = !need;
if (!need) return;
document.getElementById('reelsLotsHint').textContent = dict.reels_lots_hint.replace('{n}', need);
const pool = (typeof lastSkins !== 'undefined' ? lastSkins : [])
.filter(s => s.status === 'available' || !s.status)
.slice().sort((a, b) => (b.price || 0) - (a.price || 0)).slice(0, 40);
const box = document.getElementById('reelsLots');
if (!pool.length){
box.innerHTML = `<div class="skins-empty skins-empty-sm">${escapeHtml(dict.reels_no_lots)}</div>`;
return;
}
box.innerHTML = pool.map(s => {
const n = reelsState.lots.indexOf(s.id);
return `<button type="button" class="reels-lot${n >= 0 ? ' active' : ''}" data-lot="${s.id}" aria-pressed="${n >= 0}">
<img src="${escapeHtml(s.photo_url || '')}" alt="" loading="lazy">
<span class="reels-lot-txt"><b>${escapeHtml(s.title || '')}</b><span>#${s.id} · ${escapeHtml(s.wear || '')} · ${formatCoins(s.price || 0)}</span></span>
${n >= 0 ? `<span class="reels-lot-n">${n + 1}</span>` : ''}</button>`;
}).join('');
box.onclick = (e) => {
const btn = e.target.closest('[data-lot]');
if (!btn) return;
const id = Number(btn.dataset.lot);
const i = reelsState.lots.indexOf(id);
if (i >= 0) reelsState.lots.splice(i, 1);
else if (reelsState.lots.length < need) reelsState.lots.push(id);
else { reelsState.lots.shift(); reelsState.lots.push(id); }
renderReelsLots();
};
}

function stopReelsPreview(){
if (reelsAudio){ reelsAudio.pause(); reelsAudio = null; }
document.querySelectorAll('.reels-play.playing').forEach(b => { b.classList.remove('playing'); b.textContent = '▶'; });
}

function renderReelsMusic(){
const dict = reelsDict();
const t = reelsTemplate();
const items = [{ id: '', name: dict.reels_music_auto, about: t ? dict.reels_music_auto_hint.replace('{m}', t.music) : '' }].concat(reelsOptions.music);
const box = document.getElementById('reelsMusic');
box.innerHTML = items.map(m =>
`<div class="reels-mus${m.id === reelsState.music ? ' active' : ''}" role="radio" tabindex="0" aria-checked="${m.id === reelsState.music}" data-music="${escapeHtml(m.id)}">
<span class="reels-mus-txt"><b>${escapeHtml(m.name)}</b><span>${escapeHtml(m.about || '')}</span></span>
${m.id && m.id !== 'none' ? `<button type="button" class="reels-play" data-play="${escapeHtml(m.id)}" aria-label="${escapeHtml(dict.reels_listen)} ${escapeHtml(m.name)}">▶</button>` : ''}</div>`
).join('');
box.onclick = (e) => {
const play = e.target.closest('[data-play]');
if (play){
const was = play.classList.contains('playing');
stopReelsPreview();
if (was) return;
reelsAudio = new Audio('reels-music/' + play.dataset.play + '.mp3');
reelsAudio.play().catch(() => {});
reelsAudio.onended = stopReelsPreview;
play.classList.add('playing');
play.textContent = '■';
return;
}
const item = e.target.closest('[data-music]');
if (!item) return;
reelsState.music = item.dataset.music;
box.querySelectorAll('[data-music]').forEach(el => {
const on = el.dataset.music === reelsState.music;
el.classList.toggle('active', on);
el.setAttribute('aria-checked', on);
});
};
}

const REELS_STATUS_KEYS = { queued: 'reels_st_queued', running: 'reels_st_running', done: 'reels_st_done', failed: 'reels_st_failed' };

function loadReelsList(){
adminApiFetch('/api/admin/reels/list').then(data => {
const dict = reelsDict();
const box = document.getElementById('reelsList');
const reqs = data.requests || [];
if (!reqs.length){
box.innerHTML = `<div class="skins-empty skins-empty-sm">${escapeHtml(dict.reels_empty)}</div>`;
} else {
const names = {};
(reelsOptions && reelsOptions.templates || []).forEach(t => { names[t.id] = reelsTplName(t); });
box.innerHTML = reqs.map(r => {
const when = new Date(r.created_at * 1000).toLocaleString(currentLang === 'uz' ? 'uz-UZ' : 'ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const p = r.params || {};
const bits = [names[r.template] || r.template, (p.lang || '').toUpperCase(), p.music || ''].filter(Boolean).join(' · ');
return `<div class="reels-req">
<div class="reels-req-top"><span>#${r.id} · ${escapeHtml(bits)}</span><span class="reels-badge ${escapeHtml(r.status)}">${escapeHtml(dict[REELS_STATUS_KEYS[r.status]] || r.status)}</span></div>
<div class="reels-req-note">${escapeHtml(when)}${r.command ? ' · «' + escapeHtml(r.command.slice(0, 120)) + '»' : ''}</div>
${r.note ? `<div class="reels-req-note">${escapeHtml(r.note)}</div>` : ''}
${r.run_url ? `<a href="${escapeHtml(r.run_url)}" target="_blank" rel="noopener">${escapeHtml(dict.reels_run_link)}</a>` : ''}
</div>`;
}).join('');
}
clearTimeout(reelsPollTimer);
const busy = reqs.some(r => r.status === 'queued' || r.status === 'running');
const visible = document.getElementById('adminReelsSection').style.display !== 'none';
if (busy && visible) reelsPollTimer = setTimeout(loadReelsList, 20000);
}).catch(() => {});
}

document.getElementById('reelsCreateBtn').addEventListener('click', () => {
const dict = reelsDict();
const t = reelsTemplate();
if (!t) return;
const btn = document.getElementById('reelsCreateBtn');
btn.disabled = true;
stopReelsPreview();
adminApiFetch('/api/admin/reels/create', { method: 'POST', body: {
template: t.id, skin_ids: reelsState.lots, lang: reelsState.lang, voice_lang: reelsState.voice_lang,
voice: reelsState.voice, music: reelsState.music, command: document.getElementById('reelsCommand').value.trim(),
} }).then(() => {
showToast(dict.reels_started);
document.getElementById('reelsCommand').value = '';
if (reelsOptions) reelsOptions.used_today += 1;
renderReelsForm();
loadReelsList();
}).catch(err => {
showToast(err.message, { type: 'error' });
}).finally(() => {
btn.disabled = !(reelsOptions && reelsOptions.configured);
});
});

document.getElementById('adminChips').addEventListener('click', (e) => {
const chip = e.target.closest('[data-admin-group]');
if (!chip) return;
if (chip.dataset.adminGroup === 'reels') loadAdminReels();
else { stopReelsPreview(); clearTimeout(reelsPollTimer); }
});
