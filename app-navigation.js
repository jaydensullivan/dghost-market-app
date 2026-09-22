// ============================================================
// ВКЛАДКИ (ТАЙМЕР / МАГАЗИН / ПРОФИЛЬ)
// ============================================================

const tabTimerBtn = document.getElementById('tabTimerBtn');
const tabShopBtn = document.getElementById('tabShopBtn');
const tabProfileBtn = document.getElementById('tabProfileBtn');
const screenTimer = document.getElementById('screenTimer');
const screenShop = document.getElementById('screenShop');
const screenProfile = document.getElementById('screenProfile');

let isAdmin = false;
let isOwner = false;
let cryptoTopupAvailable = false;
let cryptoPayoutAvailable = false;
let topupCardEnabled = true;
let topupCryptoEnabled = true;
let topupStarsEnabled = true;
let coinsPerStar = 200;
let directStarsPurchaseEnabled = false;
let directCryptoPurchaseEnabled = false;
let directP2pPurchaseEnabled = false;
let sellerKycStatus = 'none';
let currentUserTrust = null;

const TRUST_BADGE_ICON = { new: '🌱', verified: '✅', trusted: '⭐' };

function renderTrustBadge(){
const badge = document.getElementById('trustBadge');
const progressEl = document.getElementById('trustProgress');
if (!badge) return;
if (!currentUserTrust){
badge.style.display = 'none';
if (progressEl) progressEl.style.display = 'none';
return;
}
const icon = TRUST_BADGE_ICON[currentUserTrust.level] || '';
badge.textContent = `${icon} ${currentUserTrust.label_ru}`.trim();
badge.style.display = 'inline-flex';
badge.title = `Сделок завершено: ${currentUserTrust.completed_trades}`;
if (progressEl){
const p = currentUserTrust.progress;
if (p && p.trades_needed > 0){
const word = p.trades_needed === 1 ? 'сделка' : (p.trades_needed < 5 ? 'сделки' : 'сделок');
progressEl.textContent = `До «${p.next_label_ru}»: ещё ${p.trades_needed} ${word}`;
progressEl.style.display = 'block';
} else {
progressEl.style.display = 'none';
}
}
}
let p2pCardDetails = '';
let withdrawCardEnabled = true;
let withdrawCryptoEnabled = true;
let adminPermissions = [];

let adminStatsLiveTimer = null;
let isAuctioneer = false;
let currentUserId = null;
let currentTab = 'shop';

function showAlert(message){
if (tg && tg.showAlert){ tg.showAlert(message); }
else { alert(message); }
}

function friendlyErrorMessage(err){
// Вызывается каждый раз, когда ошибка показывается пользователю —
// удобная точка для вибрации ошибки (haptic из app-telegram.js).
if (typeof haptic === 'function') haptic('error');
// fetch() кидает TypeError с техническим текстом вроде "Load failed"
// или "Failed to fetch", если запрос вообще не дошёл до сервера
// (обрыв связи и т.п.) — показываем понятную фразу вместо этого.
if (err instanceof TypeError){
return 'Нет соединения с сервером — проверь интернет и попробуй ещё раз.';
}
return err.message || 'Что-то пошло не так, попробуй ещё раз.';
}

function showConfirm(message, onOk){
if (tg && tg.showConfirm){ tg.showConfirm(message, ok => { if (ok) onOk(); }); }
else if (confirm(message)) { onOk(); }
}

function updateFabVisibility(){
if (isAdmin && currentTab === 'timer'){ editFab.classList.add('show'); }
else { editFab.classList.remove('show'); }
}

function switchTab(name){
currentTab = name;
if (name !== 'admin' && typeof stopAdminStatsLive === 'function'){
stopAdminStatsLive();
}
screenTimer.style.display = name === 'timer' ? '' : 'none';
screenShop.style.display = name === 'shop' ? 'block' : 'none';
screenProfile.style.display = name === 'profile' ? 'block' : 'none';
document.getElementById('screenAdmin').style.display = name === 'admin' ? 'block' : 'none';
document.getElementById('screenAuctions').style.display = name === 'auctions' ? 'block' : 'none';
document.getElementById('screenDeals').style.display = name === 'deals' ? 'block' : 'none';
document.getElementById('screenBuyRequests').style.display = name === 'buyRequests' ? 'block' : 'none';
tabTimerBtn.classList.toggle('active', name === 'timer');
tabShopBtn.classList.toggle('active', name === 'shop');
tabProfileBtn.classList.toggle('active', name === 'profile');
document.getElementById('tabAdminBtn').classList.toggle('active', name === 'admin');
document.getElementById('tabAuctionsBtn').classList.toggle('active', name === 'auctions');
// В каталоге лотов и в панели Admin нижняя навигация не нужна —
// там только кнопка «Назад». На остальных экранах навигация
// остаётся видимой как обычно.
document.getElementById('bottomNav').style.display = (name === 'shop' || name === 'admin' || name === 'deals' || name === 'buyRequests') ? 'none' : 'flex';
updateFabVisibility();
if (name === 'shop'){
loadMe();
loadSkins();
} else if (name === 'buyRequests'){
loadMyBuyRequests();
loadPublicBuyRequests();
} else if (name === 'profile'){
loadProfile();
} else if (name === 'deals'){
loadDeals();
loadTradeOffers();
} else if (name === 'admin'){
if (totp2faStatus.enabled_admin){
promptFor2faCode((I18N[currentLang] || I18N.ru).totp_prompt_admin_login).then(code => {
if (!code){ switchTab('shop'); return; }
fetch(API_BASE + '/api/2fa/verify', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData, code: code })
})
.then(r => { if (!r.ok) throw new Error('bad_code'); return r.json(); })
.then(() => loadAdminPanel())
.catch(() => {
showAlert('Неверный код.');
switchTab('shop');
});
});
} else {
loadAdminPanel();
}
} else if (name === 'auctions'){
loadAuctionsList();
}
}

