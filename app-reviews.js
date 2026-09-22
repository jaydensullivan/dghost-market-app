// ============================================================
// ПУБЛИЧНЫЙ ПРОФИЛЬ ПРОДАВЦА И ОТЗЫВЫ
//
// Профиль открывается из карточки лота (строка продавца). Имя
// продавца не раскрывается — только псевдоним DG-XXXX с сервера.
// Отзыв оставляет покупатель после подтверждения получения,
// кнопка «Оценить продавца» в «Мои сделки».
// ============================================================

const TRUST_BADGE = { new: '🌱', verified: '✅', trusted: '💎' };

function starsHtml(rating){
const r = Math.round(rating || 0);
return '★'.repeat(r) + '☆'.repeat(5 - r);
}

function formatTransferTime(hours){
const dict = I18N[currentLang] || I18N.ru;
if (hours === null || hours === undefined) return dict.sp_no_data;
if (hours < 1) return dict.sp_minutes.replace('{m}', Math.max(1, Math.round(hours * 60)));
return dict.sp_hours.replace('{h}', hours < 10 ? hours.toFixed(1).replace('.0', '') : Math.round(hours));
}

function sellerProfileHtml(p){
const dict = I18N[currentLang] || I18N.ru;
const levelLabel = dict['trust_level_' + p.trust_level] || p.trust_level;
const locale = currentLang === 'uz' ? 'uz-UZ' : (currentLang === 'en' ? 'en-US' : 'ru-RU');
const since = p.since ? new Date(p.since).toLocaleDateString(locale, { month: 'long', year: 'numeric' }) : '';
const rating = p.rating_avg ? `${p.rating_avg} <span class="sp-sub">(${p.rating_count})</span>` : dict.sp_no_data;

const lots = lastSkins.filter(s => s.seller_id === p.seller_id).slice(0, 10);
const lotsHtml = lots.length ? `<div class="similar-title" style="margin-top:16px;">${dict.sp_lots}</div>
<div class="similar-row">${lots.map(s => `
<button type="button" class="similar-card" data-similar-id="${s.id}">
<div class="similar-photo">${s.photo_url ? `<img src="${s.photo_url}" alt="" loading="lazy">` : ''}</div>
<div class="similar-name">${escapeHtml(s.title || '')}</div>
<div class="similar-price">${formatCoins(s.price)}</div>
</button>`).join('')}</div>` : '';

const reviewsHtml = p.reviews && p.reviews.length
? p.reviews.map(r => `<div class="sp-review">
<div class="sp-review-head"><span class="sp-stars">${starsHtml(r.rating)}</span><span class="sp-sub">${dealDateLabel(r.created_at).split(',')[0]}</span></div>
${r.item ? `<div class="sp-review-item">${escapeHtml(r.item)}</div>` : ''}
${r.comment ? `<div class="sp-review-text">${escapeHtml(r.comment)}</div>` : ''}
</div>`).join('')
: `<div class="shop-hint">${dict.sp_no_reviews}</div>`;

return `<div class="sp-head">
<div class="sp-avatar">${TRUST_BADGE[p.trust_level] || '👤'}</div>
<div>
<div class="sp-name">${dict.sp_title} ${escapeHtml(p.alias)}</div>
<div class="sp-sub">${escapeHtml(levelLabel)}${since ? ' · ' + escapeHtml(dict.sp_since.replace('{date}', since)) : ''}</div>
</div>
</div>
<div class="sp-grid">
<div class="sp-cell"><div class="sp-val">${p.completed_trades}</div><div class="sp-sub">${dict.sp_trades}</div></div>
<div class="sp-cell"><div class="sp-val">${rating}</div><div class="sp-sub">${dict.sp_rating}</div></div>
<div class="sp-cell"><div class="sp-val">${formatTransferTime(p.median_transfer_hours)}</div><div class="sp-sub">${dict.sp_transfer}</div></div>
<div class="sp-cell"><div class="sp-val">${p.disputes}</div><div class="sp-sub">${dict.sp_disputes}</div></div>
</div>
${lotsHtml}
<div class="similar-title" style="margin-top:16px;">${dict.sp_reviews}${p.rating_count ? ` · ${p.rating_count}` : ''}</div>
${reviewsHtml}`;
}

