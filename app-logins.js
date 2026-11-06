// ============================================================
// ПРОФИЛЬ: СПОСОБЫ ВХОДА — TELEGRAM, STEAM, ПОЧТА
//
// Карточка над карточкой Steam. Показывает, что подключено к аккаунту
// (GET /api/account/logins), и даёт подключить недостающее:
//   почта    — код на почту: /api/account/email/start → /verify;
//   Steam    — та же кнопка входа Steam, что в карточке Steam ниже;
//   Telegram — только на сайте у аккаунта без Telegram: виджет входа
//              Telegram → /api/account/telegram. Аккаунт с сайта должен
//              быть пустым — тогда почта и Steam переходят на аккаунт
//              Telegram, и сайт дальше работает уже с ним.
// ============================================================

(function(){
const card = document.createElement('div');
card.className = 'pf-card lg-card';
card.id = 'profileLoginsSection';
card.innerHTML =
'<div class="pf-card-head">'
+ '<div class="pf-ico blue"><svg class="gi" width="24" height="24" aria-hidden="true"><use href="#gi-check"/></svg></div>'
+ '<div class="pf-card-title"><div class="pf-title" data-i18n="lg_title"></div>'
+ '<div class="lg-sub" data-i18n="lg_sub"></div></div>'
+ '</div>'
+ '<div class="lg-rows">'
+ '<div class="lg-row" data-lg="telegram"><div class="lg-name">Telegram</div><div class="lg-val"></div><div class="lg-act"></div></div>'
+ '<div class="lg-row" data-lg="steam"><div class="lg-name">Steam</div><div class="lg-val"></div><div class="lg-act"></div></div>'
+ '<div class="lg-row" data-lg="email"><div class="lg-name" data-i18n="lg_email"></div><div class="lg-val"></div><div class="lg-act"></div></div>'
+ '</div>'
+ '<div class="lg-form" hidden>'
+ '<input type="email" class="lg-input lg-email" autocomplete="email" inputmode="email">'
+ '<input type="text" class="lg-input lg-code" autocomplete="one-time-code" inputmode="numeric" maxlength="6" hidden>'
+ '<div class="pf-btn-row"><button type="button" class="pf-btn lg-send"></button><button type="button" class="pf-btn lg-cancel"></button></div>'
+ '</div>'
+ '<div class="lg-tg" hidden></div>'
+ '<div class="edit-status lg-status"></div>';

const anchor = document.getElementById('profileSteamSection');
if (!anchor) return;
anchor.parentNode.insertBefore(card, anchor);

const $ = s => card.querySelector(s);
const tg = window.Telegram && window.Telegram.WebApp;
const d = () => I18N[currentLang] || I18N.ru;
let state = null;
let loading = false;
let emailStep = 'email';

function label(){
const dict = d();
card.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = dict[el.dataset.i18n] || ''; });
$('.lg-email').placeholder = dict.lg_email_ph;
$('.lg-code').placeholder = dict.lg_code_ph;
$('.lg-cancel').textContent = dict.lg_cancel;
$('.lg-send').textContent = emailStep === 'code' ? dict.lg_confirm : dict.lg_send_code;
}

function setStatus(text, ok){
const st = $('.lg-status');
st.textContent = text || '';
st.classList.toggle('ok', !!ok);
}

function row(name, value, action){
const r = card.querySelector('[data-lg="' + name + '"]');
const dict = d();
const val = r.querySelector('.lg-val');
val.textContent = value || dict.lg_none;
val.classList.toggle('on', !!value);
const act = r.querySelector('.lg-act');
act.innerHTML = '';
if (action){
const b = document.createElement('button');
b.type = 'button';
b.className = 'pf-btn lg-btn';
b.textContent = dict.lg_connect;
b.addEventListener('click', action);
act.appendChild(b);
}
}

function render(){
if (!state) return;
const dict = d();
const tgOn = state.telegram ? (state.telegram.username ? '@' + state.telegram.username : dict.lg_connected) : '';
// Подключить Telegram можно только на сайте: в мини-аппе он уже есть.
row('telegram', tgOn, (!state.telegram && window.DG_WEB) ? openTelegram : null);
row('steam', state.steam ? (state.steam.persona || dict.lg_connected) : '', state.steam ? null : () => {
const btn = document.getElementById('steamLoginBtn');
if (btn) btn.click();
});
row('email', state.email || '', state.email ? null : openEmail);
label();
}

