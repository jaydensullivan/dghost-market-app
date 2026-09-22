// ============================================================
// ВЫВОД СРЕДСТВ
// ============================================================

const wAmount = document.getElementById('wAmount');
const wDetails = document.getElementById('wDetails');
const withdrawSubmitBtn = document.getElementById('withdrawSubmitBtn');
const withdrawStatus = document.getElementById('withdrawStatus');
const withdrawPayoutPreview = document.getElementById('withdrawPayoutPreview');

const WITHDRAW_FEE_PERCENT = 2.5;

let withdrawMethod = 'card';

function setWithdrawMethod(method){
withdrawMethod = method;
document.querySelectorAll('.withdraw-method-btn').forEach(b => b.classList.toggle('active', b.dataset.method === method));
document.getElementById('withdrawCardField').style.display = method === 'card' ? '' : 'none';
document.getElementById('withdrawCryptoField').style.display = method === 'crypto' ? '' : 'none';
}

function updateWithdrawMethodVisibility(){
const cardOn = withdrawCardEnabled;
const cryptoOn = cryptoPayoutAvailable && withdrawCryptoEnabled;
document.getElementById('withdrawCardMethodBtn').style.display = cardOn ? '' : 'none';
document.getElementById('withdrawCryptoMethodBtn').style.display = cryptoOn ? '' : 'none';
if (withdrawMethod === 'card' && !cardOn && cryptoOn) setWithdrawMethod('crypto');
else if (withdrawMethod === 'crypto' && !cryptoOn && cardOn) setWithdrawMethod('card');
}

document.querySelectorAll('.withdraw-method-btn').forEach(btn => {
btn.addEventListener('click', () => setWithdrawMethod(btn.dataset.method));
});

function updateWithdrawPayoutPreview(){
const amount = Number(wAmount.value);
if (!amount || amount <= 0){
withdrawPayoutPreview.textContent = '';
return;
}
const payout = Math.round(amount * (100 - WITHDRAW_FEE_PERCENT) / 100);
withdrawPayoutPreview.textContent = `На карту придёт: ${formatCoins(payout)} (после комиссии ${WITHDRAW_FEE_PERCENT}%)`;
}

wAmount.addEventListener('input', updateWithdrawPayoutPreview);

const WITHDRAW_ERROR_MESSAGES = {
no_payment_details: 'Укажи карту и Ф.И.О. владельца карты.',
no_crypto_details: 'Укажи адрес кошелька.',
below_minimum: 'Сумма меньше минимальной для вывода.',
insufficient_funds: 'Недостаточно средств на балансе.',
not_configured: 'Вывод в крипту сейчас недоступен.',
feature_disabled: 'Вывод сейчас временно недоступен.',
totp_required: 'Неверный или устаревший код 2FA — попробуй новый код из приложения.',
totp_locked: `Слишком много неверных попыток — 2FA временно заблокирована на ${15} минут.`,
};

