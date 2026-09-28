// ============================================================
// КАТЕГОРИИ ОРУЖИЯ (для раздела «Купить»)
//
// weapon_type у лотов из инвентаря Steam обычно содержит
// конкретную модель ("AK-47"), а не общую категорию — сводим
// известные модели к категориям сами. Для лотов, выставленных
// вручную (свободный текст), категоризация может быть неточной —
// в таком случае лот просто попадёт в «Другое».
// ============================================================

const WEAPON_CATEGORY_MAP = {
'Glock-18':'pistols','USP-S':'pistols','P2000':'pistols','Dual Berettas':'pistols',
'P250':'pistols','CZ75-Auto':'pistols','Five-SeveN':'pistols','Tec-9':'pistols',
'Desert Eagle':'pistols','R8 Revolver':'pistols',
'AK-47':'rifles','M4A4':'rifles','M4A1-S':'rifles','FAMAS':'rifles',
'Galil AR':'rifles','AUG':'rifles','SG 553':'rifles',
'AWP':'snipers','SSG 08':'snipers','SCAR-20':'snipers','G3SG1':'snipers',
'MP9':'smgs','MAC-10':'smgs','MP7':'smgs','UMP-45':'smgs',
'P90':'smgs','PP-Bizon':'smgs','MP5-SD':'smgs',
'Nova':'heavy','XM1014':'heavy','Sawed-Off':'heavy','MAG-7':'heavy',
'M249':'heavy','Negev':'heavy',
};

const CATEGORY_ORDER = ['all','knives','rifles','pistols','snipers','smgs','heavy','gloves','stickers','other'];

// Иконки категорий на главном экране — простые линии, в цвет текста.
const CATEGORY_ICONS = {
all: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
knives: '<path d="M4 20 10 14"/><path d="M10 14 19.5 4.5c1 3-.5 6.5-3 9L13 17z"/><path d="M8.5 12.5l3 3"/>',
rifles: '<path d="M2 11h13l2-2h5v3h-4l-1 1h-3l-2 5H9l1.5-5H2z"/>',
pistols: '<path d="M3 7h16v4h-7l-1.5 2H9l-1 6H4.5L6 11H3z"/>',
snipers: '<path d="M2 12.5h20"/><path d="M8 12.5V9.5h7v3"/><path d="M5 12.5 4 17h3l1-4.5"/>',
smgs: '<path d="M3 9h13v3.5h-4V19H9v-6.5H3z"/><path d="M16 10h4"/>',
heavy: '<path d="M2 11h15l4-2v5l-4-1H9l-1.5 4.5H5L6.5 13H2z"/>',
gloves: '<path d="M8 21v-6l-2.5-3.5V6a1.2 1.2 0 0 1 2.4 0v4"/><path d="M8 10V3.6a1.2 1.2 0 0 1 2.4 0V10"/><path d="M10.4 10V4.6a1.2 1.2 0 0 1 2.4 0V10"/><path d="M12.8 10V6a1.2 1.2 0 0 1 2.4 0v8c0 3-1.2 5-2.2 7"/>',
stickers: '<path d="M4 4h12l4 4v12H4z"/><path d="M16 4v4h4"/>',
other: '<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>',
sets: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
builder: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
};

