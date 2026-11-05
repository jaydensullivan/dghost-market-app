// ============================================================
// ВЕБ-ВЕРСИЯ — ТОТ ЖЕ МИНИ-АПП В ОБЫЧНОМ БРАУЗЕРЕ
//
// Подключается сразу после telegram-web-app.js, до остальных модулей.
// Внутри Telegram (есть initData) ничего не делает. В браузере
// подменяет Telegram.WebApp своей заглушкой: вместо initData — токен
// сессии «web:<токен>», который бот выдаёт после входа через
// Telegram Login Widget (/api/web_login) или входа через Steam
// (/web/steam/start → ?dgw_code= → /api/web_steam_exchange). Бот принимает его везде,
// где принимает initData, поэтому остальной код не меняется.
// Без входа маркет сразу открыт как витрина; любое действие,
// которому нужен аккаунт, предлагает войти.
// ============================================================

(function(){
const real = window.Telegram && window.Telegram.WebApp;
if (real && real.initData) return;

const API = 'https://api.dghostmarket.uz';
const BOT_LOGIN = 'dghostmarketbot';
const KEY = 'dg_web_session';

let session = null;
try { session = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch(e) {}
if (!session || !session.token || !session.user) session = null;

const navLang = (navigator.language || '').slice(0, 2);
const lang = navLang === 'ru' ? 'ru' : (navLang === 'en' ? 'en' : 'uz');
const T = {
ru: {
title: 'DGhostMarket — маркет скинов CS2',
text: 'Войди через Steam или Telegram. Steam уже подтверждён в мини-аппе — откроется тот же аккаунт, баланс и сделки.',
steam: 'Войти через Steam',
or_tg: 'или через Telegram',
guest: 'Смотреть без входа',
need: 'Войти через Telegram',
failed: 'Не удалось войти. Попробуй ещё раз.',
ok: 'OK', cancel: 'Отмена',
note: 'Через Steam мы получаем только ник и аватар, через Telegram — имя и ID. Пароли и номер телефона не передаются.',
},
uz: {
title: 'DGhostMarket — CS2 skinlari bozori',
text: "Steam yoki Telegram orqali kiring. Steam mini-ilovada tasdiqlangan bo'lsa — o'sha akkaunt, balans va bitimlar ochiladi.",
steam: 'Steam orqali kirish',
or_tg: 'yoki Telegram orqali',
guest: "Kirmasdan ko'rish",
need: 'Telegram orqali kirish',
failed: "Kirib bo'lmadi. Qayta urinib ko'ring.",
ok: 'OK', cancel: 'Bekor qilish',
note: "Steam orqali faqat nik va avatar, Telegram orqali — ism va ID olinadi. Parol va telefon raqami berilmaydi.",
},
en: {
title: 'DGhostMarket — CS2 skin market',
text: 'Log in with Steam or Telegram. If your Steam is verified in the mini app, you get the same account, balance and deals.',
steam: 'Log in with Steam',
or_tg: 'or with Telegram',
guest: 'Browse without logging in',
need: 'Log in with Telegram',
failed: 'Login failed. Please try again.',
ok: 'OK', cancel: 'Cancel',
note: 'With Steam we only receive your nickname and avatar, with Telegram — your name and ID. No passwords or phone numbers are shared.',
},
}[lang];

const params = new URLSearchParams(location.search);
const startParam = params.get('startapp') || params.get('tgWebAppStartParam') || undefined;
const noop = function(){};

// ---------- окно вместо нативных showAlert / showConfirm / showPopup ----------

function popup(opts, cb){
const wrap = document.createElement('div');
wrap.className = 'dgw-modal';
const box = document.createElement('div');
box.className = 'dgw-modal-box';
if (opts.title){
const h = document.createElement('div');
h.className = 'dgw-modal-title';
h.textContent = opts.title;
box.appendChild(h);
}
const p = document.createElement('div');
p.className = 'dgw-modal-text';
p.textContent = opts.message || '';
box.appendChild(p);
const row = document.createElement('div');
row.className = 'dgw-modal-btns';
const buttons = (opts.buttons && opts.buttons.length) ? opts.buttons : [{ id: 'ok', type: 'ok' }];
buttons.forEach(b => {
const btn = document.createElement('button');
btn.type = 'button';
btn.className = 'dgw-btn' + (b.type === 'cancel' ? ' dgw-btn-ghost' : '') + (b.type === 'destructive' ? ' dgw-btn-danger' : '');
btn.textContent = b.text || (b.type === 'cancel' ? T.cancel : (b.type === 'close' ? T.cancel : T.ok));
btn.addEventListener('click', () => {
wrap.remove();
if (b.action) b.action();
if (cb) cb(b.id || '');
});
row.appendChild(btn);
});
box.appendChild(row);
wrap.appendChild(box);
document.body.appendChild(wrap);
}

const wa = {
initData: session ? 'web:' + session.token : '',
initDataUnsafe: { user: session ? session.user : undefined, start_param: startParam },
platform: 'web',
version: '6.0',
colorScheme: 'dark',
themeParams: {},
isExpanded: true,
isFullscreen: false,
// Нативные возможности новых версий Telegram (полный экран,
// вибрация, «поделиться») в браузере недоступны — код это проверяет.
isVersionAtLeast: function(){ return false; },
ready: noop, expand: noop, close: noop,
setHeaderColor: noop, setBackgroundColor: noop,
onEvent: noop, offEvent: noop,
BackButton: { isVisible: false, show: noop, hide: noop, onClick: noop, offClick: noop },
HapticFeedback: { impactOccurred: noop, notificationOccurred: noop, selectionChanged: noop },
showAlert: function(message, cb){
// Гостю на «нужно войти» сразу предлагаем кнопку входа.
if (!session){
popup({ message: message, buttons: [
{ id: 'login', text: T.need, action: openGate },
{ id: 'ok', type: 'cancel', text: T.ok },
] }, () => { if (cb) cb(); });
return;
}
popup({ message: message }, () => { if (cb) cb(); });
},
showConfirm: function(message, cb){
popup({ message: message, buttons: [
{ id: 'ok', type: 'ok' },
{ id: 'cancel', type: 'cancel' },
] }, id => { if (cb) cb(id === 'ok'); });
},
showPopup: function(opts, cb){ popup(opts || {}, cb); },
openLink: function(url){ window.open(url, '_blank', 'noopener'); },
openTelegramLink: function(url){ window.open(url, '_blank', 'noopener'); },
};
window.Telegram = { WebApp: wa };
window.DG_WEB = { loggedIn: !!session, user: session ? session.user : null };

// ---------- вход ----------

function saveSession(data){
if (!data || !data.session) throw new Error('no session');
try { localStorage.setItem(KEY, JSON.stringify({ token: data.session, user: data.user })); } catch(e) {}
}

// Вернулись со Steam: одноразовый код → сессия. Код убираем из адреса
// сразу, чтобы он не остался в истории браузера.
const steamCode = params.get('dgw_code');
if (steamCode){
params.delete('dgw_code');
const clean = location.pathname + (params.toString() ? '?' + params : '') + location.hash;
try { history.replaceState(null, '', clean); } catch(e) {}
fetch(API + '/api/web_steam_exchange', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ code: steamCode }),
})
.then(r => r.ok ? r.json() : Promise.reject(r.status))
.then(data => { saveSession(data); location.reload(); })
.catch(() => { document.addEventListener('DOMContentLoaded', () => { openGate(); const st = document.querySelector('.dgw-gate-status'); if (st) st.textContent = T.failed; }); });
}

