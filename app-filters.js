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
if (skinSort.value !== 'auto') n++;
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
${deal.photo_url ? `<img src="${escapeHtml(deal.photo_url)}" style="width:48px;height:48px;object-fit:contain;">` : ''}
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
// Проверенному продавцу блок «Стать продавцом» не нужен — вместо него
// галочка у имени; история и CSV — только продавцам.
document.getElementById('profileSellerSection').style.display = (status === 'verified') ? 'none' : '';
document.getElementById('profileVerified').style.display = (status === 'verified') ? '' : 'none';
document.querySelectorAll('.pf-seller-only').forEach(el => { el.style.display = (status === 'verified') ? '' : 'none'; });
}

// Фото документа и селфи — сжатые в JPEG (base64), номер — только
// тот, что пользователь сам отправил боту кнопкой Telegram.
let kycPhotos = { doc: '', selfie: '' };
let kycPhonePollTimer = null;

function setKycPhone(phone){
const ok = document.getElementById('kycPhoneOk');
const btn = document.getElementById('kycPhoneBtn');
if (phone){
ok.textContent = '✅ ' + phone;
ok.style.display = '';
btn.style.display = 'none';
} else {
ok.style.display = 'none';
btn.style.display = '';
}
}

function fetchKycPhone(){
if (!tg || !tg.initData) return Promise.resolve('');
return fetch(API_BASE + '/api/kyc/phone?init_data=' + encodeURIComponent(tg.initData))
.then(r => r.ok ? r.json() : {})
.then(data => data.phone || '')
.catch(() => '');
}

function pollKycPhone(){
clearInterval(kycPhonePollTimer);
let tries = 0;
kycPhonePollTimer = setInterval(() => {
if (++tries > 20 || !kycOverlay.classList.contains('show')){
clearInterval(kycPhonePollTimer);
return;
}
fetchKycPhone().then(phone => {
if (phone){
clearInterval(kycPhonePollTimer);
setKycPhone(phone);
}
});
}, 2000);
}

function resetKycPhoto(kind){
kycPhotos[kind] = '';
const box = document.getElementById(kind === 'doc' ? 'kycDocBox' : 'kycSelfieBox');
const img = document.getElementById(kind === 'doc' ? 'kycDocPreview' : 'kycSelfiePreview');
box.classList.remove('has-photo');
img.hidden = true;
img.removeAttribute('src');
}

// Уменьшаем до 1600 px по длинной стороне: так файл ~200–400 КБ
// вместо 3–8 МБ с камеры, а текст документа остаётся читаемым.
function compressKycPhoto(file){
return new Promise((resolve, reject) => {
const url = URL.createObjectURL(file);
const img = new Image();
img.onload = () => {
const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
const canvas = document.createElement('canvas');
canvas.width = Math.round(img.naturalWidth * scale);
canvas.height = Math.round(img.naturalHeight * scale);
canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
URL.revokeObjectURL(url);
resolve(canvas.toDataURL('image/jpeg', 0.85));
};
img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad_image')); };
img.src = url;
});
}

function bindKycPhotoInput(kind){
const input = document.getElementById(kind === 'doc' ? 'kycDocInput' : 'kycSelfieInput');
input.addEventListener('change', () => {
const file = input.files && input.files[0];
input.value = '';
if (!file) return;
const dict = I18N[currentLang] || I18N.ru;
compressKycPhoto(file).then(dataUrl => {
kycPhotos[kind] = dataUrl;
const box = document.getElementById(kind === 'doc' ? 'kycDocBox' : 'kycSelfieBox');
const img = document.getElementById(kind === 'doc' ? 'kycDocPreview' : 'kycSelfiePreview');
img.src = dataUrl;
img.hidden = false;
box.classList.add('has-photo');
kycStatus.textContent = '';
}).catch(() => {
resetKycPhoto(kind);
kycStatus.textContent = dict.kyc_photo_bad;
});
});
}
bindKycPhotoInput('doc');
bindKycPhotoInput('selfie');

document.getElementById('kycPhoneBtn').addEventListener('click', () => {
const dict = I18N[currentLang] || I18N.ru;
if (!tg || !tg.requestContact){
showAlert(dict.kyc_phone_unsupported);
return;
}
// Контакт уходит боту в чат; бот проверяет, что номер принадлежит
// самому пользователю, и сохраняет его — мини-апп лишь забирает итог.
tg.requestContact((sent) => {
if (sent){
kycStatus.textContent = dict.kyc_phone_checking;
pollKycPhone();
}
});
});

function openKycOverlay(){
document.getElementById('kycFullName').value = '';
document.getElementById('kycCountry').value = '';
document.getElementById('kycAddress').value = '';
document.getElementById('kycLegalStatus').value = 'individual';
document.getElementById('kycTin').value = '';
document.getElementById('kycTinField').style.display = 'none';
resetKycPhoto('doc');
resetKycPhoto('selfie');
setKycPhone('');
kycStatus.textContent = '';
kycOverlay.classList.add('show');
fetchKycPhone().then(setKycPhone);
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
${s.photo_url ? `<img src="${escapeHtml(s.photo_url)}" alt="">` : ''}
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

// Условия записи каталога желаний одной строкой-чипсами.
function wishlistChipsHtml(item){
const dict = I18N[currentLang] || I18N.ru;
const chips = [];
if (item.max_price) chips.push(`${dict.wishlist_max_price_label} ${formatCoins(item.max_price)}`);
if (item.wear) chips.push(item.wear);
if (item.stattrak === 1) chips.push('StatTrak™');
if (item.stattrak === 0) chips.push(dict.wl_st_no);
if (item.max_float) chips.push(`float ≤ ${item.max_float}`);
return chips.length ? `<div class="wl-chips">${chips.map(c => `<span>${escapeHtml(c)}</span>`).join('')}</div>` : '';
}

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
${wishlistChipsHtml(item)}
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
body: JSON.stringify({
init_data: tg.initData,
query: query,
max_price: maxPrice,
wear: document.getElementById('wishlistWearSelect').value || null,
stattrak: document.getElementById('wishlistStSelect').value,
})
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
document.getElementById('wishlistWearSelect').value = '';
document.getElementById('wishlistStSelect').value = '';
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
const dict = I18N[currentLang] || I18N.ru;
const summary = document.getElementById('totpSummaryStatus');
summary.classList.toggle('ok', !!totp2faStatus.confirmed);
summary.lastElementChild.textContent = totp2faStatus.confirmed ? dict.pf_2fa_on : dict.pf_2fa_off;
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
clearInterval(kycPhonePollTimer);
kycOverlay.classList.remove('show');
});

