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
phone_required: "Подтверди номер телефона.",
item_not_in_inventory: "Этого скина нет в твоём инвентаре Steam.",
no_market_price: "Для этого скина нет цены рынка — продать гаранту пока нельзя.",
garant_unavailable: "Этот гарант сейчас не принимает заявки.",
discount_below_garant: "Гарант берёт с большей скидкой.",
price_outside_garant: "Сумма не подходит под условия гаранта.",
week_limit: "Достигнут лимит продаж гарантам за 7 дней.",
request_pending: "По этому скину уже есть заявка, дождись ответа.",
bad_discount: "Скидка — от 5 до 15%.",
inventory_unavailable: "Steam сейчас не отдаёт инвентарь, попробуй позже.",
seller_unavailable: "Продавец больше не может продать — заявка не принята.",
admin_session_stale: "Для действий с деньгами и настройками нужен свежий вход: закройте мини-апп и откройте снова.",
admin_2fa_required: "Нужен код 2FA: откройте админку заново и введите код.",
support_too_many: "Слишком много сообщений подряд — дождитесь ответа поддержки.",
garant_required: "Нужен тариф PRO, «Бизнес» или «Гарант».",
garant_not_approved: "Сначала подай заявку на «Гарант» — её одобрит администрация.",
pro_forever: "У тебя подписка навсегда — покупать ничего не нужно.",
seller_verification_required: "Сначала пройди проверку продавца.",
event_limit: "Лимит тарифа на этот месяц исчерпан.",
has_bids: "Ставки уже есть — аукцион не отменить.",
has_entries: "Участники уже есть — розыгрыш не отменить.",
bid_banned: "Ставки закрыты: дважды выигранный аукцион не был оплачен. Напиши в поддержку.",
post_failed: "Не удалось опубликовать пост в канале. Проверь, что бот — админ канала.",
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
balance_purchase_disabled: 'Оплата с баланса доступна только покупателям. Продавец деньги с продаж выводит — выбери другой способ оплаты.',
self_dealing: 'Нельзя предложить обмен самому себе или связанному аккаунту.',
not_your_skin: 'Этот лот тебе не принадлежит.',
target_mismatch: 'Лот уже сменил владельца — обнови страницу.',
target_no_longer_available: 'Лот уже недоступен — возможно, его уже обменяли или продали.',
not_pending: 'Это предложение уже обработано.',
not_accepted: 'Это предложение ещё не принято.',
seller_kyc_required: 'Эта функция доступна только продавцам, прошедшим проверку. Подай заявку в Профиле.',
seller_offer_required: 'Сначала прими оферту для продавца.',
follow_limit: 'Слишком много подписок — отпишись от кого-нибудь.',
already_submitted: 'Заявка уже отправлена или уже одобрена.',
bad_period: 'Проверь даты: «с» не позже «по», не в будущем и не больше года.',
no_key: 'Ключ Steamwebapi не задан — сервис не используется, инвентарь и цены идут через собственный бот.',
api_error: 'Steamwebapi вернул ошибку — проверь ключ и тариф в личном кабинете steamwebapi.com.',
steam_login_required: 'Чтобы выставлять лоты, подтверди аккаунт Steam: Профиль → «Войти через Steam».',
seller_card_off: 'У продавца сейчас выключена оплата на карту — выбери другой способ.',
deal_over_share: 'Этот лот дороже лимита на одну сделку по депозиту продавца — оплати через гарант площадки.',
deposit_cover_exhausted: 'Депозит продавца сейчас занят другими сделками — оплати через гарант площадки.',
bad_card: 'Номер карты — 16 цифр.',
card_holder_mismatch: 'Имя на карте должно совпадать с ФИО из проверки продавца.',
deposit_below_min: 'Депозит меньше минимума.',
insufficient_balance: 'Не хватает на балансе.',
deposit_in_use: 'Есть открытые сделки с оплатой на карту.',
no_deposit: 'Депозита нет.',
link_not_yours: 'Ссылка ведёт на предмет другого аккаунта Steam. Нужна инспект-ссылка из своего инвентаря.',
link_unknown_item: 'Не удалось узнать предмет по ссылке. Проверь, что ссылка скопирована целиком.',
bad_unlock_date: 'Дата снятия бана должна быть в будущем и не дальше 8 дней — как показывает Steam.',
bad_link: 'Не похоже на инспект-ссылку Steam (steam://rungame/730/…).',
inspect_unavailable: 'Проверка предмета сейчас недоступна, попробуй через минуту.',
trade_link_not_yours: 'Эта ссылка на обмен ведёт на другой аккаунт Steam. Привяжи ссылку того аккаунта, с которым вошёл через Steam.',
bad_photo_url: 'По ссылке нет фото. Вставь прямую ссылку на картинку (открой фото → «Копировать адрес изображения»), а не на пост или страницу.',
item_not_tradable: 'Этот предмет сейчас нельзя передать (трейд-бан или защита обмена Steam). Выставь его, когда ограничение снимется.',
phone_not_verified: 'Подтверди номер телефона кнопкой «Подтвердить номер через Telegram».',
kyc_photos_required: 'Приложи фото документа и селфи с документом.',
tin_required: 'Самозанятому и ИП нужно указать ИНН или ПИНФЛ.',
bad_tin: 'ИНН — 9 цифр, ПИНФЛ — 14 цифр.',
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
payer_name_required: 'Укажи имя и фамилию владельца карты.',
};

