// ============================================================
// ВЫВОД СРЕДСТВ
// ============================================================

const wAmount = document.getElementById('wAmount');
const wDetails = document.getElementById('wDetails');
const withdrawSubmitBtn = document.getElementById('withdrawSubmitBtn');
const withdrawStatus = document.getElementById('withdrawStatus');
const withdrawPayoutPreview = document.getElementById('withdrawPayoutPreview');

function updateWithdrawPayoutPreview(){
const amount = Number(wAmount.value);
if (!amount || amount <= 0){
withdrawPayoutPreview.textContent = '';
return;
}
// Ставка приходит с сервера (withdrawFeePercent) — по оферте она нулевая.
const fee = Number(withdrawFeePercent) || 0;
const payout = Math.round(amount * (100 - fee) / 100);
withdrawPayoutPreview.textContent = fee
? (I18N[currentLang] || I18N.ru).withdraw_payout_fee.replace('{sum}', formatCoins(payout)).replace('{fee}', fee)
: (I18N[currentLang] || I18N.ru).withdraw_payout_nofee.replace('{sum}', formatCoins(payout));
}

wAmount.addEventListener('input', updateWithdrawPayoutPreview);

const WITHDRAW_ERROR_MESSAGES_RU = {
no_payment_details: 'Укажи карту и Ф.И.О. владельца карты.',
payout_name_mismatch: 'Вывод возможен только на свою карту: Ф.И.О. держателя должно совпадать с Ф.И.О. из проверки продавца. Впиши имя так, как на карте (можно латиницей). Если всё верно, а ошибка остаётся — напиши в поддержку.',
below_minimum: 'Сумма меньше минимальной для вывода.',
insufficient_funds: 'Недостаточно средств на балансе.',
feature_disabled: 'Вывод сейчас временно недоступен.',
totp_required: 'Неверный или устаревший код 2FA — попробуй новый код из приложения.',
totp_locked: `Слишком много неверных попыток — 2FA временно заблокирована на ${15} минут.`,
};

const WITHDRAW_ERROR_MESSAGES_UZ = {
no_payment_details: "Karta va karta egasining F.I.Sh.ni kiriting.",
payout_name_mismatch: "Pul faqat o'z kartangizga chiqariladi: karta egasining F.I.Sh. sotuvchi tekshiruvidagi F.I.Sh. bilan mos bo'lishi kerak. Ismni kartadagidek yozing (lotincha ham mumkin). Hammasi to'g'ri, lekin xato qolsa — qo'llab-quvvatlash xizmatiga yozing.",
below_minimum: "Summa chiqarish uchun minimaldan kam.",
insufficient_funds: "Balansda mablag' yetarli emas.",
feature_disabled: "Pul chiqarish hozircha vaqtincha mavjud emas.",
totp_required: "2FA kodi noto'g'ri yoki eskirgan — ilovadagi yangi kodni kiriting.",
totp_locked: `Juda ko'p noto'g'ri urinish — 2FA ${15} daqiqaga vaqtincha bloklandi.`,
};

const WITHDRAW_ERROR_MESSAGES_EN = {
no_payment_details: "Enter the card and the cardholder's full name.",
payout_name_mismatch: "Withdrawals go only to your own card: the cardholder's full name must match the name from seller verification. Write the name as it is on the card (Latin letters are fine). If everything is correct and the error persists, contact support.",
below_minimum: 'The amount is below the withdrawal minimum.',
insufficient_funds: 'Not enough funds on your balance.',
feature_disabled: 'Withdrawals are temporarily unavailable.',
totp_required: 'Wrong or expired 2FA code — try a new code from the app.',
totp_locked: `Too many wrong attempts — 2FA is locked for ${15} minutes.`,
};

function withdrawTrustLimitMessage(data){
if (data.error === 'single_limit'){
return (I18N[currentLang] || I18N.ru).withdraw_single_limit.replace('{sum}', formatCoins(data.limit));
}
if (data.error === 'daily_limit'){
return (I18N[currentLang] || I18N.ru).withdraw_daily_limit.replace('{sum}', formatCoins(data.limit));
}
return null;
}

withdrawSubmitBtn.addEventListener('click', () => {
if (!tg || !tg.initData){
withdrawStatus.textContent = errorMessage('unauthorized');
return;
}

const dict = I18N[currentLang] || I18N.ru;
const amount = Number(wAmount.value);

if (!amount || amount <= 0){
withdrawStatus.textContent = dict.withdraw_need_amount;
return;
}

let payload = { init_data: tg.initData, amount: amount, method: 'card' };

if (totp2faStatus.enabled_withdraw){
const totpCode = document.getElementById('wTotpCode').value.trim();
if (!totpCode){
withdrawStatus.textContent = dict.withdraw_need_totp;
return;
}
payload.totp_code = totpCode;
}

const details = wDetails.value.trim();
if (!details){
withdrawStatus.textContent = dict.withdraw_need_card;
return;
}
if (details.length < 10){
withdrawStatus.textContent = dict.withdraw_need_fio;
return;
}
payload.payment_details = details;

withdrawSubmitBtn.disabled = true;
withdrawStatus.textContent = dict.withdraw_sending;

fetch(API_BASE + '/api/withdraw', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(payload)
})
.then(async r => {
if (!r.ok){
const data = await r.json().catch(() => ({}));
throw new Error(withdrawTrustLimitMessage(data) || langMessage(WITHDRAW_ERROR_MESSAGES_RU, WITHDRAW_ERROR_MESSAGES_UZ, WITHDRAW_ERROR_MESSAGES_EN, data.error) || errorMessage(data.error));
}
return r.json();
})
.then(data => {
const payoutText = data.payout ? ` ${dict.withdraw_will_arrive.replace('{amount}', formatCoins(data.payout))}` : '';
withdrawStatus.textContent = dict.withdraw_submitted.replace('{id}', data.id) + payoutText;
wAmount.value = '';
wDetails.value = '';
withdrawPayoutPreview.textContent = '';
loadProfile();
})
.catch(err => {
withdrawStatus.textContent = friendlyErrorMessage(err);
})
.finally(() => {
withdrawSubmitBtn.disabled = false;
});
});

// ============================================================
// ИНВЕНТАРЬ STEAM
//
// Поиск, фильтры (тип, износ, только без трейд-бана), сортировка.
// «Выбрать» отмечает предметы (до INV_PICK_MAX), внизу — панель с
// миниатюрами и «Продолжить»: выбранные выставляются по очереди,
// каждый в компактном окне «Выставить лот». В режиме выбора приза
// (inventoryPickHandler) «Выбрать» сразу отдаёт предмет обработчику.
// ============================================================

