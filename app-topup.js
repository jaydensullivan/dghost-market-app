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
if (tg && tg.showAlert) tg.showAlert(topupCardNumber);
});
} else if (tg && tg.showAlert){
tg.showAlert(topupCardNumber);
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

