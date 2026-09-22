const tg = window.Telegram ? window.Telegram.WebApp : null;

function applyTelegramTheme(){
const isLight = tg && tg.colorScheme === 'light';
document.body.classList.toggle('theme-light', isLight);
if (tg){
try { tg.setBackgroundColor(isLight ? '#f6f3fa' : '#000000'); } catch(e) {}
try { tg.setHeaderColor(isLight ? '#f6f3fa' : '#000000'); } catch(e) {}
}
}

if (tg) {
tg.ready();
tg.expand();
applyTelegramTheme();
tg.onEvent('themeChanged', applyTelegramTheme);
}

// ---- read data ----
const params = new URLSearchParams(window.location.search);

const startParam =
(tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) ||
params.get('tgWebAppStartParam') ||
params.get('end_time');

const title = params.get('title');
const subtitle = params.get('subtitle');
const prize = params.get('prize');
const joinUrl = params.get('join_url') || 'https://t.me/JaydenSullivan';

const COIN_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="vertical-align:-2px"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5c0-1 1-1.8 2.5-1.8s2.5.7 2.5 1.7c0 2.3-5 1.3-5 3.6 0 1 1 1.8 2.5 1.8s2.5-.8 2.5-1.8"/></svg>';
const LOCK_ICON = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="vertical-align:-1px"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const TARGET_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>';

function showPlaceholderIcon(img){
const div = document.createElement('div');
div.className = 'skin-photo placeholder';
div.innerHTML = TARGET_ICON;
img.replaceWith(div);
}

if (title){
document.getElementById('title').textContent = title;
document.getElementById('title').setAttribute('data-text', title);
}
if (subtitle) document.getElementById('subtitle').textContent = subtitle;
if (prize) document.getElementById('prize').innerHTML = COIN_ICON + ' <b>' + prize + '</b>';

let endTime = startParam ? parseInt(startParam, 10) * 1000 : (Date.now() + 10 * 60 * 1000);
let totalDuration = Math.max(1, endTime - Date.now());

// Адрес бота на Railway — сюда мини-апп ходит за живыми данными
// розыгрыша и сюда же сохраняет правки из формы редактирования.
const API_BASE = 'https://api.dghostmarket.com';
const BID_BOT_URL_JS = 'https://t.me/dghostmarketbot';
const MINI_APP_LINK_BASE = 'https://t.me/dghostmarketbot/DGhost';

// ============================================================
// ЛОГОТИП В УГЛУ — РУЧНАЯ ФИКСАЦИЯ ПРИ СКРОЛЛЕ
//
// Внутри Telegram (особенно на iOS) position:fixed иногда
// считается не от видимого экрана, а от всей высоты страницы —
// из-за этого значок "уезжал" вниз при прокрутке. Держим его
// на месте вручную через scroll-listener вместо того, чтобы
// полагаться на CSS fixed.
// ============================================================

window.addEventListener('resize', () => {
const wo = document.getElementById('welcomeOverlay');
if (wo && wo.classList.contains('show')){
wo.style.height = window.innerHeight + 'px';
}
const cp = document.getElementById('categoryPickerScreen');
if (cp && cp.classList.contains('show')){
cp.style.height = window.innerHeight + 'px';
}
});