const INV_PICK_MAX = 50;

// Порядок редкости — для сортировки «сначала редкие».
const RARITY_RANK = {
'Consumer Grade': 1, 'Base Grade': 1, 'Stock': 1,
'Industrial Grade': 2,
'Mil-Spec Grade': 3, 'High Grade': 3, 'Distinguished': 3,
'Restricted': 4, 'Remarkable': 4, 'Exceptional': 4,
'Classified': 5, 'Exotic': 5, 'Superior': 5,
'Covert': 6, 'Master': 6,
'Contraband': 7, 'Extraordinary': 7,
};

const HEART_SVG = '<svg class="gi" width="18" height="18" aria-hidden="true"><use href="#gi-heart"/></svg>';

let invPicked = [];          // выбранные предметы (объекты из lastInventoryItems)
let invTradableOnly = false;
// Цены рынка по market_hash_name (сум) — для «инвентарь стоит N»,
// суммы выбранных и сортировки «сначала дорогие». Приходят порциями.
let invPrices = {};
let invPricesLoading = false;
let invPricesSeq = 0;
const INV_TOP_PICK = 5;
const INV_CATEGORY_ORDER = ['knives','gloves','rifles','snipers','pistols','smgs','heavy','stickers','other'];

function invItemPrice(item){
return invPrices[item.market_hash_name] || 0;
}

// Цены всех предметов: бот отдаёт из кэша сразу, остальные дотягивает
// с рынка порциями (pending > 0 — спрашиваем ещё раз).
function loadInvPrices(){
if (!tg || !tg.initData) return;
const seq = ++invPricesSeq;
const names = [...new Set(lastInventoryItems.map(it => it.market_hash_name).filter(Boolean))];
if (!names.length) return;
invPricesLoading = true;
renderInvStats();
const step = (attempt) => fetch(API_BASE + '/api/steam/inventory/prices', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData, names: names.filter(n => !invPrices[n]) })
})
.then(r => r.ok ? r.json() : { prices: {}, pending: 0 })
.then(data => {
if (seq !== invPricesSeq) return;
Object.assign(invPrices, data.prices || {});
if (data.pending > 0 && attempt < 6){
renderInventory();
return step(attempt + 1);
}
invPricesLoading = false;
renderInventory();
})
.catch(() => {
if (seq !== invPricesSeq) return;
invPricesLoading = false;
renderInvStats();
});
step(0);
}

function renderInvStats(){
const box = document.getElementById('invStats');
box.style.display = (lastInventoryItems.length && !inventoryPickHandler) ? '' : 'none';
const tradable = lastInventoryItems.filter(it => it.tradable !== false);
const total = tradable.reduce((sum, it) => sum + invItemPrice(it), 0);
document.getElementById('invStatValue').textContent = total
? formatCoins(total) + (invPricesLoading ? ' …' : '')
: '…';
// Цен нет совсем (бот их не отдал) — плитку стоимости прячем, а не
// показываем прочерк.
const noPrices = !total && !invPricesLoading;
document.getElementById('invStatValue').parentElement.hidden = noPrices;
box.classList.toggle('one', noPrices);
document.getElementById('invStatSellable').textContent = String(tradable.length);
}

// Категории кнопками: только те, что есть в инвентаре, с количеством.
function renderInvTypeChips(){
const dict = I18N[currentLang] || I18N.ru;
const current = document.getElementById('invTypeFilter').value;
const counts = {};
lastInventoryItems.forEach(it => { const c = categorizeSkin(it); counts[c] = (counts[c] || 0) + 1; });
const chip = (cat, n) => `<button type="button" class="category-chip inv-type-chip${cat === current ? ' active' : ''}" data-inv-type="${cat}"><span>${escapeHtml(dict[cat === 'all' ? 'cat_all' : 'cat_' + cat] || cat)}</span><b>${n}</b></button>`;
const top = (!inventoryPickHandler && Object.keys(invPrices).length)
? `<button type="button" class="category-chip inv-top-chip" id="invTopPickBtn">${escapeHtml(dict.inv_top_pick.replace('{n}', INV_TOP_PICK))}</button>`
: '';
document.getElementById('invTypeChips').innerHTML = lastInventoryItems.length
? chip('all', lastInventoryItems.length) + top + INV_CATEGORY_ORDER.filter(c => counts[c]).map(c => chip(c, counts[c])).join('')
: '';
}

// «5 самых дорогих»: добавляет к выбору дорогие передаваемые скины.
function pickTopExpensive(){
const dict = I18N[currentLang] || I18N.ru;
const candidates = lastInventoryItems
.filter(it => it.tradable !== false && invItemPrice(it) > 0 && !isInvPicked(it))
.sort((a, b) => invItemPrice(b) - invItemPrice(a));
const room = Math.max(0, INV_PICK_MAX - invPicked.length);
const add = candidates.slice(0, Math.min(INV_TOP_PICK, room));
if (!add.length){
showToast(candidates.length ? dict.inv_limit.replace('{max}', INV_PICK_MAX) : dict.inv_top_none);
return;
}
invPicked.push(...add);
haptic('light');
renderInventory();
showToast(dict.inv_top_done.replace('{n}', add.length));
}

function invKey(item){
return String(item.asset_id || item.title);
}

function isInvPicked(item){
return invPicked.some(p => invKey(p) === invKey(item));
}

function invSplitTitle(item){
const rawTitle = String(item.title || '').replace(/^★\s*/, '');
const parts = rawTitle.split('|');
return {
weapon: parts.length > 1 ? parts[0].trim() : '',
skin: parts.length > 1 ? parts.slice(1).join('|').trim() : rawTitle,
};
}

