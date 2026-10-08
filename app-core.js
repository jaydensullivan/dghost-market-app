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

const COIN_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="vertical-align:-2px"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5c0-1 1-1.8 2.5-1.8s2.5.7 2.5 1.7c0 2.3-5 1.3-5 3.6 0 1 1 1.8 2.5 1.8s2.5-.8 2.5-1.8"/></svg>';
const LOCK_ICON = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="vertical-align:-1px"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const TARGET_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>';

function showPlaceholderIcon(img){
const div = document.createElement('div');
div.className = 'skin-photo placeholder';
div.innerHTML = TARGET_ICON;
img.replaceWith(div);
}

// Адрес бота на Railway — сюда мини-апп ходит за живыми данными
// розыгрыша и сюда же сохраняет правки из формы редактирования.
const API_BASE = 'https://api.dghostmarket.com';
const BID_BOT_URL_JS = 'https://t.me/dghostmarketbot';
const MINI_APP_LINK_BASE = 'https://t.me/dghostmarketbot/DGhost';



// Пока открыто любое окно, кнопки шапки прячутся (см. body.modal-open
// в app.css). Следим за классом show у всех окон.
(function watchModals(){
const selector = '.buy-overlay, .edit-overlay';
const update = () => {
document.body.classList.toggle('modal-open',
!!document.querySelector('.buy-overlay.show, .edit-overlay.show'));
};
const observer = new MutationObserver(update);
const attach = () => {
document.querySelectorAll(selector).forEach(el => {
observer.observe(el, { attributes: true, attributeFilter: ['class'] });
});
update();
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
else attach();
})();

// Float предмета показываем так же, как Steam («Wear Rating»): в игре
// это число одинарной точности, и Steam выводит его с 9 значащими
// цифрами — 0.127000004. Сервисы инвентаря отдают его округлённым
// (0.127), поэтому сначала восстанавливаем точное значение через
// Math.fround, потом печатаем 9 цифр без хвостовых нулей.
function formatFloat(value){
const n = Math.fround(Number(value));
if (!isFinite(n)) return '';
if (n === 0) return '0';
let s = n.toPrecision(9);
if (s.indexOf('e') !== -1){
const exp = Math.floor(Math.log10(Math.abs(n)));
s = n.toFixed(Math.min(20, 8 - exp));
}
if (s.indexOf('.') !== -1) s = s.replace(/0+$/, '').replace(/\.$/, '');
return s;
}

// ---------- устройство (антифрод раздачи) ----------
// Бот ищет твинков — вторые аккаунты Telegram того же человека — по
// устройству. device_id — случайный id в localStorage (несколько
// аккаунтов на одном телефоне его делят), fp — хеш характеристик
// устройства. Ничего личного: ни контактов, ни геолокации.
function dgDeviceId(){
try {
let id = localStorage.getItem('dg_device_id');
if (!id){
id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
localStorage.setItem('dg_device_id', id);
}
return id;
} catch (e) { return null; }
}

async function dgFingerprint(){
const parts = [
navigator.userAgent, navigator.platform, (navigator.languages || []).join(','),
Intl.DateTimeFormat().resolvedOptions().timeZone,
screen.width + 'x' + screen.height + 'x' + screen.colorDepth, window.devicePixelRatio,
navigator.hardwareConcurrency, navigator.deviceMemory, navigator.maxTouchPoints,
tg ? tg.platform : '',
];
try {
const gl = document.createElement('canvas').getContext('webgl');
const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
if (ext) parts.push(gl.getParameter(ext.UNMASKED_VENDOR_WEBGL), gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
} catch (e) {}
try {
const c = document.createElement('canvas');
c.width = 200; c.height = 40;
const ctx = c.getContext('2d');
ctx.font = '16px Arial'; ctx.fillStyle = '#7B2CFF'; ctx.fillText('DGhost ✓ 2026', 4, 24);
parts.push(c.toDataURL());
} catch (e) {}
const text = parts.join('|');
if (window.crypto && crypto.subtle){
const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
return null;
}

const dgDevicePromise = (async () => {
const device_id = dgDeviceId();
let fp = null;
try { fp = await dgFingerprint(); } catch (e) {}
return device_id ? { device_id, fp } : {};
})();

dgDevicePromise.then(dev => {
if (!dev.device_id || !tg || !tg.initData) return;
fetch(API_BASE + '/api/device', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(Object.assign({ init_data: tg.initData }, dev)),
}).catch(() => {});
});

// Общая для всех файлов (app-core грузится первым). Экранирует и для текста, и для атрибутов: кавычки тоже — иначе
// значение в src="…"/title="…" могло выйти из атрибута (XSS).
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(str){
return (str == null ? '' : String(str)).replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]);
}

// Листы (.edit-overlay): тап по затемнённому фону закрывает лист тем же
// путём, что и его кнопка «Закрыть»/«Отмена». Только если и нажатие, и
// отпускание были на фоне (прокрутка внутри листа с отпусканием снаружи
// не считается), и только у листов без полей ввода — чтобы случайный
// тап не стёр заполненную форму.
(function(){
let downOnBackdrop = null;
document.addEventListener('pointerdown', (e) => {
downOnBackdrop = e.target.classList && e.target.classList.contains('edit-overlay') ? e.target : null;
}, true);
document.addEventListener('click', (e) => {
const overlay = e.target;
if (!overlay.classList || !overlay.classList.contains('edit-overlay') || overlay !== downOnBackdrop) return;
downOnBackdrop = null;
if (overlay.querySelector('input:not([type=hidden]), textarea, select')) return;
const buttons = overlay.querySelectorAll('[id$="CloseBtn"], [id$="CancelBtn"], [id$="Cancel"]');
const close = buttons[buttons.length - 1];
if (close && close.offsetParent !== null) close.click();
});
})();
