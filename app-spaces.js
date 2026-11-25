// ============================================================
// ТРИ ПРОСТРАНСТВА: CS2 Скины · Подарки · Пополнения
// (docs/SPACES-NAVIGATION.md, этап 1)
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
function calm(){ return document.documentElement.classList.contains('dg-calm'); }

let current = saved() || 'skins';

// ---------- шапки пространств ----------
function makeHead(key){
const head = document.createElement('div');
head.className = 'sp-head';
head.dataset.space = key;
head.innerHTML = `<button type="button" class="sp-back" id="spBack_${key}" data-i18n-aria-label="sp_all_spaces" aria-label="${escapeHtml(t('sp_all_spaces'))}">‹</button>`
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

function enter(key){
current = key;
remember(key);
document.documentElement.dataset.space = key;
goToScreen(SPACES[key].root);
if (key === 'gifts' && typeof setGiftsTab === 'function') setGiftsTab('buy');
if (key === 'topup' && typeof showTopupView === 'function') showTopupView(false);
window.scrollTo(0, 0);
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
if (!card) return;
const key = card.dataset.spaceGo;
if (calm()){ hideHome(); enter(key); return; }
// Выбранная карточка приближается, остальные уезжают в стороны.
home.classList.add('sp-leaving');
card.classList.add('sp-pick');
enter(key);
setTimeout(hideHome, 260);
});
}

function showHome(animate){
if (!home) buildHome();
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

// Логотип — к выбору пространства.
document.addEventListener('click', (e) => {
if (e.target.closest('.brand-tl .brand-logo')) showHome(true);
});

// ---------- свайп от левого края → назад ----------
(function edgeSwipe(){
let x0 = null, y0 = 0;
document.addEventListener('touchstart', (e) => {
const tch = e.touches[0];
x0 = (tch.clientX <= 20 && !document.documentElement.classList.contains('sp-home-open')) ? tch.clientX : null;
y0 = tch.clientY;
}, { passive: true });
document.addEventListener('touchend', (e) => {
if (x0 === null) return;
const tch = e.changedTouches[0];
const dx = tch.clientX - x0, dy = Math.abs(tch.clientY - y0);
x0 = null;
if (dx < 60 || dy > 30) return;
const back = document.getElementById('spBack_' + current);
// Только из корня пространства, когда ничего не открыто поверх.
if (back && back.getClientRects().length && !document.querySelector('.edit-overlay.show, .buy-overlay.show')) back.click();
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