const ERROR_MESSAGES_UZ = {
phone_required: "Telefon raqamini tasdiqlang.",
item_not_in_inventory: "Bu skin Steam inventaringizda yo‘q.",
no_market_price: "Bu skin uchun bozor narxi yo‘q — hozircha kafilga sotib bo‘lmaydi.",
garant_unavailable: "Bu kafil hozir ariza qabul qilmayapti.",
discount_below_garant: "Kafil kattaroq chegirma bilan oladi.",
price_outside_garant: "Summa kafil shartlariga mos emas.",
week_limit: "7 kunlik kafilga sotish limiti tugadi.",
request_pending: "Bu skin bo‘yicha ariza bor, javobni kuting.",
bad_discount: "Chegirma — 5 dan 15% gacha.",
inventory_unavailable: "Steam hozir inventarni bermayapti, keyinroq urinib ko‘ring.",
seller_unavailable: "Sotuvchi endi sota olmaydi — ariza qabul qilinmadi.",
admin_session_stale: "Pul va sozlamalar bilan amallar uchun qayta kirish kerak: mini-ilovani yopib, qayta oching.",
admin_2fa_required: "2FA kodi kerak: admin panelni qayta oching va kodni kiriting.",
support_too_many: "Juda ko'p xabar — qo'llab-quvvatlash javobini kuting.",
garant_required: "PRO, «Biznes» yoki «Kafil» tarifi kerak.",
garant_not_approved: "Avval «Kafil»ga ariza bering — ma'muriyat ma'qullaydi.",
pro_forever: "Sizda muddatsiz obuna bor — hech narsa sotib olish shart emas.",
seller_verification_required: "Avval sotuvchi tekshiruvidan o'ting.",
event_limit: "Bu oy uchun tarif limiti tugadi.",
has_bids: "Stavkalar bor — auksionni bekor qilib bo'lmaydi.",
has_entries: "Ishtirokchilar bor — konkursni bekor qilib bo'lmaydi.",
bid_banned: "Stavkalar yopilgan: ikki marta yutilgan auksion to'lanmagan. Yordamga yozing.",
post_failed: "Kanalga post joylab bo'lmadi. Bot kanal admini ekanini tekshiring.",
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
balance_purchase_disabled: "Balansdan to'lov faqat xaridorlar uchun. Sotuvchi savdodan tushgan pulni yechib oladi — boshqa to'lov usulini tanlang.",
self_dealing: "O'zingizga yoki bog'langan akkauntga almashuv taklif qilib bo'lmaydi.",
not_your_skin: "Bu lot sizga tegishli emas.",
target_mismatch: "Lot egasi allaqachon o'zgargan — sahifani yangilang.",
target_no_longer_available: "Lot endi mavjud emas — ehtimol, u allaqachon almashtirilgan yoki sotilgan.",
not_pending: "Bu taklif allaqachon ko'rib chiqilgan.",
not_accepted: "Bu taklif hali qabul qilinmagan.",
seller_kyc_required: "Bu funksiya faqat tekshiruvdan o'tgan sotuvchilar uchun. Profilda ariza topshiring.",
seller_offer_required: "Avval sotuvchi ofertasini qabul qiling.",
follow_limit: "Obunalar juda ko'p — kimdandir obunani bekor qiling.",
already_submitted: "Ariza allaqachon yuborilgan yoki tasdiqlangan.",
bad_period: "Sanalarni tekshiring: «dan» «gacha»dan keyin bo'lmasin, kelajakda va bir yildan ko'p bo'lmasin.",
no_key: "Steamwebapi kaliti berilmagan — servis ishlatilmaydi, inventar va narxlar o'z botimiz orqali olinadi.",
api_error: "Steamwebapi xato qaytardi — steamwebapi.com shaxsiy kabinetida kalit va tarifni tekshiring.",
steam_login_required: "Lot qo'yish uchun Steam akkauntini tasdiqlang: Profil → «Steam orqali kirish».",
seller_card_off: "Sotuvchida kartaga to‘lov hozir o‘chiq — boshqa usulni tanlang.",
deal_over_share: "Bu lot sotuvchi depoziti bo‘yicha bitta bitim limitidan qimmat — platforma kafili orqali to‘lang.",
deposit_cover_exhausted: "Sotuvchi depoziti hozir boshqa bitimlar bilan band — platforma kafili orqali to‘lang.",
bad_card: "Karta raqami — 16 raqam.",
card_holder_mismatch: "Kartadagi ism sotuvchi tekshiruvidagi F.I.Sh. bilan mos kelishi kerak.",
deposit_below_min: "Depozit minimumdan kam.",
insufficient_balance: "Balansda yetarli emas.",
deposit_in_use: "Kartaga to‘lovli ochiq bitimlar bor.",
no_deposit: "Depozit yo‘q.",
link_not_yours: "Havola boshqa Steam akkauntining buyumiga olib boradi. O'z inventaringizdan inspekt-havola kerak.",
link_unknown_item: "Havola bo'yicha buyumni aniqlab bo'lmadi. Havola to'liq nusxalanganini tekshiring.",
bad_unlock_date: "Ban olinadigan sana kelajakda va 8 kundan uzoq bo'lmasligi kerak — Steam ko'rsatganidek.",
bad_link: "Steam inspekt-havolasiga o'xshamaydi (steam://rungame/730/…).",
inspect_unavailable: "Buyumni tekshirish hozir ishlamayapti, bir daqiqadan keyin urinib ko'ring.",
trade_link_not_yours: "Bu almashuv havolasi boshqa Steam akkauntiga olib boradi. Steam orqali kirgan akkauntingiz havolasini ulang.",
bad_photo_url: "Havolada rasm yo'q. Post yoki sahifaga emas, rasmning to'g'ridan-to'g'ri havolasini qo'ying (rasmni oching → «Rasm manzilini nusxalash»).",
item_not_tradable: "Bu buyumni hozir berib bo'lmaydi (treyd-ban yoki Steam almashuv himoyasi). Cheklov olinganda qo'ying.",
phone_not_verified: "Telefon raqamini «Raqamni Telegram orqali tasdiqlash» tugmasi bilan tasdiqlang.",
kyc_photos_required: "Hujjat rasmi va hujjat bilan selfi biriktiring.",
tin_required: "O'zini o'zi band qilgan va YaTT uchun STIR yoki JShShIR kerak.",
bad_tin: "STIR — 9 raqam, JShShIR — 14 raqam.",
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
payer_name_required: "Karta egasining ismi va familiyasini kiriting.",
};

