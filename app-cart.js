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

function updateCartFab(){
const fab = document.getElementById('cartFab');
if (cart.length){
fab.style.display = 'flex';
document.getElementById('cartFabCount').textContent = String(cart.length);
} else {
fab.style.display = 'none';
}
}

function cartItemRowHtml(skin){
const photo = skin.photo_url
? `<img class="cart-item-photo" src="${skin.photo_url}" alt="" onerror="this.style.display='none'">`
: `<div class="cart-item-photo"></div>`;
return `<div class="cart-item">
${photo}
<div class="cart-item-info">
<div class="cart-item-title">${escapeHtml(skin.title)}</div>
<div class="cart-item-price">${formatCoins(skin.price)}</div>
</div>
<button type="button" class="cart-item-remove" data-cart-remove="${skin.id}">✕</button>
</div>`;
}

function renderCartOverlay(){
const list = document.getElementById('cartItemsList');
const dict = I18N[currentLang] || I18N.ru;
const items = cart.map(id => lastSkins.find(s => s.id === id)).filter(Boolean);

if (!items.length){
list.innerHTML = `<div class="skins-empty" style="padding:12px 4px;">${dict.cart_empty}</div>`;
document.getElementById('cartTotalAmount').textContent = formatCoins(0);
document.getElementById('cartCheckoutBtn').disabled = true;
return;
}

list.innerHTML = items.map(cartItemRowHtml).join('');
const total = items.reduce((sum, s) => sum + s.price, 0);
document.getElementById('cartTotalAmount').textContent = formatCoins(total);
document.getElementById('cartCheckoutBtn').disabled = false;
}

document.getElementById('cartFab').addEventListener('click', () => {
renderCartOverlay();
document.getElementById('cartStatus').textContent = '';
document.getElementById('cartOverlay').classList.add('show');
});

document.getElementById('cartCloseBtn').addEventListener('click', () => {
document.getElementById('cartOverlay').classList.remove('show');
});

document.getElementById('cartItemsList').addEventListener('click', (e) => {
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
throw new Error(errorMessage(data.error));
}
return r.json();
})
.then(data => {
const dict = I18N[currentLang] || I18N.ru;
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