function invFilteredItems(){
const q = document.getElementById('invSearch').value.trim().toLowerCase();
const type = document.getElementById('invTypeFilter').value;
const wear = document.getElementById('invWearFilter').value;
const sort = document.getElementById('invSort').value;
let list = lastInventoryItems.map((item, i) => ({ item, i }));
if (q) list = list.filter(({ item }) => String(item.title || '').toLowerCase().includes(q));
if (type !== 'all') list = list.filter(({ item }) => categorizeSkin(item) === type);
if (wear !== 'all') list = list.filter(({ item }) => item.wear === wear);
if (invTradableOnly) list = list.filter(({ item }) => item.tradable !== false);
if (sort === 'rare' || sort === 'common'){
const dir = sort === 'rare' ? -1 : 1;
list.sort((a, b) => dir * ((RARITY_RANK[a.item.rarity] || 0) - (RARITY_RANK[b.item.rarity] || 0)) || a.i - b.i);
} else if (sort === 'price'){
list.sort((a, b) => invItemPrice(b.item) - invItemPrice(a.item) || a.i - b.i);
} else if (sort === 'float'){
const f = x => (x.item.float_value === null || x.item.float_value === undefined) ? 2 : Number(x.item.float_value);
list.sort((a, b) => f(a) - f(b) || a.i - b.i);
}
return list;
}

function renderInventory(){
const dict = I18N[currentLang] || I18N.ru;
if (!lastInventoryItems.length){
inventoryStatus.textContent = dict.inventory_empty;
inventoryGrid.innerHTML = '';
return;
}
const list = invFilteredItems();
inventoryStatus.textContent = list.length ? '' : dict.inv_nothing_found;
const pickMode = !!inventoryPickHandler;
inventoryGrid.innerHTML = list.map(({ item, i }) => {
const photo = item.photo_url ? `<img src="${escapeHtml(item.photo_url)}" alt="" loading="lazy">` : '';
const wearText = item.wear ? WEAR_LABELS[item.wear] || '' : '';
const isTradable = item.tradable !== false;
const lockUntil = invLockUntil(item);
const sellable = isTradable || !!lockUntil;
const rarityClass = RARITY_CLASS[item.rarity] || 'rarity-consumer';
const hasFloat = item.float_value !== null && item.float_value !== undefined;
const picked = isInvPicked(item);
const { weapon, skin } = invSplitTitle(item);
const price = invItemPrice(item);

// Полоска износа с меткой на месте точного float — как в CSFloat.
const floatBlock = hasFloat
? `<div class="inv-item-wearbar"><div class="inv-item-wearbar-mark" style="left:${(Math.min(1, Math.max(0, item.float_value)) * 100).toFixed(2)}%"></div></div>
<div class="inv-float-line">Float: <b>${formatFloat(item.float_value)}</b>${item.pattern ? ` <span>#${escapeHtml(String(item.pattern))}</span>` : ''}</div>`
: '';

const badges = [];
if (wearText) badges.push(`<span class="inv-badge">${wearText}</span>`);
if (item.stattrak) badges.push('<span class="inv-badge st">ST™</span>');
if (!isTradable) badges.push(lockUntil
? `<span class="inv-badge ban">🔒 <span data-unlock="${lockUntil}">${tradeLockLeft(lockUntil)}</span></span>`
: '<span class="inv-badge ban">🔒</span>');

const pickLabel = !sellable && !pickMode ? '🔒'
: picked ? dict.inv_picked_btn : dict.inv_pick;

return `
<div class="inv-item ${rarityClass}${sellable ? '' : ' inv-item-banned'}${picked ? ' selected' : ''}" data-idx="${i}">
<div class="inv-item-photo">
<div class="inv-badges">${badges.join('')}</div>
<button type="button" class="skin-fav inv-fav${isFavSkin(item) ? ' on' : ''}" data-inv-fav="${i}" aria-label="${escapeHtml((I18N[currentLang] || I18N.ru).watch_aria)}">${HEART_SVG}</button>
${photo}
</div>
<div class="inv-item-body">
<div class="inv-item-weapon">${weapon ? escapeHtml(weapon) : ''}</div>
<div class="inv-item-skin">${escapeHtml(skin)}</div>
${floatBlock}
${price ? `<div class="inv-item-price">≈ ${formatCoins(price)}</div>` : ''}
<div class="inv-item-actions">
<button type="button" class="inv-more" data-inv-more="${i}">${dict.inv_more}</button>
<button type="button" class="inv-pick${picked ? ' on' : ''}" data-inv-pick="${i}"${!sellable && !pickMode ? ' disabled' : ''}>${pickLabel}</button>
</div>
</div>
</div>`;
}).join('');
renderInvPicked();
renderInvStats();
renderInvTypeChips();
}

function renderInvPicked(){
const dict = I18N[currentLang] || I18N.ru;
if (!sellAllRunning) document.getElementById('invSellAllBtn').textContent = dict.inv_sell_all.replace('{p}', SELL_ALL_DISCOUNT);
const box = document.getElementById('invPicked');
box.style.display = invPicked.length && !inventoryPickHandler ? '' : 'none';
document.getElementById('invPickedCount').textContent = dict.inv_of.replace('{n}', invPicked.length).replace('{max}', INV_PICK_MAX);
const pickedSum = invPicked.reduce((sum, it) => sum + invItemPrice(it), 0);
document.getElementById('invPickedSum').textContent = pickedSum ? '≈ ' + formatCoins(pickedSum) : '';
document.getElementById('invPickedThumbs').innerHTML = invPicked.map(item => `
<div class="inv-thumb">${item.photo_url ? `<img src="${escapeHtml(item.photo_url)}" alt="">` : ''}<button type="button" data-inv-unpick="${escapeHtml(invKey(item))}">✕</button></div>`).join('')
+ '<button type="button" class="inv-thumb add" id="invPickMore">+</button>';
}

// Предмет в трейд-бане, который можно выставить: Steam сказал, когда бан
// снимется, и это не дальше 8 дней (так же проверяет бот). Иначе 0.
const INV_LOCK_MAX_MS = 8 * 24 * 3600 * 1000;
function invLockUntil(item){
if (!item || item.tradable !== false || !item.tradable_after) return 0;
const t = Date.parse(item.tradable_after);
return t > Date.now() && t - Date.now() <= INV_LOCK_MAX_MS ? t : 0;
}

function toggleInvPick(item){
const dict = I18N[currentLang] || I18N.ru;
const lockUntil = invLockUntil(item);
if (item.tradable === false && !lockUntil){
showAlert(dict.inv_trade_ban);
return;
}
// В трейд-бане, но Steam сказал, когда снимется, — выставить можно, с таймером.
if (lockUntil && !isInvPicked(item)) showToast(dict.tl_inv_hint.replace('{date}', tradeLockDate(lockUntil)));
if (isInvPicked(item)){
invPicked = invPicked.filter(p => invKey(p) !== invKey(item));
} else if (invPicked.length >= INV_PICK_MAX){
showToast(dict.inv_limit.replace('{max}', INV_PICK_MAX));
return;
} else {
invPicked.push(item);
}
haptic('light');
renderInventory();
}

