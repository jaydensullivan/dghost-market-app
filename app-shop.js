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

const ERROR_MESSAGES_RU = {
trade_link_required: 'Чтобы покупать, привяжи ссылку на обмен Steam — продавцу нужно куда отправить предмет.',
sender_insufficient_funds: 'У отправителя не хватает денег на доплату — предложение больше неактуально.',
partner_not_sent: 'Партнёр ещё не отметил, что отправил предмет. Подтверждать получение рано.',
too_fast: 'Слишком много действий подряд. Подожди немного — это защита от накрутки.',
too_many_requests: 'Слишком много запросов подряд — подожди минуту и попробуй снова.',
user_blocked: 'Аккаунт заблокирован. Напиши в поддержку, чтобы разобраться.',
bad_rating: 'Выбери оценку от 1 до 5.',
review_too_early: 'Оставить отзыв можно после подтверждения получения предмета.',
already_reviewed: 'Ты уже оставил отзыв по этой сделке.',
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
seller_offer_required: 'Сначала прими оферту для продавца.',
already_submitted: 'Заявка уже отправлена или уже одобрена.',
bad_period: 'Проверь даты: «с» не позже «по», не в будущем и не больше года.',
no_key: 'Ключ Steamwebapi не задан — сервис не используется, инвентарь и цены идут через собственный бот.',
api_error: 'Steamwebapi вернул ошибку — проверь ключ и тариф в личном кабинете steamwebapi.com.',
steam_login_required: 'Чтобы выставлять лоты, подтверди аккаунт Steam: Профиль → «Войти через Steam».',
trade_link_not_yours: 'Эта ссылка на обмен ведёт на другой аккаунт Steam. Привяжи ссылку того аккаунта, с которым вошёл через Steam.',
bad_photo_url: 'По ссылке нет фото. Вставь прямую ссылку на картинку (открой фото → «Копировать адрес изображения»), а не на пост или страницу.',
item_not_tradable: 'Этот предмет сейчас нельзя передать (трейд-бан или защита обмена Steam). Выставь его, когда ограничение снимется.',
phone_not_verified: 'Подтверди номер телефона кнопкой «Подтвердить номер через Telegram».',
kyc_photos_required: 'Приложи фото документа и селфи с документом.',
send_failed: 'Не получилось отправить — проверь, что бот добавлен в канал отчётов админом.',
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
already_running: 'Раздача уже запущена.',
no_end_time: 'Сначала укажи, через сколько минут финал.',
not_running: 'Раздача сейчас не запущена.',
};