const ERROR_MESSAGES_EN = {
phone_required: "Confirm your phone number.",
item_not_in_inventory: "This skin isn't in your Steam inventory.",
no_market_price: "There's no market price for this skin — it can't be sold to a guarantor yet.",
garant_unavailable: "This guarantor isn't taking requests right now.",
discount_below_garant: "This guarantor takes a bigger discount.",
price_outside_garant: "The amount doesn't fit the guarantor's terms.",
week_limit: "You've reached the 7-day limit for sales to guarantors.",
request_pending: "There's already a request for this skin — wait for the reply.",
bad_discount: "The discount must be 5–15%.",
inventory_unavailable: "Steam isn't returning the inventory right now, try later.",
seller_unavailable: "The seller can no longer sell — request not accepted.",
admin_session_stale: "Money and settings actions need a fresh sign-in: close the mini app and open it again.",
admin_2fa_required: "2FA code needed: open the admin panel again and enter the code.",
support_too_many: "Too many messages in a row — please wait for support to reply.",
garant_required: "The Pro, Business or Guarantor plan is required.",
garant_not_approved: "Apply for the Guarantor plan first — the team will approve it.",
pro_forever: "Your subscription is forever — nothing to buy.",
seller_verification_required: "Complete seller verification first.",
event_limit: "This month's plan limit is used up.",
has_bids: "There are bids already — the auction can't be cancelled.",
has_entries: "There are entries already — the giveaway can't be cancelled.",
bid_banned: "Bidding is closed: two won auctions were not paid. Contact support.",
post_failed: "Couldn't post to the channel. Make sure the bot is a channel admin.",
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
balance_purchase_disabled: 'Paying from balance is for buyers only. Sellers withdraw their sales money — choose another payment method.',
self_dealing: "You can't offer a trade to yourself or a linked account.",
not_your_skin: "This listing doesn't belong to you.",
target_mismatch: 'The listing has already changed owner — refresh the page.',
target_no_longer_available: 'The listing is no longer available — it may have been traded or sold already.',
not_pending: 'This offer has already been handled.',
not_accepted: "This offer hasn't been accepted yet.",
seller_kyc_required: 'This feature is only for verified sellers. Apply in your Profile.',
seller_offer_required: 'Accept the seller terms first.',
follow_limit: 'Too many follows — unfollow someone first.',
already_submitted: 'The request has already been sent or approved.',
bad_period: 'Check the dates: "from" must not be after "to", not in the future and not longer than a year.',
no_key: "The Steamwebapi key isn't set — the service isn't used; inventory and prices come from our own bot.",
api_error: 'Steamwebapi returned an error — check the key and plan in your steamwebapi.com account.',
steam_login_required: 'To list items, verify your Steam account: Profile → "Sign in through Steam".',
seller_card_off: "The seller's card payments are off right now — pick another method.",
deal_over_share: "This lot exceeds the per-deal limit of the seller's deposit — pay via the platform escrow.",
deposit_cover_exhausted: "The seller's deposit is tied up in other deals — pay via the platform escrow.",
bad_card: 'The card number is 16 digits.',
card_holder_mismatch: 'The name on the card must match the verified seller name.',
deposit_below_min: 'The deposit is below the minimum.',
insufficient_balance: 'Not enough on balance.',
deposit_in_use: 'There are open card-paid deals.',
no_deposit: 'No deposit.',
link_not_yours: "This link points to another Steam account's item. Use an inspect link from your own inventory.",
link_unknown_item: "Couldn't identify the item from the link. Make sure the whole link is copied.",
bad_unlock_date: 'The unban date must be in the future and within 8 days — as Steam shows it.',
bad_link: "Doesn't look like a Steam inspect link (steam://rungame/730/…).",
inspect_unavailable: 'Item check is unavailable right now, try again in a minute.',
trade_link_not_yours: 'This trade URL belongs to a different Steam account. Link the URL of the account you signed in with.',
bad_photo_url: 'There is no photo at this link. Paste a direct link to the image (open the photo → "Copy image address"), not to a post or page.',
item_not_tradable: "This item can't be traded right now (trade ban or Steam trade protection). List it once the restriction is lifted.",
phone_not_verified: 'Verify your phone number with the "Verify number via Telegram" button.',
kyc_photos_required: 'Attach a photo of your ID and a selfie with it.',
tin_required: 'Self-employed and sole proprietors must enter a TIN or PINFL.',
bad_tin: 'TIN is 9 digits, PINFL is 14 digits.',
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
payer_name_required: 'Enter the card holder’s first and last name.',
};