let lastInventoryItems = [];
// Если задан — окно инвентаря выбирает предмет для этого обработчика
// (например, приз розыгрыша в админке), а не для продажи.
let inventoryPickHandler = null;
let pendingSkinAssetId = null;
let pendingSkinInspectLink = null;

function formatWaitHours(hours){
const dict = I18N[currentLang] || I18N.ru;
if (hours >= 1) return `${Math.ceil(hours)} ${dict.unit_hours_short}`;
return `${Math.max(1, Math.ceil(hours * 60))} ${dict.unit_minutes_short}`;
}

// Окно инвентаря открывается заново — выбор и фильтры сбрасываем.
function openInventory(){
const dict = I18N[currentLang] || I18N.ru;
invPicked = [];
document.getElementById('invSearch').value = '';
document.getElementById('invTypeFilter').value = 'all';
document.getElementById('invWearFilter').value = 'all';
document.getElementById('invSort').value = inventoryPickHandler ? 'steam' : 'price';
document.getElementById('invHeadSub').textContent = inventoryPickHandler ? dict.inv_subtitle_pick : dict.inv_subtitle;
renderInvPicked();
inventoryOverlay.classList.add('show');
inventoryOverlay.querySelector('.inventory-sheet').scrollTop = 0;
loadInventory(false);
}

function loadInventory(forceRefresh){
const dict = I18N[currentLang] || I18N.ru;
// Скелетоны вместо пустой сетки; текст оставляем только для
// ручного обновления — там полезно знать, что идёт запрос к Steam.
inventoryStatus.textContent = forceRefresh ? dict.inventory_refreshing : '';
inventoryGrid.innerHTML = skeletonCardsHtml(6, 'inv');
let url = API_BASE + '/api/steam/inventory?init_data=' + encodeURIComponent(tg.initData);
if (forceRefresh) url += '&refresh=1';
// WebView Telegram (и некоторые браузеры) могут закэшировать GET по
// этому же URL — тогда повторный клик "Обновить" покажет тот же
// самый старый ответ вместо нового сетевого запроса. Добавляем
// метку времени + явный запрет кэша, чтобы URL был каждый раз
// новым и кэш точно не сработал.
url += '&_t=' + Date.now();
fetch(url, { cache: 'no-store' })
.then(async r => {
if (!r.ok){
const data = await r.json().catch(() => ({}));
if (data.error === 'refresh_limited'){
const limitErr = new Error((I18N[currentLang] || I18N.ru).inventory_refresh_limited.replace('{wait}', formatWaitHours(data.wait_hours)));
limitErr.noRetry = true;
throw limitErr;
}
throw new Error(steamErrorMessage(data.error));
}
return r.json();
})
.then(data => {
lastInventoryItems = data.items || [];
// После обновления выбранные остаются выбранными, если они ещё есть.
invPicked = invPicked.filter(p => lastInventoryItems.some(it => invKey(it) === invKey(p)));
renderInventory();
loadInvPrices();
})
.catch(err => {
const msg = friendlyErrorMessage(err);
// Лимит обновлений — повтор бесполезен: возвращаем уже
// загруженный ранее инвентарь и показываем причину тостом.
if (err.noRetry){
inventoryStatus.textContent = '';
if (lastInventoryItems.length) renderInventory();
else renderErrorState(inventoryGrid, msg, null);
showToast(msg, { type: 'error' });
return;
}
inventoryStatus.textContent = '';
renderErrorState(inventoryGrid, msg, () => loadInventory(forceRefresh));
});
}

openInventoryBtn.addEventListener('click', () => {
if (!tg || !tg.initData) return;
inventoryPickHandler = null;
openInventory();
});

inventoryRefreshBtn.addEventListener('click', () => {
if (!tg || !tg.initData) return;
loadInventory(true);
});

inventoryCancel.addEventListener('click', () => {
inventoryPickHandler = null;
inventoryOverlay.classList.remove('show');
});

['invSearch', 'invTypeFilter', 'invWearFilter', 'invSort'].forEach(id => {
document.getElementById(id).addEventListener(id === 'invSearch' ? 'input' : 'change', () => {
if (lastInventoryItems.length) renderInventory();
});
});

document.getElementById('invTypeChips').addEventListener('click', (e) => {
if (e.target.closest('#invTopPickBtn')){
pickTopExpensive();
return;
}
const chip = e.target.closest('[data-inv-type]');
if (!chip) return;
document.getElementById('invTypeFilter').value = chip.dataset.invType;
renderInventory();
});

document.getElementById('invTradableBtn').addEventListener('click', (e) => {
invTradableOnly = !invTradableOnly;
e.currentTarget.classList.toggle('active', invTradableOnly);
showToast((I18N[currentLang] || I18N.ru)[invTradableOnly ? 'inv_tradable_on' : 'inv_tradable_off']);
if (lastInventoryItems.length) renderInventory();
});

// Выбор предмета: в режиме приза — сразу обработчику, иначе — отметка.
function pickInventoryItem(item){
if (inventoryPickHandler){
const handler = inventoryPickHandler;
inventoryPickHandler = null;
inventoryOverlay.classList.remove('show');
handler(item);
return;
}
toggleInvPick(item);
}

inventoryGrid.addEventListener('click', (e) => {
const card = e.target.closest('.inv-item');
if (!card) return;
const item = lastInventoryItems[Number(card.dataset.idx)];
if (!item) return;
if (e.target.closest('[data-inv-fav]')){
openWatchSheet(item);
return;
}
if (e.target.closest('[data-inv-more]')){
openInvDetail(item);
return;
}
// «Выбрать» и нажатие на саму карточку — одно и то же.
pickInventoryItem(item);
});

document.getElementById('invPickedThumbs').addEventListener('click', (e) => {
const un = e.target.closest('[data-inv-unpick]');
if (un){
invPicked = invPicked.filter(p => invKey(p) !== un.dataset.invUnpick);
renderInventory();
return;
}
if (e.target.closest('#invPickMore')) inventoryGrid.closest('.inventory-sheet').scrollTo({ top: 0, behavior: 'smooth' });
});

// ---------- подробнее о предмете ----------

let invDetailItem = null;

