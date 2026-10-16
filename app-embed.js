// 3D-виджет для чужих сайтов (embed.html). Параметры адреса:
//   key   — ключ клиента (выдаёт админ командой /embed_new в боте);
//   skin  — название скина: «AK-47 | Redline» или полное
//           «StatTrak™ AK-47 | Redline (Field-Tested)»;
//   float — износ 0…1, seed — паттерн 0…1000 (необязательно);
//   paint — номер раскраски (paint_index), если название неоднозначно;
//   lang  — ru | uz | en (по умолчанию en), bg — фон (как в мини-аппе);
//   ticket — пропуск от бота для открытия виджета в отдельной вкладке
//           («во весь экран» на iPhone, где iframe развернуть нельзя).
// Ключ и сайт, на котором стоит виджет, проверяет бот
// (/api/embed/session) — он же считает показы по тарифу.
(function(){
const q = new URLSearchParams(location.search);
const key = (q.get('key') || '').trim();
const skinName = (q.get('skin') || '').trim();
const floatValue = Math.min(1, Math.max(0, Number(q.get('float')) || 0));
const seedRaw = q.get('seed');
const paint = q.get('paint');
const lang = ['ru', 'uz', 'en'].includes(q.get('lang')) ? q.get('lang') : 'en';
const ticket = (q.get('ticket') || '').trim();

const MSG = {
ru: { no_skin: 'Не указан скин.', no_key: 'Не указан ключ виджета.', denied: 'Виджет не подключён для этого сайта.', limit: 'Лимит показов пробного периода исчерпан.', no_model: 'Для этого скина 3D пока нет.', blocked: 'Ключ отключён.' },
uz: { no_skin: 'Skin ko‘rsatilmagan.', no_key: 'Vidjet kaliti ko‘rsatilmagan.', denied: 'Vidjet bu sayt uchun ulanmagan.', limit: 'Sinov muddatidagi ko‘rsatuvlar limiti tugadi.', no_model: 'Bu skin uchun 3D hozircha yo‘q.', blocked: 'Kalit o‘chirilgan.' },
en: { no_skin: 'No skin specified.', no_key: 'No widget key specified.', denied: 'The widget is not enabled for this website.', limit: 'Trial view limit reached.', no_model: '3D is not available for this skin yet.', blocked: 'This key is disabled.' },
}[lang];

// Сайт, на котором стоит виджет. Браузер сам сообщает адрес страницы-
// родителя (ancestorOrigins или Referer iframe) — подделать его со
// страницы клиента нельзя. Открыт напрямую, не в iframe, — «direct».
function hostOrigin(){
if (window.top === window) return 'direct';
try {
if (location.ancestorOrigins && location.ancestorOrigins.length) return location.ancestorOrigins[0];
} catch (e) {}
try { return document.referrer ? new URL(document.referrer).origin : ''; } catch (e) { return ''; }
}

function post(event, extra){
try { window.parent.postMessage(Object.assign({ source: 'dghost3d', event: event }, extra || {}), '*'); } catch (e) {}
}

function fail(text, code){
const box = document.getElementById('embedMsg');
box.textContent = text;
box.hidden = false;
document.getElementById('viewer3dOverlay').classList.remove('show');
post('error', { code: code });
}

// «Во весь экран». Где браузер умеет разворачивать iframe (Android,
// компьютер, iPad) — Fullscreen API. На iPhone так нельзя — открываем
// виджет в новой вкладке с пропуском (ticket) от бота: прямое открытие
// без пропуска бот не пускает, чтобы ключ не тратили с чужих страниц.
function setupFullscreen(newTicket){
const old = document.getElementById('viewer3dFullBtn');
if (!old) return;
// Обработчик мини-аппа (переключает раскладку листа) виджету не нужен.
const btn = old.cloneNode(true);
old.replaceWith(btn);
const root = document.documentElement;
const canFs = document.fullscreenEnabled || document.webkitFullscreenEnabled;
const inTab = window.top === window;
if (!canFs && (inTab || !newTicket)){ document.body.classList.add('no-fs'); return; }
const isFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
const sync = () => document.body.classList.toggle('fs', isFs());
document.addEventListener('fullscreenchange', sync);
document.addEventListener('webkitfullscreenchange', sync);
btn.addEventListener('click', () => {
if (canFs){
if (isFs()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
else {
const req = root.requestFullscreen || root.webkitRequestFullscreen;
const p = req && req.call(root);
if (p && p.catch) p.catch(() => {});
}
return;
}
const url = new URL(location.href);
url.searchParams.set('ticket', newTicket);
window.open(url.toString(), '_blank', 'noopener');
post('fullscreen_tab');
});
}

// Язык просмотрщика — общий словарь мини-аппа (app-i18n.js).
try { currentLang = lang; applyTranslations(); } catch (e) {}
document.documentElement.lang = lang;

if (!key) return fail(MSG.no_key, 'no_key');
if (!skinName) return fail(MSG.no_skin, 'no_skin');

const origin = hostOrigin();
const session = fetch(API_BASE + '/api/embed/session', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ key: key, origin: origin, skin: skinName, ticket: ticket }),
}).then(r => r.json().catch(() => ({})).then(d => Object.assign({ status: r.status }, d)));

Promise.all([session, loadModelIndex(), loadPaintIndex()]).then(([s, map, paintMap]) => {
if (!s.ok){
const code = s.error || 'denied';
return fail(code === 'limit' ? MSG.limit : code === 'blocked' ? MSG.blocked : MSG.denied, code);
}
document.body.classList.toggle('no-ar', !s.ar);
document.getElementById('embedBadge').hidden = !s.badge;
const entry = modelEntryForSkin(map, paintMap, { title: skinName, paint_index: paint });
if (!entry || !entry.model) return fail(MSG.no_model, 'no_model');
const seed = seedRaw !== null && seedRaw !== '' ? seedRaw : null;
open3DViewer(entry.model, skinName.replace(/\s*\([^)]*\)\s*$/, ''), entry.skin, floatValue, entry.weapon || null, 'none', seed, null, null);
setViewerFullscreen(true);
setupFullscreen(s.ticket || '');
post('ready');
}).catch(() => fail(MSG.denied, 'network'));
})();
