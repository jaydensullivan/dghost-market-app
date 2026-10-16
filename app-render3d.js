// ============================================================
// 3D-РЕНДЕР ДЛЯ БИЗНЕСА — тот же раздел, что на сайте
// (dghostmarket.uz/3d-api/): услуги, тарифы, демо виджета, заявка.
//
// Данные ниже (R3D) выгружены из tools/render.py репозитория
// dghostmarket-site — тарифы и тексты там и здесь одинаковые. Меняешь
// цены или тексты на сайте — перевыгрузи их сюда тем же скриптом.
// Демо — виджет embed.html с ключом demo (работает на наших доменах).
// ============================================================

const R3D = {
"plans": [
{
"key": "trial",
"usd": 0,
"domains": 1,
"views": 1000,
"images": 50,
"videos": 0,
"ar": false,
"badge": "full",
"brand": false,
"support": "none"
},
{
"key": "starter",
"usd": 19,
"domains": 1,
"views": 10000,
"images": 1000,
"videos": 0,
"ar": false,
"badge": "small",
"brand": false,
"support": "mail"
},
{
"key": "pro",
"usd": 49,
"domains": 3,
"views": 50000,
"images": 5000,
"videos": 100,
"ar": true,
"badge": "off_opt",
"brand": false,
"support": "mail24",
"best": true
},
{
"key": "business",
"usd": 129,
"domains": 10,
"views": 250000,
"images": 25000,
"videos": 500,
"ar": true,
"badge": "off",
"brand": true,
"support": "tg"
},
{
"key": "enterprise",
"usd": null,
"domains": null,
"views": null,
"images": null,
"videos": null,
"ar": true,
"badge": "off",
"brand": true,
"support": "personal"
}
],
"rate": 11900,
"tg": "https://t.me/dghostmarket?direct",
"mail": "support@dghostmarket.uz",
"page": "https://dghostmarket.uz/3d-api/",
"demo": [
{
"skin": "AK-47 | Redline",
"float": 0.15,
"seed": 661
},
{
"skin": "★ Karambit | Fade",
"float": 0.012,
"seed": 412
},
{
"skin": "AWP | Asiimov",
"float": 0.24,
"seed": 77
},
{
"skin": "M4A1-S | Printstream",
"float": 0.08,
"seed": 233
},
{
"skin": "★ Butterfly Knife | Doppler",
"float": 0.02,
"seed": 905
}
],
"t": {
"ru": {
"crumb": "3D-рендер для бизнеса",
"badge": "Скоро · набираем пилотных клиентов",
"lead": "Тот же 3D-движок, что в маркете DGhostMarket: реальная раскраска, float и паттерн конкретного предмета. Подключите на свой сайт виджетом или получайте готовые картинки и видео по API.",
"cta": "Оставить заявку на пилот",
"cta_mail": "Написать на почту",
"what_h": "Что вы получаете",
"what": [
[
"🧊 3D-виджет",
"Вставляете одну строку кода — на странице товара появляется 3D-просмотр: вращение, приближение, фоны карт CS2, износ по float и рисунок по паттерну."
],
[
"🖼 API картинок",
"Отправляете скин, float и паттерн — получаете PNG или WebP нужного ракурса. Готовые картинки кэшируются: повторный запрос мгновенный."
],
[
"🎬 Видео и GIF",
"Ролик вращения или осмотр «в руках» — для карточек товара, постов и рекламы."
],
[
"📐 AR «на столе»",
"Покупатель ставит скин на свой стол через камеру телефона в натуральную величину."
]
],
"who_h": "Кому подходит",
"who": [
"маркетплейсам и магазинам скинов",
"трейд-ботам и Telegram-магазинам",
"сайтам с кейсами и обзорами, блогерам и стримерам",
"сервисам оценки и аналитики инвентаря"
],
"plans_h": "Тарифы",
"plans_sub": "Цены в месяц. При оплате за год — скидка 20%. Клиентам из Узбекистана — оплата в сумах картой Humo или Uzcard.",
"per_month": "/ мес",
"free": "Бесплатно",
"trial_note": "14 дней",
"custom": "Договорная",
"approx": "≈ {v} сум",
"best": "Популярный",
"f_domains": "Сайтов (доменов)",
"f_views": "Показы 3D-виджета",
"f_images": "Картинки по API",
"f_videos": "Видео и GIF по API",
"f_ar": "AR «на столе»",
"f_badge": "Значок «3D by DGhost»",
"f_brand": "Свой фон и брендинг",
"f_support": "Поддержка",
"v_custom": "по договору",
"v_yes": "✓",
"v_no": "—",
"badge_full": "есть",
"badge_small": "маленький",
"badge_off_opt": "можно убрать",
"badge_off": "нет",
"sup_none": "—",
"sup_mail": "почта",
"sup_mail24": "почта, ответ за 24 ч",
"sup_tg": "Telegram, в приоритете",
"sup_personal": "персональный менеджер",
"over_h": "Если лимит закончился",
"over": "Сервис не отключается — сверх лимита: $2 за 1 000 показов, $5 за 1 000 картинок, $0,10 за видео. Перерасход виден в личном кабинете.",
"plan_trial": "Пробный",
"plan_starter": "Starter",
"plan_pro": "Pro",
"plan_business": "Business",
"plan_enterprise": "Enterprise",
"how_h": "Как подключиться",
"how": [
"Оставьте заявку в Telegram или на почту: сайт, сколько товаров и показов в месяц.",
"Мы выдадим ключ и привяжем его к вашему домену — чужой сайт ваш ключ использовать не сможет.",
"Вставьте виджет или подключите API по документации — обычно это занимает час.",
"14 дней бесплатно, потом выбираете тариф."
],
"faq_h": "Вопросы",
"faq": [
[
"Чем отличается от картинок Steam?",
"В Steam одна картинка на весь скин. У нас — конкретный предмет: его float (потёртости) и паттерн (положение рисунка), в 3D со всех сторон."
],
[
"Насколько похоже на игру?",
"Модели и раскраски собираются из файлов CS2, сходство мы постоянно сверяем с CSFloat и Steam. Для части редких раскрасок работа ещё идёт — во время пилота покажем результат на ваших товарах."
],
[
"Вы отдаёте файлы моделей?",
"Нет. Вы получаете показ и готовые картинки или видео; исходные файлы закрыты и привязаны к вашему домену."
],
[
"Когда запуск?",
"Сейчас набираем пилотных клиентов: первые получают бесплатный месяц и скидку на тариф."
]
],
"legal": "DGhostMarket не связан с Valve Corporation. CS2, Counter-Strike и Steam — товарные знаки Valve Corporation. Сервис показывает внешний вид предметов, но не продаёт и не распространяет игровые файлы.",
"mail_subject": "Заявка на 3D-рендер",
"demo_h": "Попробуйте прямо здесь",
"demo_sub": "Это и есть виджет — так он будет выглядеть на вашем сайте. Крутите пальцем или мышкой, переключайте фоны и износ."
},
"uz": {
"crumb": "Biznes uchun 3D-render",
"badge": "Tez kunda · pilot mijozlarni yig‘moqdamiz",
"lead": "DGhostMarket marketidagi o‘sha 3D-dvigatel: aynan shu buyumning haqiqiy bo‘yog‘i, float va naqshi. Saytingizga vidjet orqali ulang yoki API orqali tayyor rasm va videolarni oling.",
"cta": "Pilotga ariza qoldirish",
"cta_mail": "Pochtaga yozish",
"what_h": "Siz nimani olasiz",
"what": [
[
"🧊 3D-vidjet",
"Bitta qator kod qo‘shasiz — tovar sahifasida 3D-ko‘rinish paydo bo‘ladi: aylantirish, yaqinlashtirish, CS2 xaritalari fonlari, float bo‘yicha eskirish va naqsh bo‘yicha rasm."
],
[
"🖼 Rasmlar API",
"Skin, float va naqshni yuborasiz — kerakli burchakdan PNG yoki WebP olasiz. Tayyor rasmlar keshlanadi: takroriy so‘rov bir zumda."
],
[
"🎬 Video va GIF",
"Aylanish roligi yoki «qo‘lda» ko‘rish — tovar kartochkalari, postlar va reklama uchun."
],
[
"📐 AR «Stolda»",
"Xaridor telefon kamerasi orqali skinni stoliga haqiqiy o‘lchamda qo‘yadi."
]
],
"who_h": "Kimlar uchun",
"who": [
"skin marketpleyslari va do‘konlari",
"treyd-botlar va Telegram-do‘konlar",
"keys va obzor saytlari, blogerlar va strimerlar",
"inventarni baholash va tahlil qilish servislari"
],
"plans_h": "Tariflar",
"plans_sub": "Narxlar oyiga. Bir yilga to‘lasangiz — 20% chegirma. O‘zbekistondagi mijozlar uchun — Humo yoki Uzcard kartasi bilan so‘mda to‘lov.",
"per_month": "/ oy",
"free": "Bepul",
"trial_note": "14 kun",
"custom": "Kelishilgan",
"approx": "≈ {v} so‘m",
"best": "Ommabop",
"f_domains": "Saytlar (domenlar)",
"f_views": "3D-vidjet ko‘rsatuvlari",
"f_images": "API orqali rasmlar",
"f_videos": "API orqali video va GIF",
"f_ar": "AR «Stolda»",
"f_badge": "«3D by DGhost» belgisi",
"f_brand": "O‘z foni va brendingi",
"f_support": "Yordam",
"v_custom": "kelishuv bo‘yicha",
"v_yes": "✓",
"v_no": "—",
"badge_full": "bor",
"badge_small": "kichik",
"badge_off_opt": "olib tashlash mumkin",
"badge_off": "yo‘q",
"sup_none": "—",
"sup_mail": "pochta",
"sup_mail24": "pochta, 24 soatda javob",
"sup_tg": "Telegram, birinchi navbatda",
"sup_personal": "shaxsiy menejer",
"over_h": "Limit tugasa",
"over": "Servis o‘chmaydi — limitdan ortig‘i: 1 000 ko‘rsatuv uchun $2, 1 000 rasm uchun $5, bitta video uchun $0,10. Ortiqcha sarf shaxsiy kabinetda ko‘rinadi.",
"plan_trial": "Sinov",
"plan_starter": "Starter",
"plan_pro": "Pro",
"plan_business": "Business",
"plan_enterprise": "Enterprise",
"how_h": "Qanday ulanish",
"how": [
"Telegram yoki pochta orqali ariza qoldiring: sayt, oyiga qancha tovar va ko‘rsatuv.",
"Biz kalit beramiz va uni domeningizga bog‘laymiz — boshqa sayt kalitingizdan foydalana olmaydi.",
"Vidjetni qo‘ying yoki hujjatlar bo‘yicha API’ni ulang — odatda bir soat vaqt oladi.",
"14 kun bepul, keyin tarifni tanlaysiz."
],
"faq_h": "Savollar",
"faq": [
[
"Steam rasmlaridan farqi nima?",
"Steam’da butun skin uchun bitta rasm. Bizda — aynan shu buyum: uning float’i (eskirishi) va naqshi (rasm joylashuvi), 3D’da har tomondan."
],
[
"O‘yinga qanchalik o‘xshash?",
"Modellar va bo‘yoqlar CS2 fayllaridan yig‘iladi, o‘xshashlikni doimiy ravishda CSFloat va Steam bilan solishtiramiz. Ba’zi noyob bo‘yoqlar ustida ish davom etmoqda — pilot davomida natijani o‘z tovarlaringizda ko‘rsatamiz."
],
[
"Model fayllarini berasizmi?",
"Yo‘q. Siz ko‘rsatuv va tayyor rasm yoki videolarni olasiz; asl fayllar yopiq va domeningizga bog‘langan."
],
[
"Qachon ishga tushadi?",
"Hozir pilot mijozlarni yig‘moqdamiz: birinchilar bir oy bepul va tarifga chegirma oladi."
]
],
"legal": "DGhostMarket Valve Corporation bilan bog‘liq emas. CS2, Counter-Strike va Steam — Valve Corporation tovar belgilari. Servis buyumlarning tashqi ko‘rinishini ko‘rsatadi, lekin o‘yin fayllarini sotmaydi va tarqatmaydi.",
"mail_subject": "3D-render uchun ariza",
"demo_h": "Shu yerning o‘zida sinab ko‘ring",
"demo_sub": "Bu vidjetning o‘zi — saytingizda ham xuddi shunday ko‘rinadi. Barmoq yoki sichqoncha bilan aylantiring, fon va eskirishni almashtiring."
},
"en": {
"crumb": "3D rendering for business",
"badge": "Coming soon · looking for pilot clients",
"lead": "The same 3D engine that powers the DGhostMarket marketplace: real finish, float and pattern of the exact item. Embed it on your site with a widget or get ready-made images and videos via API.",
"cta": "Apply for the pilot",
"cta_mail": "Email us",
"what_h": "What you get",
"what": [
[
"🧊 3D widget",
"Add one line of code and your product page gets a 3D viewer: rotate, zoom, CS2 map backgrounds, wear by float and artwork by pattern."
],
[
"🖼 Image API",
"Send the skin, float and pattern — get a PNG or WebP from the angle you need. Results are cached, so repeat requests are instant."
],
[
"🎬 Video and GIF",
"A rotation clip or an in-hand inspect — for product cards, posts and ads."
],
[
"📐 AR on the table",
"Buyers place the skin on their desk at real size with their phone camera."
]
],
"who_h": "Who it is for",
"who": [
"skin marketplaces and stores",
"trade bots and Telegram shops",
"case and review sites, bloggers and streamers",
"inventory valuation and analytics services"
],
"plans_h": "Pricing",
"plans_sub": "Prices per month. Pay yearly and save 20%. Clients in Uzbekistan can pay in UZS with Humo or Uzcard.",
"per_month": "/ mo",
"free": "Free",
"trial_note": "14 days",
"custom": "Custom",
"approx": "≈ {v} UZS",
"best": "Popular",
"f_domains": "Websites (domains)",
"f_views": "3D widget views",
"f_images": "API images",
"f_videos": "API videos and GIFs",
"f_ar": "AR on the table",
"f_badge": "“3D by DGhost” badge",
"f_brand": "Custom background and branding",
"f_support": "Support",
"v_custom": "custom",
"v_yes": "✓",
"v_no": "—",
"badge_full": "yes",
"badge_small": "small",
"badge_off_opt": "removable",
"badge_off": "no",
"sup_none": "—",
"sup_mail": "email",
"sup_mail24": "email, reply within 24 h",
"sup_tg": "Telegram, priority",
"sup_personal": "dedicated manager",
"over_h": "If you run out",
"over": "Your service keeps working — overage is $2 per 1,000 views, $5 per 1,000 images and $0.10 per video. You can see it in your dashboard.",
"plan_trial": "Trial",
"plan_starter": "Starter",
"plan_pro": "Pro",
"plan_business": "Business",
"plan_enterprise": "Enterprise",
"how_h": "How to start",
"how": [
"Apply via Telegram or email: your site, number of products and monthly views.",
"We issue a key bound to your domain — no other site can use it.",
"Add the widget or connect the API using the docs — usually about an hour.",
"14 days free, then pick a plan."
],
"faq_h": "FAQ",
"faq": [
[
"How is this different from Steam images?",
"Steam has one image per skin. We render the exact item — its float (wear) and pattern (artwork placement) — in 3D from every side."
],
[
"How close is it to the game?",
"Models and finishes are built from CS2 game files, and we continuously compare them with CSFloat and Steam. Some rare finishes are still in progress — during the pilot we will show results on your items."
],
[
"Do you hand out model files?",
"No. You get the viewer and ready-made images or videos; source files stay private and bound to your domain."
],
[
"When is the launch?",
"We are onboarding pilot clients now: early clients get a free month and a discount on their plan."
]
],
"legal": "DGhostMarket is not affiliated with Valve Corporation. CS2, Counter-Strike and Steam are trademarks of Valve Corporation. The service shows the appearance of items and does not sell or distribute game files.",
"mail_subject": "3D rendering request",
"demo_h": "Try it right here",
"demo_sub": "This is the widget itself — it will look the same on your website. Drag to rotate, switch backgrounds and wear."
}
},
"btn": {
"ru": "🧊 3D-рендер для бизнеса",
"uz": "🧊 Biznes uchun 3D-render",
"en": "🧊 3D rendering for business"
},
"btn_sub": {
"ru": "3D-просмотр скинов на вашем сайте — тарифы от $19",
"uz": "Saytingizda skinlarning 3D-ko‘rinishi — tariflar $19 dan",
"en": "3D skin viewer for your website — plans from $19"
},
"open_site": {
"ru": "Страница сервиса на сайте",
"uz": "Saytdagi servis sahifasi",
"en": "Service page on the website"
}
};

