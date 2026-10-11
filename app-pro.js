// ============================================================
// ПОДПИСКА PRO
//
// Бесплатно — «Поделиться» картинкой. С PRO — GIF и видео (3D-ролики
// лота) и публикация своего лота в канал маркета. Оплата — с баланса
// (/api/pro/buy). Карточка — в профиле; замки — в окне «Поделиться»
// (app-filters.js спрашивает isProActive / offerPro).
// ============================================================

let proStatus = null;

function isProActive(){
return !!(proStatus && proStatus.active);
}

function proDateText(iso){
if (!iso) return '';
const d = new Date(iso);
return d.toLocaleDateString(currentLang === 'en' ? 'en-GB' : 'ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function renderProCard(){
const card = document.getElementById('profileProCard');
if (!card) return;
const dict = I18N[currentLang] || I18N.ru;
if (!proStatus){
card.style.display = 'none';
return;
}
card.style.display = '';
const badge = document.getElementById('proBadge');
const status = document.getElementById('proStatusText');
const btn = document.getElementById('proBuyBtn');
const price = formatCoins(proStatus.price);
if (proStatus.admin){
badge.textContent = dict.pro_badge_on;
status.textContent = dict.pro_status_admin;
btn.style.display = 'none';
return;
}
btn.style.display = '';
if (proStatus.active){
badge.textContent = dict.pro_badge_on;
status.textContent = dict.pro_status_until.replace('{date}', proDateText(proStatus.expires_at));
btn.textContent = dict.pro_btn_extend.replace('{price}', price).replace('{days}', proStatus.days);
} else {
badge.textContent = '';
status.textContent = dict.pro_status_off.replace('{price}', price).replace('{days}', proStatus.days);
btn.textContent = dict.pro_btn_buy.replace('{price}', price).replace('{days}', proStatus.days);
}
}

function loadProStatus(){
if (!tg || !tg.initData) return Promise.resolve(null);
return fetch(API_BASE + '/api/pro?init_data=' + encodeURIComponent(tg.initData))
.then(r => r.ok ? r.json() : null)
.then(data => {
if (data && !data.error){
proStatus = data;
renderProCard();
}
return proStatus;
})
.catch(() => null);
}

let proBuying = false;

function buyPro(){
if (proBuying || !proStatus) return;
const dict = I18N[currentLang] || I18N.ru;
const price = formatCoins(proStatus.price);
const ask = dict.pro_confirm.replace('{price}', price).replace('{days}', proStatus.days);
showConfirmDialog(ask, () => {
proBuying = true;
fetch(API_BASE + '/api/pro/buy', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData }),
})
.then(async r => {
const data = await r.json().catch(() => ({}));
if (!r.ok){
showAlert(data.error === 'insufficient_funds'
? dict.pro_no_money.replace('{price}', price)
: errorMessage(data.error));
return;
}
proStatus = data;
renderProCard();
if (typeof loadMe === 'function') loadMe();
showAlert(dict.pro_ok.replace('{date}', proDateText(data.expires_at)));
})
.catch(() => showAlert(errorMessage('network')))
.finally(() => { proBuying = false; });
});
}

// Окно подтверждения: нативное в Telegram, своё — в браузере (app-web.js).
function showConfirmDialog(message, onOk){
if (tg && tg.showConfirm){
try {
tg.showConfirm(message, ok => { if (ok) onOk(); });
return;
} catch (e) {}
}
if (window.confirm(message)) onOk();
}

// Предложение PRO из окна «Поделиться» (замок на GIF / видео / канале).
function offerPro(statusEl, buttonEl){
const dict = I18N[currentLang] || I18N.ru;
const price = proStatus ? formatCoins(proStatus.price) : '';
if (statusEl) statusEl.textContent = dict.pro_locked.replace('{price}', price);
if (buttonEl) buttonEl.style.display = '';
}

document.getElementById('proBuyBtn').addEventListener('click', buyPro);

// Смена языка — перерисовать карточку (тексты в ней собираются из шаблонов).
const proBaseApplyTranslations = applyTranslations;
applyTranslations = function(){
proBaseApplyTranslations.apply(this, arguments);
renderProCard();
};

loadProStatus();