function errorMessage(code){
return langMessage(ERROR_MESSAGES_RU, ERROR_MESSAGES_UZ, ERROR_MESSAGES_EN, code) || (I18N[currentLang] || I18N.ru).err_generic;
}

function purchaseTrustLimitMessage(data){
if (data.error === 'trade_locked'){
const until = Date.parse(data.tradable_after);
return (I18N[currentLang] || I18N.ru).tl_error.replace('{date}', until ? tradeLockDate(until) : '—');
}
if (data.error === 'new_account_limit'){
const dict = I18N[currentLang] || I18N.ru;
return dict.aml_new_account_limit
.replace('{n}', data.max_purchases || 0)
.replace('{sum}', formatCoins(data.max_amount || 0))
.replace('{days}', data.days_left || 1);
}
if (data.error === 'buyer_kyc_required'){
const dict = I18N[currentLang] || I18N.ru;
if (typeof openKycOverlay === 'function') openKycOverlay();
return dict.aml_buyer_kyc_required.replace('{sum}', formatCoins(data.threshold || 0));
}
if (data.error === 'buyer_verification_required'){
if (typeof openBuyerVerify === 'function') openBuyerVerify(data);
const dict = I18N[currentLang] || I18N.ru;
return dict.bv_error.replace('{sum}', formatCoins(data.threshold || 0));
}
if (data.error === 'trust_limit_exceeded'){
const limitText = data.limit ? formatCoins(data.limit) : null;
return limitText
? (I18N[currentLang] || I18N.ru).trust_buy_limit.replace('{sum}', limitText)
: (I18N[currentLang] || I18N.ru).trust_buy_limit_generic;
}
return null;
}

