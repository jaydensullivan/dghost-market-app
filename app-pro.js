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
renderProChannels();
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

// ------------------------------------------------------------
// PRO: СВОИ КАНАЛЫ ПРОДАВЦА
//
// В карточке PRO — список подключённых каналов и поле «@канал».
// Бот должен быть админом канала (сервер это проверяет). В окне
// «Поделиться» своего лота — кнопка «📢 В <канал>» на каждый канал.
// ------------------------------------------------------------

let proChannels = [];
let proBotUsername = 'dghostmarketbot';
let proChannelMax = 5;

function proOwnChannel(id){
return proChannels.find(c => c.id === id) || null;
}

function proChannelName(ch){
return ch.username ? '@' + ch.username : (ch.title || String(ch.chat_id));
}

function proChannelError(data){
const dict = I18N[currentLang] || I18N.ru;
const map = {
channel_bad_ref: dict.pro_ch_err_bad,
channel_not_found: dict.pro_ch_err_not_found,
channel_not_owner: dict.pro_ch_err_owner,
channel_bot_not_admin: dict.pro_ch_err_bot,
channel_limit: dict.pro_ch_err_limit,
};
const text = map[data && data.error];
if (!text) return errorMessage(data && data.error);
return text.replace('{bot}', (data && data.bot_username) || proBotUsername).replace('{n}', (data && data.max) || proChannelMax);
}

function applyProChannelsData(data){
if (!data || !Array.isArray(data.items)) return;
proChannels = data.items;
if (data.bot_username) proBotUsername = data.bot_username;
if (data.max) proChannelMax = data.max;
renderProChannels();
}

function renderProChannels(){
const box = document.getElementById('proChannels');
if (!box) return;
const dict = I18N[currentLang] || I18N.ru;
// Блок виден с активным PRO (или если каналы уже подключены).
const show = !!(proStatus && (proStatus.active || proChannels.length));
box.style.display = show ? '' : 'none';
if (!show) return;
document.getElementById('proChannelsHint').textContent = dict.pro_ch_hint.replace('{bot}', proBotUsername);
document.getElementById('proChannelInput').placeholder = dict.pro_ch_ph;
const list = document.getElementById('proChannelsList');
list.innerHTML = proChannels.length
? proChannels.map(c => `<div class="pro-channel-row"><span>${escapeHtml(c.title || '')} <b>${escapeHtml(proChannelName(c))}</b></span><button type="button" data-pro-ch-remove="${c.id}">✕</button></div>`).join('')
: `<div class="pro-channels-empty">${escapeHtml(dict.pro_ch_empty)}</div>`;
}

function loadProChannels(){
if (!tg || !tg.initData) return;
fetch(API_BASE + '/api/pro/channels?init_data=' + encodeURIComponent(tg.initData))
.then(r => r.ok ? r.json() : null)
.then(applyProChannelsData)
.catch(() => {});
}

function postProChannels(payload){
return fetch(API_BASE + '/api/pro/channels', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(Object.assign({ init_data: tg.initData }, payload)),
}).then(async r => {
const data = await r.json().catch(() => ({}));
if (!r.ok) throw data;
applyProChannelsData(data);
return data;
});
}

document.getElementById('proChannelAddBtn').addEventListener('click', () => {
const dict = I18N[currentLang] || I18N.ru;
const input = document.getElementById('proChannelInput');
const status = document.getElementById('proChannelsStatus');
const btn = document.getElementById('proChannelAddBtn');
const value = input.value.trim();
if (!value || !tg || !tg.initData) return;
btn.disabled = true;
status.textContent = '...';
postProChannels({ channel: value })
.then(() => { input.value = ''; status.textContent = dict.pro_ch_added; })
.catch(data => {
status.textContent = data && data.error === 'pro_required' ? dict.pro_locked.replace('{price}', '') : proChannelError(data);
})
.finally(() => { btn.disabled = false; });
});

document.getElementById('proChannelsList').addEventListener('click', (e) => {
const btn = e.target.closest('[data-pro-ch-remove]');
if (!btn) return;
btn.disabled = true;
postProChannels({ remove: Number(btn.dataset.proChRemove) })
.catch(data => { document.getElementById('proChannelsStatus').textContent = proChannelError(data); });
});

// Окно «Поделиться» своего лота: кнопка на каждый свой канал.
function renderShareOwnChannels(show, pro){
const box = document.getElementById('shareOwnChannels');
if (!box) return;
const dict = I18N[currentLang] || I18N.ru;
if (!show || !proChannels.length){
box.innerHTML = '';
return;
}
box.innerHTML = proChannels.map(c =>
`<button type="button" class="save${pro ? '' : ' pro-locked'}" data-share-own-ch="${c.id}">${escapeHtml(dict.pro_ch_btn.replace('{name}', proChannelName(c)))}</button>`
).join('');
}

document.getElementById('shareOwnChannels').addEventListener('click', (e) => {
const btn = e.target.closest('[data-share-own-ch]');
if (!btn || shareBusy || !shareSkin) return;
const dict = I18N[currentLang] || I18N.ru;
if (!isProActive()){
offerPro(shareStatus, document.getElementById('shareProBtn'));
return;
}
const ch = proOwnChannel(Number(btn.dataset.shareOwnCh));
if (!ch) return;
shareTarget = 'own:' + ch.id;
document.getElementById('shareSendBtn').style.display = 'none';
shareStatus.textContent = dict.pro_ch_pick.replace('{name}', proChannelName(ch));
});

// Смена языка — перерисовать карточку (тексты в ней собираются из шаблонов).
const proBaseApplyTranslations = applyTranslations;
applyTranslations = function(){
proBaseApplyTranslations.apply(this, arguments);
renderProCard();
renderProChannels();
};

loadProStatus().then(() => {
renderProChannels();
loadProChannels();
});
