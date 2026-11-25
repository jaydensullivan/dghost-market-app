// ============================================================
// ТРИ ПРОСТРАНСТВА: CS2 Скины · Подарки · Пополнения
// (docs/SPACES-NAVIGATION.md, этапы 1–4)
//
// HOME — экран «Выбери свой мир»: три карточки, без нижнего меню.
// Показываем при первом входе, по «Назад» из корня пространства и по
// тапу на логотип. Иначе сразу открываем последнее пространство
// (localStorage dg_space). Ссылки из бота и канала (?open=, startapp=)
// ведут сразу в нужное место, минуя HOME.
//
// У каждого пространства своя шапка («‹ 01 / MARKETPLACE — CS2 Скины»)
// и своё нижнее меню из трёх кнопок. Профиль — только значком в шапке
// (#headerAvatarBtn), в нижнем меню его нет. Кнопки меню те же
// (#bottomNav), меняются подписи и действия.
// ============================================================

(function(){
const SPACE_KEY = 'dg_space';
const SPACES = {
skins: { num: '01 / MARKETPLACE', title: 'sp_skins_title', desc: 'sp_skins_desc', root: 'shop',
nav: ['nav_market', 'nav_deals', 'nav_sell'] },
gifts: { num: '02 / GIFTS', title: 'sp_gifts_title', desc: 'sp_gifts_desc', root: 'gifts',
nav: ['gf_tab_buy', 'gf_tab_send', 'gf_tab_mine'] },
topup: { num: '03 / TOP-UP', title: 'sp_topup_title', desc: 'sp_topup_desc', root: 'topup',
nav: ['sp_nav_catalog', 'sp_nav_orders', 'sp_nav_support'] },
};
// Экран → пространство. Общие экраны (профиль, сделки, поддержка) не
// меняют текущее пространство: «Заказы» в Пополнениях — это «Сделки».
const SCREEN_SPACE = { shop: 'skins', welcome: 'skins', lots: 'skins', auctions: 'skins', buyRequests: 'skins', timer: 'skins', gifts: 'gifts', topup: 'topup' };
const ART = {
skins: 'https://community.akamai.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL8js_f_jdk4uL3V6JiL_SsDW-RyOBJveRtRjy-2x8i4zjcmIuoIHmSPFcjDMMjFO9Z4BSxlta1Yey2tgXYidlFmS6r3SpXrnE8w54dz2k/330x248',
gifts: ['https://nft.fragment.com/gift/madpumpkin-5101.medium.jpg', 'https://nft.fragment.com/gift/jesterhat-130869.medium.jpg'],
topup: 'https://arcadezy.com/covers/a27f611969e1668d128934d5fcb200d5.webp',
};

function d(){ return (typeof I18N !== 'undefined' && (I18N[currentLang] || I18N.ru)) || {}; }
function t(key){ return d()[key] || key; }
function remember(key){ try { localStorage.setItem(SPACE_KEY, key); } catch(e) {} }
function saved(){ try { const v = localStorage.getItem(SPACE_KEY); return SPACES[v] ? v : null; } catch(e) { return null; } }
// «Меньше анимаций» (dg-calm) или системное prefers-reduced-motion.
function calm(){ return typeof dgMotionCalm === 'function' ? dgMotionCalm() : document.documentElement.classList.contains('dg-calm'); }

let current = saved() || 'skins';

// ---------- шапки пространств ----------
function makeHead(key, id){
const head = document.createElement('div');
head.className = 'sp-head';
head.dataset.space = key;
head.innerHTML = `<button type="button" class="sp-back" id="spBack_${id || key}" data-i18n-aria-label="sp_all_spaces" aria-label="${escapeHtml(t('sp_all_spaces'))}">‹</button>`
+ `<div class="sp-head-txt"><span class="sp-num">${SPACES[key].num}</span><b data-i18n="${SPACES[key].title}">${escapeHtml(t(SPACES[key].title))}</b></div>`;
head.querySelector('.sp-back').addEventListener('click', () => {
// В Пополнениях внутри карточки сервиса «назад» — к каталогу.
if (key === 'topup' && !document.getElementById('gtDetailView').hidden && typeof showTopupView === 'function'){ showTopupView(false); return; }
showHome(true);
});
return head;
}

function mountHeads(){
const promo = document.getElementById('promo');
if (promo && !document.getElementById('spBack_skins')) promo.parentElement.insertBefore(makeHead('skins'), promo);
const gifts = document.getElementById('screenGifts');
if (gifts && !document.getElementById('spBack_gifts')) gifts.insertBefore(makeHead('gifts'), gifts.firstChild);
const topup = document.getElementById('screenTopup');
if (topup && !document.getElementById('spBack_topup')) topup.insertBefore(makeHead('topup'), topup.firstChild);
// «Заказы» Пополнений — это экран сделок: своя шапка пространства
// вместо старой «←» (видна только в Пополнениях, см. app.css).
const deals = document.getElementById('screenDeals');
if (deals && !document.getElementById('spBack_orders')){
const h = makeHead('topup', 'orders');
h.classList.add('sp-head-orders');
deals.insertBefore(h, deals.firstChild);
}
}

// ---------- нижнее меню ----------
function navButtons(){ return [...document.querySelectorAll('#bottomNav .nav-btn')]; }

function activeIndex(screen){
if (screen === 'profile' || screen === 'pro') return -1;
if (current === 'gifts'){
if (screen !== 'gifts') return -1;
const tab = document.querySelector('#gfTabs [data-gf-tab].active');
return { buy: 0, send: 1, mine: 2 }[tab ? tab.dataset.gfTab : 'buy'];
}
if (current === 'topup') return { topup: 0, deals: 1, support: 2 }[screen] ?? -1;
return null; // Скины: подсветку ставит switchTab
}

function applyNav(screen){
const sp = SPACES[current];
// Где ты — маленькой подписью у логотипа (строка «‹ 01 / …» на телефоне скрыта).
const label = document.getElementById('brandSpace');
if (label){ label.setAttribute('data-i18n', sp.title); label.textContent = t(sp.title); }
navButtons().forEach((btn, i) => {
const label = btn.querySelector('.nav-label');
if (label && sp.nav[i]){ label.setAttribute('data-i18n', sp.nav[i]); label.textContent = t(sp.nav[i]); }
});
const idx = activeIndex(screen);
if (idx !== null) navButtons().forEach((btn, i) => btn.classList.toggle('active', i === idx));
if (typeof dgNavPill === 'function') requestAnimationFrame(dgNavPill);
}

function route(i){
if (current === 'gifts'){
goToScreen('gifts');
if (typeof setGiftsTab === 'function') setGiftsTab(['buy', 'send', 'mine'][i]);
} else if (current === 'topup'){
if (i === 0){ goToScreen('topup'); if (typeof showTopupView === 'function') showTopupView(false); }
else if (i === 1) goToScreen('deals');
else if (i === 2){ if (typeof openSupport === 'function') openSupport(); else goToScreen('support'); }
}
applyNav(currentTab);
}

// В Подарках и Пополнениях кнопки меню ведут в своё — перехватываем
// клик раньше обработчиков самих кнопок (они настроены на Скины).
document.getElementById('bottomNav').addEventListener('click', (e) => {
const btn = e.target.closest('.nav-btn');
if (!btn || current === 'skins') return;
e.stopImmediatePropagation();
e.preventDefault();
route(navButtons().indexOf(btn));
}, true);

// ---------- переключение экранов ----------
const baseSwitchTab = switchTab;
switchTab = function(name){
baseSwitchTab(name);
const sp = SCREEN_SPACE[name];
if (sp && sp !== current){ current = sp; remember(sp); }
else if (sp) remember(sp);
document.documentElement.dataset.space = current;
if (name === 'deals') dealsForSpace();
applyNav(name);
};

// «Сделки» в Скинах — только сделки со скинами, «Заказы» в Пополнениях —
// только заказы пополнений. Переключатель «Скины / Пополнения» скрыт.
const dealsTitle = document.querySelector('#screenDeals [data-i18n="deals_screen_title"]');
function dealsForSpace(){
const topup = current === 'topup';
if (typeof setDealsSeg === 'function') setDealsSeg(topup ? 'topup' : 'skins');
if (dealsTitle){
const key = topup ? 'sp_orders_title' : 'deals_screen_title';
dealsTitle.setAttribute('data-i18n', key);
dealsTitle.textContent = t(key);
}
}

if (typeof setGiftsTab === 'function'){
const baseGiftsTab = setGiftsTab;
setGiftsTab = function(tab){ baseGiftsTab(tab); if (current === 'gifts') applyNav(currentTab); };
}

// Состояние пространства при уходе на HOME: экран и прокрутка. Поиск,
// фильтры, вкладки и категории живут в самих экранах — их не пересоздаём,
// только прячем, так что при возврате они те же.
const memo = {};
function saveSpace(){
memo[current] = { screen: currentTab, y: window.scrollY };
}

function enter(key){
current = key;
remember(key);
document.documentElement.dataset.space = key;
const m = memo[key];
if (m){
goToScreen(m.screen);
restoreScroll(m.y);
return;
}
goToScreen(SPACES[key].root);
if (key === 'gifts' && typeof setGiftsTab === 'function') setGiftsTab('buy');
if (key === 'topup' && typeof showTopupView === 'function') showTopupView(false);
window.scrollTo(0, 0);
}

// Список может дорисоваться позже (каталог обновляется с сервера) —
// пробуем ещё раз, если пользователь сам не успел прокрутить.
function restoreScroll(y){
window.scrollTo(0, y);
if (!y) return;
requestAnimationFrame(() => window.scrollTo(0, y));
setTimeout(() => { if (Math.abs(window.scrollY - y) > 4 && window.scrollY < 4) window.scrollTo(0, y); }, 400);
}

// ---------- переход HOME ⇄ пространство ----------
// View Transitions: выбранная карточка раскрывается в интерфейс
// пространства (новый экран открывается «окном» от её рамки до всего
// экрана), две другие уезжают в стороны. Назад — то же в обратную
// сторону. Без View Transitions — затухание за 240 мс, при «Меньше
// анимаций» — мгновенно.
const canVT = typeof document.startViewTransition === 'function';
function setCardRect(card){
const r = card.getBoundingClientRect();
const st = document.documentElement.style;
st.setProperty('--sp-ct', Math.max(0, r.top) + 'px');
st.setProperty('--sp-cl', Math.max(0, r.left) + 'px');
st.setProperty('--sp-cr', Math.max(0, window.innerWidth - r.right) + 'px');
st.setProperty('--sp-cb', Math.max(0, window.innerHeight - r.bottom) + 'px');
}
function nameOthers(key, on){
let n = 0;
home.querySelectorAll('[data-space-go]').forEach(c => {
c.style.viewTransitionName = (on && c.dataset.spaceGo !== key) ? 'sp-other-' + (++n) : '';
});
}
function runVT(dir, update){
const html = document.documentElement;
html.classList.add('sp-vt', 'sp-vt-' + dir);
let vt;
try { vt = document.startViewTransition(update); }
catch(e){ html.classList.remove('sp-vt', 'sp-vt-' + dir); update(); return; }
vt.finished.finally(() => {
html.classList.remove('sp-vt', 'sp-vt-' + dir);
if (home) nameOthers('', false);
});
}

function openSpace(card){
const key = card.dataset.spaceGo;
if (calm()){ hideHome(); enter(key); return; }
if (canVT){
setCardRect(card);
nameOthers(key, true);
runVT('in', () => { nameOthers(key, false); hideHome(); enter(key); });
return;
}
// Без View Transitions: выбранная приближается, остальные уезжают.
home.classList.add('sp-leaving');
card.classList.add('sp-pick');
enter(key);
setTimeout(hideHome, 240);
}

// ---------- HOME: «Выбери свой мир» ----------
let home = null;

function buildHome(){
home = document.createElement('div');
home.id = 'spacesHome';
home.className = 'sp-home';
home.hidden = true;
home.innerHTML = `<div class="sp-home-in">
<div class="sp-brand"><img src="logo-120.webp" alt="" width="44" height="44"><div><b>DGhost</b><span>DIGITAL MARKETPLACE</span></div></div>
<h1 class="sp-home-title" data-i18n="sp_home_title">${escapeHtml(t('sp_home_title'))}</h1>
<p class="sp-home-sub" data-i18n="sp_home_sub">${escapeHtml(t('sp_home_sub'))}</p>
<div class="sp-cards">
${['skins', 'gifts', 'topup'].map(key => `<button type="button" class="sp-card sp-card-${key}" data-space-go="${key}">
<span class="sp-num">${SPACES[key].num}</span>
<span class="sp-art">${key === 'gifts'
? `<img class="sp-gift a" src="${ART.gifts[0]}" alt="" loading="lazy"><img class="sp-gift b" src="${ART.gifts[1]}" alt="" loading="lazy">`
: `<img src="${ART[key]}" alt="" loading="lazy">`}</span>
<span class="sp-card-txt"><b data-i18n="${SPACES[key].title}">${escapeHtml(t(SPACES[key].title))}</b><small data-i18n="${SPACES[key].desc}">${escapeHtml(t(SPACES[key].desc))}</small></span>
<span class="sp-go" aria-hidden="true">→</span>
</button>`).join('')}
</div>
</div>`;
document.body.appendChild(home);
home.addEventListener('click', (e) => {
const card = e.target.closest('[data-space-go]');
if (card) openSpace(card);
});
}

function showHome(animate){
if (!home) buildHome();
if (!home.hidden) return;
saveSpace();
if (animate && !calm() && canVT){
runVT('out', () => {
openHome(false);
const card = home.querySelector('[data-space-go="' + current + '"]');
if (card){ setCardRect(card); nameOthers(current, true); }
});
return;
}
openHome(animate);
}

function openHome(animate){
home.hidden = false;
home.classList.remove('sp-leaving');
home.querySelectorAll('.sp-pick').forEach(c => c.classList.remove('sp-pick'));
home.classList.toggle('sp-enter', !!animate && !calm());
document.documentElement.classList.add('sp-home-open');
home.scrollTop = 0;
}

function hideHome(){
if (!home) return;
home.hidden = true;
home.classList.remove('sp-leaving', 'sp-enter');
document.documentElement.classList.remove('sp-home-open');
}

window.dgShowSpaces = showHome;

// Для ПК-шапки (app-desktop.js): текущее пространство, его разделы,
// переход в раздел и переключение пространства без HOME.
window.dgSpace = {
current: () => current,
nav: () => SPACES[current].nav.slice(),
go(i){
if (current === 'skins'){ const b = navButtons()[i]; if (b) b.click(); }
else route(i);
},
enter(key){
if (!SPACES[key]) return;
if (key !== current) saveSpace();
hideHome();
enter(key);
},
};

// Логотип — к выбору пространства.
document.addEventListener('click', (e) => {
if (e.target.closest('.brand-tl .brand-logo')) showHome(true);
});

// ---------- свайп от левого края → назад ----------
// Не перехватываем жест в горизонтальных лентах (карусели, чипы),
// в 3D-просмотрщике и на полях ввода.
function ownsSwipe(el){
for (; el && el !== document.body; el = el.parentElement){
if (el.matches('canvas, input, textarea, select, .viewer3d, [class*="viewer3d"], model-viewer')) return true;
if (el.scrollWidth > el.clientWidth + 1){
const ox = getComputedStyle(el).overflowX;
if (ox === 'auto' || ox === 'scroll') return true;
}
}
return false;
}
(function edgeSwipe(){
let x0 = null, y0 = 0;
document.addEventListener('touchstart', (e) => {
const tch = e.touches[0];
x0 = (e.touches.length === 1 && tch.clientX <= 20 && !document.documentElement.classList.contains('sp-home-open') && !ownsSwipe(e.target)) ? tch.clientX : null;
y0 = tch.clientY;
}, { passive: true });
document.addEventListener('touchend', (e) => {
if (x0 === null) return;
const tch = e.changedTouches[0];
const dx = tch.clientX - x0, dy = Math.abs(tch.clientY - y0);
x0 = null;
if (dx < 60 || dy > 30) return;
// Только из корня пространства (видна его «‹»), когда ничего не открыто поверх.
const back = [...document.querySelectorAll('.sp-back')].find(b => b.getClientRects().length && getComputedStyle(b).visibility !== 'hidden');
if (back && !document.querySelector('.edit-overlay.show, .buy-overlay.show')) back.click();
}, { passive: true });
})();

// ---------- старт ----------
mountHeads();
document.documentElement.dataset.space = current;

let target = null;
try { target = new URLSearchParams(location.search).get('open'); } catch(e) {}
if (!target && typeof tg !== 'undefined' && tg && tg.initDataUnsafe && typeof tg.initDataUnsafe.start_param === 'string') target = tg.initDataUnsafe.start_param;
const spaceLink = target && /^space_(skins|gifts|topup)$/.exec(target);

if (spaceLink) enter(spaceLink[1]);
else if (target) { /* openScreenFromLaunch откроет нужный экран сам */ }
else if (!saved()) showHome(false);
else if (current !== 'skins') enter(current);
applyNav(typeof currentTab !== 'undefined' ? currentTab : 'shop');
})();