function categoryIconSvg(key){
return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${CATEGORY_ICONS[key] || ''}</svg>`;
}

// Вкладка над товарами: popular | new | discounts (auctions — отдельный экран).
let currentShopTab = 'popular';

function categorizeSkin(skin){
const wt = (skin.weapon_type || '').trim();
const title = skin.title || '';

if (WEAPON_CATEGORY_MAP[wt]) return WEAPON_CATEGORY_MAP[wt];
if (/sticker/i.test(wt) || /^sticker/i.test(title)) return 'stickers';
if (/glove|wraps/i.test(wt) || /glove|wraps/i.test(title)) return 'gloves';
if (/knife/i.test(wt) || /knife/i.test(title) || title.startsWith('★')) return 'knives';
return 'other';
}

let currentCategory = 'all';

function renderCategoryChips(){
const dict = I18N[currentLang] || I18N.ru;
const chipsEl = document.getElementById('categoryChips');
if (!chipsEl) return;
chipsEl.innerHTML = CATEGORY_ORDER.map(cat => {
const active = cat === currentCategory ? ' active' : '';
return `<button type="button" class="category-chip${active}" data-cat="${cat}">${categoryIconSvg(cat)}<span>${dict['cat_' + cat]}</span></button>`;
}).join('')
// Сеты и билдер — инструменты каталога, в конце того же ряда.
+ `<button type="button" class="category-chip tool" data-tool="sets">${categoryIconSvg('sets')}<span>${dict.shop_tool_sets}</span></button>`
+ `<button type="button" class="category-chip tool" data-tool="builder">${categoryIconSvg('builder')}<span>${dict.shop_tool_builder}</span></button>`;
}

const categoryChipsEl = document.getElementById('categoryChips');
if (categoryChipsEl){
categoryChipsEl.addEventListener('click', (e) => {
const btn = e.target.closest('.category-chip');
if (!btn) return;
if (btn.dataset.tool){
document.getElementById(btn.dataset.tool === 'sets' ? 'openSetsBtn' : 'openBuilderBtn').click();
return;
}
currentCategory = btn.dataset.cat;
renderCategoryChips();
applyFiltersAndRender();
});
}

document.getElementById('shopTabs').addEventListener('click', (e) => {
const btn = e.target.closest('[data-shop-tab]');
if (!btn) return;
if (btn.dataset.shopTab === 'auctions'){
goToScreen('auctions');
return;
}
currentShopTab = btn.dataset.shopTab;
document.querySelectorAll('#shopTabs [data-shop-tab]').forEach(b => b.classList.toggle('active', b === btn));
applyFiltersAndRender();
});

// ---------- ❤️ «Следить» ----------
// Сердечко на карточке открывает «Следить» (уведомление, когда такой
// скин появится или подешевеет). Заполнено, если скин уже в списке.
let favQueries = new Set();

function isFavSkin(skin){
return favQueries.has(String(skin.title || '').trim().toLowerCase());
}

function loadFavQueries(){
if (!tg || !tg.initData) return;
fetch(API_BASE + '/api/wishlist?init_data=' + encodeURIComponent(tg.initData))
.then(r => r.json())
.then(data => {
favQueries = new Set((data.items || []).map(it => String(it.query || '').trim().toLowerCase()));
applyFiltersAndRender();
})
.catch(() => {});
}

renderCategoryChips();

const RARITY_CLASS = {
'Consumer Grade': 'rarity-consumer',
'Industrial Grade': 'rarity-industrial',
'Mil-Spec Grade': 'rarity-milspec',
'Restricted': 'rarity-restricted',
'Classified': 'rarity-classified',
'Covert': 'rarity-covert',
'Contraband': 'rarity-contraband',
'Extraordinary': 'rarity-extraordinary',
// Кейсы и капсулы.
'Base Grade': 'rarity-consumer',
'Stock': 'rarity-consumer',
// Наклейки, брелоки, граффити — своя лестница названий, цвета
// те же, что у оружейных редкостей.
'High Grade': 'rarity-milspec',
'Remarkable': 'rarity-restricted',
'Exotic': 'rarity-classified',
// Агенты — синий/фиолетовый/розовый/красный.
'Distinguished': 'rarity-milspec',
'Exceptional': 'rarity-restricted',
'Superior': 'rarity-classified',
'Master': 'rarity-covert',
};

const RARITY_GLOW = {
'Consumer Grade': 'rgba(174,194,209,0.26)',
'Industrial Grade': 'rgba(95,147,199,0.26)',
'Mil-Spec Grade': 'rgba(90,111,214,0.26)',
'Restricted': 'rgba(140,95,214,0.26)',
'Classified': 'rgba(193,91,201,0.26)',
'Covert': 'rgba(216,84,84,0.26)',
'Contraband': 'rgba(219,184,79,0.26)',
'Extraordinary': 'rgba(219,184,79,0.26)',
'Base Grade': 'rgba(174,194,209,0.26)',
'Stock': 'rgba(174,194,209,0.26)',
'High Grade': 'rgba(90,111,214,0.26)',
'Remarkable': 'rgba(140,95,214,0.26)',
'Exotic': 'rgba(193,91,201,0.26)',
'Distinguished': 'rgba(90,111,214,0.26)',
'Exceptional': 'rgba(140,95,214,0.26)',
'Superior': 'rgba(193,91,201,0.26)',
'Master': 'rgba(216,84,84,0.26)',
};

const RARITY_GLOW_STRONG = {
'Consumer Grade': 'rgba(174,194,209,0.6)',
'Industrial Grade': 'rgba(95,147,199,0.6)',
'Mil-Spec Grade': 'rgba(90,111,214,0.6)',
'Restricted': 'rgba(140,95,214,0.6)',
'Classified': 'rgba(193,91,201,0.6)',
'Covert': 'rgba(216,84,84,0.6)',
'Contraband': 'rgba(219,184,79,0.6)',
'Extraordinary': 'rgba(219,184,79,0.6)',
'Base Grade': 'rgba(174,194,209,0.6)',
'Stock': 'rgba(174,194,209,0.6)',
'High Grade': 'rgba(90,111,214,0.6)',
'Remarkable': 'rgba(140,95,214,0.6)',
'Exotic': 'rgba(193,91,201,0.6)',
'Distinguished': 'rgba(90,111,214,0.6)',
'Exceptional': 'rgba(140,95,214,0.6)',
'Superior': 'rgba(193,91,201,0.6)',
'Master': 'rgba(216,84,84,0.6)',
};

// Те же самые фоны, что бот подставляет в посты канала
// (RARITY_BACKGROUND_URLS в bot.py) — чтобы лот в мини-аппе и лот в
// канале выглядели одинаково. Файлы лежат рядом с index.html в том
// же репозитории GitHub Pages, поэтому путь относительный.
const RARITY_BG = {
'Consumer Grade': 'bg-consumer.png',
'Base Grade': 'bg-consumer.png',
'Stock': 'bg-consumer.png',
'Industrial Grade': 'bg-industrial.png',
'Mil-Spec Grade': 'bg-mil-spec.png',
'High Grade': 'bg-mil-spec.png',
'Distinguished': 'bg-mil-spec.png',
'Restricted': 'bg-restricted.png',
'Remarkable': 'bg-restricted.png',
'Exceptional': 'bg-restricted.png',
'Classified': 'bg-classified.png',
'Exotic': 'bg-classified.png',
'Superior': 'bg-classified.png',
'Covert': 'bg-covert.png',
'Master': 'bg-covert.png',
'Contraband': 'bg-contraband.png',
'Extraordinary': 'bg-contraband.png',
};

function skinCardHtml(skin){
const photo = skin.photo_url
? `<img class="skin-photo" src="${skin.photo_url}" alt="" onerror="showPlaceholderIcon(this)">`
: `<div class="skin-photo placeholder">${TARGET_ICON}</div>`;

const wearBadge = skin.wear && WEAR_LABELS[skin.wear]
? `<div class="skin-badge wear">${WEAR_LABELS[skin.wear]}</div>`
: '';

const stBadge = skin.stattrak
? `<div class="skin-badge stattrak">ST™</div>`
: '';

// Карточка в сетке компактная: float, наклейки и доверие к продавцу
// показываются в окне лота.
const rarityClass = RARITY_CLASS[skin.rarity] || '';

// В плотной сетке карточек цветная рамка сверху уже говорит о
// редкости — фоновая картинка поверх неё дублирует тот же сигнал
// и только добавляет визуального шума (плюс сами файлы тяжёлые).
// Фон-атмосфера остаётся там, где предмет один на весь экран —
// buyHero и компактное окно "Выставить лот".
const rarityBg = '';

const isOwn = currentUserId && skin.seller_id === currentUserId;

const inCart = cart.includes(skin.id);

const CART_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3h2l2.2 12.4a2 2 0 0 0 2 1.6h8.8a2 2 0 0 0 2-1.6L21 7H6"/></svg>';

// Свой лот — «Управлять»; чужой — корзина + «Купить».
const actionBtn = isOwn
? `<button class="skin-action own" data-open="${skin.id}" type="button">${(I18N[currentLang] || I18N.ru).btn_manage}</button>`
: `<div class="skin-action-row">
<button class="skin-cart-btn${inCart ? ' in-cart' : ''}" data-cart-toggle="${skin.id}" type="button" aria-label="Корзина">${CART_ICON}</button>
<button class="skin-action" data-buy="${skin.id}" type="button">${(I18N[currentLang] || I18N.ru).btn_buy}</button>
</div>`;

const favBtn = isOwn ? ''
: `<button type="button" class="skin-fav${isFavSkin(skin) ? ' on' : ''}" data-fav="${skin.id}" aria-label="Следить"><svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 20.5s-7.5-4.6-9.2-9.3C1.6 7.8 3.9 4.5 7.3 4.5c2 0 3.6 1.1 4.7 2.7 1.1-1.6 2.7-2.7 4.7-2.7 3.4 0 5.7 3.3 4.5 6.7-1.7 4.7-9.2 9.3-9.2 9.3z"/></svg></button>`;

const weaponType = skin.weapon_type
? `<div class="skin-weapon-type">${escapeHtml(skin.weapon_type)}</div>`
: '';

// В заголовке — только название раскраски: оружие уже строкой выше.
const bareTitle = String(skin.title || '').replace(/^★\s*/, '');
const shortTitle = skin.weapon_type && bareTitle.startsWith(skin.weapon_type + ' | ')
? bareTitle.slice(skin.weapon_type.length + 3)
: skin.title;
const title = skin.stattrak
? `StatTrak™ ${escapeHtml(shortTitle)}`
: escapeHtml(shortTitle);

const priceHtml = skin.original_price
? `<div class="skin-price"><span style="text-decoration:line-through; color:var(--muted); font-size:11px; margin-right:5px;">${formatCoins(skin.original_price)}</span>${formatCoins(skin.price)} <span style="color:#7ec98a; font-size:11px;">-${skin.discount_type === 'percent' ? skin.discount_value + '%' : formatCoins(skin.discount_value)}</span></div>`
: `<div class="skin-price">${formatCoins(skin.price)}</div>`;

return `
<div class="skin-card ${rarityClass}" data-card="${skin.id}">
<div class="skin-photo-wrap"${rarityBg}>
${photo}
${wearBadge}
${stBadge}
${favBtn}
</div>
${weaponType}
<div class="skin-title">${title}</div>
${priceHtml}
${actionBtn}
</div>`;
}

