// ============================================================
// ФИЛЬТРЫ КАТАЛОГА
// ============================================================

function countActiveFilters(){
let n = 0;
if (activeFilters.priceMin !== null) n++;
if (activeFilters.priceMax !== null) n++;
if (activeFilters.floatMin !== null) n++;
if (activeFilters.floatMax !== null) n++;
if (activeFilters.stickers !== 'any') n++;
return n;
}

function updateFiltersBadge(){
const badge = document.getElementById('filtersActiveCount');
const n = countActiveFilters();
if (n > 0){
badge.style.display = '';
badge.textContent = String(n);
} else {
badge.style.display = 'none';
}
}

document.getElementById('openFiltersBtn').addEventListener('click', () => {
document.getElementById('filterPriceMin').value = activeFilters.priceMin ?? '';
document.getElementById('filterPriceMax').value = activeFilters.priceMax ?? '';
document.getElementById('filterFloatMin').value = activeFilters.floatMin ?? '';
document.getElementById('filterFloatMax').value = activeFilters.floatMax ?? '';
document.getElementById('filterStickers').value = activeFilters.stickers;
renderSavedFilters();
document.getElementById('filtersOverlay').classList.add('show');
});

// ---------------- Сеты оружия ----------------

document.getElementById('openSetsBtn').addEventListener('click', () => {
document.getElementById('setsOverlay').classList.add('show');
loadSetsList();
});

document.getElementById('setsCloseBtn').addEventListener('click', () => {
document.getElementById('setsOverlay').classList.remove('show');
});

document.getElementById('inspectCloseBtn').addEventListener('click', () => {
document.getElementById('inspectOverlay').classList.remove('show');
});

// ---------------- Детали сделки (Trade Details) ----------------

function getOrderStatusLabel(status){
const dict = I18N[currentLang] || I18N.ru;
return dict['order_status_' + status] || status;
}

function openTradeDetails(skinId){
const deal = lastDeals.find(d => d.id === skinId);
if (!deal || !tg || !tg.initData) return;

const overlay = document.getElementById('tradeDetailsOverlay');
document.getElementById('tradeDetailsCode').textContent = '…';
document.getElementById('tradeDetailsItem').innerHTML = `
${deal.photo_url ? `<img src="${deal.photo_url}" style="width:48px;height:48px;object-fit:contain;">` : ''}
<div>
<div style="font-size:13px; color:var(--silver);">${escapeHtml(deal.title)}</div>
<div style="font-size:12px; color:var(--muted);">${formatCoins(deal.price)}</div>
</div>
`;
overlay.classList.add('show');

// Пока история грузится — таймлайн по полям сделки (или по уже
// закэшированной истории), потом уточняем точным временем.
document.getElementById('tradeDetailsPartiesLine').innerHTML = '';
document.getElementById('tradeDetailsPartiesLine').style.display = 'none';
document.getElementById('tradeDetailsTimeline').innerHTML = dealStepperHtml(deal, dealHistoryCache[deal.id]);

fetch(API_BASE + '/api/deals/' + skinId + '/history?init_data=' + encodeURIComponent(tg.initData))
.then(r => r.json())
.then(data => {
document.getElementById('tradeDetailsCode').textContent = data.order_code || '';
dealHistoryCache[deal.id] = data.history || [];
document.getElementById('tradeDetailsTimeline').innerHTML = dealStepperHtml(deal, dealHistoryCache[deal.id]);
})
.catch(() => {
document.getElementById('tradeDetailsCode').textContent = '';
});
}

document.getElementById('tradeDetailsCloseBtn').addEventListener('click', () => {
document.getElementById('tradeDetailsOverlay').classList.remove('show');
});

// ---------------- Роль продавца / AML-KYC ----------------

const kycOverlay = document.getElementById('kycOverlay');
const kycStatus = document.getElementById('kycStatus');

function updateSellerStatusUI(status){
document.getElementById('sellerStatusNone').style.display = (status === 'none') ? '' : 'none';
document.getElementById('sellerStatusPending').style.display = (status === 'pending') ? '' : 'none';
document.getElementById('sellerStatusRejected').style.display = (status === 'rejected') ? '' : 'none';
document.getElementById('sellerStatusVerified').style.display = (status === 'verified') ? '' : 'none';
document.getElementById('profileMoneyButtons').style.display = (status === 'verified') ? '' : 'none';
}

function openKycOverlay(){
document.getElementById('kycFullName').value = '';
document.getElementById('kycPhone').value = '';
document.getElementById('kycCountry').value = '';
document.getElementById('kycAddress').value = '';
kycStatus.textContent = '';
kycOverlay.classList.add('show');
}

document.getElementById('openKycBtn').addEventListener('click', openKycOverlay);
document.getElementById('openKycBtnAgain').addEventListener('click', openKycOverlay);

// ---------------- Двухэтапная защита (TOTP) ----------------

let totp2faStatus = { confirmed: false, enabled_withdraw: false, enabled_admin: false };

// ---------------- Каталог желаний ----------------

// ---------------- Buy-заявки ("Ищут") ----------------

let brSelectedSkinId = null;
let brTargetRequestId = null;

function loadMyBuyRequests(){
if (!tg || !tg.initData) return;
const dict = I18N[currentLang] || I18N.ru;
const el = document.getElementById('myBuyRequestsList');
fetch(API_BASE + '/api/buy_requests/mine?init_data=' + encodeURIComponent(tg.initData))
.then(r => r.json())
.then(data => {
const items = (data && data.items) || [];
if (!items.length){
el.innerHTML = `<div class="skins-empty" style="padding:16px 4px;">${dict.br_no_my_requests}</div>`;
return;
}
el.innerHTML = items.map(req => {
const statusLabel = {
open: dict.br_status_open,
fulfilled: dict.br_status_fulfilled,
cancelled: dict.br_status_cancelled,
expired: dict.br_status_expired,
}[req.status] || req.status;
const cancelBtn = req.status === 'open'
? `<button class="deal-action secondary" data-br-cancel="${req.id}" type="button">${dict.br_btn_cancel}</button>`
: '';
return `
<div class="deal-card" style="flex-direction:column; align-items:stretch;">
<div class="deal-title">🔍 ${escapeHtml(req.title)}</div>
<div class="deal-meta">${req.max_price ? formatCoins(req.max_price) : dict.br_no_max_price} · ${statusLabel}</div>
<div id="brResponses-${req.id}" style="margin-top:6px;"></div>
<div class="deal-actions" style="margin-top:6px;">${cancelBtn}</div>
</div>`;
}).join('');
items.forEach(req => loadBuyRequestResponses(req.id));
})
.catch(() => {
el.innerHTML = `<div class="skins-empty" style="padding:16px 4px;">${dict.load_failed}</div>`;
});
}

function loadBuyRequestResponses(requestId){
if (!tg || !tg.initData) return;
const dict = I18N[currentLang] || I18N.ru;
const el = document.getElementById('brResponses-' + requestId);
if (!el) return;
fetch(API_BASE + '/api/buy_requests/' + requestId + '/responses?init_data=' + encodeURIComponent(tg.initData))
.then(r => r.json())
.then(data => {
const items = (data && data.items) || [];
if (!items.length){
el.innerHTML = '';
return;
}
el.innerHTML = items.map(r => {
let actions = '';
if (r.status === 'pending'){
actions = `<button class="deal-action" data-br-resp-accept="${r.id}" type="button">${dict.br_btn_accept}</button><button class="deal-action secondary" data-br-resp-decline="${r.id}" type="button">${dict.br_btn_decline}</button>`;
}
const statusLabel = {
pending: dict.br_resp_pending,
accepted: dict.br_resp_accepted,
declined: dict.br_resp_declined,
}[r.status] || r.status;
return `
<div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.06);">
<div>
<div style="font-size:12px; color:var(--silver);">${escapeHtml(r.skin_title || '—')} — ${formatCoins(r.price)}</div>
<div style="font-size:10px; color:var(--muted);">${statusLabel}</div>
</div>
<div style="display:flex; gap:4px;">${actions}</div>
</div>
`;
}).join('');
})
.catch(() => {});
}

document.getElementById('myBuyRequestsList').addEventListener('click', (e) => {
const cancelBtn = e.target.closest('[data-br-cancel]');
const acceptBtn = e.target.closest('[data-br-resp-accept]');
const declineBtn = e.target.closest('[data-br-resp-decline]');
const dict = I18N[currentLang] || I18N.ru;

if (cancelBtn){
showConfirm(dict.br_confirm_cancel, () => {
fetch(API_BASE + '/api/buy_requests/' + cancelBtn.dataset.brCancel + '/cancel', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData })
}).then(() => loadMyBuyRequests()).catch(() => {});
});
}

if (acceptBtn){
showConfirm(dict.br_confirm_accept, () => {
fetch(API_BASE + '/api/buy_request_responses/' + acceptBtn.dataset.brRespAccept + '/accept', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData })
})
.then(async r => {
if (!r.ok){
const data = await r.json().catch(() => ({}));
throw new Error(errorMessage(data.error));
}
showAlert(dict.br_accepted_ok);
loadMyBuyRequests();
})
.catch(err => showErrorToast(err));
});
}

if (declineBtn){
fetch(API_BASE + '/api/buy_request_responses/' + declineBtn.dataset.brRespDecline + '/decline', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData })
}).then(() => loadMyBuyRequests()).catch(() => {});
}
});