function openInvDetail(item){
const dict = I18N[currentLang] || I18N.ru;
invDetailItem = item;
const { weapon, skin } = invSplitTitle(item);
document.getElementById('invDetailWeapon').textContent = weapon;
document.getElementById('invDetailTitle').textContent = (item.stattrak ? 'StatTrak™ ' : '') + skin;
const hasFloat = item.float_value !== null && item.float_value !== undefined;
const rows = [
[dict.inv_detail_wear, item.wear ? `${WEAR_LABELS[item.wear] || item.wear}` : '—'],
['Float', hasFloat ? formatFloat(item.float_value) : '—'],
[dict.inv_detail_pattern, item.pattern ? '#' + item.pattern : '—'],
[dict.inv_detail_rarity, item.rarity || '—'],
[dict.inv_detail_trade, item.tradable === false
? (invLockUntil(item) ? dict.inv_detail_banned + ' · ' + tradeLockDate(invLockUntil(item)) : dict.inv_detail_banned)
: dict.inv_detail_ok],
];
const rarityClass = RARITY_CLASS[item.rarity] || 'rarity-consumer';
document.getElementById('invDetailBody').innerHTML = `
<div class="inv-item ${rarityClass} inv-detail-photo"><div class="inv-item-photo">${item.photo_url ? `<img src="${escapeHtml(item.photo_url)}" alt="">` : ''}</div></div>
${hasFloat ? `<div class="inv-item-wearbar" style="margin-top:10px;"><div class="inv-item-wearbar-mark" style="left:${(Math.min(1, Math.max(0, item.float_value)) * 100).toFixed(2)}%"></div></div>` : ''}
${rows.map(([k, v]) => `<div class="raffle-proof-row"><span>${k}</span><b>${escapeHtml(String(v))}</b></div>`).join('')}
${stickersHtml(item.stickers, 'full')}`;
const pickBtn = document.getElementById('invDetailPick');
pickBtn.textContent = isInvPicked(item) ? dict.inv_picked_btn : dict.inv_pick;
pickBtn.disabled = item.tradable === false && !invLockUntil(item) && !inventoryPickHandler;
const btn3d = document.getElementById('invDetail3d');
btn3d.style.display = 'none';
ensure3DScript().then(() => loadModelIndex()).then(map => {
const entry = map[modelIndexKey((item.stattrak ? 'StatTrak™ ' : '') + item.title)] || map[modelIndexKey(item.title)];
if (!entry || invDetailItem !== item) return;
btn3d.style.display = '';
btn3d.onclick = () => open3DViewer(entry.model, item.title, entry.skin, Number(item.float_value) || 0, entry.weapon || null, 'none', item.pattern, item.stickers, item.photo_url);
}).catch(() => {});
document.getElementById('invDetailOverlay').classList.add('show');
}

document.getElementById('invDetailClose').addEventListener('click', () => {
document.getElementById('invDetailOverlay').classList.remove('show');
});

document.getElementById('invDetailPick').addEventListener('click', () => {
document.getElementById('invDetailOverlay').classList.remove('show');
if (invDetailItem) pickInventoryItem(invDetailItem);
});

// ---------- выставление выбранных по очереди ----------

let sellQueue = [];
let sellQueueTotal = 0;

document.getElementById('invContinueBtn').addEventListener('click', () => {
if (!invPicked.length) return;
sellQueue = invPicked.slice();
sellQueueTotal = sellQueue.length;
invPicked = [];
inventoryOverlay.classList.remove('show');
sellNextFromQueue();
});

function sellNextFromQueue(){
const item = sellQueue.shift();
if (!item){
sellQueueTotal = 0;
return;
}
prepareSellItem(item);
openQuickSell(item);
const dict = I18N[currentLang] || I18N.ru;
const queueEl = document.getElementById('qsQueue');
const multi = sellQueueTotal > 1;
queueEl.style.display = multi ? '' : 'none';
queueEl.textContent = dict.qs_queue.replace('{n}', sellQueueTotal - sellQueue.length).replace('{total}', sellQueueTotal);
document.getElementById('quickSellSkip').style.display = sellQueue.length ? '' : 'none';
}

// ---------- «Все по рынку −3%»: выставить выбранные разом ----------
// Для каждого предмета: инспект (float, паттерн, наклейки), ориентир
// рынка, цена = рынок −3% (как подсказка в окне «Выставить лот») и
// публикация. Предметы без износа или без цены рынка пропускаем —
// их можно выставить по одному через «Продолжить».

const SELL_ALL_DISCOUNT = 3;
let sellAllRunning = false;

document.getElementById('invSellAllBtn').addEventListener('click', () => {
if (!invPicked.length || sellAllRunning) return;
const dict = I18N[currentLang] || I18N.ru;
const items = invPicked.filter(it => it.tradable !== false);
showConfirm(dict.inv_sell_all_q.replace('{n}', items.length).replace('{p}', SELL_ALL_DISCOUNT), () => {
if (!sellerOfferAccepted){
openSellerOffer(() => sellAllAtMarket(items));
return;
}
sellAllAtMarket(items);
});
});

async function sellAllInspect(item){
if (!item.inspect_link) return null;
try {
const r = await fetch(API_BASE + '/api/steam/inspect'
+ '?init_data=' + encodeURIComponent(tg.initData)
+ '&inspect_link=' + encodeURIComponent(item.inspect_link)
+ '&_t=' + Date.now(), { cache: 'no-store' });
const data = r.ok ? await r.json() : null;
return data && data.ok ? data : null;
} catch (e){
return null;
}
}

async function sellAllMarketPrice(item, stattrak){
const params = new URLSearchParams({ title: item.title });
if (item.wear) params.set('wear', item.wear);
if (stattrak) params.set('stattrak', '1');
try {
const r = await fetch(API_BASE + '/api/market_price_preview?' + params.toString());
const data = await r.json();
return data && data.available && data.market_price_uzs > 0 ? data.market_price_uzs : 0;
} catch (e){
return 0;
}
}