// ---------- наклейки ----------
// Картинки приходят с бэкенда (stickers: [{name, image, wear}]).
// size: 'mini' — полоска в карточке каталога, 'full' — ряд с
// названиями в окне покупки и в инвентаре.
function stickersHtml(stickers, size){
const list = (stickers || []).filter(st => st && st.image).slice(0, 5);
if (!list.length) return '';
const dict = I18N[currentLang] || I18N.ru;

if (size === 'mini'){
return `<div class="st-strip">${list.map(st => `
<img class="st-mini" src="${st.image}" alt="" loading="lazy" title="${escapeHtml(st.name || '')}">`).join('')}</div>`;
}

return `<div class="st-row">${list.map(st => {
const wear = st.wear ? dict.st_wear.replace('{p}', Math.round(st.wear * 100)) : dict.st_fresh;
return `<div class="st-item">
<div class="st-img"><img src="${st.image}" alt="" loading="lazy"></div>
<div class="st-name">${escapeHtml(st.name || '')}</div>
<div class="st-wear">${wear}</div>
</div>`;
}).join('')}</div>`;
}

function escapeHtml(str){
const div = document.createElement('div');
div.textContent = str == null ? '' : String(str);
return div.innerHTML;
}

let lastSkins = [];

let cart = [];

let activeFilters = {
priceMin: null,
priceMax: null,
floatMin: null,
floatMax: null,
stickers: 'any',
};