function loadPublicBuyRequests(){
const dict = I18N[currentLang] || I18N.ru;
const el = document.getElementById('publicBuyRequestsList');
fetch(API_BASE + '/api/buy_requests')
.then(r => r.json())
.then(data => {
const items = ((data && data.items) || []).filter(r => r.buyer_id !== currentUserId);
if (!items.length){
el.innerHTML = `<div class="skins-empty" style="padding:16px 4px;">${dict.br_no_public_requests}</div>`;
return;
}
el.innerHTML = items.map(req => `
<div class="deal-card">
<div class="deal-info">
<div class="deal-title">🔍 ${escapeHtml(req.title)}</div>
<div class="deal-meta">${req.max_price ? dict.br_max_price_label + ' ' + formatCoins(req.max_price) : dict.br_no_max_price}</div>
</div>
<div class="deal-actions">
<button class="deal-action" data-br-respond="${req.id}" data-br-title="${escapeHtml(req.title)}" type="button">${dict.br_btn_respond}</button>
</div>
</div>
`).join('');
})
.catch(() => {
el.innerHTML = `<div class="skins-empty" style="padding:16px 4px;">${dict.load_failed}</div>`;
});
}

document.getElementById('publicBuyRequestsList').addEventListener('click', (e) => {
const btn = e.target.closest('[data-br-respond]');
if (!btn || !currentUserId) return;
brTargetRequestId = btn.dataset.brRespond;
brSelectedSkinId = null;
const dict = I18N[currentLang] || I18N.ru;
document.getElementById('brRespondSendBtn').disabled = true;
document.getElementById('brRespondTargetInfo').textContent = dict.br_respond_target.replace('{title}', btn.dataset.brTitle);
document.getElementById('brRespondPriceInput').value = '';
document.getElementById('brRespondStatus').textContent = '';

const mySkins = lastSkins.filter(s => s.seller_id === currentUserId);
const grid = document.getElementById('brRespondMySkins');
if (!mySkins.length){
grid.innerHTML = `<div class="shop-hint">${dict.br_no_own_skins}</div>`;
} else {
grid.innerHTML = mySkins.map((s, i) => `
<div class="inv-item" data-idx="${i}" style="display:inline-block; width:31%; margin:1%; vertical-align:top;">
${s.photo_url ? `<img src="${s.photo_url}" alt="">` : ''}
<div class="inv-item-name">${escapeHtml(s.title)}</div>
<div style="font-size:11px; color:var(--red-glow);">${formatCoins(s.price)}</div>
</div>
`).join('');
grid.querySelectorAll('.inv-item').forEach((card, i) => {
card.addEventListener('click', () => {
grid.querySelectorAll('.inv-item').forEach(c => c.style.borderColor = 'var(--red-dim)');
card.style.borderColor = 'var(--red)';
brSelectedSkinId = mySkins[i].id;
document.getElementById('brRespondSendBtn').disabled = false;
});
});
}

document.getElementById('brRespondOverlay').classList.add('show');
});

document.getElementById('brRespondCloseBtn').addEventListener('click', () => {
document.getElementById('brRespondOverlay').classList.remove('show');
});

document.getElementById('brRespondSendBtn').addEventListener('click', () => {
if (!brSelectedSkinId || !brTargetRequestId || !tg || !tg.initData) return;
const dict = I18N[currentLang] || I18N.ru;
const price = Number(document.getElementById('brRespondPriceInput').value);
const status = document.getElementById('brRespondStatus');
if (!price || price <= 0){
status.textContent = dict.br_need_price;
return;
}
const btn = document.getElementById('brRespondSendBtn');
btn.disabled = true;
status.textContent = dict.br_sending;
fetch(API_BASE + '/api/buy_requests/' + brTargetRequestId + '/respond', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData, skin_id: brSelectedSkinId, price: price })
})
.then(async r => {
if (!r.ok){
const data = await r.json().catch(() => ({}));
throw new Error(errorMessage(data.error));
}
return r.json();
})
.then(() => {
status.textContent = dict.br_sent_ok;
setTimeout(() => document.getElementById('brRespondOverlay').classList.remove('show'), 800);
})
.catch(err => {
status.textContent = friendlyErrorMessage(err);
})
.finally(() => {
btn.disabled = false;
});
});

document.getElementById('brCreateBtn').addEventListener('click', () => {
if (!tg || !tg.initData) return;
const dict = I18N[currentLang] || I18N.ru;
const title = document.getElementById('brTitleInput').value.trim();
const maxPrice = Number(document.getElementById('brMaxPriceInput').value) || null;
const status = document.getElementById('brCreateStatus');
if (!title){
status.textContent = dict.br_need_title;
return;
}
const btn = document.getElementById('brCreateBtn');
btn.disabled = true;
status.textContent = dict.br_creating;
fetch(API_BASE + '/api/buy_requests', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData, title: title, max_price: maxPrice })
})
.then(async r => {
if (!r.ok){
const data = await r.json().catch(() => ({}));
throw new Error(errorMessage(data.error));
}
return r.json();
})
.then(() => {
status.textContent = dict.br_created_ok;
document.getElementById('brTitleInput').value = '';
document.getElementById('brMaxPriceInput').value = '';
loadMyBuyRequests();
})
.catch(err => {
status.textContent = friendlyErrorMessage(err);
})
.finally(() => {
btn.disabled = false;
});
});

function loadWishlist(){
if (!tg || !tg.initData) return;
const dict = I18N[currentLang] || I18N.ru;
const el = document.getElementById('wishlistItemsList');
fetch(API_BASE + '/api/wishlist?init_data=' + encodeURIComponent(tg.initData))
.then(r => r.json())
.then(data => {
const items = (data && data.items) || [];
if (!items.length){
el.innerHTML = `<div class="shop-hint">${dict.wishlist_empty}</div>`;
return;
}
el.innerHTML = items.map(item => `
<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.06);">
<div>
<div style="font-size:13px; color:var(--silver);">${escapeHtml(item.query)}</div>
${item.max_price ? `<div style="font-size:11px; color:var(--muted);">${dict.wishlist_max_price_label} ${formatCoins(item.max_price)}</div>` : ''}
</div>
<button type="button" data-wishlist-remove="${item.id}" style="background:none; border:none; color:var(--muted); font-size:16px; cursor:pointer; padding:4px 8px;">✕</button>
</div>
`).join('');
})
.catch(() => {
el.innerHTML = `<div class="shop-hint">${dict.load_failed}</div>`;
});
}

document.getElementById('wishlistItemsList').addEventListener('click', (e) => {
const btn = e.target.closest('[data-wishlist-remove]');
if (!btn || !tg || !tg.initData) return;
const itemId = btn.dataset.wishlistRemove;
fetch(API_BASE + '/api/wishlist/' + itemId + '/remove', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData })
})
.then(() => loadWishlist())
.catch(() => {});
});

document.getElementById('wishlistAddBtn').addEventListener('click', () => {
if (!tg || !tg.initData) return;
const dict = I18N[currentLang] || I18N.ru;
const query = document.getElementById('wishlistQueryInput').value.trim();
const maxPrice = Number(document.getElementById('wishlistMaxPriceInput').value) || null;
const status = document.getElementById('wishlistStatus');
if (!query){
status.textContent = dict.wishlist_need_query;
return;
}
const btn = document.getElementById('wishlistAddBtn');
btn.disabled = true;
status.textContent = dict.wishlist_adding;
fetch(API_BASE + '/api/wishlist', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData, query: query, max_price: maxPrice })
})
.then(async r => {
if (!r.ok){
const data = await r.json().catch(() => ({}));
throw new Error(data.error === 'too_many_items' ? dict.wishlist_too_many : errorMessage(data.error));
}
return r.json();
})
.then(() => {
status.textContent = dict.wishlist_added_ok;
document.getElementById('wishlistQueryInput').value = '';
document.getElementById('wishlistMaxPriceInput').value = '';
loadWishlist();
})
.catch(err => {
status.textContent = friendlyErrorMessage(err);
})
.finally(() => {
btn.disabled = false;
});
});

function loadTotpStatus(){
if (!tg || !tg.initData) return Promise.resolve();
return fetch(API_BASE + '/api/2fa/status?init_data=' + encodeURIComponent(tg.initData))
.then(r => r.json())
.then(data => {
totp2faStatus = data;
updateTotp2faUI();
})
.catch(() => {});
}

function updateTotp2faUI(){
const notSetUp = document.getElementById('totp2faNotSetUp');
const setupBox = document.getElementById('totp2faSetupBox');
const toggles = document.getElementById('totp2faToggles');
if (totp2faStatus.confirmed){
notSetUp.style.display = 'none';
setupBox.style.display = 'none';
toggles.style.display = '';
document.getElementById('totp2faToggleWithdraw').checked = !!totp2faStatus.enabled_withdraw;
document.getElementById('totp2faToggleAdmin').checked = !!totp2faStatus.enabled_admin;
document.getElementById('totp2faAdminToggleRow').style.display = isAdmin ? 'flex' : 'none';
} else {
toggles.style.display = 'none';
}
}