// ============================================================
// АВАТАР В ХЭДЕРЕ — ВЫПАДАЮЩЕЕ МЕНЮ
// ============================================================

const headerAvatarBtn = document.getElementById('headerAvatarBtn');
const headerMenu = document.getElementById('headerMenu');

if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.photo_url){
headerAvatarBtn.innerHTML = `<img src="${tg.initDataUnsafe.user.photo_url}" alt="" style="width:100%; height:100%; object-fit:cover;">`;
}

headerAvatarBtn.addEventListener('click', (e) => {
e.stopPropagation();
headerMenu.style.display = (headerMenu.style.display === 'none') ? 'block' : 'none';
});

document.addEventListener('click', (e) => {
if (headerMenu.style.display === 'block' && !headerMenu.contains(e.target) && e.target !== headerAvatarBtn){
headerMenu.style.display = 'none';
}
});

headerMenu.addEventListener('click', (e) => {
const btn = e.target.closest('[data-header-action]');
if (!btn) return;
headerMenu.style.display = 'none';
const action = btn.dataset.headerAction;
if (action === 'profile' || action === 'balance'){
switchTab('profile');
} else if (action === 'history'){
switchTab('deals');
} else if (action === 'buyRequests'){
switchTab('buyRequests');
} else if (action === 'sell'){
switchTab('shop');
setTimeout(() => addSkinBtn.click(), 150);
} else if (action === 'support'){
const url = 'https://t.me/DGhostCountdownBot';
if (tg && tg.openTelegramLink){
tg.openTelegramLink(url);
} else if (tg && tg.openLink){
tg.openLink(url);
} else {
window.open(url, '_blank');
}
} else if (action === 'auctions'){
switchTab('auctions');
} else if (action === 'admin'){
switchTab('admin');
}
});

tabTimerBtn.addEventListener('click', () => switchTab('timer'));

// ============================================================
// ИСТОРИЯ НАВИГАЦИИ — «НАЗАД» ВЕДЁТ НА ПРЕДЫДУЩИЙ ЭКРАН,
// А НЕ СРАЗУ НА ГЛАВНЫЙ
// ============================================================

// ============================================================
// ФИКСИРОВАННАЯ ИЕРАРХИЯ ЭКРАНОВ
//
// Главный экран
//   └ Магазин / Профиль / Аукцион / Admin — «Назад» отсюда
//     всегда ведёт на главный экран (не по истории переходов)
//       └ (только внутри Магазина) категории → активные лоты —
//         «Назад» отсюда ведёт на экран категорий Магазина
// ============================================================

function displayScreen(name){
if (name === 'welcome'){
hideCategoryPicker();
hideWelcomeOverlay();
switchTab('shop');
} else if (name === 'categoryPicker'){
hideWelcomeOverlay();
showCategoryPicker();
} else {
hideWelcomeOverlay();
hideCategoryPicker();
switchTab(name);
}
}

function goToScreen(name){
displayScreen(name);
}

document.getElementById('tabShopBtn').addEventListener('click', () => goToScreen('shop'));
document.getElementById('tabProfileBtn').addEventListener('click', () => goToScreen('profile'));
document.getElementById('tabAdminBtn').addEventListener('click', () => goToScreen('admin'));
document.getElementById('tabAuctionsBtn').addEventListener('click', () => goToScreen('auctions'));

// Аватар Telegram-пользователя в нижней навигации, если доступен
if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.photo_url){
document.getElementById('navAvatarIcon').innerHTML =
`<img src="${tg.initDataUnsafe.user.photo_url}" alt="">`;
}

