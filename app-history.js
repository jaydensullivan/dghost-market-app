// ============================================================
// ИСТОРИЯ ОПЕРАЦИЙ
// ============================================================

const HISTORY_TYPE_LABELS_RU = {
skin_sale: 'Продажа скина',
platform_fee: 'Комиссия платформы',
admin_adjust: 'Корректировка админом',
topup_manual: 'Пополнение',
topup_stars: 'Пополнение (Stars)',
admin_credit: 'Начислено админом',
referral_bonus: 'Реферальный бонус',
hold: 'Заморозка средств',
release_hold: 'Снятие заморозки',
finalize_hold: 'Списание (сделка завершена)',
};

const HISTORY_TYPE_LABELS_UZ = {
skin_sale: 'Skin sotildi',
platform_fee: 'Platforma komissiyasi',
admin_adjust: 'Admin tuzatishi',
topup_manual: "To'ldirish",
topup_stars: "To'ldirish (Stars)",
admin_credit: "Admin qo'shdi",
referral_bonus: 'Referral bonus',
hold: 'Mablag\' muzlatildi',
release_hold: 'Muzlatish yechildi',
finalize_hold: 'Yechildi (bitim yakunlandi)',
};

const HISTORY_TYPE_LABELS_EN = {
skin_sale: 'Skin sale',
platform_fee: 'Platform fee',
admin_adjust: 'Admin adjustment',
topup_manual: 'Top-up',
topup_stars: 'Top-up (Stars)',
admin_credit: 'Credited by admin',
referral_bonus: 'Referral bonus',
hold: 'Funds held',
release_hold: 'Hold released',
finalize_hold: 'Deducted (deal completed)',
};

function historyRowHtml(item){
const map = currentLang === 'uz' ? HISTORY_TYPE_LABELS_UZ : (currentLang === 'en' ? HISTORY_TYPE_LABELS_EN : HISTORY_TYPE_LABELS_RU);
const label = map[item.type] || item.type;
const isPositive = item.amount >= 0;
const sign = isPositive ? '+' : '';
const date = item.created_at ? new Date(item.created_at).toLocaleString(currentLang === 'uz' ? 'uz-UZ' : (currentLang === 'en' ? 'en-US' : 'ru-RU'), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
const photo = item.photo_url
? `<img class="history-row-photo" src="${item.photo_url}" alt="" onerror="this.style.display='none'">`
: '';
return `<div class="history-row">
${photo}
<div class="history-row-info">
<div class="history-row-note">${escapeHtml(item.note || label)}</div>
<div class="history-row-date">${label} · ${date}</div>
</div>
<div class="history-row-amount ${isPositive ? 'positive' : 'negative'}">${sign}${formatCoins(item.amount)}</div>
</div>`;
}

function loadHistory(){
const list = document.getElementById('historyList');
if (!tg || !tg.initData){
list.innerHTML = `<div class="skins-empty" style="padding:12px 4px;">${errorMessage('unauthorized')}</div>`;
return;
}
fetch(API_BASE + '/api/transactions?init_data=' + encodeURIComponent(tg.initData))
.then(r => r.json())
.then(data => {
const items = data.items || [];
const dict = I18N[currentLang] || I18N.ru;
if (!items.length){
list.innerHTML = `<div class="skins-empty" style="padding:12px 4px;">${dict.history_empty}</div>`;
return;
}
list.innerHTML = items.map(historyRowHtml).join('');
})
.catch(() => {
list.innerHTML = `<div class="skins-empty" style="padding:12px 4px;">${(I18N[currentLang] || I18N.ru).load_failed}</div>`;
});
}

document.getElementById('openHistoryBtn').addEventListener('click', () => {
document.getElementById('historyList').innerHTML = `<div class="skins-empty" style="padding:12px 4px;">${(I18N[currentLang] || I18N.ru).loading}</div>`;
document.getElementById('historyOverlay').classList.add('show');
loadHistory();
});

document.getElementById('exportSalesCsvBtn').addEventListener('click', () => {
if (!tg || !tg.initData) return;
const url = API_BASE + '/api/export/sales_csv?init_data=' + encodeURIComponent(tg.initData);
if (tg.openLink){
tg.openLink(url);
} else {
window.open(url, '_blank');
}
});

document.getElementById('historyCloseBtn').addEventListener('click', () => {
document.getElementById('historyOverlay').classList.remove('show');
});

document.getElementById('openWithdrawBtn').addEventListener('click', () => {
document.getElementById('withdrawTotpField').style.display = totp2faStatus.enabled_withdraw ? '' : 'none';
document.getElementById('wTotpCode').value = '';
withdrawOverlay.classList.add('show');
});
document.getElementById('withdrawCancel').addEventListener('click', () => {
withdrawOverlay.classList.remove('show');
});