function withdrawTrustLimitMessage(data){
if (data.error === 'single_limit'){
return `Максимум за один вывод на твоём уровне доверия — ${formatCoins(data.limit)}. Попробуй сумму меньше.`;
}
if (data.error === 'daily_limit'){
return `Превышен дневной лимит вывода для твоего уровня доверия (${formatCoins(data.limit)} за 24 часа). Попробуй позже или уменьши сумму.`;
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

let payload = { init_data: tg.initData, amount: amount, method: withdrawMethod };

if (totp2faStatus.enabled_withdraw){
const totpCode = document.getElementById('wTotpCode').value.trim();
if (!totpCode){
withdrawStatus.textContent = dict.withdraw_need_totp;
return;
}
payload.totp_code = totpCode;
}

if (withdrawMethod === 'crypto'){
const address = document.getElementById('wCryptoAddress').value.trim();
if (!address){
withdrawStatus.textContent = dict.withdraw_need_wallet;
return;
}
payload.crypto_address = address;
} else {
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
}

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
throw new Error(withdrawTrustLimitMessage(data) || WITHDRAW_ERROR_MESSAGES[data.error] || errorMessage(data.error));
}
return r.json();
})
.then(data => {
const payoutText = data.payout ? ` ${dict.withdraw_will_arrive.replace('{amount}', formatCoins(data.payout))}` : '';
withdrawStatus.textContent = dict.withdraw_submitted.replace('{id}', data.id) + payoutText;
wAmount.value = '';
wDetails.value = '';
document.getElementById('wCryptoAddress').value = '';
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

function renderInventory(items){
if (!items || !items.length){
inventoryStatus.textContent = (I18N[currentLang] || I18N.ru).inventory_empty;
inventoryGrid.innerHTML = '';
return;
}
inventoryStatus.textContent = '';
inventoryGrid.innerHTML = items.map((item, i) => {
// Обычная иконка Steam без серверного рендера и без фона по
// редкости — редкость и так видна по цветной рамке сверху.
const photo = item.photo_url
? `<img src="${item.photo_url}" alt="" loading="lazy">`
: '';
const wearText = item.wear ? WEAR_LABELS[item.wear] || '' : '';
const isTradable = item.tradable !== false;
const bannedClass = isTradable ? '' : ' inv-item-banned';
// Цветная рамка сверху уже показывает редкость — фон-картинка тут
// была бы тем же сигналом дважды, только тяжелее и незаметнее в
// плотной сетке. Фон остаётся в окне "Выставить лот", где карточка
// одна на экран.
const rarityClass = RARITY_CLASS[item.rarity] || '';
const rarityBg = '';

const hasFloat = item.float_value !== null && item.float_value !== undefined;

// Полоска износа с меткой на месте точного float — как в CSFloat.
// Показываем, только если float уже подтянулся (инспект-бот мог
// не успеть его расшифровать к моменту показа списка — тогда
// просто не рисуем полоску вместо пустой/нулевой).
const wearBar = hasFloat
? `<div class="inv-item-wearbar"><div class="inv-item-wearbar-mark" style="left:${(Math.min(1, Math.max(0, item.float_value)) * 100).toFixed(2)}%"></div></div>
<div class="inv-item-floatrow"><span>${Number(item.float_value).toFixed(4)}</span>${item.pattern ? `<span>#${escapeHtml(String(item.pattern))}</span>` : ''}</div>`
: '';

const stickerBadge = item.stickers_count
? `<div class="inv-item-stickers">🏷️ ${item.stickers_count}</div>`
: '';

const nameClass = item.stattrak ? ' stattrak' : '';
const stText = item.stattrak ? 'ST™ ' : '';

return `
<div class="inv-item${bannedClass}${rarityClass ? ' ' + rarityClass : ''}" data-idx="${i}" data-tradable="${isTradable ? '1' : '0'}">
<div class="inv-item-photo"${rarityBg}>${photo}${stickerBadge}</div>
<div class="inv-item-name${nameClass}">${stText}${escapeHtml(item.title)}</div>
${wearText ? `<div class="inv-item-wear">${wearText}</div>` : ''}
${wearBar}
${!isTradable ? '<div class="inv-item-ban-label">🔒 Трейд-бан</div>' : ''}
</div>`;
}).join('');
}

let lastInventoryItems = [];
let pendingSkinAssetId = null;
let pendingSkinInspectLink = null;

function formatWaitHours(hours){
const dict = I18N[currentLang] || I18N.ru;
if (hours >= 1) return `${Math.ceil(hours)} ${dict.unit_hours_short}`;
return `${Math.max(1, Math.ceil(hours * 60))} ${dict.unit_minutes_short}`;
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
throw new Error(`Обновлять инвентарь можно не больше 3 раз в сутки. Попробуй ещё раз через ${formatWaitHours(data.wait_hours)}.`);
}
throw new Error(steamErrorMessage(data.error));
}
return r.json();
})
.then(data => {
lastInventoryItems = data.items || [];
renderInventory(lastInventoryItems);
})
.catch(err => {
inventoryStatus.textContent = friendlyErrorMessage(err);
});
}

openInventoryBtn.addEventListener('click', () => {
if (!tg || !tg.initData) return;
inventoryOverlay.classList.add('show');
loadInventory(false);
});

inventoryRefreshBtn.addEventListener('click', () => {
if (!tg || !tg.initData) return;
loadInventory(true);
});

inventoryCancel.addEventListener('click', () => {
inventoryOverlay.classList.remove('show');
});

inventoryGrid.addEventListener('click', (e) => {
const card = e.target.closest('.inv-item');
if (!card) return;
const item = lastInventoryItems[Number(card.dataset.idx)];
if (!item) return;

if (item.tradable === false){
showAlert('Этот предмет сейчас в трейд-бане Steam — выбрать его для продажи нельзя, пока бан не закончится.');
return;
}

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

// Раньше здесь сразу открывалась большая форма редактирования —
// но у выбранного предмета уже известно всё (фото, название, износ,
// float, паттерн, редкость), продавцу нужно решить только цену.
// Поэтому вместо формы показываем компактное окно "Выставить лот"
// с готовой карточкой и одним полем — ценой. Полная форма
// (addSkinOverlay) никуда не делась: она открывается по ссылке
// "Подробные настройки", если авто-данные надо поправить руками.
inventoryOverlay.classList.remove('show');
openQuickSell(item);
});

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
qsPhoto.innerHTML = item.photo_url ? `<img src="${item.photo_url}" alt="">` : '';

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
qsFloatRow.innerHTML = `<span>${Number(item.float_value).toFixed(4)}</span>${item.pattern ? `<span>#${escapeHtml(String(item.pattern))}</span>` : ''}`;
} else {
qsWearBar.style.display = 'none';
qsFloatRow.style.display = 'none';
}

