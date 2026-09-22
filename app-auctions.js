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

return `<div class="auction-card">
${photo}
<div class="auction-card-title">${escapeHtml(a.title)}</div>
<div class="auction-card-details">${chips}</div>
<div class="auction-card-price">${dict.auction_current_price} <span class="auction-card-price-value">${formatCoins(a.current_price)}</span></div>
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

function loadAuctionsList(){
fetch(API_BASE + '/api/auctions/list')
.then(r => r.json())
.then(data => {
auctionsData = data.items || [];
document.getElementById('tabAuctionsBtn').style.display = auctionsData.length ? '' : 'none';
document.getElementById('headerMenuAuctions').style.display = auctionsData.length ? '' : 'none';
if (currentTab === 'auctions'){
renderAuctionsList();
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

const wearMap = currentLang === 'uz' ? WEAR_LABEL_FULL_UZ : (currentLang === 'en' ? WEAR_LABEL_FULL_EN : WEAR_LABEL_FULL);

document.getElementById('auctionBidDetails').innerHTML = [
buyDetailRow(dict.detail_wear, a.wear ? (wearMap[a.wear] || a.wear) : null),
buyDetailRow('Float', (a.float_value !== null && a.float_value !== undefined) ? Number(a.float_value).toFixed(4) : null),
buyDetailRow('Pattern', a.pattern || null),
buyDetailRow(dict.auction_current_price_label, formatCoins(a.current_price)),
buyDetailRow(dict.auction_min_bid, formatCoins(a.minimum_bid)),
buyDetailRow(dict.auction_bid_count, String(a.bid_count)),
].join('');

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
loadAuctionsList();
auctionsBgPollTimer = setInterval(loadAuctionsList, 10000);

// Магазин теперь главный экран — сразу подтягиваем баланс и каталог
loadMe();
loadSkins();
