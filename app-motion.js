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