function load(){
if (loading || !tg || !tg.initData) return;
loading = true;
fetch(API_BASE + '/api/account/logins?init_data=' + encodeURIComponent(tg.initData))
.then(r => r.ok ? r.json() : Promise.reject(r.status))
.then(data => { state = data; render(); })
.catch(() => {})
.finally(() => { loading = false; });
}

function errText(code){
const dict = d();
return dict['lg_err_' + code] || dict.err_something_wrong;
}

function post(path, body){
return fetch(API_BASE + path, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(Object.assign({ init_data: tg.initData, lang: currentLang }, body)),
}).then(r => r.json().catch(() => ({})).then(data => (r.ok ? data : Promise.reject(data.error || 'error'))),
e => Promise.reject(typeof e === 'string' ? e : 'network'));
}

// ---------- почта ----------

function openEmail(){
emailStep = 'email';
$('.lg-form').hidden = false;
$('.lg-tg').hidden = true;
$('.lg-email').disabled = false;
$('.lg-code').hidden = true;
$('.lg-code').value = '';
setStatus('');
label();
$('.lg-email').focus();
}

function closeEmail(){
$('.lg-form').hidden = true;
setStatus('');
}

function sendEmail(){
const dict = d();
const email = $('.lg-email').value.trim();
if (emailStep === 'email'){
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ setStatus(dict.lg_err_bad_email); return; }
$('.lg-send').disabled = true;
setStatus(dict.lg_sending);
post('/api/account/email/start', { email: email })
.then(() => {
emailStep = 'code';
$('.lg-email').disabled = true;
$('.lg-code').hidden = false;
$('.lg-code').focus();
setStatus(dict.lg_code_sent.replace('{email}', email), true);
label();
})
.catch(code => setStatus(errText(code)))
.finally(() => { $('.lg-send').disabled = false; });
return;
}
const code = $('.lg-code').value.replace(/\D/g, '');
if (code.length !== 6){ setStatus(dict.lg_err_bad_code); return; }
$('.lg-send').disabled = true;
post('/api/account/email/verify', { email: email, code: code })
.then(data => {
state = data;
closeEmail();
render();
setStatus(dict.lg_email_ok, true);
})
.catch(c => setStatus(errText(c)))
.finally(() => { $('.lg-send').disabled = false; });
}

$('.lg-send').addEventListener('click', sendEmail);
$('.lg-cancel').addEventListener('click', closeEmail);
$('.lg-code').addEventListener('keydown', e => { if (e.key === 'Enter') sendEmail(); });
$('.lg-email').addEventListener('keydown', e => { if (e.key === 'Enter') sendEmail(); });

// ---------- Telegram (только сайт) ----------

function openTelegram(){
const box = $('.lg-tg');
$('.lg-form').hidden = true;
box.hidden = false;
setStatus(d().lg_tg_hint);
if (box.querySelector('script')) return;
const s = document.createElement('script');
s.async = true;
s.src = 'https://telegram.org/js/telegram-widget.js?22';
s.setAttribute('data-telegram-login', 'dghostmarketbot');
s.setAttribute('data-size', 'large');
s.setAttribute('data-radius', '12');
s.setAttribute('data-request-access', 'write');
s.setAttribute('data-onauth', 'dgLinkTelegram(user)');
box.appendChild(s);
}

window.dgLinkTelegram = function(user){
post('/api/account/telegram', { telegram: user })
.then(data => {
// Дальше сайт работает с аккаунтом Telegram — новая сессия.
if (typeof window.dgWebSetSession === 'function') window.dgWebSetSession(data);
})
.catch(code => setStatus(errText(code)));
};

// ---------- когда грузить ----------

new MutationObserver(() => {
if (document.body.dataset.tab === 'profile') load();
}).observe(document.body, { attributes: true, attributeFilter: ['data-tab'] });
// Вернулись со Steam или сменили язык — обновить.
window.addEventListener('focus', () => { if (document.body.dataset.tab === 'profile') { state = null; load(); } });
window.renderLoginMethods = render;
if (document.body.dataset.tab === 'profile') load();
})();
