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

const CATEGORY_ORDER = ['all','pistols','rifles','smgs','snipers','heavy','knives','gloves','stickers','other'];

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
return `<button type="button" class="category-chip${active}" data-cat="${cat}">${dict['cat_' + cat]}</button>`;
}).join('');
}

const categoryChipsEl = document.getElementById('categoryChips');
if (categoryChipsEl){
categoryChipsEl.addEventListener('click', (e) => {
const btn = e.target.closest('.category-chip');
if (!btn) return;
currentCategory = btn.dataset.cat;
renderCategoryChips();
applyFiltersAndRender();
});
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

const trustDict = I18N[currentLang] || I18N.ru;
const trustLabels = { new: trustDict.trust_level_new, verified: trustDict.trust_level_verified, trusted: trustDict.trust_level_trusted };
const sellerTrustBadge = skin.seller_trust_level
? `<div class="skin-seller-trust" title="${trustLabels[skin.seller_trust_level] || ''}">${TRUST_BADGE_ICON[skin.seller_trust_level] || ''} ${trustLabels[skin.seller_trust_level] || ''}</div>`
: '';

const rarityClass = RARITY_CLASS[skin.rarity] || '';

// В плотной сетке карточек цветная рамка сверху уже говорит о
// редкости — фоновая картинка поверх неё дублирует тот же сигнал
// и только добавляет визуального шума (плюс сами файлы тяжёлые).
// Фон-атмосфера остаётся там, где предмет один на весь экран —
// buyHero и компактное окно "Выставить лот".
const rarityBg = '';

const isOwn = currentUserId && skin.seller_id === currentUserId;

const inCart = cart.includes(skin.id);

const actionBtn = isOwn
? `<button class="skin-action own" data-open="${skin.id}" type="button">${(I18N[currentLang] || I18N.ru).btn_manage}</button>`
: `<button class="skin-action" data-buy="${skin.id}" type="button" style="width:100%;">${(I18N[currentLang] || I18N.ru).btn_buy}</button>`;

const weaponType = skin.weapon_type
? `<div class="skin-weapon-type">${escapeHtml(skin.weapon_type)}</div>`
: '';

const floatLine = (skin.float_value !== null && skin.float_value !== undefined)
? `<div class="skin-float">Float: ${Number(skin.float_value).toFixed(4)}</div>`
: '';

const title = skin.stattrak
? `StatTrak™ ${escapeHtml(skin.title)}`
: escapeHtml(skin.title);

const priceHtml = skin.original_price
? `<div class="skin-price"><span style="text-decoration:line-through; color:var(--muted); font-size:11px; margin-right:5px;">${formatCoins(skin.original_price)}</span>${formatCoins(skin.price)} <span style="color:#7ec98a; font-size:11px;">-${skin.discount_type === 'percent' ? skin.discount_value + '%' : formatCoins(skin.discount_value)}</span></div>`
: `<div class="skin-price">${formatCoins(skin.price)}</div>`;

return `
<div class="skin-card ${rarityClass}">
<div class="skin-photo-wrap"${rarityBg}>
${photo}
${wearBadge}
${stBadge}
</div>
${weaponType}
${sellerTrustBadge}
<div class="skin-title">${title}</div>
${floatLine}
${priceHtml}
${actionBtn}
</div>`;
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
deepLinkSkinId = tg.initDataUnsafe.start_param.slice(5);
}

let deepLinkAuctionId = null;
if (tg && tg.initDataUnsafe && typeof tg.initDataUnsafe.start_param === 'string' && tg.initDataUnsafe.start_param.startsWith('auction_')){
deepLinkAuctionId = Number(tg.initDataUnsafe.start_param.slice(8));
}

const deepLinkGiveaway = !!(tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param === 'giveaway');

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

filtered = filtered.slice();

if (sort === 'price_asc'){
filtered.sort((a, b) => a.price - b.price);
} else if (sort === 'price_desc'){
filtered.sort((a, b) => b.price - a.price);
} else {
filtered.sort((a, b) => b.id - a.id);
}

if (!filtered.length){
skinsList.innerHTML = `<div class="skins-empty">${lastSkins.length ? 'Ничего не нашлось' : 'Пока нет лотов — стань первым'}</div>`;
return;
}

skinsList.innerHTML = filtered.map(skinCardHtml).join('');
}

function renderSkins(list){
lastSkins = list || [];
applyFiltersAndRender();
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
skinSort.addEventListener('change', applyFiltersAndRender);

skinsList.addEventListener('click', (e) => {
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
}
});