qsPrice.value = '';
qsStatus.textContent = '';
document.getElementById('qsMarketPricePreview').style.display = 'none';

quickSellOverlay.classList.add('show');
}

function closeQuickSell(){
quickSellOverlay.classList.remove('show');
}

document.getElementById('quickSellCloseBtn').addEventListener('click', closeQuickSell);
document.getElementById('quickSellCancel').addEventListener('click', closeQuickSell);

// Цена вводится в компактном окне, но публикует её та же самая
// функция publishSkin, что читает sPrice — держим их синхронно.
qsPrice.addEventListener('input', () => {
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
closeQuickSell();
addSkinOverlay.classList.add('show');
});

addSkinBtn.addEventListener('click', () => {
if (!tg || !tg.initData){
showAlert(errorMessage('unauthorized'));
return;
}
if (sellerKycStatus !== 'verified'){
showAlert('Чтобы выставлять лоты, нужно пройти проверку продавца — открой Профиль → «Стать продавцом».');
return;
}
if (!hasSteamLink){
showAlert('Сначала привяжи трейд-ссылку Steam в Профиле.');
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
inventoryOverlay.classList.add('show');
loadInventory(false);
});

const welcomeOverlay = document.getElementById('welcomeOverlay');

function showWelcomeOverlay(){
// 100vh внутри Telegram WebView иногда считается неверно (больше
// реально видимой области) — измеряем высоту сами через JS и
// блокируем скролл страницы, пока экран показан, чтобы контент
// не "уезжал" вниз.
welcomeOverlay.style.height = window.innerHeight + 'px';
welcomeOverlay.classList.add('show');
document.body.style.overflow = 'hidden';
}

function hideWelcomeOverlay(){
welcomeOverlay.classList.remove('show');
document.body.style.overflow = '';
}

const categoryPickerScreen = document.getElementById('categoryPickerScreen');

function showCategoryPicker(){
categoryPickerScreen.style.height = window.innerHeight + 'px';
categoryPickerScreen.classList.add('show');
document.body.style.overflow = 'hidden';
document.getElementById('bottomNav').style.display = 'flex';
document.getElementById('bottomNav').classList.add('elevated');
}

function hideCategoryPicker(){
categoryPickerScreen.classList.remove('show');
document.body.style.overflow = '';
document.getElementById('bottomNav').classList.remove('elevated');
}

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

document.getElementById('welcomeSellBtn').addEventListener('click', () => {
goToScreen('shop');

if (!tg || !tg.initData){
showAlert(errorMessage('unauthorized'));
return;
}

addSkinStatus.textContent = '';
updateSteamBlockVisibility();
updateMandatorySteamOverlay();
pendingSkinAssetId = null;
pendingSkinInspectLink = null;
document.getElementById('sMarketPricePreview').style.display = 'none';
addSkinOverlay.classList.add('show');

// Если Steam уже привязан — сразу открываем инвентарь, без
// лишнего тапа на «Выбрать из инвентаря Steam». Если не привязан —
// addSkinOverlay сам покажет подсказку привязать его сначала.
if (hasSteamLink){
inventoryOverlay.classList.add('show');
loadInventory(false);
}
});

document.getElementById('welcomeBuyBtn').addEventListener('click', () => {
goToScreen('categoryPicker');
});

document.getElementById('categoryPickerBack').addEventListener('click', () => goToScreen('welcome'));

document.getElementById('shopBackBtn').addEventListener('click', () => goToScreen('categoryPicker'));
document.getElementById('profileBackBtn').addEventListener('click', () => goToScreen('welcome'));
document.getElementById('auctionsBackBtn').addEventListener('click', () => goToScreen('welcome'));
document.getElementById('adminBackBtn').addEventListener('click', () => goToScreen('welcome'));
document.getElementById('dealsBackBtn').addEventListener('click', () => goToScreen('welcome'));
document.getElementById('buyRequestsBackBtn').addEventListener('click', () => goToScreen('welcome'));

document.querySelector('.category-tile-grid').addEventListener('click', (e) => {
const tile = e.target.closest('.category-tile');
if (!tile) return;
currentCategory = tile.dataset.cat;
if (typeof renderCategoryChips === 'function') renderCategoryChips();
goToScreen('shop');
});

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
if (data.error === 'price_too_high'){
throw new Error(`Цена слишком высокая — максимум для этого предмета сейчас ${formatCoins(data.max_allowed)} (не больше 200% от рыночной цены ${formatCoins(data.market_price_uzs)}).`);
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