document.getElementById('setup2faBtn').addEventListener('click', () => {
if (!tg || !tg.initData) return;
const btn = document.getElementById('setup2faBtn');
btn.disabled = true;
fetch(API_BASE + '/api/2fa/setup', {
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
.then(data => {
document.getElementById('totp2faSecretText').textContent = data.secret_grouped;
document.getElementById('totp2faConfirmCode').value = '';
document.getElementById('totp2faSetupStatus').textContent = '';
document.getElementById('totp2faNotSetUp').style.display = 'none';
document.getElementById('totp2faSetupBox').style.display = '';
})
.catch(err => {
showErrorToast(err);
})
.finally(() => { btn.disabled = false; });
});

document.getElementById('totp2faCopyBtn').addEventListener('click', () => {
const text = document.getElementById('totp2faSecretText').textContent;
navigator.clipboard?.writeText(text.replace(/\s/g, '')).catch(() => {});
});

document.getElementById('totp2faConfirmBtn').addEventListener('click', () => {
if (!tg || !tg.initData) return;
const dict = I18N[currentLang] || I18N.ru;
const code = document.getElementById('totp2faConfirmCode').value.trim();
const btn = document.getElementById('totp2faConfirmBtn');
const status = document.getElementById('totp2faSetupStatus');
if (!code){ status.textContent = dict.totp_enter_code; return; }
btn.disabled = true;
status.textContent = dict.totp_checking;
fetch(API_BASE + '/api/2fa/confirm', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData, code: code })
})
.then(async r => {
if (!r.ok){
const data = await r.json().catch(() => ({}));
throw new Error(data.error === 'bad_code' ? dict.totp_bad_code : (data.error === 'totp_locked' ? dict.totp_locked_msg : errorMessage(data.error)));
}
return r.json();
})
.then(() => {
status.textContent = '';
loadTotpStatus();
})
.catch(err => {
status.textContent = friendlyErrorMessage(err);
})
.finally(() => { btn.disabled = false; });
});

// Универсальный запрос кода — используется и для переключателей,
// и для входа в админку. Возвращает Promise<string|null>.
function promptFor2faCode(title){
return new Promise((resolve) => {
const overlay = document.getElementById('totp2faPromptOverlay');
const input = document.getElementById('totp2faPromptCode');
const status = document.getElementById('totp2faPromptStatus');
const okBtn = document.getElementById('totp2faPromptOkBtn');
const cancelBtn = document.getElementById('totp2faPromptCancelBtn');
document.getElementById('totp2faPromptTitle').textContent = title;
input.value = '';
status.textContent = '';
overlay.classList.add('show');
function cleanup(result){
overlay.classList.remove('show');
okBtn.removeEventListener('click', onOk);
cancelBtn.removeEventListener('click', onCancel);
resolve(result);
}
function onOk(){
const code = input.value.trim();
if (!code){ status.textContent = (I18N[currentLang] || I18N.ru).totp_enter_code_short; return; }
cleanup(code);
}
function onCancel(){ cleanup(null); }
okBtn.addEventListener('click', onOk);
cancelBtn.addEventListener('click', onCancel);
});
}

function toggle2fa(purpose, enabled, checkboxEl){
const dict = I18N[currentLang] || I18N.ru;
promptFor2faCode(enabled ? dict.totp_prompt_enable : dict.totp_prompt_disable).then(code => {
if (!code){ checkboxEl.checked = !enabled; return; }
fetch(API_BASE + '/api/2fa/toggle', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData, purpose: purpose, enabled: enabled, code: code })
})
.then(async r => {
if (!r.ok){
const data = await r.json().catch(() => ({}));
throw new Error(data.error === 'bad_code' ? dict.totp_bad_code_short : (data.error === 'totp_locked' ? dict.totp_locked_msg : errorMessage(data.error)));
}
return r.json();
})
.then(() => { loadTotpStatus(); })
.catch(err => {
checkboxEl.checked = !enabled;
showErrorToast(err);
});
});
}

document.getElementById('totp2faToggleWithdraw').addEventListener('change', (e) => {
toggle2fa('withdraw', e.target.checked, e.target);
});

document.getElementById('totp2faToggleAdmin').addEventListener('change', (e) => {
toggle2fa('admin', e.target.checked, e.target);
});

document.getElementById('kycCloseBtn').addEventListener('click', () => {
kycOverlay.classList.remove('show');
});

document.getElementById('kycSubmitBtn').addEventListener('click', () => {
if (!tg || !tg.initData) return;
const dict = I18N[currentLang] || I18N.ru;
const fullName = document.getElementById('kycFullName').value.trim();
const phone = document.getElementById('kycPhone').value.trim();
const country = document.getElementById('kycCountry').value.trim();
const address = document.getElementById('kycAddress').value.trim();
if (!fullName || !phone || !country || !address){
kycStatus.textContent = dict.kyc_fill_all;
return;
}
const btn = document.getElementById('kycSubmitBtn');
btn.disabled = true;
kycStatus.textContent = dict.kyc_sending;
fetch(API_BASE + '/api/kyc/submit', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
init_data: tg.initData,
full_name: fullName, phone: phone, country: country, address: address,
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
kycStatus.textContent = '';
kycOverlay.classList.remove('show');
sellerKycStatus = 'pending';
updateSellerStatusUI('pending');
showAlert(dict.kyc_submitted_alert);
})
.catch(err => {
kycStatus.textContent = friendlyErrorMessage(err);
})
.finally(() => {
btn.disabled = false;
});
});

// ---------------- Билдер под бюджет (Combo / Inventory) ----------------

let builderMode = 'combo';
let builderSide = 't';

document.getElementById('openBuilderBtn').addEventListener('click', () => {
document.getElementById('builderOverlay').classList.add('show');
});

document.getElementById('builderCloseBtn').addEventListener('click', () => {
document.getElementById('builderOverlay').classList.remove('show');
});

document.querySelectorAll('.builder-mode-btn').forEach(btn => {
btn.addEventListener('click', () => {
builderMode = btn.dataset.mode;
document.querySelectorAll('.builder-mode-btn').forEach(b => b.classList.toggle('active', b === btn));
document.getElementById('builderSideRow').style.display = builderMode === 'inventory' ? '' : 'none';
document.getElementById('builderResult').innerHTML = '';
document.getElementById('builderStatus').textContent = '';
});
});

document.querySelectorAll('.builder-side-btn').forEach(btn => {
btn.addEventListener('click', () => {
builderSide = btn.dataset.side;
document.querySelectorAll('.builder-side-btn').forEach(b => b.classList.toggle('active', b === btn));
});
});

let builderResultItems = {};

function builderItemCard(item, label){
if (!item) return '';
builderResultItems[item.id] = item;
const photo = item.photo_url
? `<img src="${item.photo_url}" alt="" style="width:56px; height:56px; border-radius:8px; object-fit:cover; background:rgba(255,255,255,0.04);" onerror="showPlaceholderIcon(this)">`
: `<div style="width:56px; height:56px; border-radius:8px; background:rgba(255,255,255,0.04);"></div>`;
return `<div class="deal-card builder-result-item" data-skin-id="${item.id}" style="cursor:pointer;">
<div style="display:flex; align-items:center; gap:10px;">
${photo}
<div class="deal-info">
<div class="deal-meta" style="font-size:11px;">${label}</div>
<div class="deal-title" style="font-size:13px;">${escapeHtml(item.title)}</div>
<div class="deal-meta">${formatCoins(item.price)}</div>
</div>
</div>
</div>`;
}

function renderBuilderResult(container, data, mode){
if (mode === 'combo'){
if (!data.found){
container.innerHTML = '<div class="shop-hint">Не нашлось подходящей пары нож+перчатки под этот бюджет.</div>';
return;
}
container.innerHTML =
builderItemCard(data.knife, 'Нож') +
builderItemCard(data.gloves, 'Перчатки') +
`<div class="shop-hint" style="margin-top:8px;">Итого: ${formatCoins(data.total)} · Остаток от бюджета: ${formatCoins(data.remaining)}</div>`;
return;
}
// inventory
const renderOne = (res, sideLabel) => {
if (!res.found){
return `<div class="shop-hint" style="margin-bottom:10px;">${sideLabel}: не нашлось полного набора под этот бюджет.</div>`;
}
return `<div class="profile-section-title" style="font-size:12px; margin-top:10px;">${sideLabel}</div>` +
builderItemCard(res.rifle, 'Винтовка') +
builderItemCard(res.pistol, 'Пистолет') +
builderItemCard(res.knife, 'Нож') +
builderItemCard(res.gloves, 'Перчатки') +
`<div class="shop-hint" style="margin:8px 0 4px;">Итого: ${formatCoins(res.total)} · Остаток: ${formatCoins(res.remaining)}</div>`;
};
if (data.t !== undefined){
container.innerHTML = renderOne(data.t, 'T') + renderOne(data.ct, 'CT');
} else {
container.innerHTML = renderOne(data, data.side === 't' ? 'T' : 'CT');
}
}

document.getElementById('builderGenerateBtn').addEventListener('click', () => {
const status = document.getElementById('builderStatus');
const result = document.getElementById('builderResult');
const budget = Number(document.getElementById('builderBudget').value);
if (!budget || budget <= 0){
status.textContent = (I18N[currentLang] || I18N.ru).combo_need_budget;
return;
}
status.textContent = (I18N[currentLang] || I18N.ru).combo_assembling;
result.innerHTML = '';
builderResultItems = {};
const url = builderMode === 'combo'
? `${API_BASE}/api/builder/combo?budget=${budget}`
: `${API_BASE}/api/builder/inventory?budget=${budget}&side=${builderSide}`;
fetch(url)
.then(r => r.json())
.then(data => {
status.textContent = '';
renderBuilderResult(result, data, builderMode);
})
.catch(() => {
status.textContent = (I18N[currentLang] || I18N.ru).combo_assemble_failed;
});
});