const sellerProfileOverlay = document.getElementById('sellerProfileOverlay');
const sellerProfileBody = document.getElementById('sellerProfileBody');

function openSellerProfile(sellerId){
sellerProfileBody.innerHTML = skeletonRowsHtml(4);
sellerProfileOverlay.classList.add('show');
fetch(API_BASE + '/api/sellers/' + sellerId + '/profile')
.then(r => {
if (!r.ok) throw new Error('HTTP ' + r.status);
return r.json();
})
.then(p => { sellerProfileBody.innerHTML = sellerProfileHtml(p); })
.catch(() => {
renderErrorState(sellerProfileBody, (I18N[currentLang] || I18N.ru).load_failed, () => openSellerProfile(sellerId));
});
}

document.addEventListener('click', (e) => {
const btn = e.target.closest('[data-seller-profile]');
if (btn) openSellerProfile(Number(btn.dataset.sellerProfile));
// Лот из профиля продавца открывается поверх — профиль закрываем.
if (e.target.closest('#sellerProfileOverlay [data-similar-id]')) sellerProfileOverlay.classList.remove('show');
});

document.getElementById('sellerProfileCloseBtn').addEventListener('click', () => {
sellerProfileOverlay.classList.remove('show');
});

// ---------- форма отзыва ----------

const reviewOverlay = document.getElementById('reviewOverlay');
const reviewStars = document.getElementById('reviewStars');
const reviewComment = document.getElementById('reviewComment');
const reviewStatus = document.getElementById('reviewStatus');
const reviewSubmitBtn = document.getElementById('reviewSubmitBtn');

let reviewSkinId = null;
let reviewRating = 0;

function paintReviewStars(){
reviewStars.querySelectorAll('[data-star]').forEach(b => {
b.classList.toggle('on', Number(b.dataset.star) <= reviewRating);
});
}

function openReviewForm(skinId){
const dict = I18N[currentLang] || I18N.ru;
reviewSkinId = skinId;
reviewRating = 0;
reviewComment.value = '';
reviewStatus.textContent = '';
reviewSubmitBtn.disabled = false;
document.getElementById('reviewTitle').textContent = dict.rv_title;
document.getElementById('reviewHint').textContent = dict.rv_hint;
reviewComment.placeholder = dict.rv_comment_ph;
reviewSubmitBtn.textContent = dict.rv_submit;
paintReviewStars();
reviewOverlay.classList.add('show');
}

reviewStars.addEventListener('click', (e) => {
const b = e.target.closest('[data-star]');
if (!b) return;
reviewRating = Number(b.dataset.star);
reviewStatus.textContent = '';
paintReviewStars();
haptic('select');
});

reviewSubmitBtn.addEventListener('click', () => {
const dict = I18N[currentLang] || I18N.ru;
if (!reviewSkinId || !tg || !tg.initData) return;
if (!reviewRating){
reviewStatus.textContent = dict.rv_pick;
haptic('error');
return;
}
reviewSubmitBtn.disabled = true;
fetch(API_BASE + '/api/skins/' + reviewSkinId + '/review', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData, rating: reviewRating, comment: reviewComment.value.trim() })
})
.then(async r => {
if (!r.ok){
const data = await r.json().catch(() => ({}));
throw new Error(errorMessage(data.error));
}
return r.json();
})
.then(() => {
reviewOverlay.classList.remove('show');
showToast(dict.rv_ok, { type: 'success' });
loadDeals();
})
.catch(err => { reviewStatus.textContent = friendlyErrorMessage(err); })
.finally(() => { reviewSubmitBtn.disabled = false; });
});

document.getElementById('reviewCancelBtn').addEventListener('click', () => {
reviewOverlay.classList.remove('show');
});