function steamLogin(){
location.href = API + '/web/steam/start?return=' + encodeURIComponent(location.origin + location.pathname);
}

window.dgWebOnAuth = function(user){
const fd = new FormData();
Object.keys(user || {}).forEach(k => { if (user[k] != null) fd.append(k, String(user[k])); });
fetch(API + '/api/web_login', { method: 'POST', body: fd })
.then(r => r.ok ? r.json() : Promise.reject(r.status))
.then(data => { saveSession(data); location.reload(); })
.catch(() => {
const st = document.querySelector('.dgw-gate-status');
if (st) st.textContent = T.failed;
});
};

window.dgWebLogout = function(){
const token = session && session.token;
try { localStorage.removeItem(KEY); } catch(e) {}
const done = () => location.reload();
if (!token){ done(); return; }
fetch(API + '/api/web_logout', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: 'web:' + token }),
}).then(done, done);
};

function openGate(){
if (document.querySelector('.dgw-gate')) return;
const gate = document.createElement('div');
gate.className = 'dgw-gate';
gate.innerHTML =
'<div class="dgw-gate-box">'
+ '<img class="dgw-gate-logo" src="logo.webp" alt="">'
+ '<div class="dgw-gate-title"></div>'
+ '<div class="dgw-gate-text"></div>'
+ '<button type="button" class="dgw-btn dgw-btn-steam"><span></span></button>'
+ '<div class="dgw-gate-or"></div>'
+ '<div class="dgw-gate-widget"></div>'
+ '<div class="dgw-gate-status"></div>'
+ '<button type="button" class="dgw-btn dgw-btn-ghost dgw-gate-guest"></button>'
+ '<div class="dgw-gate-note"></div>'
+ '</div>';
gate.querySelector('.dgw-gate-title').textContent = T.title;
gate.querySelector('.dgw-gate-text').textContent = T.text;
gate.querySelector('.dgw-btn-steam span').textContent = T.steam;
gate.querySelector('.dgw-btn-steam').addEventListener('click', steamLogin);
gate.querySelector('.dgw-gate-or').textContent = T.or_tg;
gate.querySelector('.dgw-gate-guest').textContent = T.guest;
gate.querySelector('.dgw-gate-note').textContent = T.note;
gate.querySelector('.dgw-gate-guest').addEventListener('click', () => gate.remove());
const s = document.createElement('script');
s.async = true;
s.src = 'https://telegram.org/js/telegram-widget.js?22';
s.setAttribute('data-telegram-login', BOT_LOGIN);
s.setAttribute('data-size', 'large');
s.setAttribute('data-radius', '12');
s.setAttribute('data-request-access', 'write');
s.setAttribute('data-onauth', 'dgWebOnAuth(user)');
gate.querySelector('.dgw-gate-widget').appendChild(s);
document.body.appendChild(gate);
}
window.dgWebLogin = openGate;