document.getElementById('builderResult').addEventListener('click', (e) => {
const card = e.target.closest('.builder-result-item');
if (!card) return;
const skinId = Number(card.dataset.skinId);
const skin = builderResultItems[skinId];
if (skin) openBuySheet(skin);
});

function renderSetCard(item){
const itemsLine = item.items.map(it => escapeHtml(it.title)).join(', ');
return `
<div class="set-card">
<div class="set-card-title">${escapeHtml(item.title)}</div>
${item.description ? `<div class="set-card-items">${escapeHtml(item.description)}</div>` : ''}
<div class="set-card-items">${itemsLine}</div>
<div class="set-card-price-row">
<span class="set-card-old-price">${formatCoins(item.individual_total)}</span>
<span class="set-card-new-price">${formatCoins(item.set_price)}</span>
<span class="set-card-discount">-${item.discount_percent}%</span>
</div>
<button type="button" class="steam-link-btn" data-buy-set="${item.id}">Купить сет</button>
</div>`;
}

function loadSetsList(){
const list = document.getElementById('setsList');
const status = document.getElementById('setsStatus');
status.textContent = '';
list.innerHTML = '<div class="skins-empty" style="padding:12px 4px;">Загрузка...</div>';
fetch(API_BASE + '/api/sets')
.then(r => r.json())
.then(data => {
const items = data.items || [];
if (!items.length){
list.innerHTML = '<div class="skins-empty" style="padding:12px 4px;">Сейчас нет доступных сетов</div>';
return;
}
list.innerHTML = items.map(renderSetCard).join('');
})
.catch(() => { list.innerHTML = '<div class="skins-empty" style="padding:12px 4px;">Не удалось загрузить</div>'; });
}

document.getElementById('setsList').addEventListener('click', (e) => {
const btn = e.target.closest('[data-buy-set]');
if (!btn) return;
const setId = btn.dataset.buySet;
if (!tg || !tg.initData){
showAlert(errorMessage('unauthorized'));
return;
}
showConfirm('Купить этот сет целиком?', () => {
btn.disabled = true;
const status = document.getElementById('setsStatus');
status.textContent = '...';
fetch(API_BASE + '/api/sets/' + setId + '/buy', {
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
.then(data => {
status.textContent = `✅ Куплено за ${formatCoins(data.set_price)}`;
loadSetsList();
loadSkins();
loadMe();
})
.catch(err => {
status.textContent = friendlyErrorMessage(err);
btn.disabled = false;
});
});
});

document.getElementById('filtersCloseBtn').addEventListener('click', () => {
document.getElementById('filtersOverlay').classList.remove('show');
});

document.getElementById('filtersApplyBtn').addEventListener('click', () => {
const priceMin = document.getElementById('filterPriceMin').value;
const priceMax = document.getElementById('filterPriceMax').value;
const floatMin = document.getElementById('filterFloatMin').value;
const floatMax = document.getElementById('filterFloatMax').value;

activeFilters = {
priceMin: priceMin !== '' ? Number(priceMin) : null,
priceMax: priceMax !== '' ? Number(priceMax) : null,
floatMin: floatMin !== '' ? Number(floatMin) : null,
floatMax: floatMax !== '' ? Number(floatMax) : null,
stickers: document.getElementById('filterStickers').value,
};

updateFiltersBadge();
applyFiltersAndRender();
document.getElementById('filtersOverlay').classList.remove('show');
});

document.getElementById('filtersResetBtn').addEventListener('click', () => {
activeFilters = { priceMin: null, priceMax: null, floatMin: null, floatMax: null, stickers: 'any' };
document.getElementById('filterPriceMin').value = '';
document.getElementById('filterPriceMax').value = '';
document.getElementById('filterFloatMin').value = '';
document.getElementById('filterFloatMax').value = '';
document.getElementById('filterStickers').value = 'any';
updateFiltersBadge();
applyFiltersAndRender();
document.getElementById('filtersOverlay').classList.remove('show');
});

// ---------------- Сохранённые фильтры (localStorage) ----------------

const SAVED_FILTERS_KEY = 'dghost_saved_filters';
const SAVED_FILTERS_MAX = 5;

function getSavedFilters(){
try {
const raw = localStorage.getItem(SAVED_FILTERS_KEY);
return raw ? JSON.parse(raw) : [];
} catch (e) {
return [];
}
}

function setSavedFilters(list){
try {
localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(list));
} catch (e) {}
}

function describeFilter(f){
const parts = [];
if (f.category && f.category !== 'all') parts.push(f.category);
if (f.priceMin || f.priceMax) parts.push(`${f.priceMin || 0}–${f.priceMax || '∞'}`);
if (f.stickers && f.stickers !== 'any') parts.push(f.stickers === 'yes' ? '🎨' : '🚫🎨');
return parts.length ? parts.join(' · ') : (I18N[currentLang] || I18N.ru).filters_saved_empty_desc;
}

function renderSavedFilters(){
const dict = I18N[currentLang] || I18N.ru;
const list = getSavedFilters();
const el = document.getElementById('savedFiltersList');
if (!list.length){
el.innerHTML = `<div class="shop-hint" style="font-size:11px;">${dict.filters_saved_none}</div>`;
return;
}
el.innerHTML = list.map((f, i) => `
<div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.06);">
<button type="button" data-apply-saved="${i}" style="background:none; border:none; color:var(--silver); font-size:12px; text-align:left; flex:1; cursor:pointer; padding:4px 0;">📂 ${escapeHtml(describeFilter(f))}</button>
<button type="button" data-delete-saved="${i}" style="background:none; border:none; color:var(--muted); font-size:14px; cursor:pointer; padding:4px 8px;">✕</button>
</div>
`).join('');
}

document.getElementById('savedFiltersList').addEventListener('click', (e) => {
const applyBtn = e.target.closest('[data-apply-saved]');
const deleteBtn = e.target.closest('[data-delete-saved]');
if (applyBtn){
const f = getSavedFilters()[Number(applyBtn.dataset.applySaved)];
if (!f) return;
document.getElementById('filterPriceMin').value = f.priceMin ?? '';
document.getElementById('filterPriceMax').value = f.priceMax ?? '';
document.getElementById('filterFloatMin').value = f.floatMin ?? '';
document.getElementById('filterFloatMax').value = f.floatMax ?? '';
document.getElementById('filterStickers').value = f.stickers || 'any';
activeFilters = {
priceMin: f.priceMin ?? null, priceMax: f.priceMax ?? null,
floatMin: f.floatMin ?? null, floatMax: f.floatMax ?? null,
stickers: f.stickers || 'any',
};
if (f.category && typeof currentCategory !== 'undefined'){
currentCategory = f.category;
if (typeof renderCategoryChips === 'function') renderCategoryChips();
}
updateFiltersBadge();
applyFiltersAndRender();
document.getElementById('filtersOverlay').classList.remove('show');
}
if (deleteBtn){
const list = getSavedFilters();
list.splice(Number(deleteBtn.dataset.deleteSaved), 1);
setSavedFilters(list);
renderSavedFilters();
}
});

document.getElementById('saveCurrentFilterBtn').addEventListener('click', () => {
const dict = I18N[currentLang] || I18N.ru;
const priceMin = document.getElementById('filterPriceMin').value;
const priceMax = document.getElementById('filterPriceMax').value;
const floatMin = document.getElementById('filterFloatMin').value;
const floatMax = document.getElementById('filterFloatMax').value;
const newFilter = {
priceMin: priceMin !== '' ? Number(priceMin) : null,
priceMax: priceMax !== '' ? Number(priceMax) : null,
floatMin: floatMin !== '' ? Number(floatMin) : null,
floatMax: floatMax !== '' ? Number(floatMax) : null,
stickers: document.getElementById('filterStickers').value,
category: typeof currentCategory !== 'undefined' ? currentCategory : 'all',
};
const list = getSavedFilters();
list.unshift(newFilter);
if (list.length > SAVED_FILTERS_MAX) list.length = SAVED_FILTERS_MAX;
setSavedFilters(list);
renderSavedFilters();
showAlert(dict.filters_saved_ok);
});

const RARITY_LABEL_RU = {
'Consumer Grade': 'Ширпотреб',
'Industrial Grade': 'Промышленное',
'Mil-Spec Grade': 'Армейское',
'Restricted': 'Запрещённое',
'Classified': 'Засекреченное',
'Covert': 'Тайное',
'Contraband': 'Контрабанда',
'Extraordinary': 'Экстраординарное',
};

const RARITY_LABEL_UZ = {
'Consumer Grade': 'Oddiy',
'Industrial Grade': 'Sanoat',
'Mil-Spec Grade': 'Harbiy',
'Restricted': "Cheklangan",
'Classified': 'Maxfiy',
'Covert': 'Yashirin',
'Contraband': 'Kontrabanda',
'Extraordinary': "G'ayrioddiy",
};

const RARITY_LABEL_EN = {
'Consumer Grade': 'Consumer Grade',
'Industrial Grade': 'Industrial Grade',
'Mil-Spec Grade': 'Mil-Spec Grade',
'Restricted': 'Restricted',
'Classified': 'Classified',
'Covert': 'Covert',
'Contraband': 'Contraband',
'Extraordinary': 'Extraordinary',
};

const WEAR_LABEL_FULL = {
FN: 'Прямо с завода',
MW: 'Немного поношенное',
FT: 'После полевых испытаний',
WW: 'Поношенное',
BS: 'Закалённое в боях',
};

const WEAR_LABEL_FULL_UZ = {
FN: "Zavoddan yangi",
MW: 'Biroz eskirgan',
FT: 'Dala sinovidan o\'tgan',
WW: 'Eskirgan',
BS: "Jangda toblangan",
};

const WEAR_LABEL_FULL_EN = {
FN: 'Factory New',
MW: 'Minimal Wear',
FT: 'Field-Tested',
WW: 'Well-Worn',
BS: 'Battle-Scarred',
};

function buyDetailRow(label, value){
if (value === null || value === undefined || value === '') return '';
return `<div class="buy-detail-row"><div class="buy-detail-label">${label}</div><div class="buy-detail-value">${value}</div></div>`;
}

// ---------------- Мини-график истории цены (SVG, без библиотек) ----------------

function loadPriceHistoryChart(title){
const box = document.getElementById('priceHistoryBox');
const chartEl = document.getElementById('priceHistoryChart');
box.style.display = 'none';
if (!title) return;
fetch(API_BASE + '/api/price_history?title=' + encodeURIComponent(title))
.then(r => r.json())
.then(data => {
const history = data.history || [];
if (history.length < 2){
box.style.display = 'none';
return;
}
const prices = history.map(h => h.price);
const min = Math.min(...prices);
const max = Math.max(...prices);
const range = max - min || 1;
const w = 280, h = 60, pad = 4;
const step = (w - pad * 2) / (prices.length - 1);
const points = prices.map((p, i) => {
const x = pad + i * step;
const y = pad + (1 - (p - min) / range) * (h - pad * 2);
return `${x.toFixed(1)},${y.toFixed(1)}`;
}).join(' ');
chartEl.innerHTML = `
<svg viewBox="0 0 ${w} ${h}" style="width:100%; height:60px; display:block;">
<polyline points="${points}" fill="none" stroke="var(--red)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
</svg>
<div style="display:flex; justify-content:space-between; font-size:10px; color:var(--muted); margin-top:2px;">
<span>${formatCoins(min)}</span>
<span>${formatCoins(max)}</span>
</div>
`;
box.style.display = '';
})
.catch(() => {
box.style.display = 'none';
});
}

function openBuySheet(skin){
if (!tg || !tg.initData){
showAlert(errorMessage('unauthorized'));
return;
}
pendingBuySkin = skin;

fetch(API_BASE + '/api/skins/' + skin.id + '/view', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData })
}).catch(() => {});