let deepLinkSkinId = null;
if (tg && tg.initDataUnsafe && typeof tg.initDataUnsafe.start_param === 'string' && tg.initDataUnsafe.start_param.startsWith('skin_')){
// skin_<id> или skin_<id>_r<пригласивший> (ссылка из «Поделиться» с GIF).
deepLinkSkinId = (tg.initDataUnsafe.start_param.match(/^skin_(\d+)/) || [])[1] || null;
}

let deepLinkAuctionId = null;
if (tg && tg.initDataUnsafe && typeof tg.initDataUnsafe.start_param === 'string' && tg.initDataUnsafe.start_param.startsWith('auction_')){
deepLinkAuctionId = Number(tg.initDataUnsafe.start_param.slice(8));
}

// «giveaway» — из поста в канале; ref_<id> — друг позвал по приглашению
// в розыгрыш, сразу показываем, куда его звали.
const deepLinkGiveaway = !!(tg && tg.initDataUnsafe && typeof tg.initDataUnsafe.start_param === 'string'
&& (tg.initDataUnsafe.start_param === 'giveaway' || tg.initDataUnsafe.start_param.startsWith('ref_')));

function applyFiltersAndRender(){
const q = skinSearch.value.trim().toLowerCase();
const sort = skinSort.value;

let filtered = lastSkins;

if (currentCategory && currentCategory !== 'all'){
filtered = filtered.filter(s => categorizeSkin(s) === currentCategory);
}

if (q){
filtered = filtered.filter(s =>
(s.title || '').toLowerCase().includes(q) ||
(s.weapon_type || '').toLowerCase().includes(q)
);
}

if (activeFilters.priceMin !== null){
filtered = filtered.filter(s => s.price >= activeFilters.priceMin);
}
if (activeFilters.priceMax !== null){
filtered = filtered.filter(s => s.price <= activeFilters.priceMax);
}
if (activeFilters.floatMin !== null){
filtered = filtered.filter(s => s.float_value !== null && s.float_value !== undefined && s.float_value >= activeFilters.floatMin);
}
if (activeFilters.floatMax !== null){
filtered = filtered.filter(s => s.float_value !== null && s.float_value !== undefined && s.float_value <= activeFilters.floatMax);
}
if (activeFilters.stickers === 'yes'){
filtered = filtered.filter(s => !!s.has_stickers);
} else if (activeFilters.stickers === 'no'){
filtered = filtered.filter(s => !s.has_stickers);
}

if (currentShopTab === 'discounts'){
filtered = filtered.filter(s => !!s.original_price);
}

filtered = filtered.slice();

if (sort === 'price_asc'){
filtered.sort((a, b) => a.price - b.price);
} else if (sort === 'price_desc'){
filtered.sort((a, b) => b.price - a.price);
} else if (sort === 'auto' && currentShopTab === 'popular'){
// Популярное — по просмотрам, при равенстве новые выше.
filtered.sort((a, b) => (b.view_count || 0) - (a.view_count || 0) || b.id - a.id);
} else {
filtered.sort((a, b) => b.id - a.id);
}

if (!filtered.length){
const dict = I18N[currentLang] || I18N.ru;
skinsList.innerHTML = `<div class="skins-empty">${!lastSkins.length ? dict.shop_empty_all
: currentShopTab === 'discounts' ? dict.shop_empty_discounts : dict.shop_empty_filtered}</div>`;
return;
}

skinsList.innerHTML = filtered.map(skinCardHtml).join('');
}