async function sellAllAtMarket(items){
const dict = I18N[currentLang] || I18N.ru;
const btn = document.getElementById('invSellAllBtn');
sellAllRunning = true;
btn.disabled = true;
let listed = 0, skipped = 0, failed = 0;
try {
for (let i = 0; i < items.length; i++){
const item = items[i];
btn.textContent = dict.inv_sell_all_progress.replace('{n}', i + 1).replace('{total}', items.length);
// Износ не нужен: кейсы, капсулы и наклейки тоже выставляются по рынку.
if (!item.title || !item.photo_url || !item.asset_id){
skipped++;
continue;
}
const info = await sellAllInspect(item);
const stattrak = !!(item.stattrak || (info && info.stattrak));
const market = await sellAllMarketPrice(item, stattrak);
if (!market){
skipped++;
continue;
}
const pick = (a, b) => (a !== null && a !== undefined && a !== '') ? a : (b !== undefined ? b : null);
const r = await fetch(API_BASE + '/api/skins', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
init_data: tg.initData,
title: item.title,
description: '',
price: qsRoundPrice(market * (1 - SELL_ALL_DISCOUNT / 100)),
photo_url: item.photo_url,
weapon_type: item.weapon_type || '',
wear: item.wear,
rarity: item.rarity || (info && info.rarity) || '',
float_value: pick(item.float_value, info && info.float_value),
pattern: pick(item.pattern, info && info.pattern),
stattrak: stattrak,
has_stickers: !!(info && info.has_stickers),
asset_id: item.asset_id,
inspect_link: item.inspect_link || null,
})
}).catch(() => null);
if (r && r.ok){
listed++;
invPicked = invPicked.filter(p => invKey(p) !== invKey(item));
continue;
}
const data = r ? await r.json().catch(() => ({})) : {};
if (data.error === 'seller_offer_required'){
// Оферту ещё не приняли — после принятия продолжаем с этого же предмета.
sellerOfferAccepted = false;
const rest = items.slice(i);
openSellerOffer(() => sellAllAtMarket(rest));
break;
}
failed++;
}
} finally {
sellAllRunning = false;
btn.disabled = false;
btn.textContent = dict.inv_sell_all.replace('{p}', SELL_ALL_DISCOUNT);
renderInventory();
}
if (listed) loadSkins();
showAlert(dict.inv_sell_all_done
.replace('{ok}', listed)
.replace('{skip}', skipped + failed));
if (listed && !invPicked.length) inventoryOverlay.classList.remove('show');
}

// Вызывается из publishSkin после успешной публикации из окна «Выставить лот».
function onQuickSellPublished(){
if (sellQueue.length) setTimeout(sellNextFromQueue, 700);
else sellQueueTotal = 0;
}

document.getElementById('quickSellSkip').addEventListener('click', () => {
closeQuickSell();
sellNextFromQueue();
});

// Заполняет форму лота данными предмета и подтягивает float/паттерн.
function prepareSellItem(item){
sTitle.value = item.title || '';
sWeaponType.value = item.weapon_type || '';
sWear.value = item.wear || '';
sRarity.value = item.rarity || '';
sStattrak.checked = !!item.stattrak;

// Раньше эти поля только ЗАПОЛНЯЛИСЬ, когда у предмета была
// нужная информация, но никогда не очищались для предмета,
// у которого её нет — оставалось значение от предыдущего
// выбранного скина. Теперь всегда явно ставим (или очищаем).
sPhoto.value = item.photo_url || '';
sFloat.value = (item.float_value !== null && item.float_value !== undefined)
? item.float_value
: '';

// Паттерн (paint seed) — теперь своё обязательное поле, а не
// текст внутри описания.
sPattern.value = (item.pattern !== null && item.pattern !== undefined) ? item.pattern : '';

// asset_id/inspect_link не показываются в форме — сохраняем
// в переменные, чтобы отправить вместе с лотом при "Выставить".
// Продавец потом сможет открыть точный экземпляр предмета в Steam
// (чтобы не перепутать с похожим скином при ручной отправке).
pendingSkinAssetId = item.asset_id || null;
pendingSkinInspectLink = item.inspect_link || null;

sDescription.value = '';

// Float и паттерн приходят только из Game Coordinator, а инспект
// там идёт по одному предмету за раз (секунда-две каждый) — гнать
// через него весь инвентарь при открытии нельзя, это минуты
// ожидания. Поэтому инспектируем ровно выбранный предмет, уже
// после того, как форма заполнена всем остальным: продавец сразу
// видит карточку, а float с паттерном подставляются через
// мгновение. Если инспект-бот недоступен — просто оставляем поля
// пустыми, продавец заполнит руками (не блокируем выставление).
if (item.inspect_link){
const inspectDict = I18N[currentLang] || I18N.ru;
addSkinStatus.textContent = inspectDict.loading;

fetch(API_BASE + '/api/steam/inspect'
+ '?init_data=' + encodeURIComponent(tg.initData)
+ '&inspect_link=' + encodeURIComponent(item.inspect_link)
+ '&_t=' + Date.now(), { cache: 'no-store' })
.then(r => r.ok ? r.json() : null)
.then(data => {
addSkinStatus.textContent = '';

if (!data || !data.ok) return;

// Не затираем то, что продавец успел вписать руками, пока
// шёл запрос — подставляем только в пустые поля.
if (sFloat.value === '' && data.float_value !== null && data.float_value !== undefined){
sFloat.value = data.float_value;
}

if (sPattern.value === '' && data.pattern !== null && data.pattern !== undefined){
sPattern.value = data.pattern;
}

if (!sRarity.value && data.rarity){
sRarity.value = data.rarity;
}

if (data.stattrak) sStattrak.checked = true;
if (data.has_stickers) sHasStickers.checked = true;
})
.catch(() => {
addSkinStatus.textContent = '';
});
}

scheduleSellMarketPreview();
}

// ---------------- Компактное окно "Выставить лот" ----------------

const quickSellOverlay = document.getElementById('quickSellOverlay');
const qsPhoto = document.getElementById('qsPhoto');
const qsName = document.getElementById('qsName');
const qsSub = document.getElementById('qsSub');
const qsWearBar = document.getElementById('qsWearBar');
const qsWearMark = document.getElementById('qsWearMark');
const qsFloatRow = document.getElementById('qsFloatRow');
const qsPrice = document.getElementById('qsPrice');
const qsStatus = document.getElementById('quickSellStatus');

