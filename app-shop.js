// ============================================================
// МАГАЗИН СКИНОВ
// ============================================================

const balancePill = document.getElementById('balancePill');
const skinsList = document.getElementById('skinsList');
const addSkinBtn = document.getElementById('addSkinBtn');
const addSkinOverlay = document.getElementById('addSkinOverlay');
const addSkinCancel = document.getElementById('addSkinCancel');
const addSkinSave = document.getElementById('addSkinSave');
const addSkinStatus = document.getElementById('addSkinStatus');
const sTitle = document.getElementById('sTitle');
const sDescription = document.getElementById('sDescription');
const sPattern = document.getElementById('sPattern');
const sPrice = document.getElementById('sPrice');
const sPhoto = document.getElementById('sPhoto');
const sWeaponType = document.getElementById('sWeaponType');
const sWear = document.getElementById('sWear');
const sRarity = document.getElementById('sRarity');
const sFloat = document.getElementById('sFloat');
const sStattrak = document.getElementById('sStattrak');
const sHasStickers = document.getElementById('sHasStickers');

const skinSearch = document.getElementById('skinSearch');
const skinSort = document.getElementById('skinSort');

const buyOverlay = document.getElementById('buyOverlay');
const buyPhoto = document.getElementById('buyPhoto');
const buyTitle = document.getElementById('buyTitle');
const buySubtitle = document.getElementById('buySubtitle');
const buyHero = document.getElementById('buyHero');
const buyDetailsTable = document.getElementById('buyDetailsTable');
const buyShareBtn = document.getElementById('buyShareBtn');
const buyRemoveBtn = document.getElementById('buyRemoveBtn');
const buyClose = document.getElementById('buyClose');
const buyPrice = document.getElementById('buyPrice');
const buyCancel = document.getElementById('buyCancel');
const buyConfirmBalance = document.getElementById('buyConfirmBalance');
const buyConfirmStars = document.getElementById('buyConfirmStars');
const buyConfirmCrypto = document.getElementById('buyConfirmCrypto');
const buyConfirmP2P = document.getElementById('buyConfirmP2P');
const buyEditPriceBtn = document.getElementById('buyEditPriceBtn');
const buySavePriceBtn = document.getElementById('buySavePriceBtn');
const buyPriceEdit = document.getElementById('buyPriceEdit');
const buyNewPriceInput = document.getElementById('buyNewPriceInput');
const buyMakeOfferBtn = document.getElementById('buyMakeOfferBtn');
const buySendOfferBtn = document.getElementById('buySendOfferBtn');
const buyOfferEdit = document.getElementById('buyOfferEdit');
const buyOfferInput = document.getElementById('buyOfferInput');
const buyStatus = document.getElementById('buyStatus');

let pendingBuySkin = null;

const WEAR_LABELS = { FN: 'FN', MW: 'MW', FT: 'FT', WW: 'WW', BS: 'BS' };

const ERROR_MESSAGES = {
bad_photo: 'Не удалось прочитать фото — попробуй другое.',
evidence_empty: 'Добавь описание, Trade ID или скриншот.',
evidence_limit: 'Ты уже отправил максимум доказательств по этому спору. Админ свяжется с тобой в боте.',
item_no_longer_available: 'Этого предмета уже нет в инвентаре продавца — лот снят с продажи. Извини, оплата не потребуется.',
balance_purchase_disabled: 'Оплата с баланса покупателем больше не поддерживается — выбери Stars, крипту или П2П.',
self_dealing: 'Нельзя предложить обмен самому себе или связанному аккаунту.',
not_your_skin: 'Этот лот тебе не принадлежит.',
target_mismatch: 'Лот уже сменил владельца — обнови страницу.',
target_no_longer_available: 'Лот уже недоступен — возможно, его уже обменяли или продали.',
not_pending: 'Это предложение уже обработано.',
not_accepted: 'Это предложение ещё не принято.',
seller_kyc_required: 'Эта функция доступна только продавцам, прошедшим проверку. Подай заявку в Профиле.',
already_submitted: 'Заявка уже отправлена или уже одобрена.',
seller_not_sent_yet: 'Продавец ещё не отметил "Отправил" — подтвердить получение можно только после этого.',
unauthorized: 'Открой мини-апп через Telegram, а не в браузере.',
not_available: 'Этот скин уже продан или снят с продажи.',
own_listing: 'Нельзя купить собственный лот.',
insufficient_funds: 'Недостаточно сум на балансе.',
race_lost: 'Кто-то купил этот скин на секунду раньше.',
forbidden: 'Можно снять только свой лот.',
not_found: 'Лот не найден.',
items_unavailable: 'Один или несколько лотов из этого сета уже проданы — сет больше недоступен целиком.',
set_not_found: 'Этот сет больше не существует.',
invalid: 'Проверь название и цену.',
bad_price: 'Укажи корректную цену.',
too_low: 'Ставка слишком маленькая — кто-то уже успел поставить больше.',
not_active: 'Аукцион уже завершился.',
already_running: 'Розыгрыш уже запущен.',
no_end_time: 'Сначала укажи, через сколько минут финал.',
not_running: 'Розыгрыш сейчас не запущен.',
};

