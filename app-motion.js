// Единый моушн мини-аппа: появление экранов, подсветка нижнего меню,
// окна снизу (выезд + свайп вниз) и выключатель «Меньше анимаций».
// Скорости и кривая — в app.css (--m-t1/--m-t2/--m-t3, --m-ease).
// Двигаем только transform/opacity, чтобы не тормозило на слабых Android.

// «Меньше анимаций»: класс dg-calm на <html> ставится ещё в <head>
// (index.html), чтобы первый экран не мигнул анимацией.
function dgMotionCalm(){
return document.documentElement.classList.contains('dg-calm')
|| !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

// Перезапуск CSS-анимации: снять класс, дать браузеру кадр, вернуть.
function dgReplay(el, cls){
if (!el) return;
el.classList.remove(cls);
void el.offsetWidth;
if (!dgMotionCalm()) el.classList.add(cls);
}

// ---------- экраны ----------
// Вкладки нижнего меню — появляются со сдвигом вверх. Экраны «вглубь»
// выезжают справа; возврат с них на вкладку — слева.
const DG_SCREEN_EL = {
shop: 'screenShop', profile: 'screenProfile', admin: 'screenAdmin', auctions: 'screenAuctions',
deals: 'screenDeals', buyRequests: 'screenBuyRequests', support: 'screenSupport', lots: 'screenLots',
pro: 'screenPro', topup: 'screenTopup', timer: 'screenTimer'
};
const DG_PUSH_SCREENS = ['buyRequests', 'support', 'pro', 'topup', 'auctions', 'timer'];
let dgPrevScreen = null;
let dgPrevNavBtn = null;

function dgMotionScreen(name){
const prev = dgPrevScreen;
dgPrevScreen = name;
dgNavPill();
(DG_ARM_ON_SCREEN[name] || []).forEach(dgArm);
if (prev === null){ dgPrevNavBtn = document.querySelector('#bottomNav .nav-btn.active'); return; }
if (prev === name) return;
const el = document.getElementById(DG_SCREEN_EL[name]);
if (!el) return;
let cls = 'dg-in-up';
if (DG_PUSH_SCREENS.includes(name)) cls = 'dg-in-right';
else if (DG_PUSH_SCREENS.includes(prev)) cls = 'dg-in-left';
['dg-in-up', 'dg-in-right', 'dg-in-left'].forEach(c => el.classList.remove(c));
dgReplay(el, cls);
// Иконка выбранной вкладки слегка подпрыгивает (если вкладка сменилась).
const btn = document.querySelector('#bottomNav .nav-btn.active');
if (btn && btn !== dgPrevNavBtn) dgReplay(btn, 'dg-hop');
dgPrevNavBtn = btn;
}

// ---------- нижнее меню: подсветка переезжает под активную вкладку ----------
function dgNavPill(){
const nav = document.getElementById('bottomNav');
if (!nav) return;
let pill = document.getElementById('navPill');
if (!pill){
pill = document.createElement('span');
pill.id = 'navPill';
pill.className = 'nav-pill';
pill.setAttribute('aria-hidden', 'true');
nav.insertBefore(pill, nav.firstChild);
}
const btn = nav.querySelector('.nav-btn.active');
if (!btn || !btn.offsetWidth){ pill.style.opacity = '0'; return; }
pill.style.opacity = '';
pill.style.width = btn.offsetWidth + 'px';
pill.style.transform = 'translateX(' + btn.offsetLeft + 'px)';
}
window.addEventListener('resize', () => requestAnimationFrame(dgNavPill));

// ---------- окна снизу: свайп вниз закрывает ----------
// Тянуть можно только за верхнюю полоску окна (первые 44 px), когда оно
// не прокручено: так не мешаем прокрутке, полям ввода и 3D внутри.
// Закрываем тем же крестиком, что и пользователь, — вся логика закрытия
// остаётся у самого окна.
(function dgSheetSwipe(){
const SHEETS = '.edit-overlay.show > .edit-sheet, .buy-overlay.show > .buy-sheet';
let sheet = null, y0 = 0, dy = 0;
document.addEventListener('touchstart', (e) => {
const s = e.target.closest && e.target.closest(SHEETS);
if (!s || s.scrollTop > 0 || dgMotionCalm()) return;
if (!s.querySelector('.buy-close-btn, .inv-close')) return;
const t = e.touches[0];
if (t.clientY - s.getBoundingClientRect().top > 44) return;
if (e.target.closest('input, textarea, select, canvas')) return;
sheet = s; y0 = t.clientY; dy = 0;
sheet.classList.add('dg-dragging');
}, { passive: true });
document.addEventListener('touchmove', (e) => {
if (!sheet) return;
dy = Math.max(0, e.touches[0].clientY - y0);
sheet.style.transform = 'translateY(' + dy + 'px)';
}, { passive: true });
function end(){
if (!sheet) return;
const s = sheet;
sheet = null;
s.classList.remove('dg-dragging');
if (dy > 90){
const close = s.querySelector('.buy-close-btn, .inv-close');
s.style.transform = '';
if (close) close.click();
if (typeof haptic === 'function') haptic('light');
} else {
s.style.transform = '';
}
}
document.addEventListener('touchend', end);
document.addEventListener('touchcancel', end);
})();

// ---------- списки: карточки появляются по очереди ----------
// Только при первом показе (вход на экран, смена раздела), а не на каждую
// букву в поиске. Первые 14 карточек; остальные — сразу, без ожидания.
function dgCascade(items){
items.slice(0, 14).forEach((el, i) => {
el.style.setProperty('--dg-i', i);
el.classList.add('dg-rise');
// Снимаем класс по таймеру, а не по animationend: внутри (полоски сделки)
// свои анимации, им нужно доиграть.
setTimeout(() => { el.classList.remove('dg-rise'); el.style.removeProperty('--dg-i'); }, i * 45 + 1500);
});
}
const dgCascadeArmed = {};
function dgArm(id){ dgCascadeArmed[id] = true; }
function dgWatchList(id, selector){
const box = document.getElementById(id);
if (!box) return;
dgArm(id);
new MutationObserver(() => {
if (!dgCascadeArmed[id]) return;
const items = [...box.querySelectorAll(selector)];
if (!items.length) return;
dgCascadeArmed[id] = false;
if (!dgMotionCalm()) dgCascade(items);
}).observe(box, { childList: true, subtree: true });
}
dgWatchList('skinsList', '.skin-card');
dgWatchList('gtGrid', '.gt-tile, .gt-svc');
dgWatchList('gtOffers', '[data-gt-offer]');
dgWatchList('dealsList', '.deal-card');
dgWatchList('gtOrdersList', '.gt-order');

// Взводим каскад заново: вход на экран, смена раздела каталога, открытие игры.
const DG_ARM_ON_SCREEN = { shop: ['skinsList'], topup: ['gtGrid'], deals: ['dealsList', 'gtOrdersList'] };
document.addEventListener('click', (e) => {
if (e.target.closest('[data-gt-type], [data-gt-genre]')) dgArm('gtGrid');
if (e.target.closest('[data-gt-slug], [data-gt-region]')) dgArm('gtOffers');
}, true);

// ---------- ♡ и ★: «бьётся» и разбрасывает искры ----------
function dgSparks(host, color){
if (dgMotionCalm() || !host) return;
for (let k = 0; k < 7; k++){
const sp = document.createElement('i');
sp.className = 'dg-spark';
const a = k / 7 * Math.PI * 2;
sp.style.setProperty('--x', Math.round(Math.cos(a) * 20) + 'px');
sp.style.setProperty('--y', Math.round(Math.sin(a) * 20) + 'px');
if (color) sp.style.background = color;
host.appendChild(sp);
setTimeout(() => sp.remove(), 560);
}
}
document.addEventListener('click', (e) => {
const fav = e.target.closest('.skin-fav, .gt-fav-btn');
if (fav){
dgReplay(fav, 'dg-beat');
dgSparks(fav, fav.classList.contains('gt-fav-btn') ? '#fbbf24' : '#ff2bd6');
return;
}
const offer = e.target.closest('[data-gt-offer]');
if (offer) dgReplay(offer, 'dg-pop');
}, true);

// ---------- деньги: сумма досчитывает, рост вспыхивает зелёным ----------
// el.dataset.dgMoney хранит прошлое значение; первый показ — сразу, без счёта.
function dgSetMoney(el, value){
if (!el) return;
const to = Number(value) || 0;
const had = el.dataset.dgMoney !== undefined && el.dataset.dgMoney !== '';
const from = had ? Number(el.dataset.dgMoney) : to;
el.dataset.dgMoney = String(to);
if (el.dgMoneyRaf) cancelAnimationFrame(el.dgMoneyRaf);
if (!had || from === to || dgMotionCalm()){ el.textContent = formatCoins(to); return; }
if (to > from){ el.classList.remove('dg-money-up'); void el.offsetWidth; el.classList.add('dg-money-up'); }
const t0 = performance.now(), ms = 900;
const step = (t) => {
const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
el.textContent = formatCoins(Math.round(from + (to - from) * e));
if (k < 1) el.dgMoneyRaf = requestAnimationFrame(step); else el.dgMoneyRaf = 0;
};
el.dgMoneyRaf = requestAnimationFrame(step);
}

// ---------- ошибка: встряска кнопки, по которой только что нажали ----------
let dgLastTap = null, dgLastTapAt = 0;
document.addEventListener('click', (e) => {
const b = e.target.closest && e.target.closest('button, .steam-link-btn, .welcome-btn');
if (b){ dgLastTap = b; dgLastTapAt = Date.now(); }
}, true);
function dgShake(el){ dgReplay(el, 'dg-shake'); }
// Зовётся из haptic('error'): ошибка пришла в ответ на нажатие — трясём кнопку.
function dgShakeLast(){
if (dgLastTap && Date.now() - dgLastTapAt < 8000 && dgLastTap.isConnected && dgLastTap.offsetParent) dgShake(dgLastTap);
}

// ---------- успех: галочка рисуется + фиолетовое конфетти ----------
let dgSuccessTimer = 0;
function dgSuccess(title, sub){
let box = document.getElementById('dgSuccess');
if (!box){
box = document.createElement('div');
box.id = 'dgSuccess';
box.className = 'dg-success';
box.setAttribute('role', 'status');
box.innerHTML = '<div class="dg-success-box"><svg class="dg-success-ring" viewBox="0 0 84 84" aria-hidden="true"><circle cx="42" cy="42" r="38" transform="rotate(-90 42 42)"/><path d="M26 43l11 11 21-23"/></svg><div class="dg-success-title"></div><div class="dg-success-sub"></div></div>';
box.addEventListener('click', () => dgSuccessHide());
document.body.appendChild(box);
}
box.querySelector('.dg-success-title').textContent = title || '';
box.querySelector('.dg-success-sub').textContent = sub || '';
box.classList.remove('on');
void box.offsetWidth;
box.classList.add('on');
if (typeof haptic === 'function') haptic('success');
if (!dgMotionCalm()){
const cols = ['#7B2CFF', '#C4169F', '#A855F7', '#ff2bd6', '#c081fa'];
for (let k = 0; k < 36; k++){
const p = document.createElement('i');
p.className = 'dg-conf';
p.style.left = (Math.random() * 100) + '%';
p.style.background = cols[k % cols.length];
p.style.setProperty('--x', Math.round(Math.random() * 120 - 60) + 'px');
p.style.setProperty('--r', Math.round(Math.random() * 720 - 360) + 'deg');
p.style.animationDelay = (Math.random() * 0.25).toFixed(2) + 's';
box.appendChild(p);
setTimeout(() => p.remove(), 1900);
}
}
clearTimeout(dgSuccessTimer);
dgSuccessTimer = setTimeout(dgSuccessHide, 1700);
}
function dgSuccessHide(){
const box = document.getElementById('dgSuccess');
if (box) box.classList.remove('on');
clearTimeout(dgSuccessTimer);
}

// ---------- выключатель «Меньше анимаций» в Настройках ----------
(function dgCalmToggle(){
const box = document.getElementById('calmToggle');
if (!box) return;
box.checked = document.documentElement.classList.contains('dg-calm');
box.addEventListener('change', () => {
document.documentElement.classList.toggle('dg-calm', box.checked);
try { localStorage.setItem('dg_calm', box.checked ? '1' : '0'); } catch(e) {}
});
})();

dgMotionScreen(typeof currentTab === 'string' ? currentTab : 'shop');