function openQuickSell(item){
const rarityBg = RARITY_BG[item.rarity]
? `url('${RARITY_BG[item.rarity]}')`
: 'none';
qsPhoto.style.backgroundImage = rarityBg;
qsPhoto.innerHTML = item.photo_url ? `<img src="${escapeHtml(item.photo_url)}" alt="">` : '';

qsName.textContent = (item.stattrak ? 'ST™ ' : '') + (item.title || '');
qsName.className = 'qs-name' + (item.stattrak ? ' stattrak' : '');

const wearText = item.wear ? WEAR_LABELS[item.wear] || '' : '';
const subParts = [wearText, item.weapon_type].filter(Boolean);
qsSub.textContent = subParts.join(' · ');

const hasFloat = item.float_value !== null && item.float_value !== undefined;
if (hasFloat){
qsWearBar.style.display = '';
qsWearMark.style.left = (Math.min(1, Math.max(0, item.float_value)) * 100).toFixed(2) + '%';
qsFloatRow.style.display = 'flex';
qsFloatRow.innerHTML = `<span>${formatFloat(item.float_value)}</span>${item.pattern ? `<span>#${escapeHtml(String(item.pattern))}</span>` : ''}`;
} else {
qsWearBar.style.display = 'none';
qsFloatRow.style.display = 'none';
}

qsPrice.value = '';
qsStatus.textContent = '';
qsAutoPriced = false;
// Ориентир по рынку виден сразу («загрузка…»), а не появляется из ниоткуда.
const qsMarketBox = document.getElementById('qsMarketPricePreview');
const qsDict = I18N[currentLang] || I18N.ru;
qsMarketBox.innerHTML = `<div class="mp-row"><span>${qsDict.mp_preview_ref}</span><span class="mp-row-status">${qsDict.mp_row_loading}</span></div>`;
qsMarketBox.style.display = '';
renderQuickSellPriceChips(0);

quickSellOverlay.classList.add('show');
}

function closeQuickSell(){
quickSellOverlay.classList.remove('show');
}

// Закрыли окно — остальные выбранные скины не выставляем.
function stopQuickSell(){
sellQueue = [];
sellQueueTotal = 0;
closeQuickSell();
}

document.getElementById('quickSellCloseBtn').addEventListener('click', stopQuickSell);
document.getElementById('quickSellCancel').addEventListener('click', stopQuickSell);

// Подсказки цены: «−3% · −5% · по рынку» от ориентира рынка. Как только
// ориентир пришёл, а цены ещё нет — сразу ставим «рынок −3%»: так лот
// заметно дешевле рынка и уходит быстрее, а продавцу остаётся нажать
// «Выставить» (или поправить цену).
const QS_PRICE_STEPS = [3, 5, 0];
let qsAutoPriced = false;

function qsRoundPrice(value){
const step = value >= 1000000 ? 10000 : value >= 100000 ? 1000 : 100;
return Math.max(step, Math.floor(value / step) * step);
}

function setQuickSellPrice(price){
qsPrice.value = String(price);
sPrice.value = qsPrice.value;
scheduleSellMarketPreview();
}

function renderQuickSellPriceChips(market){
const box = document.getElementById('qsPriceChips');
if (!box) return;
const dict = I18N[currentLang] || I18N.ru;
if (!market || !quickSellOverlay.classList.contains('show')){
box.innerHTML = '';
box.hidden = true;
return;
}
const current = Number(qsPrice.value) || 0;
box.innerHTML = QS_PRICE_STEPS.map(p => {
const price = qsRoundPrice(market * (1 - p / 100));
const label = p ? `−${p}%` : dict.qs_chip_market;
return `<button type="button" class="qs-chip${current === price ? ' on' : ''}" data-qs-price="${price}"><b>${escapeHtml(label)}</b><span>${escapeHtml(formatCoins(price))}</span></button>`;
}).join('');
box.hidden = false;
if (!qsPrice.value && !qsAutoPriced){
qsAutoPriced = true;
setQuickSellPrice(qsRoundPrice(market * (1 - QS_PRICE_STEPS[0] / 100)));
qsStatus.textContent = dict.qs_prefilled;
}
}

document.getElementById('qsPriceChips').addEventListener('click', (e) => {
const chip = e.target.closest('[data-qs-price]');
if (!chip) return;
haptic('light');
qsStatus.textContent = '';
setQuickSellPrice(Number(chip.dataset.qsPrice));
});

// Цена вводится в компактном окне, но публикует её та же самая
// функция publishSkin, что читает sPrice — держим их синхронно.
qsPrice.addEventListener('input', () => {
qsAutoPriced = true;
qsStatus.textContent = '';
sPrice.value = qsPrice.value;
scheduleSellMarketPreview();
});

document.getElementById('quickSellConfirm').addEventListener('click', () => {
sPrice.value = qsPrice.value;
publishSkin(document.getElementById('quickSellConfirm'), qsStatus, quickSellOverlay);
});

// Escape-люк для редких случаев, когда авто-подставленные данные
// нужно поправить руками (например, инспект-бот ошибся с редкостью
// у нестандартного предмета) — открывает ту же большую форму, что
// была тут раньше, уже с теми же данными внутри.
document.getElementById('quickSellAdvanced').addEventListener('click', () => {
sellQueue = [];
sellQueueTotal = 0;
closeQuickSell();
addSkinOverlay.classList.add('show');
});

addSkinBtn.addEventListener('click', () => {
if (!tg || !tg.initData){
showAlert(errorMessage('unauthorized'));
return;
}
if (sellerKycStatus !== 'verified'){
showAlert((I18N[currentLang] || I18N.ru).sell_need_kyc);
return;
}
if (steamLoginRequired && !steamVerified){
const dict = I18N[currentLang] || I18N.ru;
showConfirm(dict.steam_login_required_q, startSteamLogin);
return;
}
if (!hasSteamLink){
showAlert((I18N[currentLang] || I18N.ru).sell_need_trade_link);
return;
}
addSkinStatus.textContent = '';
pendingSkinAssetId = null;
pendingSkinInspectLink = null;
document.getElementById('sMarketPricePreview').style.display = 'none';
// Явно прячем форму и чистим её поля на случай, если где-то
// осталось прошлое состояние (например, WebView не перезагрузился
// полностью между открытиями мини-аппа) — иначе может мелькнуть
// старая форма с прошлыми тестовыми значениями поверх инвентаря.
addSkinOverlay.classList.remove('show');
sTitle.value = '';
sWeaponType.value = '';
sRarity.value = '';
sWear.value = '';
sFloat.value = '';
sPattern.value = '';
sStattrak.checked = false;
sHasStickers.checked = false;
sDescription.value = '';
sPrice.value = '';
sPhoto.value = '';
inventoryPickHandler = null;
openInventory();
});