function errorMessage(code){
return ERROR_MESSAGES[code] || 'Что-то пошло не так, попробуй ещё раз.';
}

function purchaseTrustLimitMessage(data){
if (data.error === 'trust_limit_exceeded'){
const limitText = data.limit ? formatCoins(data.limit) : null;
return limitText
? `Максимальная разовая покупка на твоём уровне доверия — ${limitText}. Свяжись с поддержкой, если нужен лимит побольше.`
: 'Эта покупка превышает лимит твоего уровня доверия. Свяжись с поддержкой.';
}
return null;
}

function formatCoins(n){
return Number(n || 0).toLocaleString('ru-RU') + ' сум';
}

let hasSteamLink = false;
let steamLinkSkippedThisSession = false;
let agreementAccepted = false;
let agreementTextLoaded = false;

function updateSteamBlockVisibility(){
document.getElementById('steamLinkBlock').style.display = hasSteamLink ? 'none' : 'block';
document.getElementById('steamInventoryBlock').style.display = hasSteamLink ? 'block' : 'none';
}

function loadAgreementText(){
if (agreementTextLoaded) return;
fetch(API_BASE + '/api/agreement')
.then(r => r.json())
.then(data => {
document.getElementById('agreementTextBox').textContent = data.text;
agreementTextLoaded = true;
})
.catch(() => {
document.getElementById('agreementTextBox').textContent = (I18N[currentLang] || I18N.ru).agreement_load_failed;
});
}

function updateMandatorySteamOverlay(){
const agreementOverlay = document.getElementById('mandatoryAgreementOverlay');
const steamOverlay = document.getElementById('mandatorySteamOverlay');

if (currentUserId && !agreementAccepted){
loadAgreementText();
agreementOverlay.style.height = window.innerHeight + 'px';
agreementOverlay.classList.add('show');
steamOverlay.classList.remove('show');
document.body.style.overflow = 'hidden';
return;
}

agreementOverlay.classList.remove('show');

if (currentUserId && !hasSteamLink && !steamLinkSkippedThisSession){
// Та же особенность Telegram WebView, что и на welcomeOverlay —
// 100vh может считаться неверно, задаём высоту явно через JS и
// блокируем скролл страницы, пока экран показан.
steamOverlay.style.height = window.innerHeight + 'px';
steamOverlay.classList.add('show');
document.body.style.overflow = 'hidden';
} else {
steamOverlay.classList.remove('show');
document.body.style.overflow = '';
maybeShowChangelogBanner();
}
}

let changelogSeen = true;

function maybeShowChangelogBanner(){
if (!currentUserId || changelogSeen) return;
const dict = I18N[currentLang] || I18N.ru;
fetch(API_BASE + '/api/changelog')
.then(r => r.json())
.then(data => {
document.getElementById('changelogTitle').textContent = '📣 ' + (data.title || dict.changelog_fallback_title);
const list = document.getElementById('changelogList');
list.innerHTML = (data.items || []).map(t => `<li style="margin-bottom:6px;">${t}</li>`).join('');
document.getElementById('changelogBanner').classList.add('show');
})
.catch(() => {});
}

