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
// Чек к переводу на карту (data URL JPEG) — уходит вместе с заявкой.
let topupReceiptPhoto = null;
let topupCardNumber = '';

const TOPUP_ERROR_MESSAGES_RU = {
below_minimum: 'Сумма меньше минимальной для пополнения.',
bad_photo: 'Не удалось прочитать фото чека — попробуй другой скриншот.',
feature_disabled: 'Пополнение сейчас временно недоступно.',
};
const TOPUP_ERROR_MESSAGES_UZ = {
below_minimum: "Summa to'ldirish uchun minimaldan kam.",
bad_photo: "Chek rasmini o'qib bo'lmadi — boshqa skrinshot yuboring.",
feature_disabled: "To'ldirish hozircha vaqtincha mavjud emas.",
};
const TOPUP_ERROR_MESSAGES_EN = {
below_minimum: 'The amount is below the top-up minimum.',
bad_photo: "Couldn't read the receipt photo — try another screenshot.",
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
if (can) document.getElementById('openTopupBtn').style.display = '';
gtAccAutoOpen();
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
status.textContent = d.stars_topup_bad_amount.replace('{min}', starsInfo ? starsInfo.min : 1);
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

// ---------- аккордеон способов оплаты ----------
// Нажал на один — он раскрывается, другой закрывается; повторное нажатие
// закрывает. Если способ один (Stars выключены) — он открыт сразу.
function setTopupAcc(name){
document.querySelectorAll('#topupAcc .pay-acc-item').forEach(item => {
const open = item.dataset.acc === name;
item.classList.toggle('open', open);
item.querySelector('.pay-acc-head').setAttribute('aria-expanded', open ? 'true' : 'false');
});
}
let topupAccChosen = false;
function gtAccAutoOpen(){
if (topupAccChosen) return;
const visible = [...document.querySelectorAll('#topupAcc .pay-acc-item')].filter(i => !i.hidden);
setTopupAcc(visible.length === 1 ? visible[0].dataset.acc : '');
}
document.getElementById('topupAcc').addEventListener('click', (e) => {
const head = e.target.closest('[data-acc-toggle]');
if (!head) return;
const item = head.closest('.pay-acc-item');
topupAccChosen = true;
setTopupAcc(item.classList.contains('open') ? '' : head.dataset.accToggle);
});
gtAccAutoOpen();

// ---------- чек к переводу на карту ----------
// Сжимаем до 1600px JPEG, чтобы заявка с фото быстро ушла и с мобильного.
function topupCompressImage(file){
return new Promise((resolve, reject) => {
const img = new Image();
const url = URL.createObjectURL(file);
img.onload = () => {
const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
const c = document.createElement('canvas');
c.width = Math.round(img.width * scale);
c.height = Math.round(img.height * scale);
c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
URL.revokeObjectURL(url);
resolve(c.toDataURL('image/jpeg', 0.85));
};
img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
img.src = url;
});
}
function setTopupReceipt(data){
const d = I18N[currentLang] || I18N.ru;
topupReceiptPhoto = data;
const thumb = document.getElementById('topupReceiptThumb');
const label = document.getElementById('topupReceiptLabel');
const btn = label.closest('.topup-receipt-btn');
thumb.hidden = !data;
if (data) thumb.src = data; else thumb.removeAttribute('src');
btn.classList.toggle('attached', !!data);
label.textContent = data ? '✅ ' + d.topup_attached : d.topup_attach;
if (!data) document.getElementById('topupReceiptFile').value = '';
}
document.getElementById('topupReceiptFile').addEventListener('change', (e) => {
const file = e.target.files && e.target.files[0];
if (!file) return;
topupCompressImage(file).then(setTopupReceipt).catch(() => {
topupStatus.textContent = (I18N[currentLang] || I18N.ru).topup_bad_photo;
});
});
