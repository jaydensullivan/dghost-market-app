// ============================================================
// АУКЦИОНЫ — МОЖЕТ БЫТЬ НЕСКОЛЬКО ОДНОВРЕМЕННО
// ============================================================

let auctionsData = [];
let auctionsTickTimer = null;
let auctionsBgPollTimer = null;
let currentBidAuction = null;

function formatAuctionCountdown(endTimestamp){
const dict = I18N[currentLang] || I18N.ru;
if (!endTimestamp) return '—';
const remaining = endTimestamp * 1000 - Date.now();
if (remaining <= 0) return dict.auction_ending;
const totalSeconds = Math.floor(remaining / 1000);
const h = Math.floor(totalSeconds / 3600);
const m = Math.floor((totalSeconds % 3600) / 60);
const s = totalSeconds % 60;
const pad = n => String(n).padStart(2, '0');
return (h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`);
}

function auctionCardHtml(a){
const dict = I18N[currentLang] || I18N.ru;
const wearMap = currentLang === 'uz' ? WEAR_LABEL_FULL_UZ : (currentLang === 'en' ? WEAR_LABEL_FULL_EN : WEAR_LABEL_FULL);
const wearLabel = a.wear ? (wearMap[a.wear] || a.wear) : null;
const floatStr = (a.float_value !== null && a.float_value !== undefined) ? Number(a.float_value).toFixed(4) : null;
const photo = a.photo_url ? `<img src="${a.photo_url}" class="auction-card-photo" alt="" onerror="this.style.display='none'">` : '';
const chips = [
wearLabel ? `<span>${escapeHtml(wearLabel)}</span>` : '',
floatStr ? `<span>Float ${floatStr}</span>` : '',
a.pattern ? `<span>Pattern ${escapeHtml(a.pattern)}</span>` : '',
].join('');

let badge = '';
if (a.leading) badge = `<div class="au-badge lead">${dict.au_leading}</div>`;
else if (a.my_bid) badge = `<div class="au-badge outbid">${dict.au_outbid}</div>`;

return `<div class="auction-card" id="auctionCard_${a.auction_id}">
${photo}
<div class="auction-card-title">${escapeHtml(a.title)}</div>
<div class="auction-card-details">${chips}</div>
<div id="auctionBadge_${a.auction_id}">${badge}</div>
<div class="auction-card-price">${dict.auction_current_price} <span class="auction-card-price-value" id="auctionPrice_${a.auction_id}">${formatCoins(a.current_price)}</span>
<span class="au-bids" id="auctionBids_${a.auction_id}">${dict.au_bids.replace('{n}', a.bid_count)}</span></div>
<div class="auction-card-time" id="auctionTime_${a.auction_id}">${formatAuctionCountdown(a.end_time)}</div>
<button type="button" class="auction-card-bid-btn" data-bid-auction="${a.auction_id}">${dict.auction_btn_place_bid}</button>
</div>`;
}

function renderAuctionsList(){
const list = document.getElementById('auctionsList');
const dict = I18N[currentLang] || I18N.ru;
if (!auctionsData.length){
list.innerHTML = `<div class="skins-empty" style="padding:16px 4px;">${dict.auctions_empty}</div>`;
return;
}
list.innerHTML = auctionsData.map(auctionCardHtml).join('');
}

function tickAuctionTimers(){
auctionsData.forEach(a => {
const el = document.getElementById('auctionTime_' + a.auction_id);
if (!el) return;
const text = formatAuctionCountdown(a.end_time);
el.textContent = text;
const remaining = a.end_time ? (a.end_time * 1000 - Date.now()) : null;
el.classList.toggle('ending', remaining !== null && remaining <= 60000);
});
}

// Живое обновление: карточки не перерисовываются целиком, меняются
// только цена, число ставок и метка лидера — с короткой подсветкой,
// когда цена выросла. Полная перерисовка — только если сам набор
// аукционов изменился (новый начался или старый закончился).
function applyAuctionUpdates(prevById){
const dict = I18N[currentLang] || I18N.ru;
const list = document.getElementById('auctionsList');
const sameSet = auctionsData.length === Object.keys(prevById).length
&& auctionsData.every(a => prevById[a.auction_id])
&& auctionsData.every(a => document.getElementById('auctionCard_' + a.auction_id));

if (!sameSet){
renderAuctionsList();
return;
}

auctionsData.forEach(a => {
const prev = prevById[a.auction_id];
const priceEl = document.getElementById('auctionPrice_' + a.auction_id);
if (priceEl && prev.current_price !== a.current_price){
priceEl.textContent = formatCoins(a.current_price);
const card = document.getElementById('auctionCard_' + a.auction_id);
card.classList.remove('au-flash');
void card.offsetWidth; // перезапуск анимации
card.classList.add('au-flash');
}
const bidsEl = document.getElementById('auctionBids_' + a.auction_id);
if (bidsEl) bidsEl.textContent = dict.au_bids.replace('{n}', a.bid_count);
const badgeEl = document.getElementById('auctionBadge_' + a.auction_id);
if (badgeEl && (prev.leading !== a.leading || prev.my_bid !== a.my_bid)){
badgeEl.innerHTML = a.leading
? `<div class="au-badge lead">${dict.au_leading}</div>`
: (a.my_bid ? `<div class="au-badge outbid">${dict.au_outbid}</div>` : '');
}
});
}

// Открытое окно ставки тоже живое: если кто-то поставил, пока ты
// думаешь, — обновляем детали и поднимаем сумму до нового минимума.
function refreshOpenBidOverlay(prevById){
if (!currentBidAuction) return;
if (!document.getElementById('auctionBidOverlay').classList.contains('show')) return;
const fresh = auctionsData.find(x => x.auction_id === currentBidAuction.auction_id);
if (!fresh) return;
const prev = prevById[fresh.auction_id];
currentBidAuction = fresh;
fillAuctionBidDetails(fresh);
if (prev && prev.current_price !== fresh.current_price){
const input = document.getElementById('auctionBidInput');
input.min = fresh.minimum_bid;
if (Number(input.value) < fresh.minimum_bid) input.value = fresh.minimum_bid;
renderQuickBids(fresh);
document.getElementById('auctionBidStatus').textContent =
(I18N[currentLang] || I18N.ru).au_price_changed.replace('{min}', formatCoins(fresh.minimum_bid));
haptic('warning');
}
}

// Перебили, пока мини-апп открыт — тост и вибрация сразу, не дожидаясь бота.
function detectOutbid(prevById){
const dict = I18N[currentLang] || I18N.ru;
auctionsData.forEach(a => {
const prev = prevById[a.auction_id];
if (prev && prev.leading && !a.leading){
showToast(dict.au_outbid_toast.replace('{title}', a.title).replace('{price}', formatCoins(a.current_price)), {
type: 'error',
actionLabel: dict.auction_btn_place_bid,
onAction: () => { goToScreen('auctions'); openAuctionBid(a.auction_id); },
});
haptic('warning');
}
});
}

function loadAuctionsList(){
const q = (tg && tg.initData) ? '?init_data=' + encodeURIComponent(tg.initData) : '';
return fetch(API_BASE + '/api/auctions/list' + q)
.then(r => r.json())
.then(data => {
const prevById = {};
auctionsData.forEach(a => { prevById[a.auction_id] = a; });
const hadData = auctionsData.length > 0;
auctionsData = data.items || [];
document.getElementById('tabAuctionsBtn').style.display = auctionsData.length ? '' : 'none';
document.getElementById('headerMenuAuctions').style.display = auctionsData.length ? '' : 'none';
if (currentTab === 'auctions'){
if (hadData) applyAuctionUpdates(prevById);
else renderAuctionsList();
}
if (hadData){
refreshOpenBidOverlay(prevById);
detectOutbid(prevById);
}
if (deepLinkAuctionId){
const target = auctionsData.find(a => a.auction_id === deepLinkAuctionId);
if (target){
goToScreen('auctions');
renderAuctionsList();
openAuctionBid(target.auction_id);
}
deepLinkAuctionId = null;
}
})
.catch(() => {});
}

// Частота опроса: 3 секунды, пока открыт экран аукционов или окно
// ставки, иначе раз в 15 секунд (только чтобы вовремя показать
// кнопку «Аукцион» и поймать перебитую ставку).
function auctionsPollDelay(){
const bidOpen = document.getElementById('auctionBidOverlay').classList.contains('show');
return (currentTab === 'auctions' || bidOpen) && !document.hidden ? 3000 : 15000;
}

// Проверка каждые 3 секунды, нужен ли запрос: так переход на экран
// аукционов сразу ускоряет обновление, без ожидания длинной паузы.
let lastAuctionsFetchAt = 0;

function scheduleAuctionsPoll(){
clearInterval(auctionsBgPollTimer);
auctionsBgPollTimer = setInterval(() => {
if (Date.now() - lastAuctionsFetchAt < auctionsPollDelay() - 200) return;
lastAuctionsFetchAt = Date.now();
loadAuctionsList();
}, 3000);
}

function renderQuickBids(a){
const dict = I18N[currentLang] || I18N.ru;
const box = document.getElementById('auctionQuickBids');
box.innerHTML = [1, 2, 5].map(n => {
const value = a.current_price + a.step * n;
return `<button type="button" class="au-quick-btn" data-quick-bid="${value}">
<span>+${Number(a.step * n).toLocaleString('ru-RU')}</span><b>${formatCoins(value)}</b></button>`;
}).join('');
}

document.getElementById('auctionQuickBids').addEventListener('click', (e) => {
const b = e.target.closest('[data-quick-bid]');
if (!b) return;
document.getElementById('auctionBidInput').value = b.dataset.quickBid;
document.getElementById('auctionBidStatus').textContent = '';
haptic('select');
});

function fillAuctionBidDetails(a){
const dict = I18N[currentLang] || I18N.ru;
const wearMap = currentLang === 'uz' ? WEAR_LABEL_FULL_UZ : (currentLang === 'en' ? WEAR_LABEL_FULL_EN : WEAR_LABEL_FULL);
document.getElementById('auctionBidDetails').innerHTML = [
buyDetailRow(dict.detail_wear, a.wear ? (wearMap[a.wear] || a.wear) : null),
buyDetailRow('Float', (a.float_value !== null && a.float_value !== undefined) ? Number(a.float_value).toFixed(4) : null),
buyDetailRow('Pattern', a.pattern || null),
buyDetailRow(dict.auction_current_price_label, formatCoins(a.current_price)),
buyDetailRow(dict.auction_min_bid, formatCoins(a.minimum_bid)),
buyDetailRow(dict.auction_bid_count, String(a.bid_count)),
].join('');
}

function openAuctionBid(auctionId){
const a = auctionsData.find(x => x.auction_id === auctionId);
if (!a) return;
if (!tg || !tg.initData){
showAlert(errorMessage('unauthorized'));
return;
}

currentBidAuction = a;

const dict = I18N[currentLang] || I18N.ru;

document.getElementById('auctionBidTitle').textContent = a.title;

const photo = document.getElementById('auctionBidPhoto');
if (a.photo_url){
photo.src = a.photo_url;
photo.style.display = '';
} else {
photo.style.display = 'none';
}

fillAuctionBidDetails(a);
renderQuickBids(a);

document.getElementById('auctionBidInput').value = a.minimum_bid;
document.getElementById('auctionBidInput').min = a.minimum_bid;
document.getElementById('auctionBidStatus').textContent = '';
document.getElementById('auctionBidOverlay').classList.add('show');
}

document.getElementById('auctionsList').addEventListener('click', (e) => {
const btn = e.target.closest('[data-bid-auction]');
if (!btn) return;
openAuctionBid(Number(btn.dataset.bidAuction));
});

document.getElementById('auctionBidCancel').addEventListener('click', () => {
document.getElementById('auctionBidOverlay').classList.remove('show');
});

document.getElementById('auctionBidSubmit').addEventListener('click', () => {
if (!currentBidAuction || !tg || !tg.initData) return;

const btn = document.getElementById('auctionBidSubmit');
const status = document.getElementById('auctionBidStatus');
const amount = Number(document.getElementById('auctionBidInput').value);

if (!amount || amount < currentBidAuction.minimum_bid){
status.textContent = errorMessage('too_low');
return;
}

btn.disabled = true;
status.textContent = '...';

fetch(API_BASE + '/api/auctions/' + currentBidAuction.auction_id + '/bid', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData, amount: amount })
})
.then(async r => {
if (!r.ok){
const data = await r.json().catch(() => ({}));
throw new Error(errorMessage(data.error));
}
return r.json();
})
.then(() => {
status.textContent = (I18N[currentLang] || I18N.ru).auction_bid_accepted;
haptic('success');
loadAuctionsList();
setTimeout(() => {
document.getElementById('auctionBidOverlay').classList.remove('show');
}, 900);
})
.catch(err => { status.textContent = friendlyErrorMessage(err); })
.finally(() => { btn.disabled = false; });
});

// Живой посекундный таймер — просто обновляет текст на экране,
// не дёргает сервер. Список (цены/новые ставки других игроков)
// подтягиваем отдельно, реже.
auctionsTickTimer = setInterval(tickAuctionTimers, 1000);

// Проверяем наличие активных аукционов в фоне — независимо от
// того, какая вкладка сейчас открыта (иначе кнопка "Аукцион"
// внизу не появится вовремя).
lastAuctionsFetchAt = Date.now();
loadAuctionsList();
scheduleAuctionsPoll();
// Вернулись в мини-апп или открыли экран аукционов — обновляем сразу.
document.addEventListener('visibilitychange', () => { if (!document.hidden) loadAuctionsList(); });

// Магазин теперь главный экран — сразу подтягиваем баланс и каталог
loadMe();
loadSkins();