const GUEST_GATED = [
'#buyOpenPayBtn', '#buyMakeOfferBtn', '#buyMakeTradeBtn', '#buyWatchBtn',
'#skinsList [data-fav]', '#cartCheckoutBtn', '#tabDealsBtn', '#tabLotsBtn',
].join(',');

document.addEventListener('DOMContentLoaded', () => {
document.documentElement.classList.add('dg-web', session ? 'dg-web-in' : 'dg-web-guest');
// Витрину гость видит сразу, без экрана входа. Вход просим только
// там, где нужен аккаунт: покупка, «Хочу», предложение цены, сделки,
// продажа. Сервер всё равно проверяет сессию в каждом таком запросе.
if (!session){
document.addEventListener('click', (e) => {
const t = e.target.closest && e.target.closest(GUEST_GATED);
if (!t) return;
e.preventDefault();
e.stopImmediatePropagation();
openGate();
}, true);
}
const inBtn = document.getElementById('webLoginBtn');
if (inBtn) inBtn.addEventListener('click', openGate);
const outBtn = document.getElementById('webLogoutBtn');
if (outBtn) outBtn.addEventListener('click', () => {
wa.showConfirm(outBtn.textContent.trim() + '?', ok => { if (ok) window.dgWebLogout(); });
});
});
})();
