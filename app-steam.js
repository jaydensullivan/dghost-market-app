// ============================================================
// STEAM — ТРЕЙД-ССЫЛКА И ИНВЕНТАРЬ
// ============================================================

const openInventoryBtn = document.getElementById('openInventoryBtn');
const inventoryRefreshBtn = document.getElementById('inventoryRefreshBtn');

const inventoryOverlay = document.getElementById('inventoryOverlay');
const inventoryGrid = document.getElementById('inventoryGrid');
const inventoryStatus = document.getElementById('inventoryStatus');
const inventoryCancel = document.getElementById('inventoryCancel');

const pTradeLink = document.getElementById('pTradeLink');
const profileLinkBtn = document.getElementById('profileLinkBtn');
const openSteamTradeUrlBtn = document.getElementById('openSteamTradeUrlBtn');
const profileRelinkBtn = document.getElementById('profileRelinkBtn');
const profileSteamStatus = document.getElementById('profileSteamStatus');
const profileSteamLinked = document.getElementById('profileSteamLinked');
const profileSteamUnlinked = document.getElementById('profileSteamUnlinked');

const STEAM_ERROR_MESSAGES = {
bad_trade_link: 'Не похоже на трейд-ссылку — проверь, что скопировал целиком.',
not_linked: 'Сначала привяжи трейд-ссылку.',
inventory_private: 'Инвентарь закрыт. В настройках приватности Steam выставь инвентарь на "Открытый".',
inventory_private_or_empty: 'Инвентарь закрыт или пуст (или в нём нет предметов CS2).',
steam_unavailable: 'Сервис инвентаря сейчас не отвечает, попробуй чуть позже.',
rate_limited: 'Слишком много запросов, подожди немного и попробуй снова.',
not_configured: 'Инвентарь Steam ещё не настроен на сервере — сообщи админу.',
};

function steamErrorMessage(code){
return STEAM_ERROR_MESSAGES[code] || errorMessage(code);
}

function updateProfileSteamBlock(){
profileSteamLinked.style.display = hasSteamLink ? 'block' : 'none';
profileSteamUnlinked.style.display = hasSteamLink ? 'none' : 'block';
}

function submitTradeLink(opts){
opts = opts || {};
const dict = I18N[currentLang] || I18N.ru;
const inputEl = opts.inputEl || pTradeLink;
const statusEl = opts.statusEl || profileSteamStatus;
const btnEl = opts.btnEl || profileLinkBtn;
const onSuccess = opts.onSuccess;
if (!tg || !tg.initData){
statusEl.textContent = errorMessage('unauthorized');
return;
}
const link = inputEl.value.trim();
if (!link){
statusEl.textContent = dict.steam_link_need_link;
return;
}
btnEl.disabled = true;
statusEl.textContent = dict.steam_link_linking;
fetch(API_BASE + '/api/steam/link', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData, trade_link: link })
})
.then(async r => {
if (!r.ok){
const data = await r.json().catch(() => ({}));
throw new Error(steamErrorMessage(data.error));
}
return r.json();
})
.then(() => {
hasSteamLink = true;
statusEl.textContent = dict.steam_link_linked_ok;
inputEl.value = '';
setTimeout(() => {
updateProfileSteamBlock();
updateSteamBlockVisibility();
updateMandatorySteamOverlay();
statusEl.textContent = '';
if (onSuccess) onSuccess();
}, 500);
})
.catch(err => {
statusEl.textContent = friendlyErrorMessage(err);
})
.finally(() => {
btnEl.disabled = false;
});
}

profileLinkBtn.addEventListener('click', () => submitTradeLink());

document.getElementById('mandatoryLinkBtn').addEventListener('click', () => {
submitTradeLink({
inputEl: document.getElementById('mandatoryTradeLink'),
statusEl: document.getElementById('mandatorySteamStatus'),
btnEl: document.getElementById('mandatoryLinkBtn'),
});
});

openSteamTradeUrlBtn.addEventListener('click', () => {
const url = 'https://steamcommunity.com/my/tradeoffers/privacy';
if (tg && tg.openLink) {
tg.openLink(url);
} else {
window.open(url, '_blank');
}
});

document.getElementById('mandatoryAcceptAgreementBtn').addEventListener('click', () => {
if (!tg || !tg.initData) return;
const dict = I18N[currentLang] || I18N.ru;
const btn = document.getElementById('mandatoryAcceptAgreementBtn');
const status = document.getElementById('mandatoryAgreementStatus');
btn.disabled = true;
status.textContent = dict.agreement_saving;
fetch(API_BASE + '/api/agreement/accept', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData })
})
.then(async r => {
if (!r.ok){
const data = await r.json().catch(() => ({}));
throw new Error(errorMessage(data.error));
}
return r.json();
})
.then(() => {
agreementAccepted = true;
status.textContent = '';
updateMandatorySteamOverlay();
})
.catch(err => {
status.textContent = friendlyErrorMessage(err);
})
.finally(() => {
btn.disabled = false;
});
});

document.getElementById('mandatoryOpenSteamBtn').addEventListener('click', () => {
const url = 'https://steamcommunity.com/my/tradeoffers/privacy';
if (tg && tg.openLink) {
tg.openLink(url);
} else {
window.open(url, '_blank');
}
});

document.getElementById('mandatorySteamLaterBtn').addEventListener('click', () => {
steamLinkSkippedThisSession = true;
updateMandatorySteamOverlay();
});

profileRelinkBtn.addEventListener('click', () => {
profileSteamLinked.style.display = 'none';
profileSteamUnlinked.style.display = 'block';
});

