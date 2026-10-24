// ============================================================
// КОРЗИНА — покупка нескольких лотов за раз
// ============================================================

function toggleCartItem(skinId){
const idx = cart.indexOf(skinId);
if (idx === -1){
cart.push(skinId);
} else {
cart.splice(idx, 1);
}
applyFiltersAndRender();
updateCartFab();
}

// Корзина хранится и на сервере: переживает закрытие мини-аппа, а бот
// через сутки напоминает о брошенной корзине. Пока сохранённую корзину
// не восстановили — не сохраняем (пустая затёрла бы её).
let cartRestoreStarted = false;
let cartRestored = false;
let cartSaveTimer = null;

function saveCart(){
if (!cartRestored || !tg || !tg.initData) return;
clearTimeout(cartSaveTimer);
cartSaveTimer = setTimeout(() => {
fetch(API_BASE + '/api/cart', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData, skin_ids: cart })
}).catch(() => {});
}, 800);
}

// Вызывается после первой загрузки каталога (renderSkins).
function restoreCart(){
if (cartRestoreStarted) return;
cartRestoreStarted = true;
if (!tg || !tg.initData){
cartRestored = true;
return;
}
let openCart = false;
try { openCart = new URLSearchParams(location.search).get('open') === 'cart'; } catch (e) {}
if (tg.initDataUnsafe && tg.initDataUnsafe.start_param === 'cart') openCart = true;
fetch(API_BASE + '/api/cart?init_data=' + encodeURIComponent(tg.initData) + '&_t=' + Date.now(), { cache: 'no-store' })
.then(r => r.ok ? r.json() : null)
.then(data => {
((data && data.skin_ids) || []).forEach(id => {
if (!cart.includes(id) && lastSkins.some(s => s.id === id)) cart.push(id);
});
})
.catch(() => {})
.finally(() => {
cartRestored = true;
updateCartFab();
applyFiltersAndRender();
if (openCart && cart.length) document.getElementById('navCartBtn').click();
});
}

// Корзина — значок в шапке со счётчиком; пустая корзина не занимает место.
function updateCartFab(){
saveCart();
const badge = document.getElementById('navCartBadge');
badge.textContent = String(cart.length);
badge.style.display = cart.length ? '' : 'none';
document.getElementById('navCartBtn').style.display = cart.length ? '' : 'none';
}

function cartItemRowHtml(skin, buyOne){
const photo = skin.photo_url
? `<img class="cart-item-photo" src="${escapeHtml(skin.photo_url)}" alt="" onerror="this.style.display='none'">`
: `<div class="cart-item-photo"></div>`;
return `<div class="cart-item">
${photo}
<div class="cart-item-info">
<div class="cart-item-title">${escapeHtml(skin.title)}</div>
<div class="cart-item-price">${formatCoins(skin.price)}</div>
</div>
${buyOne ? `<button type="button" class="cart-item-buy" data-cart-buy="${skin.id}">${escapeHtml((I18N[currentLang] || I18N.ru).cart_buy_one)}</button>` : ''}
<button type="button" class="cart-item-remove" data-cart-remove="${skin.id}">✕</button>
</div>`;
}