loadPriceHistoryChart(skin.title);

const sellerStatsBox = document.getElementById('sellerStatsBox');
if (skin.seller_completed_trades !== undefined && skin.seller_id !== currentUserId){
const statsDict = I18N[currentLang] || I18N.ru;
const rating = skin.seller_rating_avg
? ` · ⭐ ${skin.seller_rating_avg} (${skin.seller_rating_count})` : '';
// Строка продавца кликабельна — открывает его публичный профиль.
sellerStatsBox.innerHTML = `<button type="button" class="seller-line" data-seller-profile="${skin.seller_id}">
<span>${escapeHtml(statsDict.seller_line
.replace('{rating}', rating)
.replace('{trades}', skin.seller_completed_trades)
.replace('{disputes}', skin.seller_disputes ?? 0))}</span>
<span class="seller-line-open">${statsDict.seller_open}</span>
</button>`;
sellerStatsBox.style.display = '';
} else {
sellerStatsBox.style.display = 'none';
}

const dict = I18N[currentLang] || I18N.ru;
const rarityMap = currentLang === 'uz' ? RARITY_LABEL_UZ : (currentLang === 'en' ? RARITY_LABEL_EN : RARITY_LABEL_RU);
const wearMap = currentLang === 'uz' ? WEAR_LABEL_FULL_UZ : (currentLang === 'en' ? WEAR_LABEL_FULL_EN : WEAR_LABEL_FULL);

if (skin.photo_url){
buyPhoto.src = skin.photo_url;
buyPhoto.style.display = '';
} else {
buyPhoto.removeAttribute('src');
buyPhoto.style.display = 'none';
}

let titleText = skin.stattrak ? 'StatTrak™ ' + skin.title : skin.title;
buyTitle.textContent = titleText;
buySubtitle.textContent = skin.weapon_type || 'CS2 SKIN';

buyHero.style.setProperty('--rarity-glow', RARITY_GLOW[skin.rarity] || 'rgba(235,75,75,0.35)');
buyHero.style.setProperty('--rarity-glow-strong', RARITY_GLOW_STRONG[skin.rarity] || 'rgba(235,75,75,0.55)');
buyHero.style.setProperty('--rarity-bg', RARITY_BG[skin.rarity] ? `url('${RARITY_BG[skin.rarity]}')` : 'none');

const rarityBadge = document.getElementById('buyRarityBadge');
if (skin.rarity){
rarityBadge.textContent = (rarityMap[skin.rarity] || skin.rarity).toUpperCase();
rarityBadge.style.display = '';
} else {
rarityBadge.style.display = 'none';
}

document.getElementById('buyStattrakBadge').style.display = skin.stattrak ? '' : 'none';

buyPrice.textContent = formatCoins(skin.price);

const isOwn = currentUserId && skin.seller_id === currentUserId;

const rows = [
isOwn ? '' : buyDetailRow(dict.detail_seller, dict.value_anon),
buyDetailRow(dict.detail_wear, skin.wear ? (wearMap[skin.wear] || skin.wear) : null),
buyDetailRow(dict.detail_rarity, skin.rarity ? (rarityMap[skin.rarity] || skin.rarity) : null),
buyDetailRow('StatTrak', skin.stattrak ? dict.value_yes : null),
buyDetailRow('Float', (skin.float_value !== null && skin.float_value !== undefined) ? Number(skin.float_value).toFixed(4) : null),
buyDetailRow(dict.detail_price, formatCoins(skin.price)),
].join('');

buyDetailsTable.innerHTML = rows;

// Переключаем набор кнопок: свой лот — управление, чужой — покупка.
// Админ дополнительно видит "Снять с продажи" и на чужих лотах
// (принудительная отмена — спам/обман), но не видит "Изменить цену"
// и "Предложить цену" на чужом.
buyRemoveBtn.style.display = (isOwn || isAdmin) ? '' : 'none';
document.getElementById('buyPaymentMethods').style.display = isOwn ? 'none' : 'flex';
buyConfirmBalance.style.display = 'none'; // Оплата с баланса покупателем убрана полностью
buyConfirmStars.style.display = (!isOwn && directStarsPurchaseEnabled) ? '' : 'none';
buyConfirmCrypto.style.display = (!isOwn && directCryptoPurchaseEnabled) ? '' : 'none';
buyConfirmP2P.style.display = (!isOwn && directP2pPurchaseEnabled) ? '' : 'none';
document.getElementById('buyNoPaymentHint').style.display =
(!isOwn && !directStarsPurchaseEnabled && !directCryptoPurchaseEnabled && !directP2pPurchaseEnabled) ? '' : 'none';
buyEditPriceBtn.style.display = isOwn ? '' : 'none';
document.getElementById('buyDiscountBtn').style.display = isOwn ? '' : 'none';
buySavePriceBtn.style.display = 'none';
buyPriceEdit.style.display = 'none';
buyNewPriceInput.value = skin.price;

buyMakeOfferBtn.style.display = isOwn ? 'none' : '';
document.getElementById('buyMakeTradeBtn').style.display = isOwn ? 'none' : '';
buySendOfferBtn.style.display = 'none';
buyOfferEdit.style.display = 'none';
buyOfferInput.value = '';

buyStatus.textContent = '';
buyOverlay.classList.add('show');

loadMarketPriceComparison(skin.id);
renderSimilarSkins(skin);
}

// Мини-график по дневным снимкам цены (history: [{day, price_uzs}]).
function marketSparklineHtml(history){
if (!history || history.length < 2) return '';
const prices = history.map(h => h.price_uzs);
const min = Math.min(...prices);
const max = Math.max(...prices);
const range = max - min || 1;
const w = 280, h = 44, pad = 3;
const step = (w - pad * 2) / (prices.length - 1);
const points = prices.map((p, i) => {
const x = pad + i * step;
const y = pad + (1 - (p - min) / range) * (h - pad * 2);
return `${x.toFixed(1)},${y.toFixed(1)}`;
}).join(' ');
const dict = I18N[currentLang] || I18N.ru;
return `<div class="mp-spark">
<div class="mp-spark-title">${dict.mp_history}</div>
<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${points}" fill="none" stroke="var(--red)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>
<div class="mp-spark-range"><span>${formatCoins(min)}</span><span>${formatCoins(max)}</span></div>
</div>`;
}