const ERROR_MESSAGES_UZ = {
trade_link_required: 'Xarid qilish uchun Steam almashuv havolasini ulang — sotuvchi buyumni qayerga yuborishini bilishi kerak.',
sender_insufficient_funds: "Yuboruvchida qo'shimcha to'lov uchun mablag' yetarli emas — taklif endi dolzarb emas.",
partner_not_sent: "Hamkor hali buyumni yuborganini belgilamagan. Qabul qilishni tasdiqlashga hali erta.",
too_fast: "Ketma-ket juda ko'p amal. Biroz kuting — bu aldovdan himoya.",
too_many_requests: "Ketma-ket juda ko'p so'rov — bir daqiqa kutib, qayta urinib ko'ring.",
user_blocked: "Akkaunt bloklangan. Aniqlash uchun qo'llab-quvvatlash xizmatiga yozing.",
bad_rating: "1 dan 5 gacha baho tanlang.",
review_too_early: "Sharhni buyumni qabul qilganingizni tasdiqlagandan keyin qoldirish mumkin.",
already_reviewed: "Bu bitim bo'yicha sharh allaqachon qoldirgansiz.",
bad_photo: "Rasmni o'qib bo'lmadi — boshqasini sinab ko'ring.",
evidence_empty: "Tavsif, Trade ID yoki skrinshot qo'shing.",
evidence_limit: "Bu nizo bo'yicha maksimal dalil yuborgansiz. Admin bot orqali siz bilan bog'lanadi.",
item_no_longer_available: "Bu buyum endi sotuvchining inventarida yo'q — lot sotuvdan olindi. Uzr, to'lov talab qilinmaydi.",
balance_purchase_disabled: "Xaridor uchun balansdan to'lov endi qo'llab-quvvatlanmaydi — Stars, kripto yoki P2P ni tanlang.",
self_dealing: "O'zingizga yoki bog'langan akkauntga almashuv taklif qilib bo'lmaydi.",
not_your_skin: "Bu lot sizga tegishli emas.",
target_mismatch: "Lot egasi allaqachon o'zgargan — sahifani yangilang.",
target_no_longer_available: "Lot endi mavjud emas — ehtimol, u allaqachon almashtirilgan yoki sotilgan.",
not_pending: "Bu taklif allaqachon ko'rib chiqilgan.",
not_accepted: "Bu taklif hali qabul qilinmagan.",
seller_kyc_required: "Bu funksiya faqat tekshiruvdan o'tgan sotuvchilar uchun. Profilda ariza topshiring.",
seller_offer_required: "Avval sotuvchi ofertasini qabul qiling.",
already_submitted: "Ariza allaqachon yuborilgan yoki tasdiqlangan.",
bad_period: "Sanalarni tekshiring: «dan» «gacha»dan keyin bo'lmasin, kelajakda va bir yildan ko'p bo'lmasin.",
no_key: "Steamwebapi kaliti berilmagan — servis ishlatilmaydi, inventar va narxlar o'z botimiz orqali olinadi.",
api_error: "Steamwebapi xato qaytardi — steamwebapi.com shaxsiy kabinetida kalit va tarifni tekshiring.",
steam_login_required: "Lot qo'yish uchun Steam akkauntini tasdiqlang: Profil → «Steam orqali kirish».",
trade_link_not_yours: "Bu almashuv havolasi boshqa Steam akkauntiga olib boradi. Steam orqali kirgan akkauntingiz havolasini ulang.",
bad_photo_url: "Havolada rasm yo'q. Post yoki sahifaga emas, rasmning to'g'ridan-to'g'ri havolasini qo'ying (rasmni oching → «Rasm manzilini nusxalash»).",
item_not_tradable: "Bu buyumni hozir berib bo'lmaydi (treyd-ban yoki Steam almashuv himoyasi). Cheklov olinganda qo'ying.",
phone_not_verified: "Telefon raqamini «Raqamni Telegram orqali tasdiqlash» tugmasi bilan tasdiqlang.",
kyc_photos_required: "Hujjat rasmi va hujjat bilan selfi biriktiring.",
send_failed: "Yuborib bo'lmadi — bot hisobotlar kanaliga admin sifatida qo'shilganini tekshiring.",
seller_not_sent_yet: "Sotuvchi hali «Yubordim» deb belgilamagan — qabul qilishni faqat shundan keyin tasdiqlash mumkin.",
unauthorized: "Mini-appni brauzerda emas, Telegram orqali oching.",
not_available: "Bu skin allaqachon sotilgan yoki sotuvdan olingan.",
own_listing: "O'z lotingizni sotib olib bo'lmaydi.",
insufficient_funds: "Balansda so'm yetarli emas.",
race_lost: "Kimdir bu skinni sizdan bir soniya oldin sotib oldi.",
forbidden: "Faqat o'z lotingizni olib tashlash mumkin.",
not_found: "Lot topilmadi.",
items_unavailable: "Bu setdagi bir yoki bir nechta lot allaqachon sotilgan — set endi to'liq mavjud emas.",
set_not_found: "Bu set endi mavjud emas.",
invalid: "Nomi va narxini tekshiring.",
bad_price: "To'g'ri narx kiriting.",
too_low: "Stavka juda kichik — kimdir allaqachon kattaroq stavka qo'ydi.",
not_active: "Auksion allaqachon tugagan.",
already_running: "Tanlov allaqachon boshlangan.",
no_end_time: "Avval final necha daqiqadan keyin bo'lishini kiriting.",
not_running: "Tanlov hozir boshlanmagan.",
};