// Валюта — на языке интерфейса: «сум», «so'm», «UZS».
function formatCoins(n){
const dict = (typeof I18N !== 'undefined' && I18N[typeof currentLang !== 'undefined' ? currentLang : 'ru']) || null;
return Number(n || 0).toLocaleString('ru-RU') + ' ' + ((dict && dict.currency_sum) || 'сум');
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
document.getElementById('agreementTextBox').textContent = (currentLang === 'uz' && data.text_uz) ? data.text_uz : data.text;
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

// Язык из профиля на сервере — после того как подгрузился его словарь.
function applyServerLanguage(lang){
if (lang === currentLang) return;
currentLang = lang;
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
myAvailableBalance = Number(data.available) || 0;
balancePill.style.display = '';
isAdmin = !!data.is_admin;
isOwner = !!data.is_owner;
adminPermissions = data.admin_permissions || [];
isAuctioneer = !!data.is_auctioneer;
// До applySupportMe: кнопка «Открыть» из бота поддержки сразу ведёт в
// админку, а запрос кода 2FA там смотрит на этот статус.
totp2faStatus = data.totp || totp2faStatus;
applySupportMe(data);
// Admin — в меню аватара; в нижней навигации только пять вкладок.
document.getElementById('headerMenuAdmin').style.display = (isAdmin || isAuctioneer || isSupportStaff) ? '' : 'none';
if (isAdmin || isAuctioneer || isSupportStaff) ensureAdminScript().catch(() => {});
if (typeof applyChipVisibility === 'function') applyChipVisibility();
currentUserId = data.user_id;
hasSteamLink = !!data.has_steam_link;
applySteamVerification(data);
agreementAccepted = !!data.agreement_accepted;
sellerOfferAccepted = !!data.seller_offer_accepted;
changelogSeen = !!data.changelog_seen;
topupCardEnabled = data.topup_card_enabled !== false;
directP2pPurchaseEnabled = data.direct_p2p_purchase_enabled === true;
hostedPayMethods = Array.isArray(data.payment_methods) ? data.payment_methods.filter(m => m && m.kind === 'hosted') : [];
sellerKycStatus = data.seller_kyc_status || 'none';
instantCanWithdraw = !!data.instant_can_withdraw;
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
if (typeof updateTopupMethods === 'function') updateTopupMethods();
document.getElementById('openTopupBtn').style.display = (topupCardEnabled && sellerKycStatus === 'verified') ? '' : 'none';
document.getElementById('openWithdrawBtn').style.display = withdrawCardEnabled ? '' : 'none';
if (data.language && data.language !== currentLang){
ensureLanguage(data.language).then(() => applyServerLanguage(data.language)).catch(() => {});
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
const pDict = I18N[currentLang] || I18N.ru;
if (window.DG_WEB && typeof window.dgWebLogin === 'function'){
// Браузер без входа: вместо «Открой через Telegram» — кнопка входа.
profileName.textContent = pDict.web_login;
profileName.style.cursor = 'pointer';
profileName.onclick = () => window.dgWebLogin();
} else {
profileName.textContent = pDict.open_via_telegram;
}
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
// До applySupportMe: кнопка «Открыть» из бота поддержки сразу ведёт в
// админку, а запрос кода 2FA там смотрит на этот статус.
totp2faStatus = data.totp || totp2faStatus;
applySupportMe(data);
document.getElementById('headerMenuAdmin').style.display = (isAdmin || isAuctioneer || isSupportStaff) ? '' : 'none';
if (isAdmin || isAuctioneer || isSupportStaff) ensureAdminScript().catch(() => {});
if (typeof applyChipVisibility === 'function') applyChipVisibility();
currentUserId = data.user_id;
hasSteamLink = !!data.has_steam_link;
applySteamVerification(data);
agreementAccepted = !!data.agreement_accepted;
sellerOfferAccepted = !!data.seller_offer_accepted;
changelogSeen = !!data.changelog_seen;
topupCardEnabled = data.topup_card_enabled !== false;
directP2pPurchaseEnabled = data.direct_p2p_purchase_enabled === true;
hostedPayMethods = Array.isArray(data.payment_methods) ? data.payment_methods.filter(m => m && m.kind === 'hosted') : [];
sellerKycStatus = data.seller_kyc_status || 'none';
instantCanWithdraw = !!data.instant_can_withdraw;
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
if (typeof updateTopupMethods === 'function') updateTopupMethods();
document.getElementById('openTopupBtn').style.display = (topupCardEnabled && sellerKycStatus === 'verified') ? '' : 'none';
document.getElementById('openWithdrawBtn').style.display = withdrawCardEnabled ? '' : 'none';
updateSteamBlockVisibility();
updateMandatorySteamOverlay();
updateProfileSteamBlock();

profileName.textContent = data.username || ('ID ' + data.user_id);
profileBalanceAmount.textContent = formatCoins(data.available);
myAvailableBalance = Number(data.available) || 0;
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


// promo.mp4 (~0,5 МБ) нужен только на экране привязки Steam — качаем
// его при первом показе этого экрана, а не при каждом открытии приложения.
(function lazyMandatorySteamPromo(){
const overlay = document.getElementById('mandatorySteamOverlay');
const video = document.getElementById('mandatorySteamPromo');
if (!overlay || !video || typeof MutationObserver === 'undefined') return;
function sync(){
if (overlay.classList.contains('show')){
if (!video.getAttribute('src') && video.dataset.src) video.src = video.dataset.src;
const p = video.play();
if (p && p.catch) p.catch(() => {});
} else if (!video.paused){
video.pause();
}
}
new MutationObserver(sync).observe(overlay, { attributes: true, attributeFilter: ['class'] });
sync();
})();
