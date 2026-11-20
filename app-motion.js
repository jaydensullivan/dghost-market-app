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
el.addEventListener('animationend', () => { el.classList.remove('dg-rise'); el.style.removeProperty('--dg-i'); }, { once: true });
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

// Взводим каскад заново: вход на экран, смена раздела каталога, открытие игры.
const DG_ARM_ON_SCREEN = { shop: ['skinsList'], topup: ['gtGrid'] };
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