(function(){
const css = `
.r3d-card .r3d-sub{color:var(--muted);font-size:13px;margin:4px 0 10px}
.r3d-sheet{max-height:92vh;overflow-y:auto}
.r3d-sheet .r3d-badge{display:inline-block;border:1px solid rgba(168,85,247,0.35);border-radius:999px;padding:4px 10px;font-size:12px;color:#c9a6ff;margin:0 0 10px}
.r3d-sheet .r3d-lead{color:var(--muted);font-size:14px;line-height:1.5;margin:0 0 12px}
.r3d-sheet h3{font-size:16px;margin:18px 0 10px}
.r3d-sheet .r3d-cards{display:grid;gap:8px}
.r3d-sheet .r3d-c{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:12px}
.r3d-sheet .r3d-c b{display:block;margin-bottom:4px}
.r3d-sheet .r3d-c p{margin:0;color:var(--muted);font-size:13px;line-height:1.5}
.r3d-sheet .r3d-who{display:flex;flex-wrap:wrap;gap:6px}
.r3d-sheet .r3d-who span{border:1px solid rgba(168,85,247,0.3);border-radius:999px;padding:5px 10px;font-size:12px}
.r3d-sheet .r3d-demo iframe{width:100%;height:340px;border:0;border-radius:14px;background:#0c0816;display:block}
.r3d-sheet .r3d-skins{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.r3d-sheet .r3d-skins button{font:inherit;font-size:12px;color:var(--text);background:rgba(255,255,255,0.04);border:1px solid rgba(168,85,247,0.3);border-radius:999px;padding:6px 10px}
.r3d-sheet .r3d-skins button.on{background:linear-gradient(135deg,#7B2CFF,#FF2BD6);border-color:transparent;color:#fff}
.r3d-sheet .r3d-plans{display:grid;gap:10px}
.r3d-sheet .r3d-plan{position:relative;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:12px}
.r3d-sheet .r3d-plan.best{border-color:#A855F7}
.r3d-sheet .r3d-plan .tag{position:absolute;top:-9px;right:12px;background:linear-gradient(135deg,#7B2CFF,#FF2BD6);color:#fff;border-radius:999px;padding:1px 8px;font-size:11px;font-weight:600}
.r3d-sheet .r3d-plan .ph{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.r3d-sheet .r3d-plan .pn{font-weight:700}
.r3d-sheet .r3d-plan .pp{font-weight:800;font-size:18px}
.r3d-sheet .r3d-plan .pp small{font-size:12px;font-weight:500;color:var(--muted)}
.r3d-sheet .r3d-plan .pa{color:var(--muted);font-size:12px;text-align:right;min-height:14px}
.r3d-sheet .r3d-plan dl{display:grid;grid-template-columns:1fr auto;gap:4px 10px;margin:8px 0 0;font-size:13px}
.r3d-sheet .r3d-plan dt{color:var(--muted)}
.r3d-sheet .r3d-plan dd{margin:0;font-weight:600;text-align:right}
.r3d-sheet .r3d-note{background:rgba(255,255,255,0.03);border-radius:12px;padding:10px 12px;margin-top:10px;font-size:13px;line-height:1.5}
.r3d-sheet ol{padding-left:18px;margin:0;font-size:14px;line-height:1.55}
.r3d-sheet details{background:rgba(255,255,255,0.03);border-radius:12px;padding:10px 12px;margin-bottom:6px}
.r3d-sheet summary{font-weight:600;font-size:14px}
.r3d-sheet details p{color:var(--muted);font-size:13px;line-height:1.5;margin:8px 0 0}
.r3d-sheet .r3d-legal{color:var(--muted);font-size:11px;line-height:1.5;margin:14px 0 6px}
.r3d-sheet .r3d-actions{display:grid;gap:8px;margin:14px 0 4px}
`;
const style = document.createElement('style');
style.textContent = css;
document.head.appendChild(style);

const lang = () => (typeof currentLang !== 'undefined' && R3D.t[currentLang]) ? currentLang : 'ru';
const esc = s => escapeHtml(String(s == null ? '' : s));
const num = (n, l) => { const s = Number(n).toLocaleString('en-US'); return l === 'en' ? s : s.replace(/,/g, ' '); };
const demoSrc = (d, l) => 'embed.html?key=demo&skin=' + encodeURIComponent(d.skin) + '&float=' + d.float + '&seed=' + d.seed + '&lang=' + l;

function limit(v, t, l){
if (v === null) return t.v_custom;
return v ? num(v, l) : t.v_no;
}

function planHtml(p, t, l){
let price, approx;
if (p.usd === null){ price = esc(t.custom); approx = ''; }
else if (p.usd === 0){ price = esc(t.free); approx = esc(t.trial_note); }
else {
price = '$' + p.usd + ' <small>' + esc(t.per_month) + '</small>';
approx = esc(t.approx.replace('{v}', num(Math.round(p.usd * R3D.rate / 10000) * 10000, l)));
}
const rows = [
[t.f_domains, limit(p.domains, t, l)], [t.f_views, limit(p.views, t, l)],
[t.f_images, limit(p.images, t, l)], [t.f_videos, limit(p.videos, t, l)],
[t.f_ar, p.ar ? t.v_yes : t.v_no], [t.f_badge, t['badge_' + p.badge]],
[t.f_brand, p.brand ? t.v_yes : t.v_no], [t.f_support, t['sup_' + p.support]],
];
return '<div class="r3d-plan' + (p.best ? ' best' : '') + '">' + (p.best ? '<span class="tag">' + esc(t.best) + '</span>' : '')
+ '<div class="ph"><span class="pn">' + esc(t['plan_' + p.key]) + '</span><span class="pp">' + price + '</span></div>'
+ '<div class="pa">' + approx + '</div><dl>'
+ rows.map(r => '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>').join('') + '</dl></div>';
}

function render(){
const l = lang();
const t = R3D.t[l];
const body = document.getElementById('r3dBody');
if (!body) return;
const mail = 'mailto:' + R3D.mail + '?subject=' + encodeURIComponent(t.mail_subject);
body.innerHTML =
'<div class="r3d-badge">' + esc(t.badge) + '</div>'
+ '<p class="r3d-lead">' + esc(t.lead) + '</p>'
+ '<div class="r3d-actions"><button type="button" class="pf-btn pro-buy" data-r3d-apply>' + esc(t.cta) + '</button></div>'
+ '<h3>' + esc(t.demo_h) + '</h3><p class="r3d-lead">' + esc(t.demo_sub) + '</p>'
+ '<div class="r3d-demo"><iframe id="r3dDemo" title="3D" allow="xr-spatial-tracking; fullscreen" allowfullscreen></iframe>'
+ '<div class="r3d-skins">' + R3D.demo.map((d, i) => '<button type="button" data-r3d-demo="' + i + '"' + (i === 0 ? ' class="on"' : '') + '>' + esc(d.skin.replace('★ ', '')) + '</button>').join('') + '</div></div>'
+ '<h3>' + esc(t.what_h) + '</h3><div class="r3d-cards">' + t.what.map(w => '<div class="r3d-c"><b>' + esc(w[0]) + '</b><p>' + esc(w[1]) + '</p></div>').join('') + '</div>'
+ '<h3>' + esc(t.who_h) + '</h3><div class="r3d-who">' + t.who.map(w => '<span>' + esc(w) + '</span>').join('') + '</div>'
+ '<h3>' + esc(t.plans_h) + '</h3><p class="r3d-lead">' + esc(t.plans_sub) + '</p>'
+ '<div class="r3d-plans">' + R3D.plans.map(p => planHtml(p, t, l)).join('') + '</div>'
+ '<div class="r3d-note"><b>' + esc(t.over_h) + '</b><br>' + esc(t.over) + '</div>'
+ '<h3>' + esc(t.how_h) + '</h3><ol>' + t.how.map(h => '<li>' + esc(h) + '</li>').join('') + '</ol>'
+ '<h3>' + esc(t.faq_h) + '</h3>' + t.faq.map(f => '<details><summary>' + esc(f[0]) + '</summary><p>' + esc(f[1]) + '</p></details>').join('')
+ '<div class="r3d-actions"><button type="button" class="pf-btn pro-buy" data-r3d-apply>' + esc(t.cta) + '</button>'
+ '<a class="pf-btn" href="' + esc(mail) + '">' + esc(t.cta_mail) + '</a>'
+ '<button type="button" class="pf-btn" data-r3d-site>' + esc(R3D.open_site[l]) + '</button></div>'
+ '<p class="r3d-legal">' + esc(t.legal) + '</p>';
document.getElementById('r3dTitle').textContent = t.crumb;
document.getElementById('r3dDemo').src = demoSrc(R3D.demo[0], l);
}

function openLink(url){
if (tg && tg.openTelegramLink && /^https:\/\/t\.me\//.test(url)) tg.openTelegramLink(url);
else if (tg && tg.openLink) tg.openLink(url);
else window.open(url, '_blank', 'noopener');
}

const overlay = document.getElementById('r3dOverlay');
if (!overlay) return;
function open(){ render(); overlay.classList.add('show'); }
function close(){
overlay.classList.remove('show');
// Виджет внутри — WebGL: выгружаем, чтобы не грел телефон в фоне.
const f = document.getElementById('r3dDemo');
if (f) f.src = 'about:blank';
}
overlay.addEventListener('click', e => {
if (e.target === overlay) return close();
const demo = e.target.closest('[data-r3d-demo]');
if (demo){
document.getElementById('r3dDemo').src = demoSrc(R3D.demo[+demo.dataset.r3dDemo], lang());
overlay.querySelectorAll('[data-r3d-demo]').forEach(b => b.classList.toggle('on', b === demo));
return;
}
if (e.target.closest('[data-r3d-apply]')) return openLink(R3D.tg);
if (e.target.closest('[data-r3d-site]')) return openLink(R3D.page);
});
document.getElementById('r3dCloseBtn').addEventListener('click', close);
document.getElementById('r3dOpenBtn').addEventListener('click', open);

function renderCard(){
const l = lang();
const b = document.getElementById('r3dOpenBtn');
const s = document.getElementById('r3dCardSub');
if (b) b.textContent = R3D.btn[l];
if (s) s.textContent = R3D.btn_sub[l];
if (overlay.classList.contains('show')) render();
}
renderCard();
// Язык переключили — перерисовываем подписи.
['langBtnRu', 'langBtnUz', 'langBtnEn'].forEach(id => {
const el = document.getElementById(id);
if (el) el.addEventListener('click', () => setTimeout(renderCard, 0));
});
window.openRender3d = open;
})();