function renderMarketPriceBox(data){
const box = document.getElementById('marketPriceBox');
if (!data || !data.available){
box.style.display = 'none';
return;
}
const dict = I18N[currentLang] || I18N.ru;
const isCsfloat = data.source === 'csfloat';
const cheaper = data.diff_percent >= 0;
const pct = Math.abs(data.diff_percent);
const diffLabel = (cheaper
? (isCsfloat ? dict.mp_cheaper : dict.mp_cheaper_generic)
: (isCsfloat ? dict.mp_pricier : dict.mp_pricier_generic)).replace('{p}', pct);
const label = isCsfloat ? dict.mp_csfloat : dict.mp_market;
const usd = (isCsfloat && data.price_usd) ? `<span class="mp-usd">${dict.mp_from} $${Number(data.price_usd).toFixed(2)}</span>` : '';
box.innerHTML = `
<div class="mp-row"><span>${label} ${usd}</span><span>${formatCoins(data.market_price_uzs)}</span></div>
<div class="mp-diff ${cheaper ? 'cheaper' : 'pricier'}">${diffLabel}</div>
${marketSparklineHtml(data.history)}
`;
box.style.display = '';
}

// ---------- похожие лоты ----------
// Считаются на телефоне из уже загруженного каталога: сначала то же
// оружие (часть названия до « | »), затем тот же тип оружия; внутри —
// ближе по цене к текущему лоту.
function findSimilarSkins(skin, limit){
const weaponOf = (s) => String(s.title || '').split('|')[0].trim().toLowerCase();
const weapon = weaponOf(skin);
const scored = [];
for (const s of lastSkins){
if (s.id === skin.id) continue;
let score = 0;
if (weapon && weaponOf(s) === weapon) score = 2;
else if (skin.weapon_type && s.weapon_type === skin.weapon_type) score = 1;
if (!score) continue;
scored.push({ s, score, gap: Math.abs((s.price || 0) - (skin.price || 0)) });
}
scored.sort((a, b) => (b.score - a.score) || (a.gap - b.gap));
return scored.slice(0, limit).map(x => x.s);
}

function renderSimilarSkins(skin){
const box = document.getElementById('similarLotsBox');
if (!box) return;
const similar = findSimilarSkins(skin, 8);
if (!similar.length){
box.style.display = 'none';
box.innerHTML = '';
return;
}
const dict = I18N[currentLang] || I18N.ru;
box.innerHTML = `<div class="similar-title">${dict.similar_title}</div>
<div class="similar-row">${similar.map(s => `
<button type="button" class="similar-card" data-similar-id="${s.id}">
<div class="similar-photo">${s.photo_url ? `<img src="${s.photo_url}" alt="" loading="lazy">` : ''}</div>
<div class="similar-name">${escapeHtml(s.title || '')}</div>
<div class="similar-price">${formatCoins(s.price)}</div>
</button>`).join('')}</div>`;
box.style.display = '';
}

document.addEventListener('click', (e) => {
const card = e.target.closest('[data-similar-id]');
if (!card) return;
const skin = lastSkins.find(s => s.id === Number(card.dataset.similarId));
if (!skin) return;
openBuySheet(skin);
const sheet = document.querySelector('#buyOverlay .buy-sheet');
if (sheet) sheet.scrollTop = 0;
});

function loadMarketPriceComparison(skinId){
const box = document.getElementById('marketPriceBox');
box.style.display = 'none';
fetch(API_BASE + '/api/market_price?skin_id=' + skinId)
.then(r => r.json())
.then(data => {
// Пользователь мог уже закрыть/сменить лот, пока запрос летал —
// не показываем устаревшие данные не по тому лоту.
if (!pendingBuySkin || pendingBuySkin.id !== skinId) return;
renderMarketPriceBox(data);
})
.catch(() => {});
}

// ---------------- Предпросмотр рыночной цены при выставлении ----------------

let sMarketPreviewTimer = null;

function renderSellMarketPreview(data){
// Два места показа одного и того же ориентира по рынку: полная
// форма (sMarketPricePreview) и компактное окно быстрой продажи
// (qsMarketPricePreview) — оба обновляем одинаково, второй элемент
// может отсутствовать в DOM на старых кэшах, поэтому необязателен.
const boxes = ['sMarketPricePreview', 'qsMarketPricePreview']
.map(id => document.getElementById(id))
.filter(Boolean);

if (!data || !data.available){
boxes.forEach(box => { box.style.display = 'none'; });
return;
}
let extra = '';
if (typeof data.diff_percent === 'number'){
const cheaper = data.diff_percent >= 0;
extra = `<div class="mp-diff ${cheaper ? 'cheaper' : 'pricier'}">${cheaper ? 'Дешевле рынка' : '⚠️ Дороже рынка'} на ${Math.abs(data.diff_percent)}%</div>`;
}
const html = `<div class="mp-row"><span>Ориентир по рынку</span><span>${formatCoins(data.market_price_uzs)}</span></div>${extra}`;
boxes.forEach(box => { box.innerHTML = html; box.style.display = ''; });
}

function refreshSellMarketPreview(){
const title = sTitle.value.trim();
const wear = sWear.value;
if (!title || !wear){
document.getElementById('sMarketPricePreview').style.display = 'none';
return;
}
const params = new URLSearchParams({ title, wear });
if (sStattrak.checked) params.set('stattrak', '1');
const price = sPrice.value.trim();
if (price) params.set('price', price);
fetch(API_BASE + '/api/market_price_preview?' + params.toString())
.then(r => r.json())
.then(renderSellMarketPreview)
.catch(() => {});
}

function scheduleSellMarketPreview(){
clearTimeout(sMarketPreviewTimer);
sMarketPreviewTimer = setTimeout(refreshSellMarketPreview, 500);
}

['sTitle', 'sWear', 'sStattrak', 'sPrice'].forEach(id => {
const el = document.getElementById(id);
el.addEventListener('input', scheduleSellMarketPreview);
el.addEventListener('change', scheduleSellMarketPreview);
});

buyShareBtn.addEventListener('click', () => {
if (!pendingBuySkin) return;
const shareText = `${pendingBuySkin.stattrak ? 'StatTrak™ ' : ''}${pendingBuySkin.title} — ${formatCoins(pendingBuySkin.price)} в DGhost`;
const shareUrl = `${API_BASE}/s/${pendingBuySkin.id}`;
const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
if (tg && tg.openTelegramLink) {
tg.openTelegramLink(telegramShareUrl);
} else if (navigator.share) {
navigator.share({ title: pendingBuySkin.title, text: shareText, url: shareUrl }).catch(() => {});
} else {
window.open(telegramShareUrl, '_blank');
}
});

buyCancel.addEventListener('click', () => {
buyOverlay.classList.remove('show');
pendingBuySkin = null;
});

buyClose.addEventListener('click', () => {
buyOverlay.classList.remove('show');
pendingBuySkin = null;
});

buyRemoveBtn.addEventListener('click', () => {
if (!pendingBuySkin) return;
cancelListing(pendingBuySkin.id);
});

buyEditPriceBtn.addEventListener('click', () => {
if (!pendingBuySkin) return;
buyPriceEdit.style.display = '';
buyEditPriceBtn.style.display = 'none';
buySavePriceBtn.style.display = '';
buyNewPriceInput.focus();
});

buySavePriceBtn.addEventListener('click', () => {
if (!pendingBuySkin || !tg || !tg.initData) return;

const newPrice = Number(buyNewPriceInput.value);

if (!newPrice || newPrice <= 0){
buyStatus.textContent = (I18N[currentLang] || I18N.ru).status_need_valid_price;
return;
}

buySavePriceBtn.disabled = true;
buyStatus.textContent = (I18N[currentLang] || I18N.ru).discount_saving;

fetch(API_BASE + '/api/skins/' + pendingBuySkin.id + '/update_price', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData, price: newPrice })
})
.then(async r => {
if (!r.ok){
const data = await r.json().catch(() => ({}));
throw new Error(errorMessage(data.error));
}
return r.json();
})
.then((data) => {
buyStatus.textContent = (I18N[currentLang] || I18N.ru).status_price_updated;
pendingBuySkin.price = data.price;
buyPrice.textContent = formatCoins(data.price);
buyDetailsTable.innerHTML = buyDetailsTable.innerHTML.replace(/Цена<\/div><div class="buy-detail-value">[^<]*/, 'Цена</div><div class="buy-detail-value">' + formatCoins(data.price));
buyPriceEdit.style.display = 'none';
buyEditPriceBtn.style.display = '';
buySavePriceBtn.style.display = 'none';
loadSkins();
})
.catch(err => {
buyStatus.textContent = friendlyErrorMessage(err);
})
.finally(() => {
buySavePriceBtn.disabled = false;
});
});

// ---------------- Скидки ----------------

document.getElementById('buyDiscountBtn').addEventListener('click', () => {
if (!pendingBuySkin) return;
const dict = I18N[currentLang] || I18N.ru;
const skin = pendingBuySkin;
const hasDiscount = !!skin.original_price;
document.getElementById('discountCurrentInfo').textContent = hasDiscount
? `${dict.discount_info_now}: ${formatCoins(skin.original_price)} → ${formatCoins(skin.price)}`
: `${dict.discount_info_current}: ${formatCoins(skin.price)}`;
document.getElementById('discountType').value = skin.discount_type || 'percent';
document.getElementById('discountValueInput').value = skin.discount_value || '';
document.getElementById('discountExpiresInput').value = '';
document.getElementById('discountRemoveBtn').style.display = hasDiscount ? '' : 'none';
document.getElementById('discountCategoryHint').textContent = dict.discount_category_hint.replace('{category}', skin.weapon_type || skin.title || '—');
document.getElementById('discountStatus').textContent = '';
document.getElementById('discountOverlay').classList.add('show');
});

