// ============================================================
// ЦЕНТР УВЕДОМЛЕНИЙ — КОЛОКОЛЬЧИК В ШАПКЕ И ЛЕНТА
//
// Те же сообщения, что бот присылает в чат (сделки, баланс,
// аукционы, KYC), сохраняются на сервере (notify_send в bot.py) и
// показываются здесь. Счётчик непрочитанных обновляется при
// запуске, раз в 90 секунд и при возвращении в мини-апп. При
// открытии ленты всё помечается прочитанным.
// ============================================================

const NOTIF_ICONS = {
deal: '🤝', trade: '🔄', balance: '💰', referral: '🎁',
wishlist: '⭐', auction: '🔨', kyc: '🛡️', giveaway: '🎉',
};

const notifBellBtn = document.getElementById('notifBellBtn');
const notifBadge = document.getElementById('notifBadge');
const notificationsOverlay = document.getElementById('notificationsOverlay');
const notificationsList = document.getElementById('notificationsList');

let notifItems = [];

function setNotifBadge(count){
if (count > 0){
notifBadge.textContent = count > 99 ? '99+' : String(count);
notifBadge.style.display = '';
} else {
notifBadge.style.display = 'none';
}
}

function fetchNotifications(){
if (!tg || !tg.initData) return Promise.resolve(null);
return fetch(API_BASE + '/api/notifications?init_data=' + encodeURIComponent(tg.initData))
.then(r => {
if (!r.ok) throw new Error('HTTP ' + r.status);
return r.json();
})
.then(data => {
notifItems = data.items || [];
setNotifBadge(data.unread || 0);
return data;
});
}

// Куда ведёт нажатие на уведомление.
function notifTarget(item){
if ((item.kind === 'deal') && item.skin_id) return 'deal';
if (item.kind === 'deal' || item.kind === 'trade') return 'deals';
if (item.kind === 'balance' || item.kind === 'referral') return 'history';
if (item.kind === 'auction') return 'auctions';
return null;
}

function notifItemHtml(item, idx){
const dict = I18N[currentLang] || I18N.ru;
const target = notifTarget(item);
const icon = NOTIF_ICONS[item.kind] || '🔔';
const open = target ? `<span class="notif-open">${dict.notif_open} →</span>` : '';
return `<div class="notif-item${item.read ? '' : ' unread'}${target ? ' clickable' : ''}" data-notif-idx="${idx}">
<div class="notif-icon">${icon}</div>
<div class="notif-body">
<div class="notif-text">${escapeHtml(item.text)}</div>
<div class="notif-meta"><span>${dealDateLabel(item.created_at)}</span>${open}</div>
</div>
${item.read ? '' : '<div class="notif-dot"></div>'}
</div>`;
}

function renderNotifications(){
const dict = I18N[currentLang] || I18N.ru;
if (!notifItems.length){
notificationsList.innerHTML = `<div class="skins-empty" style="padding:18px 4px;">${dict.notif_empty}</div>`;
return;
}
notificationsList.innerHTML = notifItems.map(notifItemHtml).join('');
}

function markNotificationsRead(){
if (!tg || !tg.initData) return;
fetch(API_BASE + '/api/notifications/read', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData })
})
.then(() => setNotifBadge(0))
.catch(() => {});
}

function openNotifications(){
notificationsList.innerHTML = skeletonRowsHtml(5);
notificationsOverlay.classList.add('show');
fetchNotifications()
.then(() => {
renderNotifications();
if (notifItems.some(i => !i.read)) markNotificationsRead();
})
.catch(() => {
const dict = I18N[currentLang] || I18N.ru;
renderErrorState(notificationsList, dict.load_failed, openNotifications);
});
}

// Сделка из уведомления: открываем «Мои сделки», ждём, пока
// список подгрузится, и сразу показываем таймлайн нужной сделки.
function openDealFromNotification(skinId){
goToScreen('deals');
let tries = 0;
const timer = setInterval(() => {
tries += 1;
if (lastDeals.some(d => d.id === skinId)){
clearInterval(timer);
openTradeDetails(skinId);
} else if (tries > 25){
clearInterval(timer); // сделки уже нет в списке — остаёмся на экране сделок
}
}, 200);
}

notificationsList.addEventListener('click', (e) => {
const row = e.target.closest('[data-notif-idx]');
if (!row) return;
const item = notifItems[Number(row.dataset.notifIdx)];
const target = item && notifTarget(item);
if (!target) return;
notificationsOverlay.classList.remove('show');
if (target === 'deal') openDealFromNotification(item.skin_id);
else if (target === 'deals') goToScreen('deals');
else if (target === 'auctions') goToScreen('auctions');
else if (target === 'history') document.getElementById('openHistoryBtn').click();
});

notifBellBtn.addEventListener('click', openNotifications);

document.getElementById('notificationsCloseBtn').addEventListener('click', () => {
notificationsOverlay.classList.remove('show');
});

// Счётчик: при запуске, раз в 90 секунд и при возвращении в приложение.
function refreshNotifBadge(){
if (document.hidden) return;
fetchNotifications().catch(() => {});
}

setTimeout(refreshNotifBadge, 1500);
setInterval(refreshNotifBadge, 90000);
document.addEventListener('visibilitychange', refreshNotifBadge);