function renderCartOverlay(){
const list = document.getElementById('cartItemsList');
const dict = I18N[currentLang] || I18N.ru;
const items = cart.map(id => lastSkins.find(s => s.id === id)).filter(Boolean);

const balanceEl = document.getElementById('cartBalanceHint');
if (!items.length){
list.innerHTML = `<div class="skins-empty skins-empty-sm">${dict.cart_empty}</div>`;
document.getElementById('cartTotalAmount').textContent = formatCoins(0);
document.getElementById('cartCheckoutBtn').disabled = true;
balanceEl.textContent = '';
return;
}

const total = items.reduce((sum, s) => sum + s.price, 0);
const topupBtn = document.getElementById('cartTopupBtn');
topupBtn.hidden = true;
document.getElementById('cartTotalAmount').textContent = formatCoins(total);
// Гость в браузере: баланса у него нет — кнопка ведёт ко входу
// (её перехватывает app-web.js), без «не хватает денег».
if (window.DG_WEB && !window.DG_WEB.loggedIn){
list.innerHTML = items.map(s => cartItemRowHtml(s, false)).join('');
balanceEl.classList.remove('cart-short');
balanceEl.textContent = '';
document.getElementById('cartCheckoutBtn').disabled = false;
return;
}
// Корзина платит с баланса: сразу видно, хватает ли денег.
const balance = (typeof myAvailableBalance === 'number') ? myAvailableBalance : 0;
const missing = total - balance;
balanceEl.classList.toggle('cart-short', missing > 0);
balanceEl.textContent = missing > 0
? dict.cart_short.replace('{balance}', formatCoins(balance)).replace('{missing}', formatCoins(missing))
: dict.cart_balance.replace('{balance}', formatCoins(balance));
document.getElementById('cartCheckoutBtn').disabled = missing > 0;
// Денег не хватает — не тупик: у каждого лота кнопка «Купить» (обычная
// покупка картой или П2П) и, если пополнение включено, «Пополнить баланс».
list.innerHTML = items.map(s => cartItemRowHtml(s, missing > 0)).join('');
const openTopup = document.getElementById('openTopupBtn');
topupBtn.hidden = !(missing > 0 && openTopup && openTopup.style.display !== 'none');
}

document.getElementById('cartTopupBtn').addEventListener('click', () => {
document.getElementById('cartOverlay').classList.remove('show');
document.getElementById('openTopupBtn').click();
});

document.getElementById('cartCloseBtn').addEventListener('click', () => {
document.getElementById('cartOverlay').classList.remove('show');
});

document.getElementById('cartItemsList').addEventListener('click', (e) => {
const buy = e.target.closest('[data-cart-buy]');
if (buy){
const skin = lastSkins.find(s => s.id === Number(buy.dataset.cartBuy));
if (!skin) return;
document.getElementById('cartOverlay').classList.remove('show');
openBuySheet(skin);
return;
}
const btn = e.target.closest('[data-cart-remove]');
if (!btn) return;
const id = Number(btn.dataset.cartRemove);
cart = cart.filter(x => x !== id);
renderCartOverlay();
applyFiltersAndRender();
updateCartFab();
});

document.getElementById('cartCheckoutBtn').addEventListener('click', () => {
if (!tg || !tg.initData){
showAlert(errorMessage('unauthorized'));
return;
}
if (!cart.length) return;

const btn = document.getElementById('cartCheckoutBtn');
const status = document.getElementById('cartStatus');

btn.disabled = true;
status.textContent = '...';

fetch(API_BASE + '/api/cart/buy', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData, skin_ids: cart })
})
.then(async r => {
if (!r.ok){
const data = await r.json().catch(() => ({}));
const dict = I18N[currentLang] || I18N.ru;
if (data.error === 'insufficient_funds' && data.missing){
myAvailableBalance = Number(data.available) || 0;
renderCartOverlay();
throw new Error(dict.cart_short.replace('{balance}', formatCoins(data.available)).replace('{missing}', formatCoins(data.missing)));
}
if (data.error === 'cart_too_big') throw new Error(dict.cart_too_big.replace('{n}', data.max));
throw new Error(errorMessage(data.error));
}
return r.json();
})
.then(data => {
const dict = I18N[currentLang] || I18N.ru;
if (typeof data.available === 'number') myAvailableBalance = data.available;
const results = data.results || [];
const failed = results.filter(r => !r.ok);
const succeeded = results.filter(r => r.ok);

cart = cart.filter(id => !succeeded.some(r => r.skin_id === id));
updateCartFab();
loadMe();
loadSkins();

if (!failed.length){
status.textContent = dict.cart_success;
setTimeout(() => {
document.getElementById('cartOverlay').classList.remove('show');
status.textContent = '';
}, 900);
} else if (succeeded.length){
status.textContent = dict.cart_partial.replace('{n}', failed.length);
renderCartOverlay();
} else {
status.textContent = errorMessage(failed[0].error);
}
})
.catch(err => { status.textContent = friendlyErrorMessage(err); })
.finally(() => { btn.disabled = false; });
});

