// ============================================================
// ГЛАВНЫЙ ЭКРАН МАГАЗИНА
//
// Промо-баннер (листается сам), «Мои лоты», корзина в нижней
// навигации и баланс в шапке. Каталог, категории и вкладки — в
// app-catalog.js.
// ============================================================

// ---------- промо-баннер ----------

let promoIndex = 0;
let promoTimer = null;
let promoKey = '';

// «Выгода дня» — лот с самой большой скидкой к рынку (тот же расчёт,
// что у плашки «−N% к рынку» на карточке). Нет такого — нет слайда.
function promoDealSkin(){
let best = null, bestPct = 0;
(typeof lastSkins !== 'undefined' ? lastSkins : []).forEach(s => {
const market = Number(s.market_price_uzs || s.market_price) || 0;
if (!s.photo_url || !(market > 0) || !(s.price > 0)) return;
if (currentUserId && s.seller_id === currentUserId) return;
const pct = Math.round((1 - s.price / market) * 100);
if (pct >= TRADER_BADGE_MIN_PCT && pct > bestPct){ best = s; bestPct = pct; }
});
return best ? { skin: best, pct: bestPct } : null;
}

function promoSlides(){
const dict = I18N[currentLang] || I18N.ru;
const slides = [];
const deal = promoDealSkin();
if (deal){
slides.push({
key: 'deal' + deal.skin.id + '_' + deal.skin.price,
kicker: dict.promo_deal_kicker,
title: deal.skin.title,
text: dict.promo_deal_text.replace('{price}', formatCoins(deal.skin.price)).replace('{p}', deal.pct),
btn: dict.promo_deal_btn,
image: deal.skin.photo_url,
action: () => openBuySheet(deal.skin),
});
}
// Картинка первого слайда — самый дорогой лот каталога.
const top = (typeof lastSkins !== 'undefined' ? lastSkins : [])
.filter(s => s.photo_url)
.reduce((best, s) => (!best || s.price > best.price ? s : best), null);
slides.push({
key: 'shop',
kicker: '',
title: dict.promo_shop_title,
text: dict.promo_shop_text,
btn: dict.promo_shop_btn,
image: top ? top.photo_url : '',
action: () => document.getElementById('shopSearchAnchor').scrollIntoView({ behavior: 'smooth', block: 'start' }),
});
const raffle = typeof raffleData !== 'undefined' && raffleData && raffleData.current;
if (raffle && raffle.status === 'active'){
slides.push({
key: 'raffle' + raffle.id,
kicker: dict.rf_now,
title: raffle.title,
text: dict.promo_raffle_text.replace('{n}', raffleData.invites_required || 2),
btn: dict.promo_raffle_btn,
image: raffle.gif_url || (raffle.prize_skin && raffle.prize_skin.photo_url) || '',
action: () => goToScreen('timer'),
});
}
const auctions = typeof auctionsData !== 'undefined' ? auctionsData : [];
if (auctions.length){
slides.push({
key: 'auctions' + auctions.length,
kicker: dict.promo_auctions_kicker,
title: auctions[0].title || dict.shop_tab_auctions,
text: dict.promo_auctions_text.replace('{n}', auctions.length),
btn: dict.promo_auctions_btn,
image: auctions[0].photo_url || '',
action: () => goToScreen('auctions'),
});
}
slides.push({
key: 'sell',
kicker: '',
title: dict.promo_sell_title,
text: dict.promo_sell_text,
btn: dict.promo_sell_btn,
image: 'coin-512.webp',
action: () => { goToScreen('lots'); setTimeout(() => addSkinBtn.click(), 150); },
});
return slides;
}

function renderPromo(){
const slides = promoSlides();
// Перерисовываем, только если набор слайдов поменялся — иначе
// баннер дёргался бы при каждом обновлении каталога.
const key = slides.map(s => s.key + s.image).join('|') + currentLang;
if (key === promoKey) return;
promoKey = key;
const track = document.getElementById('promoTrack');
track.innerHTML = slides.map((s, i) => `
<div class="promo-slide${s.key.indexOf('deal') === 0 ? ' promo-deal' : ''}" data-promo="${i}">
<div class="promo-body">
${s.kicker ? `<div class="promo-kicker">${s.key.indexOf('deal') === 0 ? FIRE_ICON : ''}${escapeHtml(s.kicker)}</div>` : ''}
<div class="promo-title">${escapeHtml(s.title)}</div>
<div class="promo-text">${escapeHtml(s.text)}</div>
</div>
${s.image ? `<img class="promo-img" src="${escapeHtml(s.image)}" alt="" onerror="this.remove()">` : ''}
<button type="button" class="promo-btn" data-promo-btn="${i}" aria-label="${escapeHtml(s.btn)}"><img src="icons/arrow.webp" alt="" width="32" height="16"></button>
</div>`).join('');
document.getElementById('promoDots').innerHTML = slides.length > 1
? slides.map((_, i) => `<span class="${i === 0 ? 'on' : ''}"></span>`).join('') : '';
track._slides = slides;
promoIndex = 0;
track.scrollLeft = 0;
restartPromoTimer();
}

