// ============================================================
// ИСТОРИЯ ОПЕРАЦИЙ
// ============================================================

const HISTORY_TYPE_LABELS_RU = {
topup_crypto: 'Пополнение (крипта)',
trade_cash: 'Доплата по обмену',
withdrawal_paid: 'Вывод средств',
withdraw_commission: 'Комиссия за вывод',
referral_claim: 'Вывод реферального бонуса',
admin_debit: 'Списано админом',
set_discount: 'Скидка на лот',
stars_direct_purchase: 'Продажа (оплата Stars)',
stars_direct_purchase_refund: 'Возврат (Stars)',
crypto_direct_purchase_refund: 'Возврат (крипта)',
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
topup_crypto: "To'ldirish (kripto)",
trade_cash: "Almashuv bo'yicha to'lov",
withdrawal_paid: 'Pul yechish',
withdraw_commission: 'Yechish komissiyasi',
referral_claim: 'Referral bonusni yechish',
admin_debit: 'Admin yechdi',
set_discount: 'Lotga chegirma',
stars_direct_purchase: "Sotuv (Stars to'lovi)",
stars_direct_purchase_refund: 'Qaytarish (Stars)',
crypto_direct_purchase_refund: 'Qaytarish (kripto)',
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
topup_crypto: 'Top-up (crypto)',
trade_cash: 'Trade cash',
withdrawal_paid: 'Withdrawal',
withdraw_commission: 'Withdrawal fee',
referral_claim: 'Referral bonus claim',
admin_debit: 'Debited by admin',
set_discount: 'Listing discount',
stars_direct_purchase: 'Sale (Stars payment)',
stars_direct_purchase_refund: 'Refund (Stars)',
crypto_direct_purchase_refund: 'Refund (crypto)',
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
// День показан заголовком группы — в строке только время.
const date = item.created_at ? new Date(item.created_at).toLocaleTimeString(currentLang === 'uz' ? 'uz-UZ' : (currentLang === 'en' ? 'en-US' : 'ru-RU'), { hour: '2-digit', minute: '2-digit' }) : '';
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

// ---------- фильтры истории ----------
// Группы типов операций. Всё, что не попало в группу, видно только
// во «Все» — так новые типы на бэкенде не теряются.
const HISTORY_GROUPS = {
topup: ['topup_manual', 'topup_stars', 'topup_crypto'],
sale: ['skin_sale', 'trade_cash', 'stars_direct_purchase'],
withdraw: ['withdrawal_paid', 'hold', 'release_hold', 'finalize_hold'],
fee: ['platform_fee', 'withdraw_commission', 'set_discount'],
bonus: ['referral_bonus', 'referral_claim', 'admin_credit'],
refund: ['stars_direct_purchase_refund', 'crypto_direct_purchase_refund'],
};

let historyItems = [];
let historyRequests = [];
let historyFilter = 'all';
let historyPeriod = 30;

function historyLocale(){
return currentLang === 'uz' ? 'uz-UZ' : (currentLang === 'en' ? 'en-US' : 'ru-RU');
}

function historyDayLabel(iso){
const dict = I18N[currentLang] || I18N.ru;
const d = new Date(iso);
const today = new Date();
const yesterday = new Date(Date.now() - 86400000);
const same = (x, y) => x.toDateString() === y.toDateString();
if (same(d, today)) return dict.h_today;
if (same(d, yesterday)) return dict.h_yesterday;
return d.toLocaleDateString(historyLocale(), { day: 'numeric', month: 'long', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

function historyInPeriod(iso){
if (!historyPeriod) return true;
return iso && (Date.now() - new Date(iso).getTime()) <= historyPeriod * 86400000;
}

function historyControlsHtml(){
const dict = I18N[currentLang] || I18N.ru;
const groups = ['all', 'topup', 'sale', 'withdraw', 'fee', 'bonus', 'refund', 'requests'];
const chips = groups.map(g => `<button type="button" class="h-chip${historyFilter === g ? ' on' : ''}" data-h-filter="${g}">${dict['hf_' + g]}</button>`).join('');
const periods = [[7, dict.hp_7], [30, dict.hp_30], [0, dict.hp_all]]
.map(([v, l]) => `<button type="button" class="h-period${historyPeriod === v ? ' on' : ''}" data-h-period="${v}">${l}</button>`).join('');
return `<div class="h-chips">${chips}</div><div class="h-periods">${periods}</div>`;
}

function historyRequestRowHtml(r){
const dict = I18N[currentLang] || I18N.ru;
const label = r.kind === 'topup' ? dict.hr_topup : dict.hr_withdraw;
const status = dict['hs_' + r.status] || r.status;
const time = r.created_at ? new Date(r.created_at).toLocaleTimeString(historyLocale(), { hour: '2-digit', minute: '2-digit' }) : '';
return `<div class="history-row">
<div class="history-row-info">
<div class="history-row-note">${label}</div>
<div class="history-row-date">${time}</div>
</div>
<div style="text-align:right;">
<div class="history-row-amount ${r.amount >= 0 ? 'positive' : 'negative'}">${r.amount >= 0 ? '+' : ''}${formatCoins(r.amount)}</div>
<span class="h-status ${r.status}">${escapeHtml(status)}</span>
</div>
</div>`;
}

// Группировка по дням с заголовком «Сегодня / Вчера / 12 сентября».
function groupByDayHtml(rows, rowHtml){
let html = '';
let lastDay = '';
for (const row of rows){
const day = row.created_at ? new Date(row.created_at).toDateString() : '';
if (day !== lastDay){
html += `<div class="h-day">${row.created_at ? historyDayLabel(row.created_at) : ''}</div>`;
lastDay = day;
}
html += rowHtml(row);
}
return html;
}

function renderHistory(){
const list = document.getElementById('historyList');
const dict = I18N[currentLang] || I18N.ru;

if (!historyItems.length && !historyRequests.length){
list.innerHTML = `<div class="skins-empty" style="padding:12px 4px;">${dict.history_empty}</div>`;
return;
}

let body = '';
let summary = '';

if (historyFilter === 'requests'){
const rows = historyRequests.filter(r => historyInPeriod(r.created_at));
body = rows.length ? groupByDayHtml(rows, historyRequestRowHtml) : '';
} else {
const types = HISTORY_GROUPS[historyFilter];
const rows = historyItems.filter(i => historyInPeriod(i.created_at) && (!types || types.includes(i.type)));
const income = rows.filter(i => i.amount > 0).reduce((s, i) => s + i.amount, 0);
const expense = rows.filter(i => i.amount < 0).reduce((s, i) => s + i.amount, 0);
if (rows.length){
summary = `<div class="h-summary">
<div><span>${dict.h_in}</span><b class="positive">+${formatCoins(income)}</b></div>
<div><span>${dict.h_out}</span><b class="negative">${formatCoins(expense)}</b></div>
</div>`;
}
body = rows.length ? groupByDayHtml(rows, historyRowHtml) : '';
}

list.innerHTML = historyControlsHtml() + summary
+ (body || `<div class="skins-empty" style="padding:18px 4px;">${dict.h_nothing}</div>`);
}

document.getElementById('historyList').addEventListener('click', (e) => {
const chip = e.target.closest('[data-h-filter]');
const period = e.target.closest('[data-h-period]');
if (chip){ historyFilter = chip.dataset.hFilter; renderHistory(); }
if (period){ historyPeriod = Number(period.dataset.hPeriod); renderHistory(); }
});

function loadHistory(){
const list = document.getElementById('historyList');
if (!tg || !tg.initData){
list.innerHTML = `<div class="skins-empty" style="padding:12px 4px;">${errorMessage('unauthorized')}</div>`;
return;
}
fetch(API_BASE + '/api/transactions?init_data=' + encodeURIComponent(tg.initData))
.then(r => r.json())
.then(data => {
historyItems = data.items || [];
historyRequests = data.requests || [];
renderHistory();
})
.catch(() => {
if (typeof haptic === 'function') haptic('error');
renderErrorState(list, (I18N[currentLang] || I18N.ru).load_failed, () => {
list.innerHTML = skeletonRowsHtml(6);
loadHistory();
});
});
}

document.getElementById('openHistoryBtn').addEventListener('click', () => {
document.getElementById('historyList').innerHTML = skeletonRowsHtml(6);
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