document.getElementById('discountType').addEventListener('change', (e) => {
const dict = I18N[currentLang] || I18N.ru;
document.getElementById('discountValueLabel').textContent = e.target.value === 'percent'
? dict.discount_label_value_percent
: dict.discount_label_value_fixed;
});

document.getElementById('discountCloseBtn').addEventListener('click', () => {
document.getElementById('discountOverlay').classList.remove('show');
});

function readDiscountForm(){
const dict = I18N[currentLang] || I18N.ru;
const discountType = document.getElementById('discountType').value;
const discountValue = Number(document.getElementById('discountValueInput').value);
const expiresRaw = document.getElementById('discountExpiresInput').value;
const expiresAt = expiresRaw ? new Date(expiresRaw).toISOString() : null;
if (!discountValue || discountValue <= 0){
document.getElementById('discountStatus').textContent = dict.discount_need_value;
return null;
}
return { discountType, discountValue, expiresAt };
}

document.getElementById('discountApplyBtn').addEventListener('click', () => {
if (!pendingBuySkin || !tg || !tg.initData) return;
const dict = I18N[currentLang] || I18N.ru;
const form = readDiscountForm();
if (!form) return;
const btn = document.getElementById('discountApplyBtn');
const status = document.getElementById('discountStatus');
btn.disabled = true;
status.textContent = dict.discount_saving;
fetch(API_BASE + '/api/skins/' + pendingBuySkin.id + '/discount', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
init_data: tg.initData,
discount_type: form.discountType,
discount_value: form.discountValue,
expires_at: form.expiresAt,
})
})
.then(async r => {
if (!r.ok){
const data = await r.json().catch(() => ({}));
throw new Error(errorMessage(data.error));
}
return r.json();
})
.then((data) => {
status.textContent = dict.discount_applied_ok;
Object.assign(pendingBuySkin, data.skin);
buyPrice.textContent = formatCoins(data.skin.price);
loadSkins();
})
.catch(err => {
status.textContent = friendlyErrorMessage(err);
})
.finally(() => {
btn.disabled = false;
});
});

document.getElementById('discountRemoveBtn').addEventListener('click', () => {
if (!pendingBuySkin || !tg || !tg.initData) return;
const dict = I18N[currentLang] || I18N.ru;
const status = document.getElementById('discountStatus');
status.textContent = dict.discount_removing;
fetch(API_BASE + '/api/skins/' + pendingBuySkin.id + '/discount/remove', {
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
status.textContent = dict.discount_removed_ok;
Object.assign(pendingBuySkin, data.skin);
buyPrice.textContent = formatCoins(data.skin.price);
document.getElementById('discountRemoveBtn').style.display = 'none';
loadSkins();
})
.catch(err => {
status.textContent = friendlyErrorMessage(err);
});
});

document.getElementById('discountApplyCategoryBtn').addEventListener('click', () => {
if (!pendingBuySkin || !tg || !tg.initData) return;
const dict = I18N[currentLang] || I18N.ru;
const form = readDiscountForm();
if (!form) return;
const weaponType = pendingBuySkin.weapon_type;
if (!weaponType){
document.getElementById('discountStatus').textContent = dict.discount_no_category;
return;
}
showConfirm(dict.discount_confirm_category.replace('{weapon}', weaponType), () => {
const btn = document.getElementById('discountApplyCategoryBtn');
const status = document.getElementById('discountStatus');
btn.disabled = true;
status.textContent = dict.discount_applying;
fetch(API_BASE + '/api/skins/category_discount', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
init_data: tg.initData,
weapon_type: weaponType,
discount_type: form.discountType,
discount_value: form.discountValue,
expires_at: form.expiresAt,
})
})
.then(async r => {
if (!r.ok){
const data = await r.json().catch(() => ({}));
throw new Error(errorMessage(data.error));
}
return r.json();
})
.then((data) => {
status.textContent = dict.discount_applied_category.replace('{n}', data.changed.length);
loadSkins();
})
.catch(err => {
status.textContent = friendlyErrorMessage(err);
})
.finally(() => {
btn.disabled = false;
});
});
});

// ---------------- Предложить обмен ----------------

let tradeMakeSelectedSkinId = null;

document.getElementById('buyMakeTradeBtn').addEventListener('click', () => {
if (!pendingBuySkin || !currentUserId) return;
const dict = I18N[currentLang] || I18N.ru;
tradeMakeSelectedSkinId = null;
document.getElementById('tradeMakeSendBtn').disabled = true;
document.getElementById('tradeMakeTargetInfo').textContent = dict.trade_make_target.replace('{title}', pendingBuySkin.title).replace('{price}', formatCoins(pendingBuySkin.price));
document.getElementById('tradeMakeCashInput').value = '';
document.getElementById('tradeMakeCashHint').textContent = dict.trade_make_cash_hint;
document.getElementById('tradeMakeCashRow').style.display = '';
document.getElementById('tradeMakeStatus').textContent = '';

const mySkins = lastSkins.filter(s => s.seller_id === currentUserId && s.id !== pendingBuySkin.id);
const grid = document.getElementById('tradeMakeMySkins');
if (!mySkins.length){
grid.innerHTML = `<div class="shop-hint">${dict.trade_make_no_skins}</div>`;
} else {
grid.innerHTML = mySkins.map((s, i) => `
<div class="inv-item" data-idx="${i}" style="display:inline-block; width:31%; margin:1%; vertical-align:top;">
${s.photo_url ? `<img src="${s.photo_url}" alt="">` : ''}
<div class="inv-item-name">${escapeHtml(s.title)}</div>
<div style="font-size:11px; color:var(--red-glow);">${formatCoins(s.price)}</div>
</div>
`).join('');
grid.querySelectorAll('.inv-item').forEach((card, i) => {
card.addEventListener('click', () => {
grid.querySelectorAll('.inv-item').forEach(c => c.style.borderColor = 'var(--red-dim)');
card.style.borderColor = 'var(--red)';
tradeMakeSelectedSkinId = mySkins[i].id;
document.getElementById('tradeMakeSendBtn').disabled = false;
});
});
}

document.getElementById('tradeMakeOverlay').classList.add('show');
});

document.getElementById('tradeMakeCloseBtn').addEventListener('click', () => {
document.getElementById('tradeMakeOverlay').classList.remove('show');
});

document.getElementById('tradeMakeSendBtn').addEventListener('click', () => {
if (!tradeMakeSelectedSkinId || !pendingBuySkin || !tg || !tg.initData) return;
const dict = I18N[currentLang] || I18N.ru;
const btn = document.getElementById('tradeMakeSendBtn');
const status = document.getElementById('tradeMakeStatus');
const cashAmount = Number(document.getElementById('tradeMakeCashInput').value) || 0;
const cashPayer = document.getElementById('tradeMakeCashPayer').value;
btn.disabled = true;
status.textContent = dict.trade_make_sending;
fetch(API_BASE + '/api/trade_offers', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
init_data: tg.initData,
from_skin_id: tradeMakeSelectedSkinId,
to_skin_id: pendingBuySkin.id,
cash_amount: cashAmount,
cash_payer: cashAmount ? cashPayer : null,
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
status.textContent = dict.trade_make_sent_ok;
loadSkins();
setTimeout(() => {
document.getElementById('tradeMakeOverlay').classList.remove('show');
buyOverlay.classList.remove('show');
}, 800);
})
.catch(err => {
status.textContent = friendlyErrorMessage(err);
btn.disabled = false;
});
});

buyMakeOfferBtn.addEventListener('click', () => {
buyOfferEdit.style.display = '';
buyMakeOfferBtn.style.display = 'none';
buySendOfferBtn.style.display = '';
buyOfferInput.focus();
});

buySendOfferBtn.addEventListener('click', () => {
if (!pendingBuySkin || !tg || !tg.initData) return;

const offerPrice = Number(buyOfferInput.value);

if (!offerPrice || offerPrice <= 0){
buyStatus.textContent = (I18N[currentLang] || I18N.ru).status_need_valid_price;
return;
}

buySendOfferBtn.disabled = true;
buyStatus.textContent = (I18N[currentLang] || I18N.ru).p2p_skin_sending;

fetch(API_BASE + '/api/skins/' + pendingBuySkin.id + '/offer', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData, price: offerPrice })
})
.then(async r => {
if (!r.ok){
const data = await r.json().catch(() => ({}));
throw new Error(errorMessage(data.error));
}
return r.json();
})
.then(() => {
buyStatus.textContent = (I18N[currentLang] || I18N.ru).status_offer_sent;
buyOfferEdit.style.display = 'none';
buySendOfferBtn.style.display = 'none';
buyMakeOfferBtn.style.display = '';
})
.catch(err => {
buyStatus.textContent = friendlyErrorMessage(err);
})
.finally(() => {
buySendOfferBtn.disabled = false;
});
});

buyConfirmBalance.addEventListener('click', () => {
if (!pendingBuySkin || !tg || !tg.initData) return;

const skinId = pendingBuySkin.id;
buyConfirmBalance.disabled = true;
buyStatus.textContent = (I18N[currentLang] || I18N.ru).status_buying;

fetch(API_BASE + '/api/skins/' + skinId + '/buy', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData })
})
.then(async r => {
if (!r.ok){
const data = await r.json().catch(() => ({}));
throw new Error(purchaseTrustLimitMessage(data) || errorMessage(data.error));
}
return r.json();
})
.then(() => {
buyStatus.textContent = (I18N[currentLang] || I18N.ru).status_bought_ok;
loadMe();
loadSkins();
setTimeout(() => {
buyOverlay.classList.remove('show');
pendingBuySkin = null;
}, 700);
})
.catch(err => {
buyStatus.textContent = friendlyErrorMessage(err);
})
.finally(() => {
buyConfirmBalance.disabled = false;
});
});