function restartPromoTimer(){
clearInterval(promoTimer);
const track = document.getElementById('promoTrack');
if (!track._slides || track._slides.length < 2) return;
promoTimer = setInterval(() => {
if (document.hidden || currentTab !== 'shop') return;
promoIndex = (promoIndex + 1) % track._slides.length;
track.scrollTo({ left: promoIndex * track.clientWidth, behavior: 'smooth' });
}, 5000);
}

document.getElementById('promoTrack').addEventListener('scroll', (e) => {
const track = e.target;
const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
if (i === promoIndex) return;
promoIndex = i;
document.querySelectorAll('#promoDots span').forEach((d, j) => d.classList.toggle('on', j === i));
}, { passive: true });

// Палец на баннере — автопрокрутку начинаем заново, чтобы не мешала.
document.getElementById('promoTrack').addEventListener('touchstart', restartPromoTimer, { passive: true });

document.getElementById('promoTrack').addEventListener('click', (e) => {
const el = e.target.closest('[data-promo]');
const track = document.getElementById('promoTrack');
if (!el || !track._slides) return;
const slide = track._slides[Number(el.dataset.promo)];
if (slide) slide.action();
});

// ---------- мои лоты ----------

function renderMyLots(){
const dict = I18N[currentLang] || I18N.ru;
const box = document.getElementById('myLotsList');
if (!currentUserId){
box.innerHTML = `<div class="skins-empty">${dict.lots_login}</div>`;
return;
}
const mine = (typeof lastSkins !== 'undefined' ? lastSkins : []).filter(s => s.seller_id === currentUserId);
box.innerHTML = mine.length
? mine.map(skinCardHtml).join('')
: `<div class="skins-empty">${dict.lots_empty}</div>`;
markOverpricedLots(mine);
}

// «Мои лоты»: красная пометка на лоте, цена которого сильно выше рынка
// (совет Советника №3) — такие висят неделями. Рыночная цена по
// каждому лоту запрашивается по очереди и кэшируется на сессию.
const myLotMarketCache = new Map();

function markOverpricedLots(lots){
const dict = I18N[currentLang] || I18N.ru;
const apply = (skin, data) => {
const card = document.querySelector(`#myLotsList [data-card="${skin.id}"]`);
if (!card || !data || !data.available || typeof data.diff_percent !== 'number') return;
if (-data.diff_percent < MARKET_WARN_PRICIER) return;
if (card.querySelector('.lot-overpriced')) return;
const note = document.createElement('div');
note.className = 'lot-overpriced';
note.textContent = '⚠️ ' + marketGapText(dict, skin.price, data.market_price_uzs) + ' (' + formatCoins(data.market_price_uzs) + ') — ' + dict.mp_badge_lower_hint;
card.appendChild(note);
};
let chain = Promise.resolve();
lots.slice(0, 30).forEach(skin => {
const key = skin.id + ':' + skin.price;
if (myLotMarketCache.has(key)){ apply(skin, myLotMarketCache.get(key)); return; }
chain = chain.then(() => fetch(API_BASE + '/api/market_price?skin_id=' + skin.id)
.then(r => r.json())
.then(data => { myLotMarketCache.set(key, data); apply(skin, data); })
.catch(() => {}));
});
}

document.getElementById('lotsDealsBtn').addEventListener('click', () => goToScreen('deals'));

// ---------- корзина (значок в шапке) ----------

document.getElementById('navCartBtn').addEventListener('click', () => {
renderCartOverlay();
document.getElementById('cartStatus').textContent = '';
document.getElementById('cartOverlay').classList.add('show');
});

// ---------- баланс в шапке ----------

document.getElementById('balancePillBtn').addEventListener('click', () => goToScreen('profile'));

document.getElementById('balanceInfoBtn').addEventListener('click', () => {
showAlert((I18N[currentLang] || I18N.ru).hint_sell_flow);
});

renderPromo();

// ---------- профиль: переходы и настройки ----------

document.getElementById('screenProfile').addEventListener('click', (e) => {
const go = e.target.closest('[data-pf-go]');
if (go){
goToScreen(go.dataset.pfGo);
return;
}
const act = e.target.closest('[data-pf-action]');
if (!act) return;
const action = act.dataset.pfAction;
if (action === 'notifications'){
document.getElementById('notifBellBtn').click();
} else if (action === 'legal'){
openLegal('terms');
} else if (action === 'support'){
document.querySelector('[data-header-action="support"]').click();
} else if (action === 'howbuy'){
openBuyGuide();
} else if (action === 'channel'){
const url = 'https://t.me/dghostmarket';
if (tg && tg.openTelegramLink) tg.openTelegramLink(url);
else window.open(url, '_blank', 'noopener');
} else if (action === 'exit'){
if (tg && tg.close) tg.close();
}
});

document.getElementById('profileHeldInfo').addEventListener('click', () => {
showAlert((I18N[currentLang] || I18N.ru).hint_sell_flow);
});

// Форма «Каталога желаний» открывается по «+ Добавить».
document.getElementById('wishlistToggleForm').addEventListener('click', () => {
const form = document.getElementById('wishlistForm');
form.style.display = form.style.display === 'none' ? '' : 'none';
if (form.style.display === '') document.getElementById('wishlistQueryInput').focus();
});
