// ============================================================
// ПРИГЛАСИТЬ ДРУГА
// ============================================================

const referralLinkBox = document.getElementById('referralLinkBox');
const referralLinkText = document.getElementById('referralLinkText');
const referralCopyBtn = document.getElementById('referralCopyBtn');
const referralBonusText = document.getElementById('referralBonusText');
const referralInvitedCount = document.getElementById('referralInvitedCount');
const referralWalletValue = document.getElementById('referralWalletValue');
const referralClaimBtn = document.getElementById('referralClaimBtn');
const referralClaimStatus = document.getElementById('referralClaimStatus');

let referralLinkRaw = '';

function loadReferralInfo(){
const dict = I18N[currentLang] || I18N.ru;
if (!tg || !tg.initData){
referralLinkText.textContent = dict.open_via_telegram;
return;
}
fetch(API_BASE + '/api/referral_info?init_data=' + encodeURIComponent(tg.initData))
.then(r => r.json())
.then(data => {
if (!data || data.error) throw new Error();
referralLinkRaw = data.link;
referralLinkText.textContent = referralLinkRaw;
referralInvitedCount.textContent = data.invited_count;
referralBonusText.textContent = dict.referral_bonus_text(data.bonus_percent);
referralWalletValue.textContent = `${formatCoins(data.wallet)} / ${formatCoins(data.wallet_cap)}`;
referralClaimBtn.style.display = data.wallet > 0 ? '' : 'none';
})
.catch(() => {
referralLinkText.textContent = dict.load_failed;
});
}

referralClaimBtn.addEventListener('click', () => {
if (!tg || !tg.initData) return;
referralClaimBtn.disabled = true;
referralClaimStatus.textContent = '...';
fetch(API_BASE + '/api/referral/claim', {
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
referralClaimStatus.textContent = `Готово ✓ +${formatCoins(data.claimed)} на баланс`;
loadReferralInfo();
loadMe();
})
.catch(err => {
referralClaimStatus.textContent = friendlyErrorMessage(err);
})
.finally(() => {
referralClaimBtn.disabled = false;
});
});

function copyReferralLink(){
if (!referralLinkRaw) return;

const done = () => {
const originalHtml = referralCopyBtn.innerHTML;
referralCopyBtn.classList.add('copied');
referralCopyBtn.textContent = (I18N[currentLang] || I18N.ru).copied_text;
setTimeout(() => {
referralCopyBtn.classList.remove('copied');
referralCopyBtn.innerHTML = originalHtml;
}, 1500);
};

if (navigator.clipboard && navigator.clipboard.writeText){
navigator.clipboard.writeText(referralLinkRaw).then(done).catch(() => {
if (tg && tg.showAlert) tg.showAlert(referralLinkRaw);
});
} else if (tg && tg.showAlert){
tg.showAlert(referralLinkRaw);
}
}

referralLinkBox.addEventListener('click', copyReferralLink);
referralCopyBtn.addEventListener('click', (e) => {
e.stopPropagation();
copyReferralLink();
});

loadReferralInfo();

function updateTopupCryptoBtnVisibility(){
document.getElementById('topupCryptoBtn').style.display = (cryptoTopupAvailable && topupCryptoEnabled) ? '' : 'none';
document.getElementById('topupStarsBtn').style.display = topupStarsEnabled ? '' : 'none';
document.getElementById('topupDetailsBox').style.display = topupCardEnabled ? '' : 'none';
topupSubmitBtn.style.display = topupCardEnabled ? '' : 'none';
}

document.getElementById('topupCryptoBtn').addEventListener('click', () => {
if (!tg || !tg.initData){
topupStatus.textContent = errorMessage('unauthorized');
return;
}
const amount = Number(tAmount.value);
if (!amount || amount < 1000){
topupStatus.textContent = (I18N[currentLang] || I18N.ru).topup_need_amount;
return;
}
const btn = document.getElementById('topupCryptoBtn');
btn.disabled = true;
topupStatus.textContent = (I18N[currentLang] || I18N.ru).status_creating_invoice_short;
fetch(API_BASE + '/api/topup/crypto', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData, amount: amount })
})
.then(async r => {
if (!r.ok){
const data = await r.json().catch(() => ({}));
throw new Error(data.error === 'not_configured' ? 'Оплата криптой сейчас недоступна.' : errorMessage(data.error));
}
return r.json();
})
.then(data => {
topupStatus.textContent = (I18N[currentLang] || I18N.ru).status_invoice_created;
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
topupStatus.textContent = friendlyErrorMessage(err);
})
.finally(() => {
btn.disabled = false;
});
});

document.getElementById('topupStarsBtn').addEventListener('click', () => {
if (!tg || !tg.initData){
topupStatus.textContent = errorMessage('unauthorized');
return;
}
const amount = Number(tAmount.value);
if (!amount || amount < coinsPerStar){
topupStatus.textContent = `Укажи сумму пополнения (минимум ${formatCoins(coinsPerStar)}).`;
return;
}
const btn = document.getElementById('topupStarsBtn');
btn.disabled = true;
topupStatus.textContent = (I18N[currentLang] || I18N.ru).status_creating_invoice;
fetch(API_BASE + '/api/topup/stars', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData, amount: amount })
})
.then(async r => {
if (!r.ok){
const data = await r.json().catch(() => ({}));
throw new Error(data.error === 'feature_disabled' ? 'Оплата Stars сейчас недоступна.' : errorMessage(data.error));
}
return r.json();
})
.then(data => {
if (tg && tg.openInvoice){
tg.openInvoice(data.link, (status) => {
if (status === 'paid'){
topupStatus.textContent = (I18N[currentLang] || I18N.ru).status_topup_paid_ok;
setTimeout(() => { loadMe(); loadProfile(); }, 2500);
} else if (status === 'cancelled'){
topupStatus.textContent = '';
} else {
topupStatus.textContent = (I18N[currentLang] || I18N.ru).status_payment_failed;
}
});
} else {
window.open(data.link, '_blank');
}
})
.catch(err => {
topupStatus.textContent = friendlyErrorMessage(err);
})
.finally(() => {
btn.disabled = false;
});
});

topupSubmitBtn.addEventListener('click', () => {
if (!tg || !tg.initData){
topupStatus.textContent = errorMessage('unauthorized');
return;
}

const amount = Number(tAmount.value);

if (!amount || amount <= 0){
topupStatus.textContent = (I18N[currentLang] || I18N.ru).withdraw_need_amount;
return;
}

topupSubmitBtn.disabled = true;
topupStatus.textContent = (I18N[currentLang] || I18N.ru).withdraw_sending;

fetch(API_BASE + '/api/topup', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
init_data: tg.initData,
amount: amount,
})
})
.then(async r => {
if (!r.ok){
const data = await r.json().catch(() => ({}));
throw new Error(TOPUP_ERROR_MESSAGES[data.error] || errorMessage(data.error));
}
return r.json();
})
.then(data => {
topupStatus.textContent = `Заявка #${data.id} создана ✓ Теперь пришли скриншот чека прямо в чат с ботом.`;
tAmount.value = '';
if (tg.close) {
// оставляем мини-апп открытым — пользователь сам
// переключится в чат, чтобы отправить фото
}
})
.catch(err => {
topupStatus.textContent = friendlyErrorMessage(err);
})
.finally(() => {
topupSubmitBtn.disabled = false;
});
});