document.getElementById('kycSubmitBtn').addEventListener('click', () => {
if (!tg || !tg.initData) return;
const dict = I18N[currentLang] || I18N.ru;
const fullName = document.getElementById('kycFullName').value.trim();
const country = document.getElementById('kycCountry').value.trim();
const address = document.getElementById('kycAddress').value.trim();
const legalStatus = document.getElementById('kycLegalStatus').value;
const tin = document.getElementById('kycTin').value.replace(/\D/g, '');
if (legalStatus !== 'individual' && tin.length !== 9 && tin.length !== 14){
kycStatus.textContent = errorMessage(tin ? 'bad_tin' : 'tin_required');
return;
}
if (!fullName || !country || !address){
kycStatus.textContent = dict.kyc_fill_all;
return;
}
if (document.getElementById('kycPhoneOk').style.display === 'none'){
kycStatus.textContent = errorMessage('phone_not_verified');
return;
}
if (!kycPhotos.doc || !kycPhotos.selfie){
kycStatus.textContent = errorMessage('kyc_photos_required');
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
full_name: fullName, country: country, address: address,
legal_status: legalStatus, tin: tin,
doc_photo: kycPhotos.doc, selfie_photo: kycPhotos.selfie,
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

// ---------------- Билдер под бюджет ----------------
// Форма: режим, бюджет, предпочтения, цвет → /api/builder/build.
// Результат: предметы, сводка по бюджету и варианты замены для
// выбранного слота; замена пересчитывает итог и остаток.

let builderMode = 'combo';
let builderPref = 'any';
let builderColor = 'any';
let builderData = null;      // ответ сервера (items меняются при замене)
let builderAltSlot = null;

const BUILDER_SLOT_ICON = { knife: 'knives', gloves: 'gloves', rifle: 'rifles', pistol: 'pistols', sniper: 'snipers' };

// Иконки режимов — те же линии, что у категорий на главной.
document.querySelectorAll('#builderModes [data-ico]').forEach(el => {
el.innerHTML = el.dataset.ico.split(',').map(k => categoryIconSvg(k)).join('');
});

function builderBudgetValue(){
return Number(String(document.getElementById('builderBudget').value).replace(/\D/g, '')) || 0;
}

function setBuilderBudget(n){
document.getElementById('builderBudget').value = n ? Number(n).toLocaleString('ru-RU') : '';
document.querySelectorAll('#builderBudgetChips [data-budget]').forEach(b => b.classList.toggle('active', Number(b.dataset.budget) === n));
}

function showBuilderForm(){
document.getElementById('builderForm').style.display = '';
document.getElementById('builderResultView').style.display = 'none';
}

document.getElementById('openBuilderBtn').addEventListener('click', () => {
showBuilderForm();
document.getElementById('builderStatus').textContent = '';
document.getElementById('builderOverlay').classList.add('show');
});

document.getElementById('builderCloseBtn').addEventListener('click', () => {
document.getElementById('builderOverlay').classList.remove('show');
});

document.getElementById('builderModes').addEventListener('click', (e) => {
const btn = e.target.closest('[data-mode]');
if (!btn) return;
builderMode = btn.dataset.mode;
document.querySelectorAll('#builderModes [data-mode]').forEach(b => b.classList.toggle('active', b === btn));
});

document.getElementById('builderBudget').addEventListener('input', (e) => {
const n = builderBudgetValue();
setBuilderBudget(n);
e.target.setSelectionRange(e.target.value.length, e.target.value.length);
});

document.getElementById('builderBudgetChips').addEventListener('click', (e) => {
const btn = e.target.closest('[data-budget]');
if (!btn) return;
if (btn.dataset.budget === 'other'){
setBuilderBudget(0);
document.getElementById('builderBudget').focus();
return;
}
setBuilderBudget(Number(btn.dataset.budget));
});

document.getElementById('builderPrefs').addEventListener('click', (e) => {
const btn = e.target.closest('[data-pref]');
if (!btn) return;
builderPref = btn.dataset.pref;
document.querySelectorAll('#builderPrefs [data-pref]').forEach(b => b.classList.toggle('active', b === btn));
document.getElementById('builderColorStep').style.display = builderPref === 'color' ? '' : 'none';
});

document.getElementById('builderColors').addEventListener('click', (e) => {
const btn = e.target.closest('[data-color]');
if (!btn) return;
builderColor = btn.dataset.color;
document.querySelectorAll('#builderColors [data-color]').forEach(b => b.classList.toggle('active', b === btn));
});

function builderSlotLabel(slot){
return (I18N[currentLang] || I18N.ru)['bld_slot_' + slot] || slot;
}

function builderItemCard(slot, item){
const dict = I18N[currentLang] || I18N.ru;
const hasFloat = item.float_value !== null && item.float_value !== undefined;
const wear = item.wear && WEAR_LABELS[item.wear] ? `<span class="inv-badge">${WEAR_LABELS[item.wear]}</span>` : '';
return `<div class="bld-item${slot === builderAltSlot ? ' active' : ''} ${RARITY_CLASS[item.rarity] || ''}" data-bld-slot="${slot}">
<div class="bld-item-photo">
<div class="inv-badges"><span class="inv-badge">${categoryIconSvg(BUILDER_SLOT_ICON[slot])}</span>${wear}</div>
<button type="button" class="skin-fav${isFavSkin(item) ? ' on' : ''}" data-bld-fav="${slot}" aria-label="Следить">${HEART_SVG}</button>
${item.photo_url ? `<img src="${escapeHtml(item.photo_url)}" alt="">` : ''}
</div>
<div class="bld-item-title">${escapeHtml((item.stattrak ? 'StatTrak™ ' : '') + String(item.title || '').replace(/^★\s*/, ''))}</div>
${hasFloat ? `<div class="bld-item-float">Float: ${formatFloat(item.float_value)}${item.pattern ? ` · #${escapeHtml(String(item.pattern))}` : ''}</div>` : ''}
<div class="bld-item-price">${formatCoins(item.price)}</div>
<button type="button" class="bld-more" data-bld-more="${slot}">${dict.inv_more}</button>
</div>`;
}

function renderBuilderAlts(){
const dict = I18N[currentLang] || I18N.ru;
const d = builderData;
const current = d.items[builderAltSlot];
const room = d.budget - (d.total - current.price);
const alts = (d.alternatives[builderAltSlot] || []).filter(a => a.id !== current.id && a.price <= room);
document.getElementById('bldAltTitle').classList.toggle('empty', !alts.length);
document.getElementById('bldAltTitle').textContent = alts.length
? dict.bld_alts.replace('{slot}', builderSlotLabel(builderAltSlot).toLowerCase())
: dict.bld_no_alts.replace('{slot}', builderSlotLabel(builderAltSlot).toLowerCase());
document.getElementById('bldAlts').innerHTML = alts.slice(0, 4).map(a => {
const diff = a.price - current.price;
const name = String(a.title || '').split('|').slice(-1)[0].trim();
return `<button type="button" class="bld-alt" data-bld-alt="${a.id}">
${a.photo_url ? `<img src="${escapeHtml(a.photo_url)}" alt="">` : ''}
<span class="bld-alt-name">${escapeHtml(name)}</span>
<span class="bld-alt-diff ${diff > 0 ? 'up' : 'down'}">${diff > 0 ? '+' : '−'}${formatCoins(Math.abs(diff))}</span>
</button>`;
}).join('');
}

function renderBuilderResult(){
const d = builderData;
d.total = d.slots.reduce((sum, s) => sum + d.items[s].price, 0);
d.remaining = d.budget - d.total;
document.getElementById('bldSumBudget').textContent = formatCoins(d.budget);
document.getElementById('bldSumTotal').textContent = formatCoins(d.total);
document.getElementById('bldSumRest').textContent = formatCoins(d.remaining);
const box = document.getElementById('builderResult');
box.classList.toggle('three', d.slots.length === 3);
box.innerHTML = d.slots.map(s => builderItemCard(s, d.items[s])).join('');
renderBuilderAlts();
}

document.getElementById('builderGenerateBtn').addEventListener('click', () => {
const dict = I18N[currentLang] || I18N.ru;
const status = document.getElementById('builderStatus');
const budget = builderBudgetValue();
if (!budget){
status.textContent = dict.combo_need_budget;
return;
}
const btn = document.getElementById('builderGenerateBtn');
btn.disabled = true;
status.textContent = dict.combo_assembling;
const color = builderPref === 'color' ? builderColor : 'any';
fetch(`${API_BASE}/api/builder/build?mode=${builderMode}&budget=${budget}&pref=${builderPref}&color=${color}`)
.then(r => r.json())
.then(data => {
if (!data.found){
const empty = (data.empty_slots || []).map(builderSlotLabel).join(', ');
status.textContent = empty ? dict.bld_not_found_slots.replace('{slots}', empty.toLowerCase()) : dict.bld_not_found;
return;
}
status.textContent = '';
builderData = data;
builderAltSlot = data.slots[0];
renderBuilderResult();
document.getElementById('builderForm').style.display = 'none';
document.getElementById('builderResultView').style.display = '';
document.querySelector('#builderOverlay .edit-sheet').scrollTop = 0;
})
.catch(() => { status.textContent = dict.combo_assemble_failed; })
.finally(() => { btn.disabled = false; });
});

document.getElementById('builderResult').addEventListener('click', (e) => {
const d = builderData;
if (!d) return;
const fav = e.target.closest('[data-bld-fav]');
if (fav){ openWatchSheet(d.items[fav.dataset.bldFav]); return; }
const more = e.target.closest('[data-bld-more]');
if (more){ openBuySheet(d.items[more.dataset.bldMore]); return; }
// Нажатие на карточку — показать замены для этого слота.
const card = e.target.closest('[data-bld-slot]');
if (card){
builderAltSlot = card.dataset.bldSlot;
renderBuilderResult();
}
});

document.getElementById('bldAlts').addEventListener('click', (e) => {
const btn = e.target.closest('[data-bld-alt]');
if (!btn || !builderData) return;
const d = builderData;
const alt = (d.alternatives[builderAltSlot] || []).find(a => String(a.id) === btn.dataset.bldAlt);
if (!alt) return;
// Бывший предмет становится вариантом замены — можно вернуть.
d.alternatives[builderAltSlot] = [d.items[builderAltSlot], ...d.alternatives[builderAltSlot].filter(a => a.id !== alt.id)];
d.items[builderAltSlot] = alt;
haptic('light');
renderBuilderResult();
});

document.getElementById('builderAgainBtn').addEventListener('click', showBuilderForm);

// «Купить комплект» — все предметы в корзину и открыть её.
document.getElementById('builderToCartBtn').addEventListener('click', () => {
const d = builderData;
if (!d) return;
d.slots.forEach(s => {
const item = d.items[s];
if (!lastSkins.some(x => x.id === item.id)) lastSkins.push(item);
if (!cart.includes(item.id)) cart.push(item.id);
});
updateCartFab();
applyFiltersAndRender();
document.getElementById('builderOverlay').classList.remove('show');
document.getElementById('navCartBtn').click();
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
const setDict = I18N[currentLang] || I18N.ru;
status.textContent = `✅ Куплено за ${formatCoins(data.set_price)}`
+ (data.discount_on_completion ? ' ' + setDict.set_discount_later.replace('{sum}', formatCoins(data.discount_amount)) : '');
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
skinSort.value = 'auto';
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

function buyDetailRow(label, value, key){
if (value === null || value === undefined || value === '') return '';
const keyAttr = key ? ` data-detail="${key}"` : '';
return `<div class="buy-detail-row"${keyAttr}><div class="buy-detail-label">${label}</div><div class="buy-detail-value">${value}</div></div>`;
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
// Гость в браузере может рассмотреть лот; купить — только после входа
// (кнопки действий перехватывает app-web.js).
const webGuest = !!(window.DG_WEB && !window.DG_WEB.loggedIn);
if ((!tg || !tg.initData) && !webGuest){
showAlert(errorMessage('unauthorized'));
return;
}
pendingBuySkin = skin;

if (tg && tg.initData){
fetch(API_BASE + '/api/skins/' + skin.id + '/view', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData })
}).catch(() => {});
}

loadPriceHistoryChart(skin.title);

const sellerStatsBox = document.getElementById('sellerStatsBox');
if (skin.seller_completed_trades !== undefined && skin.seller_id !== currentUserId){
const statsDict = I18N[currentLang] || I18N.ru;
const rating = skin.seller_rating_avg
? ` · ⭐ ${skin.seller_rating_avg} (${skin.seller_rating_count})` : '';
// Строка продавца кликабельна — открывает его публичный профиль.
// У нового продавца нет сделок — «0 сделок · 0 споров» отпугивает,
// поэтому пишем «новый на маркете».
const sellerIsNew = !Number(skin.seller_completed_trades) && !skin.seller_rating_avg;
const sellerLine = sellerIsNew
? (skin.seller_verified ? statsDict.seller_line_verified_new : statsDict.seller_line_new)
: (skin.seller_verified ? statsDict.seller_line_verified : statsDict.seller_line);
sellerStatsBox.innerHTML = `<button type="button" class="seller-line${skin.seller_verified ? ' verified' : ''}" data-seller-profile="${skin.seller_id}">
<span>${escapeHtml(sellerLine
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
buyDetailRow(dict.detail_wear, skin.wear ? (wearMap[skin.wear] || skin.wear) : null),
buyDetailRow(dict.detail_rarity, skin.rarity ? (rarityMap[skin.rarity] || skin.rarity) : null),
buyDetailRow('StatTrak', skin.stattrak ? dict.value_yes : null),
buyDetailRow('Float', (skin.float_value !== null && skin.float_value !== undefined) ? formatFloat(skin.float_value) : null),
// Паттерн (paint seed): у Fade, Doppler, Case Hardened от него сильно зависит цена.
buyDetailRow(dict.detail_pattern, (skin.pattern !== null && skin.pattern !== undefined && skin.pattern !== '') ? '#' + skin.pattern : null),
buyDetailRow(dict.detail_price, formatCoins(skin.price), 'price'),
].join('');

buyDetailsTable.innerHTML = rows;

const stickersBox = document.getElementById('buyStickers');
const stickersMarkup = stickersHtml(skin.stickers, 'full');
if (stickersMarkup){
stickersBox.innerHTML = `<div class="similar-title">${dict.st_title}</div>${stickersMarkup}`;
stickersBox.style.display = '';
} else {
stickersBox.innerHTML = '';
stickersBox.style.display = 'none';
}

// Переключаем набор кнопок: свой лот — управление, чужой — покупка.
// Админ дополнительно видит "Снять с продажи" и на чужих лотах
// (принудительная отмена — спам/обман), но не видит "Изменить цену"
// и "Предложить цену" на чужом.
buyRemoveBtn.style.display = (isOwn || isAdmin) ? '' : 'none';
document.getElementById('buyWatchBtn').style.display = isOwn ? 'none' : '';
if (typeof updateMusicKitButton === 'function') updateMusicKitButton(skin);
document.getElementById('buyPaymentMethods').style.display = isOwn ? 'none' : 'flex';
document.getElementById('buyOpenPayBtn').style.display = isOwn ? 'none' : '';
document.getElementById('buyGuarantee').style.display = isOwn ? 'none' : '';
document.getElementById('buyMainPrice').textContent = formatCoins(skin.price);
closePaySheet();
// С баланса платят только покупатели (не проверенные продавцы) и
// только если хватает: пополнить баланс они не могут, там лежат их
// возвраты и бонусы. Продавец деньги с продаж выводит.
const canPayFromBalance = !isOwn && sellerKycStatus !== 'verified' && myAvailableBalance >= skin.price;
buyConfirmBalance.style.display = canPayFromBalance ? '' : 'none';
buyPrice.textContent = formatCoins(skin.price);
document.getElementById('buyBalanceAvailable').textContent = formatCoins(myAvailableBalance);
buyConfirmP2P.style.display = (!isOwn && directP2pPurchaseEnabled) ? '' : 'none';
buyConfirmCard.style.display = (!isOwn && hostedPayMethods.length) ? '' : 'none';
document.getElementById('buyNoPaymentHint').style.display =
(!isOwn && !canPayFromBalance && !directP2pPurchaseEnabled && !hostedPayMethods.length) ? '' : 'none';
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
if (typeof update3DButton === 'function') update3DButton(skin);
buyOverlay.classList.add('show');

loadMarketPriceComparison(skin.id);
renderSimilarSkins(skin);
}

// График по дневным снимкам цены (history: [{day, price_uzs}]): сверху —
// изменение за период, на линии — пунктир «этот лот» (если цена лота не
// слишком далеко от рынка) и точка «сегодня», снизу — даты и мин/макс.
function marketSparklineHtml(history, lotPrice){
if (!history || history.length < 2) return '';
const dict = I18N[currentLang] || I18N.ru;
const prices = history.map(h => h.price_uzs);
let min = Math.min(...prices);
let max = Math.max(...prices);
const first = prices[0], last = prices[prices.length - 1];
// Цену лота рисуем, только если она рядом с рынком — иначе график сплющится.
const showLot = lotPrice > 0 && lotPrice >= min * 0.8 && lotPrice <= max * 1.2;
const lo = showLot ? Math.min(min, lotPrice) : min;
const hi = showLot ? Math.max(max, lotPrice) : max;
const range = hi - lo || 1;
const w = 300, h = 70, padX = 4, padY = 8;
const step = (w - padX * 2) / (prices.length - 1);
const yOf = p => padY + (1 - (p - lo) / range) * (h - padY * 2);
const pts = prices.map((p, i) => [padX + i * step, yOf(p)]);
const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
const area = `${padX},${h} ${line} ${(padX + (prices.length - 1) * step).toFixed(1)},${h}`;
const [lx, ly] = pts[pts.length - 1];
const lotLine = showLot
? `<line x1="0" x2="${w}" y1="${yOf(lotPrice).toFixed(1)}" y2="${yOf(lotPrice).toFixed(1)}" stroke="var(--silver)" stroke-width="1" stroke-dasharray="4 4" opacity=".7" vector-effect="non-scaling-stroke"/>`
: '';
const change = first ? Math.round((last - first) / first * 100) : 0;
const changeText = change === 0 ? dict.mp_change_flat
: (change > 0 ? '▲ +' : '▼ −') + Math.abs(change) + '% ' + dict.mp_change_period;
const dayText = d => { const m = String(d || '').match(/^\d{4}-(\d{2})-(\d{2})/); return m ? `${m[2]}.${m[1]}` : ''; };
return `<div class="mp-spark">
<div class="mp-spark-head"><span class="mp-spark-title">${dict.mp_history}</span><span class="mp-spark-change ${change > 0 ? 'up' : (change < 0 ? 'down' : '')}">${changeText}</span></div>
<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
<defs><linearGradient id="mpSparkFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--red)" stop-opacity=".28"/><stop offset="1" stop-color="var(--red)" stop-opacity="0"/></linearGradient></defs>
<polygon points="${area}" fill="url(#mpSparkFill)"/>
${lotLine}
<polyline points="${line}" fill="none" stroke="var(--red)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="3.5" fill="var(--red)"/>
</svg>
<div class="mp-spark-dates"><span>${dayText(history[0].day)}</span><span>${dict.mp_today}: ${formatCoins(last)}</span></div>
<div class="mp-spark-legend"><span>${dict.mp_min} ${formatCoins(min)}</span><span>${dict.mp_max} ${formatCoins(max)}</span>${showLot ? `<span class="mp-spark-lot">┄ ${dict.mp_this_lot}</span>` : ''}</div>
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
${marketSparklineHtml(data.history, pendingBuySkin && pendingBuySkin.price)}
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
<div class="similar-photo">${s.photo_url ? `<img src="${escapeHtml(s.photo_url)}" alt="" loading="lazy">` : ''}</div>
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

// Плашка у названия (совет Советника №3): покупателю — выгода «−N% к
// рынку», если лот дешевле хотя бы на 3%; продавцу на своём лоте —
// предупреждение, если цена заметно выше рынка (лот не продастся).
const MARKET_BADGE_MIN_CHEAPER = 3;
const MARKET_WARN_PRICIER = 15;

function marketGapText(dict, price, market){
const ratio = market > 0 ? price / market : 0;
if (ratio >= 2) return dict.mp_badge_times.replace('{x}', (Math.round(ratio * 10) / 10).toLocaleString(currentLang === 'en' ? 'en-US' : 'ru-RU'));
return dict.mp_badge_pricier.replace('{p}', Math.round((ratio - 1) * 100));
}

function renderMarketBadge(data, skin){
const badge = document.getElementById('buyMarketBadge');
if (!badge) return;
badge.hidden = true;
badge.className = 'buy-market-badge';
if (!data || !data.available || typeof data.diff_percent !== 'number' || !skin) return;
const dict = I18N[currentLang] || I18N.ru;
const isOwn = currentUserId && skin.seller_id === currentUserId;
if (isOwn){
if (-data.diff_percent >= MARKET_WARN_PRICIER){
badge.textContent = '⚠️ ' + marketGapText(dict, skin.price, data.market_price_uzs) + ' — ' + dict.mp_badge_lower_hint;
badge.classList.add('pricier');
badge.hidden = false;
}
return;
}
if (data.diff_percent >= MARKET_BADGE_MIN_CHEAPER){
badge.textContent = dict.mp_badge_cheaper.replace('{p}', Math.round(data.diff_percent));
badge.classList.add('cheaper');
badge.hidden = false;
}
}

function loadMarketPriceComparison(skinId){
const box = document.getElementById('marketPriceBox');
box.style.display = 'none';
const badge = document.getElementById('buyMarketBadge');
if (badge) badge.hidden = true;
fetch(API_BASE + '/api/market_price?skin_id=' + skinId)
.then(r => r.json())
.then(data => {
// Пользователь мог уже закрыть/сменить лот, пока запрос летал —
// не показываем устаревшие данные не по тому лоту.
if (!pendingBuySkin || pendingBuySkin.id !== skinId) return;
renderMarketPriceBox(data);
renderMarketBadge(data, pendingBuySkin);
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
if (typeof renderQuickSellPriceChips === 'function') renderQuickSellPriceChips(0);
return;
}
const dict = I18N[currentLang] || I18N.ru;
let extra = '';
if (typeof data.diff_percent === 'number'){
const cheaper = data.diff_percent >= 0;
extra = `<div class="mp-diff ${cheaper ? 'cheaper' : 'pricier'}">${(cheaper ? dict.mp_preview_cheaper : dict.mp_preview_pricier).replace('{p}', Math.abs(data.diff_percent))}</div>`;
}
const html = `<div class="mp-row"><span>${dict.mp_preview_ref}</span><span>${formatCoins(data.market_price_uzs)}</span></div>${extra}`;
boxes.forEach(box => { box.innerHTML = html; box.style.display = ''; });
if (typeof renderQuickSellPriceChips === 'function') renderQuickSellPriceChips(data.market_price_uzs);
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

// ---------- «Поделиться»: ссылка, картинка или GIF ----------
const shareOverlay = document.getElementById('shareOverlay');
const shareStatus = document.getElementById('shareStatus');
let shareSkin = null;
let shareBusy = false;
// Готовое сообщение для окна выбора чата: { preparedId, name }.
let shareReady = null;
// Куда отправляем готовый файл: 'chat' — друзьям, 'channel' — в канал (PRO).
let shareTarget = 'chat';

function setShareBusy(busy){
shareBusy = busy;
['shareLinkBtn', 'sharePhotoBtn', 'shareGifBtn', 'shareHandsBtn', 'shareSendBtn', 'shareChannelBtn', 'shareProBtn'].forEach(id => {
document.getElementById(id).disabled = busy;
});
document.querySelectorAll('#shareOwnChannels button').forEach(b => { b.disabled = busy; });
}

buyShareBtn.addEventListener('click', () => {
if (!pendingBuySkin) return;
shareSkin = pendingBuySkin;
document.getElementById('shareItemTitle').textContent =
(shareSkin.stattrak ? 'StatTrak™ ' : '') + shareSkin.title;
// Картинку и GIF рисуем из 3D — у лота без 3D остаётся только ссылка.
const has3d = typeof canShare3DLot === 'function' && canShare3DLot(shareSkin);
document.getElementById('sharePhotoBtn').style.display = has3d ? '' : 'none';
document.getElementById('shareGifBtn').style.display = has3d ? '' : 'none';
// Видео «в руках» — у ножей и стволов с комплектом анимаций и у перчаток.
const handsBtn = document.getElementById('shareHandsBtn');
handsBtn.style.display = 'none';
if (has3d && typeof canShareInHands === 'function'){
const forSkin = shareSkin;
canShareInHands(shareSkin).then(ok => {
if (ok && shareSkin === forSkin) handsBtn.style.display = '';
});
}
shareStatus.textContent = '';
shareReady = null;
shareTarget = 'chat';
document.getElementById('shareSendBtn').style.display = 'none';
// PRO: GIF и видео — с подпиской (замок на кнопках), «В канал» — только свой лот.
// Чужим лотом делиться GIF/видео — бесплатно (реклама маркета); своим — с PRO.
const pro = typeof isProActive === 'function' && isProActive();
const ownLot = !!(currentUserId && shareSkin.seller_id === currentUserId);
['shareGifBtn', 'shareHandsBtn'].forEach(id => document.getElementById(id).classList.toggle('pro-locked', ownLot && !pro));
const channelBtn = document.getElementById('shareChannelBtn');
channelBtn.classList.toggle('pro-locked', !pro);
channelBtn.style.display = has3d && ownLot ? '' : 'none';
// Свои каналы продавца (PRO) — по кнопке на канал (app-pro.js).
if (typeof renderShareOwnChannels === 'function') renderShareOwnChannels(has3d && ownLot, pro);
// «Гарант»: аукцион / розыгрыш своего лота в своём канале (app-pro.js).
if (typeof renderShareEvents === 'function') renderShareEvents(ownLot && (shareSkin.status || 'available') === 'available');
document.getElementById('shareProBtn').style.display = 'none';
setShareBusy(false);
shareOverlay.classList.add('show');
});

function closeShareSheet(){
if (shareBusy) return;
shareOverlay.classList.remove('show');
}
document.getElementById('shareClose').addEventListener('click', closeShareSheet);
shareOverlay.addEventListener('click', (e) => {
if (e.target === shareOverlay) closeShareSheet();
});

function shareErrorText(err){
const dict = I18N[currentLang] || I18N.ru;
console.warn('Поделиться:', err);
const code = String(err && err.message || '');
if (code === 'share_hourly_limit') return dict.share_hourly_limit;
return code === 'too_often' ? dict.share_too_often : dict.share_failed;
}

// Окно выбора чата не открылось — шлём в личку, оттуда перешлют.
function shareViaDm(){
const dict = I18N[currentLang] || I18N.ru;
if (!shareReady) return;
setShareBusy(true);
sendShareToDm(shareSkin, shareReady.name)
.then(() => { shareStatus.textContent = dict.share_sent_dm; })
.catch(err => { shareStatus.textContent = shareErrorText(err); })
.finally(() => setShareBusy(false));
}

if (tg && typeof tg.onEvent === 'function'){
tg.onEvent('shareMessageFailed', () => {
if (shareOverlay.classList.contains('show')) shareViaDm();
});
}

// Рисуем картинку/GIF и готовим сообщение. Окно выбора чата
// открываем отдельным нажатием: после долгого рендера телефон может
// не считать вызов действием пользователя и молча его проигнорировать.
function shareMedia(kind){
if (!shareSkin || shareBusy) return;
const dict = I18N[currentLang] || I18N.ru;
const ownLot = !!(currentUserId && shareSkin.seller_id === currentUserId);
if (kind !== 'photo' && ownLot && !(typeof isProActive === 'function' && isProActive())){
offerPro(shareStatus, document.getElementById('shareProBtn'));
return;
}
const sendBtn = document.getElementById('shareSendBtn');
sendBtn.style.display = 'none';
shareReady = null;
setShareBusy(true);
prepareShare3DLot(shareSkin, text => { shareStatus.textContent = text; }, kind)
.then(ready => {
shareReady = ready;
if (shareTarget === 'channel' || shareTarget.startsWith('own:')) return postShareToChannel(shareSkin, ready.name);
if (ready.preparedId && canShareMessage()){
shareStatus.textContent = dict.share_ready;
sendBtn.style.display = '';
return null;
}
return sendShareToDm(shareSkin, ready.name)
.then(() => { shareStatus.textContent = dict.share_sent_dm; });
})
.catch(err => { shareStatus.textContent = shareErrorText(err); })
.finally(() => setShareBusy(false));
}

document.getElementById('shareSendBtn').addEventListener('click', () => {
if (!shareReady || !shareReady.preparedId || shareBusy) return;
const dict = I18N[currentLang] || I18N.ru;
try {
tg.shareMessage(shareReady.preparedId, (sent) => {
if (sent) shareStatus.textContent = dict.share_gif_sent;
});
} catch (err) {
shareViaDm();
}
});
// «📢 В канал» (PRO): дальше выбирают формат — картинка, GIF или видео.
document.getElementById('shareChannelBtn').addEventListener('click', () => {
if (!shareSkin || shareBusy) return;
const dict = I18N[currentLang] || I18N.ru;
if (!(typeof isProActive === 'function' && isProActive())){
offerPro(shareStatus, document.getElementById('shareProBtn'));
return;
}
shareTarget = 'channel';
document.getElementById('shareSendBtn').style.display = 'none';
shareStatus.textContent = dict.pro_channel_pick;
});

function postShareToChannel(skin, name){
const dict = I18N[currentLang] || I18N.ru;
// 'own:<id>' — свой канал продавца, 'channel' — канал маркета.
const own = shareTarget.startsWith('own:') && typeof proOwnChannel === 'function'
? proOwnChannel(Number(shareTarget.slice(4))) : null;
const ownName = own ? proChannelName(own) : '';
const payload = { init_data: tg.initData, skin_id: skin.id, name };
if (own) payload.channel_id = own.id;
return fetch(API_BASE + '/api/pro/channel_post', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(payload),
})
.then(async r => {
const data = await r.json().catch(() => ({}));
shareTarget = 'chat';
if (r.ok){
shareStatus.textContent = own ? dict.pro_ch_done.replace('{name}', ownName) : dict.pro_channel_done;
return;
}
if (data.error === 'post_limit'){
shareStatus.textContent = !own && data.per_day === null
? dict.pro_channel_limit_lot
: (own ? dict.pro_ch_limit : dict.pro_channel_limit).replace('{n}', data.per_day || 3);
} else if (data.error === 'pro_required'){
shareStatus.textContent = dict.pro_locked.replace('{price}', '');
} else if (own && typeof proChannelError === 'function'){
shareStatus.textContent = proChannelError(data);
} else {
shareStatus.textContent = errorMessage(data.error);
}
});
}

document.getElementById('shareProBtn').addEventListener('click', () => {
if (typeof openProPlans === 'function') openProPlans();
});

document.getElementById('sharePhotoBtn').addEventListener('click', () => shareMedia('photo'));
document.getElementById('shareGifBtn').addEventListener('click', () => shareMedia('gif'));
document.getElementById('shareHandsBtn').addEventListener('click', () => shareMedia('hands'));

document.getElementById('shareLinkBtn').addEventListener('click', () => {
if (!shareSkin) return;
const skin = shareSkin;
shareOverlay.classList.remove('show');

// Обычное окно Telegram «Поделиться ссылкой», открытое прямо в
// касании. Ссылка ведёт на страницу превью лота (фото, цена), а ?r=
// засчитывает того, кто поделился, как пригласившего.
const me = tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.id;
const shareText = `${skin.stattrak ? 'StatTrak™ ' : ''}${skin.title} — ${formatCoins(skin.price)} в DGhost`;
const shareUrl = `${API_BASE}/s/${skin.id}` + (me ? `?r=${me}` : '');
const telegramShareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
if (tg && tg.openTelegramLink) {
tg.openTelegramLink(telegramShareUrl);
} else if (navigator.share) {
navigator.share({ title: skin.title, text: shareText, url: shareUrl }).catch(() => {});
} else {
window.open(telegramShareUrl, '_blank');
}
});

buyCancel.addEventListener('click', () => {
buyOverlay.classList.remove('show');
pendingBuySkin = null;
});

// ---------- окно выбора способа оплаты ----------
const payOverlay = document.getElementById('payOverlay');

function closePaySheet(){
payOverlay.classList.remove('show');
}

function openPaySheet(){
if (!pendingBuySkin) return;
document.getElementById('payItemTitle').textContent = buyTitle.textContent;
document.getElementById('payItemPrice').textContent = formatCoins(pendingBuySkin.price);
payOverlay.classList.add('show');
}

// ---------- «Как купить за 3 шага» — один раз перед первой оплатой ----------
// Отметка в localStorage: в приватном режиме её может не быть —
// тогда подсказка просто покажется ещё раз, это не страшно.
const BUY_GUIDE_KEY = 'dg_buy_guide_seen';
const buyGuideOverlay = document.getElementById('buyGuideOverlay');

function buyGuideSeen(){
try { return localStorage.getItem(BUY_GUIDE_KEY) === '1'; } catch (e) { return false; }
}

function openBuyGuide(){
// Без ссылки на обмен продавец не сможет отправить скин — показываем
// это прямо в шаге 2 с кнопкой привязки.
document.getElementById('buyGuideLinkOk').style.display = hasSteamLink ? '' : 'none';
document.getElementById('buyGuideLinkBtn').style.display = hasSteamLink ? 'none' : '';
buyGuideOverlay.classList.add('show');
}

function closeBuyGuide(){
buyGuideOverlay.classList.remove('show');
}

document.getElementById('buyOpenPayBtn').addEventListener('click', () => {
if (!pendingBuySkin) return;
if (!buyGuideSeen()){
openBuyGuide();
return;
}
openPaySheet();
});

document.getElementById('buyGuideContinue').addEventListener('click', () => {
try { localStorage.setItem(BUY_GUIDE_KEY, '1'); } catch (e) {}
closeBuyGuide();
openPaySheet();
});

document.getElementById('buyGuideLinkBtn').addEventListener('click', () => {
closeBuyGuide();
steamLinkSkippedThisSession = false;
updateMandatorySteamOverlay();
});

document.getElementById('buyGuideClose').addEventListener('click', closeBuyGuide);
buyGuideOverlay.addEventListener('click', (e) => {
if (e.target === buyGuideOverlay) closeBuyGuide();
});

document.getElementById('payClose').addEventListener('click', closePaySheet);
payOverlay.addEventListener('click', (e) => {
if (e.target === payOverlay) closePaySheet();
});
// Выбрали способ — окно закрываем: статус оплаты виден в окне лота.
document.getElementById('buyPaymentMethods').addEventListener('click', (e) => {
if (e.target.closest('button')) closePaySheet();
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
// Строка цены — по метке data-detail: раньше искали слово «Цена», и в
// узбекском и английском интерфейсе цена в таблице оставалась старой.
const priceCell = buyDetailsTable.querySelector('[data-detail="price"] .buy-detail-value');
if (priceCell) priceCell.textContent = formatCoins(data.price);
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
${s.photo_url ? `<img src="${escapeHtml(s.photo_url)}" alt="">` : ''}
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
const p2pSkinPayerName = document.getElementById('p2pSkinPayerName');
const p2pSkinTimer = document.getElementById('p2pSkinTimer');
const p2pSkinAmountCopy = document.getElementById('p2pSkinAmountCopy');
const p2pSkinCardCopy = document.getElementById('p2pSkinCardCopy');
let p2pCardNumber = '';
let p2pAmountValue = 0;

// Таймер брони: сколько ещё лот закреплён за покупателем. После нуля
// чек всё равно можно отправить — заявку проверит админ.
let p2pTimerInterval = null;
function stopP2pTimer(){
clearInterval(p2pTimerInterval);
p2pTimerInterval = null;
p2pSkinTimer.hidden = true;
}
function startP2pTimer(untilIso){
stopP2pTimer();
const until = untilIso ? new Date(untilIso).getTime() : NaN;
if (!until) return;
const tick = () => {
const dict = I18N[currentLang] || I18N.ru;
const left = Math.max(0, Math.round((until - Date.now()) / 1000));
p2pSkinTimer.hidden = false;
p2pSkinTimer.classList.toggle('expired', left === 0);
p2pSkinTimer.classList.toggle('soon', left > 0 && left <= 300);
if (left === 0){
p2pSkinTimer.textContent = dict.p2p_timer_expired;
clearInterval(p2pTimerInterval);
return;
}
const mm = Math.floor(left / 60), ss = String(left % 60).padStart(2, '0');
p2pSkinTimer.textContent = dict.p2p_timer.replace('{time}', mm + ':' + ss);
};
tick();
p2pTimerInterval = setInterval(tick, 1000);
}

// Номер карты из реквизитов (16 цифр, можно с пробелами или дефисами) —
// отдельной кнопкой: в банковском приложении его вставляют без имени и банка.
function p2pExtractCardNumber(text){
const m = String(text || '').match(/(?:\d[ -]?){15}\d/);
return m ? m[0].replace(/\D/g, '') : '';
}
p2pSkinCardCopy.addEventListener('click', () => {
if (!p2pCardNumber) return;
const dict = I18N[currentLang] || I18N.ru;
const done = () => showToast(dict.p2p_card_copied, { type: 'success', duration: 2500 });
if (navigator.clipboard && navigator.clipboard.writeText){
navigator.clipboard.writeText(p2pCardNumber).then(done).catch(() => showAlert(p2pCardNumber));
} else {
showAlert(p2pCardNumber);
}
});

p2pSkinAmountCopy.addEventListener('click', () => {
if (!p2pAmountValue) return;
const dict = I18N[currentLang] || I18N.ru;
const text = String(p2pAmountValue);
const done = () => showToast(dict.p2p_amount_copied.replace('{sum}', formatCoins(p2pAmountValue)), { type: 'success', duration: 2500 });
if (navigator.clipboard && navigator.clipboard.writeText){
navigator.clipboard.writeText(text).then(done).catch(() => showAlert(text));
} else {
showAlert(text);
}
});

// Имя держателя карты: минимум имя и фамилия. Запоминаем на устройстве,
// чтобы не вводить при каждой покупке.
function p2pPayerNameValue(){
return p2pSkinPayerName.value.trim().replace(/\s+/g, ' ');
}
function p2pPayerNameValid(){
return p2pPayerNameValue().split(' ').filter(w => w.length >= 2).length >= 2;
}

// Оплата картой на странице банка: бот резервирует лот и создаёт заказ,
// мини-апп открывает страницу оплаты. Итог банк присылает боту — лот
// появится в «Сделках», а если он уже недоступен, деньги лягут на баланс.
const buyConfirmCard = document.getElementById('buyConfirmCard');
buyConfirmCard.addEventListener('click', () => {
if (!pendingBuySkin || !tg || !tg.initData || !hostedPayMethods.length) return;
const dict = I18N[currentLang] || I18N.ru;
const provider = hostedPayMethods[0].code;
const skinId = pendingBuySkin.id;
buyConfirmCard.disabled = true;
buyStatus.textContent = dict.status_reserving;
fetch(API_BASE + '/api/pay/' + encodeURIComponent(provider) + '/skin/' + skinId, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData })
})
.then(async r => {
const data = await r.json().catch(() => ({}));
if (!r.ok){
throw new Error(purchaseTrustLimitMessage(data)
|| (data.error === 'feature_disabled' || data.error === 'provider_unavailable' ? dict.buy_card_unavailable : errorMessage(data.error)));
}
return data;
})
.then(data => {
if (!data.payment_url) throw new Error(dict.buy_card_unavailable);
buyStatus.textContent = dict.buy_card_opened;
if (typeof tg.openLink === 'function') tg.openLink(data.payment_url);
else window.open(data.payment_url, '_blank');
})
.catch(err => {
buyStatus.textContent = friendlyErrorMessage(err);
})
.finally(() => {
buyConfirmCard.disabled = false;
});
});

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
try { p2pSkinPayerName.value = localStorage.getItem('dg_payer_name') || ''; } catch (e) { p2pSkinPayerName.value = ''; }
p2pSkinDetailsText.textContent = data.card_details || p2pCardDetails || 'Реквизиты не заданы — обратись в поддержку.';
p2pCardNumber = p2pExtractCardNumber(p2pSkinDetailsText.textContent);
p2pSkinCardCopy.hidden = !p2pCardNumber;
p2pSkinAmount.textContent = formatCoins(data.amount);
p2pAmountValue = Number(data.amount) || 0;
startP2pTimer(data.reserved_until);
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
if (!p2pPayerNameValid()){
p2pSkinStatus.textContent = dict.p2p_skin_payer_required;
p2pSkinPayerName.focus();
return;
}
const payerName = p2pPayerNameValue();
try { localStorage.setItem('dg_payer_name', payerName); } catch (e) {}
p2pSkinSentBtn.disabled = true;
p2pSkinStatus.textContent = dict.p2p_skin_sending;

fetch(API_BASE + '/api/p2p_skin_orders/' + pendingP2pOrderId + '/mark_sent', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData, photo_base64: p2pReceiptBase64, payer_name: payerName })
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
stopP2pTimer();
showAlert(dict.p2p_skin_sent_alert);
// Сразу показываем, где теперь смотреть статус оплаты.
if (typeof goToScreen === 'function') goToScreen('deals');
})
.catch(err => {
p2pSkinStatus.textContent = friendlyErrorMessage(err);
p2pSkinSentBtn.disabled = false;
});
});