document.getElementById('changelogOkBtn').addEventListener('click', () => {
document.getElementById('changelogBanner').classList.remove('show');
changelogSeen = true;
if (tg && tg.initData){
fetch(API_BASE + '/api/changelog/seen', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData })
}).catch(() => {});
}
});

function loadMe(){
if (!tg || !tg.initData){
document.getElementById('balanceAmount').textContent = '—';
return;
}
fetch(API_BASE + '/api/me?init_data=' + encodeURIComponent(tg.initData))
.then(r => r.json())
.then(data => {
if (!data || data.error) return;
document.getElementById('balanceAmount').textContent = formatCoins(data.available);
isAdmin = !!data.is_admin;
isOwner = !!data.is_owner;
adminPermissions = data.admin_permissions || [];
isAuctioneer = !!data.is_auctioneer;
document.getElementById('tabAdminBtn').style.display = (isAdmin || isAuctioneer) ? '' : 'none';
document.getElementById('headerMenuAdmin').style.display = (isAdmin || isAuctioneer) ? '' : 'none';
if (typeof applyChipVisibility === 'function') applyChipVisibility();
currentUserId = data.user_id;
hasSteamLink = !!data.has_steam_link;
agreementAccepted = !!data.agreement_accepted;
changelogSeen = !!data.changelog_seen;
cryptoTopupAvailable = !!data.crypto_topup_available;
cryptoPayoutAvailable = !!data.crypto_payout_available;
topupCardEnabled = data.topup_card_enabled !== false;
topupCryptoEnabled = data.topup_crypto_enabled !== false;
topupStarsEnabled = data.topup_stars_enabled !== false;
coinsPerStar = data.coins_per_star || 200;
directStarsPurchaseEnabled = data.direct_stars_purchase_enabled === true;
directCryptoPurchaseEnabled = data.direct_crypto_purchase_enabled === true;
directP2pPurchaseEnabled = data.direct_p2p_purchase_enabled === true;
sellerKycStatus = data.seller_kyc_status || 'none';
saleFeePercent = data.sale_fee_percent ?? saleFeePercent;
withdrawFeePercent = data.withdraw_fee_percent ?? withdrawFeePercent;
applyTranslations();
applyFeePercents();
updateSellerStatusUI(sellerKycStatus);
totp2faStatus = data.totp || totp2faStatus;
updateTotp2faUI();
p2pCardDetails = data.p2p_card_details || '';
withdrawCardEnabled = data.withdraw_card_enabled !== false;
currentUserTrust = data.trust || null;
renderTrustBadge();
withdrawCryptoEnabled = data.withdraw_crypto_enabled !== false;
if (typeof updateWithdrawMethodVisibility === 'function') updateWithdrawMethodVisibility();
if (typeof updateTopupCryptoBtnVisibility === 'function') updateTopupCryptoBtnVisibility();
document.getElementById('openTopupBtn').style.display = (!topupCardEnabled && !topupCryptoEnabled) ? 'none' : '';
document.getElementById('openWithdrawBtn').style.display = (!withdrawCardEnabled && !withdrawCryptoEnabled) ? 'none' : '';
if (data.language && data.language !== currentLang){
currentLang = data.language;
applyTranslations();
applyFeePercents();
if (typeof renderCategoryChips === 'function'){
renderCategoryChips();
}
if (typeof loadReferralInfo === 'function'){
loadReferralInfo();
}
if (typeof lastSkins !== 'undefined' && lastSkins.length){
applyFiltersAndRender();
}
if (typeof lastDeals !== 'undefined' && lastDeals.length){
document.getElementById('dealsList').innerHTML = lastDeals.map(dealCardHtml).join('');
}
}
updateFabVisibility();
updateSteamBlockVisibility();
updateMandatorySteamOverlay();
})
.catch(() => {
document.getElementById('balanceAmount').textContent = '—';
});
}