function renderSkins(list){
lastSkins = list || [];
applyFiltersAndRender();
if (typeof renderMyLots === 'function') renderMyLots();
if (typeof renderPromo === 'function') renderPromo();
if (deepLinkSkinId){
const targetId = deepLinkSkinId;
deepLinkSkinId = null;
const skin = lastSkins.find(s => String(s.id) === targetId);
if (skin){
openBuySheet(skin);
} else {
// Лот не в обычном каталоге — например, он уже
// зарезервирован (принятое предложение цены, победа в
// аукционе, отклик на buy-заявку). Запрашиваем его отдельно.
fetch(API_BASE + '/api/skins/' + targetId)
.then(r => r.json())
.then(data => {
if (data && data.skin) openBuySheet(data.skin);
})
.catch(() => {});
}
}
}

function loadSkins(){
fetch(API_BASE + '/api/skins')
.then(r => r.json())
.then(renderSkins)
.catch(() => {
// Если каталог уже был показан (повторная подгрузка упала) —
// оставляем старые лоты на месте и сообщаем тостом, а не
// затираем экран ошибкой.
if (lastSkins.length){
showErrorToast(new TypeError('network'), loadSkins);
return;
}
const dict = I18N[currentLang] || I18N.ru;
if (typeof haptic === 'function') haptic('error');
renderErrorState(skinsList, dict.catalog_load_failed, () => {
skinsList.innerHTML = skeletonCardsHtml(6, 'lot');
loadSkins();
});
});
}

skinSearch.addEventListener('input', applyFiltersAndRender);
skinSort.addEventListener('change', () => {
applyFiltersAndRender();
if (typeof updateFiltersBadge === 'function') updateFiltersBadge();
});

function onSkinGridClick(e){
const favBtn = e.target.closest('[data-fav]');
if (favBtn){
const skin = lastSkins.find(s => String(s.id) === favBtn.dataset.fav);
if (skin) openWatchSheet(skin);
return;
}
const buyBtn = e.target.closest('[data-buy]');
if (buyBtn){
const skin = lastSkins.find(s => String(s.id) === buyBtn.dataset.buy);
if (skin) openBuySheet(skin);
return;
}
const openBtn = e.target.closest('[data-open]');
if (openBtn){
const skin = lastSkins.find(s => String(s.id) === openBtn.dataset.open);
if (skin) openBuySheet(skin);
return;
}
const cartBtn = e.target.closest('[data-cart-toggle]');
if (cartBtn){
const id = Number(cartBtn.dataset.cartToggle);
toggleCartItem(id);
return;
}
// Нажатие на саму карточку (не на кнопку внутри) открывает лот —
// не нужно целиться в маленькую кнопку.
const card = e.target.closest('[data-card]');
if (card && !e.target.closest('button, a, input, select')){
const skin = lastSkins.find(s => String(s.id) === card.dataset.card);
if (skin) openBuySheet(skin);
}
}

skinsList.addEventListener('click', onSkinGridClick);
document.getElementById('myLotsList').addEventListener('click', onSkinGridClick);

loadFavQueries();