const ONBOARDING_SEEN_KEY = 'dghost_onboarding_seen';
let onboardingSlideIndex = 0;
const ONBOARDING_SLIDES_COUNT = 4;

function startAppAfterOnboarding(){
if (deepLinkGiveaway){
switchTab('timer');
} else {
switchTab('shop');
}
}

function showOnboardingSlide(i){
for (let s = 0; s < ONBOARDING_SLIDES_COUNT; s++){
document.getElementById('onboardingSlide' + s).style.display = (s === i) ? '' : 'none';
}
document.querySelectorAll('.onboarding-dot').forEach((dot, idx) => {
dot.classList.toggle('active', idx === i);
});
document.getElementById('onboardingNextBtn').textContent = (i === ONBOARDING_SLIDES_COUNT - 1)
? (I18N[currentLang] || I18N.ru).onb_btn_done
: (I18N[currentLang] || I18N.ru).onb_btn_next;
}

function finishOnboarding(){
try { localStorage.setItem(ONBOARDING_SEEN_KEY, '1'); } catch (e) {}
document.getElementById('onboardingOverlay').classList.remove('show');
document.body.style.overflow = '';
startAppAfterOnboarding();
}

document.getElementById('onboardingNextBtn').addEventListener('click', () => {
if (onboardingSlideIndex < ONBOARDING_SLIDES_COUNT - 1){
onboardingSlideIndex++;
showOnboardingSlide(onboardingSlideIndex);
} else {
finishOnboarding();
}
});

document.getElementById('onboardingSkipBtn').addEventListener('click', finishOnboarding);

let onboardingAlreadySeen = false;
try { onboardingAlreadySeen = localStorage.getItem(ONBOARDING_SEEN_KEY) === '1'; } catch (e) {}

const hasAnyDeepLink = !!deepLinkSkinId || !!deepLinkAuctionId || deepLinkGiveaway;

if (!onboardingAlreadySeen && !hasAnyDeepLink){
onboardingSlideIndex = 0;
showOnboardingSlide(0);
document.getElementById('onboardingOverlay').style.height = window.innerHeight + 'px';
document.getElementById('onboardingOverlay').classList.add('show');
document.body.style.overflow = 'hidden';
} else {
startAppAfterOnboarding();
}

document.getElementById('auctionsBackBtn').addEventListener('click', () => goToScreen('welcome'));
document.getElementById('adminBackBtn').addEventListener('click', () => goToScreen('welcome'));
document.getElementById('dealsBackBtn').addEventListener('click', () => goToScreen('welcome'));
document.getElementById('buyRequestsBackBtn').addEventListener('click', () => goToScreen('welcome'));

addSkinCancel.addEventListener('click', () => {
addSkinOverlay.classList.remove('show');
});

// Общая публикация лота — раньше жила только внутри обработчика
// клика на большую форму. Вынесена в функцию, чтобы её же вызывало
// компактное окно быстрой продажи: оба пути шлют один и тот же
// набор полей на /api/skins, разница только в том, откуда куда
// пишутся статус и куда убирается оверлей по завершении.
function publishSkin(triggerBtn, statusEl, overlayEl){
if (!tg || !tg.initData){
statusEl.textContent = errorMessage('unauthorized');
return;
}

if (!pendingSkinAssetId){
statusEl.textContent = (I18N[currentLang] || I18N.ru).addskin_need_pick;
return;
}

// Перед первым лотом — оферта продавца. После принятия продолжаем
// ту же публикацию, пользователю не нужно жать кнопку ещё раз.
if (!sellerOfferAccepted){
openSellerOffer(() => publishSkin(triggerBtn, statusEl, overlayEl));
return;
}

const title = sTitle.value.trim();
const price = Number(sPrice.value);
const photo = sPhoto.value.trim();
const wear = sWear.value;
const floatStr = sFloat.value;
const pattern = sPattern.value.trim();

if (!title || !price || price <= 0){
statusEl.textContent = (I18N[currentLang] || I18N.ru).skin_fill_title_price;
return;
}

if (!photo){
statusEl.textContent = (I18N[currentLang] || I18N.ru).skin_fill_required;
return;
}

triggerBtn.disabled = true;
statusEl.textContent = (I18N[currentLang] || I18N.ru).addskin_publishing;

fetch(API_BASE + '/api/skins', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
init_data: tg.initData,
title: title,
description: sDescription.value.trim(),
price: price,
photo_url: photo,
weapon_type: sWeaponType.value.trim(),
wear: wear || null,
rarity: sRarity.value,
float_value: floatStr === '' ? null : Number(floatStr),
pattern: pattern || null,
stattrak: sStattrak.checked,
has_stickers: sHasStickers.checked,
asset_id: pendingSkinAssetId,
inspect_link: pendingSkinInspectLink,
})
})
.then(async r => {
if (!r.ok){
const data = await r.json().catch(() => ({}));
if (data.error === 'seller_offer_required'){
sellerOfferAccepted = false;
openSellerOffer(() => publishSkin(triggerBtn, statusEl, overlayEl));
}
if (data.error === 'price_too_high'){
throw new Error((I18N[currentLang] || I18N.ru).price_too_high.replace('{max}', formatCoins(data.max_allowed)).replace('{market}', formatCoins(data.market_price_uzs)));
}
throw new Error(errorMessage(data.error));
}
return r.json();
})
.then(() => {
statusEl.textContent = (I18N[currentLang] || I18N.ru).addskin_published_ok;
sTitle.value = '';
sDescription.value = '';
sPrice.value = '';
sPhoto.value = '';
sWeaponType.value = '';
sWear.value = '';
sRarity.value = '';
sFloat.value = '';
sPattern.value = '';
sStattrak.checked = false;
sHasStickers.checked = false;
pendingSkinAssetId = null;
pendingSkinInspectLink = null;
document.getElementById('sMarketPricePreview').style.display = 'none';
const qsBox = document.getElementById('qsMarketPricePreview');
if (qsBox) qsBox.style.display = 'none';
loadSkins();
setTimeout(() => {
overlayEl.classList.remove('show');
statusEl.textContent = '';
if (overlayEl === quickSellOverlay) onQuickSellPublished();
}, 600);
})
.catch(err => {
statusEl.textContent = friendlyErrorMessage(err);
})
.finally(() => {
triggerBtn.disabled = false;
});
}

addSkinSave.addEventListener('click', () => {
publishSkin(addSkinSave, addSkinStatus, addSkinOverlay);
});