const ERROR_MESSAGES_EN = {
trade_link_required: 'To buy, link your Steam trade URL — the seller needs somewhere to send the item.',
sender_insufficient_funds: "The sender doesn't have enough funds for the top-up — the offer is no longer valid.",
partner_not_sent: "Your partner hasn't marked the item as sent yet. It's too early to confirm receipt.",
too_fast: 'Too many actions in a row. Wait a little — this protects against abuse.',
too_many_requests: 'Too many requests in a row — wait a minute and try again.',
user_blocked: 'Your account is blocked. Contact support to sort it out.',
bad_rating: 'Choose a rating from 1 to 5.',
review_too_early: 'You can leave a review after confirming that you received the item.',
already_reviewed: "You've already left a review for this deal.",
bad_photo: "Couldn't read the photo — try another one.",
evidence_empty: 'Add a description, a Trade ID or a screenshot.',
evidence_limit: "You've already sent the maximum amount of evidence for this dispute. An admin will contact you in the bot.",
item_no_longer_available: "This item is no longer in the seller's inventory — the listing was removed. Sorry, no payment is needed.",
balance_purchase_disabled: 'Paying from balance is no longer supported for buyers — choose Stars, crypto or P2P.',
self_dealing: "You can't offer a trade to yourself or a linked account.",
not_your_skin: "This listing doesn't belong to you.",
target_mismatch: 'The listing has already changed owner — refresh the page.',
target_no_longer_available: 'The listing is no longer available — it may have been traded or sold already.',
not_pending: 'This offer has already been handled.',
not_accepted: "This offer hasn't been accepted yet.",
seller_kyc_required: 'This feature is only for verified sellers. Apply in your Profile.',
seller_offer_required: 'Accept the seller terms first.',
already_submitted: 'The request has already been sent or approved.',
bad_period: 'Check the dates: "from" must not be after "to", not in the future and not longer than a year.',
no_key: "The Steamwebapi key isn't set — the service isn't used; inventory and prices come from our own bot.",
api_error: 'Steamwebapi returned an error — check the key and plan in your steamwebapi.com account.',
steam_login_required: 'To list items, verify your Steam account: Profile → "Sign in through Steam".',
trade_link_not_yours: 'This trade URL belongs to a different Steam account. Link the URL of the account you signed in with.',
bad_photo_url: 'There is no photo at this link. Paste a direct link to the image (open the photo → "Copy image address"), not to a post or page.',
item_not_tradable: "This item can't be traded right now (trade ban or Steam trade protection). List it once the restriction is lifted.",
phone_not_verified: 'Verify your phone number with the "Verify number via Telegram" button.',
kyc_photos_required: 'Attach a photo of your ID and a selfie with it.',
send_failed: "Couldn't send — make sure the bot is added to the reports channel as an admin.",
seller_not_sent_yet: 'The seller hasn\'t marked "Sent" yet — you can confirm receipt only after that.',
unauthorized: 'Open the mini app through Telegram, not in a browser.',
not_available: 'This skin has already been sold or removed from sale.',
own_listing: "You can't buy your own listing.",
insufficient_funds: 'Not enough sum on your balance.',
race_lost: 'Someone bought this skin a second before you.',
forbidden: 'You can only remove your own listing.',
not_found: 'Listing not found.',
items_unavailable: 'One or more listings from this set have already been sold — the set is no longer available as a whole.',
set_not_found: 'This set no longer exists.',
invalid: 'Check the name and price.',
bad_price: 'Enter a valid price.',
too_low: 'The bid is too low — someone has already bid more.',
not_active: 'The auction has already ended.',
already_running: 'The giveaway is already running.',
no_end_time: 'First set how many minutes until the final.',
not_running: "The giveaway isn't running right now.",
};

function errorMessage(code){
return langMessage(ERROR_MESSAGES_RU, ERROR_MESSAGES_UZ, ERROR_MESSAGES_EN, code) || (I18N[currentLang] || I18N.ru).err_generic;
}

function purchaseTrustLimitMessage(data){
if (data.error === 'buyer_verification_required'){
if (typeof openBuyerVerify === 'function') openBuyerVerify(data);
const dict = I18N[currentLang] || I18N.ru;
return dict.bv_error.replace('{sum}', formatCoins(data.threshold || 0));
}
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
// Аккаунт Steam подтверждён официальным входом Steam (OpenID).
let steamVerified = false;
let steamPersona = null;
let steamAvatar = null;
let steamLoginRequired = true;
let steamLinkSkippedThisSession = false;
let agreementAccepted = false;
let sellerOfferAccepted = false;
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

// Покупка без ссылки на обмен невозможна: сервер вернёт
// trade_link_required, и мы сразу открываем окно привязки, а не
// показываем тупиковую ошибку.
function requireSteamLink(){
if (!steamOverlay) return;
steamOverlay.style.height = window.innerHeight + 'px';
steamOverlay.classList.add('show');
document.body.style.overflow = 'hidden';
haptic('warning');
}

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
balancePill.style.display = '';
isAdmin = !!data.is_admin;
isOwner = !!data.is_owner;
adminPermissions = data.admin_permissions || [];
isAuctioneer = !!data.is_auctioneer;
// Admin — в меню аватара; в нижней навигации только пять вкладок.
document.getElementById('headerMenuAdmin').style.display = (isAdmin || isAuctioneer) ? '' : 'none';
if (typeof applyChipVisibility === 'function') applyChipVisibility();
currentUserId = data.user_id;
hasSteamLink = !!data.has_steam_link;
applySteamVerification(data);
agreementAccepted = !!data.agreement_accepted;
sellerOfferAccepted = !!data.seller_offer_accepted;
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
profileAvatar.innerHTML = `<img src="${escapeHtml(tg.initDataUnsafe.user.photo_url)}" alt="">`;
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
document.getElementById('headerMenuAdmin').style.display = (isAdmin || isAuctioneer) ? '' : 'none';
if (typeof applyChipVisibility === 'function') applyChipVisibility();
currentUserId = data.user_id;
hasSteamLink = !!data.has_steam_link;
applySteamVerification(data);
agreementAccepted = !!data.agreement_accepted;
sellerOfferAccepted = !!data.seller_offer_accepted;
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