buyConfirmStars.addEventListener('click', () => {
if (!pendingBuySkin || !tg || !tg.initData) return;

const skinId = pendingBuySkin.id;
buyConfirmStars.disabled = true;
buyStatus.textContent = (I18N[currentLang] || I18N.ru).status_creating_invoice;

fetch(API_BASE + '/api/skins/' + skinId + '/buy_stars_invoice', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData })
})
.then(async r => {
if (!r.ok){
const data = await r.json().catch(() => ({}));
throw new Error(purchaseTrustLimitMessage(data) || (data.error === 'feature_disabled' ? 'Оплата Stars сейчас недоступна.' : errorMessage(data.error)));
}
return r.json();
})
.then(data => {
buyStatus.textContent = '';
if (tg && tg.openInvoice){
tg.openInvoice(data.link, (status) => {
if (status === 'paid'){
buyStatus.textContent = (I18N[currentLang] || I18N.ru).status_paid_ok;
loadMe();
loadSkins();
setTimeout(() => {
buyOverlay.classList.remove('show');
pendingBuySkin = null;
}, 700);
} else if (status === 'cancelled'){
buyStatus.textContent = '';
} else {
buyStatus.textContent = (I18N[currentLang] || I18N.ru).status_payment_failed;
}
});
} else {
window.open(data.link, '_blank');
}
})
.catch(err => {
buyStatus.textContent = friendlyErrorMessage(err);
})
.finally(() => {
buyConfirmStars.disabled = false;
});
});

buyConfirmCrypto.addEventListener('click', () => {
if (!pendingBuySkin || !tg || !tg.initData) return;

const skinId = pendingBuySkin.id;
buyConfirmCrypto.disabled = true;
buyStatus.textContent = (I18N[currentLang] || I18N.ru).status_creating_invoice;

fetch(API_BASE + '/api/skins/' + skinId + '/buy_crypto_invoice', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData })
})
.then(async r => {
if (!r.ok){
const data = await r.json().catch(() => ({}));
throw new Error(purchaseTrustLimitMessage(data) || (data.error === 'feature_disabled' ? 'Оплата криптой сейчас недоступна.' : (data.error === 'not_configured' ? 'Оплата криптой сейчас недоступна.' : errorMessage(data.error))));
}
return r.json();
})
.then(data => {
buyStatus.textContent = (I18N[currentLang] || I18N.ru).status_invoice_created_buy;
const link = data.tg_deeplink || data.url;
if (tg && tg.openTelegramLink && data.tg_deeplink){
tg.openTelegramLink(data.tg_deeplink);
} else if (tg && tg.openLink){
tg.openLink(link);
} else {
window.open(link, '_blank');
}
})
.catch(err => {
buyStatus.textContent = friendlyErrorMessage(err);
})
.finally(() => {
buyConfirmCrypto.disabled = false;
});
});

let pendingP2pOrderId = null;
let p2pReceiptBase64 = null;

const p2pSkinOverlay = document.getElementById('p2pSkinOverlay');
const p2pSkinDetailsText = document.getElementById('p2pSkinDetailsText');
const p2pSkinAmount = document.getElementById('p2pSkinAmount');
const p2pSkinSentBtn = document.getElementById('p2pSkinSentBtn');
const p2pSkinStatus = document.getElementById('p2pSkinStatus');
const p2pSkinCopyBtn = document.getElementById('p2pSkinCopyBtn');
const p2pSkinDetailsBox = document.getElementById('p2pSkinDetailsBox');
const p2pSkinCloseBtn = document.getElementById('p2pSkinCloseBtn');
const p2pSkinReceiptInput = document.getElementById('p2pSkinReceiptInput');
const p2pSkinReceiptPreview = document.getElementById('p2pSkinReceiptPreview');

buyConfirmP2P.addEventListener('click', () => {
if (!pendingBuySkin || !tg || !tg.initData) return;

const skinId = pendingBuySkin.id;
buyConfirmP2P.disabled = true;
buyStatus.textContent = (I18N[currentLang] || I18N.ru).status_reserving;

fetch(API_BASE + '/api/skins/' + skinId + '/buy_p2p_reserve', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData })
})
.then(async r => {
if (!r.ok){
const data = await r.json().catch(() => ({}));
throw new Error(purchaseTrustLimitMessage(data) || (data.error === 'feature_disabled' ? 'Оплата П2П сейчас недоступна.' : errorMessage(data.error)));
}
return r.json();
})
.then(data => {
buyStatus.textContent = '';
pendingP2pOrderId = data.order_id;
p2pReceiptBase64 = null;
p2pSkinReceiptInput.value = '';
p2pSkinReceiptPreview.style.display = 'none';
p2pSkinDetailsText.textContent = data.card_details || p2pCardDetails || 'Реквизиты не заданы — обратись в поддержку.';
p2pSkinAmount.textContent = formatCoins(data.amount);
p2pSkinSentBtn.disabled = true;
p2pSkinStatus.textContent = '';
buyOverlay.classList.remove('show');
p2pSkinOverlay.classList.add('show');
})
.catch(err => {
buyStatus.textContent = friendlyErrorMessage(err);
})
.finally(() => {
buyConfirmP2P.disabled = false;
});
});

function copyP2pSkinDetails(){
const text = p2pSkinDetailsText.textContent;
if (!text) return;
navigator.clipboard?.writeText(text).catch(() => {});
const original = p2pSkinCopyBtn.innerHTML;
p2pSkinCopyBtn.classList.add('copied');
p2pSkinCopyBtn.textContent = (I18N[currentLang] || I18N.ru).copied_text;
setTimeout(() => {
p2pSkinCopyBtn.classList.remove('copied');
p2pSkinCopyBtn.innerHTML = original;
}, 1500);
}

p2pSkinDetailsBox.addEventListener('click', copyP2pSkinDetails);

p2pSkinReceiptInput.addEventListener('change', () => {
const file = p2pSkinReceiptInput.files[0];
if (!file){
p2pReceiptBase64 = null;
p2pSkinReceiptPreview.style.display = 'none';
p2pSkinSentBtn.disabled = true;
return;
}
p2pSkinStatus.textContent = (I18N[currentLang] || I18N.ru).status_processing_photo;
const reader = new FileReader();
reader.onload = () => {
const img = new Image();
img.onload = () => {
// Сжимаем — фото с телефона легко весит 3-8 МБ, для чека
// такое разрешение не нужно, а большой файл дольше грузится
// и рискует упереться в лимиты.
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
const compressed = canvas.toDataURL('image/jpeg', 0.82);
p2pReceiptBase64 = compressed;
p2pSkinReceiptPreview.src = compressed;
p2pSkinReceiptPreview.style.display = 'block';
p2pSkinSentBtn.disabled = false;
p2pSkinStatus.textContent = '';
};
img.onerror = () => {
p2pSkinStatus.textContent = (I18N[currentLang] || I18N.ru).status_photo_failed;
p2pSkinSentBtn.disabled = true;
};
img.src = reader.result;
};
reader.onerror = () => {
p2pSkinStatus.textContent = (I18N[currentLang] || I18N.ru).status_file_read_failed;
p2pSkinSentBtn.disabled = true;
};
reader.readAsDataURL(file);
});

p2pSkinSentBtn.addEventListener('click', () => {
if (!pendingP2pOrderId || !tg || !tg.initData || !p2pReceiptBase64) return;

const dict = I18N[currentLang] || I18N.ru;
p2pSkinSentBtn.disabled = true;
p2pSkinStatus.textContent = dict.p2p_skin_sending;

fetch(API_BASE + '/api/p2p_skin_orders/' + pendingP2pOrderId + '/mark_sent', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData, photo_base64: p2pReceiptBase64 })
})
.then(async r => {
if (!r.ok){
const data = await r.json().catch(() => ({}));
throw new Error(errorMessage(data.error));
}
return r.json();
})
.then(() => {
p2pSkinStatus.textContent = '';
p2pSkinOverlay.classList.remove('show');
pendingP2pOrderId = null;
showAlert(dict.p2p_skin_sent_alert);
})
.catch(err => {
p2pSkinStatus.textContent = friendlyErrorMessage(err);
p2pSkinSentBtn.disabled = false;
});
});

p2pSkinCloseBtn.addEventListener('click', () => {
p2pSkinOverlay.classList.remove('show');
pendingP2pOrderId = null;
});

function cancelListing(skinId){
if (!tg || !tg.initData){
showAlert(errorMessage('unauthorized'));
return;
}
const skin = lastSkins.find(s => s.id === skinId);
const isOwnListing = skin && currentUserId && skin.seller_id === currentUserId;
const url = isOwnListing
? API_BASE + '/api/skins/' + skinId + '/cancel'
: API_BASE + '/api/admin/skins/' + skinId + '/force_cancel';
showConfirm('Снять этот лот с продажи?', () => {
fetch(url, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData })
})
.then(async r => {
if (!r.ok){
const data = await r.json().catch(() => ({}));
throw new Error(errorMessage(data.error));
}
buyOverlay.classList.remove('show');
pendingBuySkin = null;
loadSkins();
})
.catch(err => showErrorToast(err));
});
}