p2pSkinCloseBtn.addEventListener('click', () => {
p2pSkinOverlay.classList.remove('show');
pendingP2pOrderId = null;
stopP2pTimer();
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



// ============================================================
// ❤️ «СЛЕДИТЬ» — СРАЗУ В «ХОЧУ», БЕЗ ОКНА
//
// Нажатие на сердечко сразу добавляет скин в «Хочу»: название,
// износ и StatTrak берутся из лота, порог цены не задаётся (его
// можно поставить в разделе «Хочу»). Повторное нажатие на
// заполненное сердечко — убирает из «Хочу».
// ============================================================

let watchBusy = false;

function watchKey(skin){
return String((skin && skin.title) || '').trim().toLowerCase();
}

function openWatchSheet(skin){
if (!tg || !tg.initData){
showAlert(errorMessage('unauthorized'));
return;
}
if (!skin || watchBusy) return;
const dict = I18N[currentLang] || I18N.ru;
const key = watchKey(skin);
const favs = (typeof favQueries !== 'undefined') ? favQueries : null;
watchBusy = true;
// Уже в «Хочу» — убираем.
if (favs && favs.has(key)){
const itemId = favs.get(key);
fetch(API_BASE + '/api/wishlist/' + itemId + '/remove', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData })
})
.then(r => {
if (!r.ok) throw new Error(errorMessage('network'));
favs.delete(key);
applyFiltersAndRender();
showToast(dict.watch_removed);
if (typeof loadWishlist === 'function') loadWishlist();
})
.catch(err => showErrorToast(err))
.finally(() => { watchBusy = false; });
return;
}
fetch(API_BASE + '/api/wishlist', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
init_data: tg.initData,
query: skin.title,
max_price: null,
wear: skin.wear || null,
stattrak: skin.stattrak ? 1 : 0,
})
})
.then(async r => {
const data = await r.json().catch(() => ({}));
if (!r.ok) throw new Error(data.error === 'too_many_items' ? dict.wishlist_too_many : errorMessage(data.error));
return data;
})
.then(() => {
showToast(dict.watch_ok, { type: 'success' });
if (typeof loadWishlist === 'function') loadWishlist();
// id новой записи нужен для снятия — берём из списка.
if (typeof loadFavQueries === 'function') loadFavQueries();
})
.catch(err => showErrorToast(err))
.finally(() => { watchBusy = false; });
}

document.getElementById('buyWatchBtn').addEventListener('click', () => {
if (pendingBuySkin) openWatchSheet(pendingBuySkin);
});

// Самозанятым и ИП — поле ИНН/ПИНФЛ (для сплита оплаты банком).
document.getElementById('kycLegalStatus').addEventListener('change', (e) => {
document.getElementById('kycTinField').style.display = e.target.value === 'individual' ? 'none' : '';
});
