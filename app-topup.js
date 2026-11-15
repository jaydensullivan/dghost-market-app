// ============================================================
// ПОПОЛНЕНИЕ БАЛАНСА
// ============================================================

const tAmount = document.getElementById('tAmount');
const topupSubmitBtn = document.getElementById('topupSubmitBtn');
const topupStatus = document.getElementById('topupStatus');
const topupDetailsText = document.getElementById('topupDetailsText');
const topupDetailsBox = document.getElementById('topupDetailsBox');
const topupCopyBtn = document.getElementById('topupCopyBtn');

let topupDetailsRaw = '';
let topupCardNumber = '';

const TOPUP_ERROR_MESSAGES_RU = {
below_minimum: 'Сумма меньше минимальной для пополнения.',
feature_disabled: 'Пополнение сейчас временно недоступно.',
};
const TOPUP_ERROR_MESSAGES_UZ = {
below_minimum: "Summa to'ldirish uchun minimaldan kam.",
feature_disabled: "To'ldirish hozircha vaqtincha mavjud emas.",
};
const TOPUP_ERROR_MESSAGES_EN = {
below_minimum: 'The amount is below the top-up minimum.',
feature_disabled: 'Top-ups are temporarily unavailable.',
};

function loadTopupInfo(){
fetch(API_BASE + '/api/topup_info' + (tg && tg.initData ? '?init_data=' + encodeURIComponent(tg.initData) : ''))
.then(r => r.json())
.then(data => {
topupDetailsRaw = data.details || '';
topupCardNumber = data.card_number || topupDetailsRaw;
topupDetailsText.textContent = topupDetailsRaw;
if (data.min_amount) tAmount.placeholder = String(data.min_amount);
})
.catch(() => {
topupDetailsText.textContent = (I18N[currentLang] || I18N.ru).status_details_load_failed;
});
}

function copyTopupDetails(){
if (!topupCardNumber) return;

const done = () => {
const originalHtml = topupCopyBtn.innerHTML;
topupCopyBtn.classList.add('copied');
topupCopyBtn.textContent = (I18N[currentLang] || I18N.ru).copied_text;
setTimeout(() => {
topupCopyBtn.classList.remove('copied');
topupCopyBtn.innerHTML = originalHtml;
}, 1500);
};

if (navigator.clipboard && navigator.clipboard.writeText){
navigator.clipboard.writeText(topupCardNumber).then(done).catch(() => {
showAlert(topupCardNumber);
});
} else {
showAlert(topupCardNumber);
}
}

topupDetailsBox.addEventListener('click', copyTopupDetails);
topupCopyBtn.addEventListener('click', (e) => {
e.stopPropagation();
copyTopupDetails();
});

loadTopupInfo();

const topupOverlay = document.getElementById('topupOverlay');
const withdrawOverlay = document.getElementById('withdrawOverlay');

document.getElementById('openTopupBtn').addEventListener('click', () => {
topupOverlay.classList.add('show');
});
document.getElementById('topupCancel').addEventListener('click', () => {
topupOverlay.classList.remove('show');
});

document.querySelectorAll('[data-quick-amount]').forEach(btn => {
btn.addEventListener('click', () => {
document.getElementById('tAmount').value = btn.dataset.quickAmount;
});
});


// ---------- пополнение через Telegram Stars ----------
// Счёт выставляет бот (XTR), оплата — в окне Telegram; зачисление на
// баланс делает бот по сообщению об успешной оплате.
let starsInfo = null;

function starsDict(){ return I18N[currentLang] || I18N.ru; }

function renderStarsPreview(){
const box = document.getElementById('starsPreview');
const n = parseInt(document.getElementById('starsAmount').value, 10) || 0;
if (!starsInfo || !n){ box.textContent = ''; return; }
box.textContent = starsDict().stars_topup_preview.replace('{stars}', n).replace('{sum}', formatCoins(Math.floor(n * starsInfo.rate)));
}

function loadStarsInfo(){
fetch(API_BASE + '/api/stars/info')
.then(r => r.json())
.then(d => {
// Только внутри Telegram: на сайте окна оплаты Stars нет.
const can = !!(d.enabled && tg && tg.openInvoice && tg.initData);
starsInfo = can ? d : null;
document.getElementById('starsTopupBox').hidden = !can;
if (can) document.getElementById('starsAmount').min = d.min;
renderStarsPreview();
})
.catch(() => { document.getElementById('starsTopupBox').hidden = true; });
}

document.getElementById('starsAmount').addEventListener('input', renderStarsPreview);
document.querySelectorAll('[data-quick-stars]').forEach(btn => btn.addEventListener('click', () => {
document.getElementById('starsAmount').value = btn.dataset.quickStars;
renderStarsPreview();
}));

document.getElementById('starsPayBtn').addEventListener('click', () => {
const d = starsDict();
const status = document.getElementById('starsStatus');
const stars = parseInt(document.getElementById('starsAmount').value, 10) || 0;
if (!starsInfo || stars < starsInfo.min || stars > starsInfo.max){
status.textContent = d.stars_topup_bad_amount.replace('{min}', starsInfo ? starsInfo.min : 50);
return;
}
status.textContent = d.loading;
fetch(API_BASE + '/api/stars/invoice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ init_data: tg.initData, stars: stars }) })
.then(r => r.json().then(j => (r.ok ? j : Promise.reject(j))))
.then(j => {
status.textContent = '';
tg.openInvoice(j.link, result => {
if (result === 'paid'){
status.textContent = d.stars_topup_paid;
// Бот зачисляет за секунду-две; обновляем баланс чуть позже.
setTimeout(() => { if (typeof loadProfile === 'function') loadProfile(); }, 2500);
} else if (result === 'failed'){
status.textContent = d.stars_topup_failed;
}
});
})
.catch(() => { status.textContent = d.stars_topup_failed; });
});

loadStarsInfo();