function loadProfile(){
const profileAvatar = document.getElementById('profileAvatar');
const profileName = document.getElementById('profileName');
const profileBalanceAmount = document.getElementById('profileBalanceAmount');
const profileHeld = document.getElementById('profileHeld');

loadWishlist();

if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.photo_url){
profileAvatar.innerHTML = `<img src="${tg.initDataUnsafe.user.photo_url}" alt="">`;
}

if (!tg || !tg.initData){
profileName.textContent = (I18N[currentLang] || I18N.ru).open_via_telegram;
profileBalanceAmount.textContent = '—';
return;
}

fetch(API_BASE + '/api/profile?init_data=' + encodeURIComponent(tg.initData))
.then(async r => {
if (!r.ok) throw new Error();
return r.json();
})
.then(data => {
if (!data || data.error) throw new Error();

isAdmin = !!data.is_admin;
isOwner = !!data.is_owner;
adminPermissions = data.admin_permissions || [];
isAuctioneer = !!data.is_auctioneer;
document.getElementById('tabAdminBtn').style.display = (isAdmin || isAuctioneer) ? '' : 'none';
document.getElementById('headerMenuAdmin').style.display = (isAdmin || isAuctioneer) ? '' : 'none';
if (typeof applyChipVisibility === 'function') applyChipVisibility();
currentUserId = data.user_id;
hasSteamLink = !!data.has_steam_link;
agreementAccepted = !!data.agreement_accepted;
changelogSeen = !!data.changelog_seen;
cryptoTopupAvailable = !!data.crypto_topup_available;
cryptoPayoutAvailable = !!data.crypto_payout_available;
topupCardEnabled = data.topup_card_enabled !== false;
topupCryptoEnabled = data.topup_crypto_enabled !== false;
topupStarsEnabled = data.topup_stars_enabled !== false;
coinsPerStar = data.coins_per_star || 200;
directStarsPurchaseEnabled = data.direct_stars_purchase_enabled === true;
directCryptoPurchaseEnabled = data.direct_crypto_purchase_enabled === true;
directP2pPurchaseEnabled = data.direct_p2p_purchase_enabled === true;
sellerKycStatus = data.seller_kyc_status || 'none';
saleFeePercent = data.sale_fee_percent ?? saleFeePercent;
withdrawFeePercent = data.withdraw_fee_percent ?? withdrawFeePercent;
applyTranslations();
applyFeePercents();
updateSellerStatusUI(sellerKycStatus);
totp2faStatus = data.totp || totp2faStatus;
updateTotp2faUI();
p2pCardDetails = data.p2p_card_details || '';
withdrawCardEnabled = data.withdraw_card_enabled !== false;
currentUserTrust = data.trust || null;
renderTrustBadge();
withdrawCryptoEnabled = data.withdraw_crypto_enabled !== false;
if (typeof updateWithdrawMethodVisibility === 'function') updateWithdrawMethodVisibility();
if (typeof updateTopupCryptoBtnVisibility === 'function') updateTopupCryptoBtnVisibility();
document.getElementById('openTopupBtn').style.display = (!topupCardEnabled && !topupCryptoEnabled) ? 'none' : '';
document.getElementById('openWithdrawBtn').style.display = (!withdrawCardEnabled && !withdrawCryptoEnabled) ? 'none' : '';
updateFabVisibility();
updateSteamBlockVisibility();
updateMandatorySteamOverlay();
updateProfileSteamBlock();

profileName.textContent = data.username || ('ID ' + data.user_id);
profileBalanceAmount.textContent = formatCoins(data.available);
profileHeld.innerHTML = data.held > 0
? (LOCK_ICON + ' ' + (I18N[currentLang] || I18N.ru).profile_held_label + ' ' + formatCoins(data.held))
: '';

document.getElementById('statSold').textContent = data.sold_count;
document.getElementById('statBought').textContent = data.bought_count;
document.getElementById('statActive').textContent = data.active_count;
})
.catch(() => {
profileName.textContent = (I18N[currentLang] || I18N.ru).load_failed;
profileBalanceAmount.textContent = '—';
});

loadDeals();
loadTradeOffers();
}

