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
trade_link_not_yours: 'Эта ссылка на обмен ведёт на другой аккаунт Steam. Привяжи ссылку того аккаунта, с которым вошёл через Steam.',
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
document.getElementById('profileRelinkBtn').style.display = hasSteamLink ? '' : 'none';
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
// Устройство — вместе с принятием правил: по нему бот проверяет,
// не второй ли это аккаунт пригласившего (антифрод раздачи).
dgDevicePromise.catch(() => ({})).then(dev => fetch(API_BASE + '/api/agreement/accept', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(Object.assign({ init_data: tg.initData }, dev))
}))
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



// ============================================================
// ВХОД ЧЕРЕЗ STEAM
//
// Сервер выдаёт одноразовую ссылку; она открывается в браузере и
// ведёт на официальный вход Steam. Пароль вводится только у Steam,
// мы получаем лишь подтверждённый SteamID. Пока человек в браузере,
// мини-апп опрашивает статус и обновляется сам.
// ============================================================

let steamLoginPoll = null;

function applySteamVerification(data){
steamVerified = !!data.steam_verified;
steamPersona = data.steam_persona || null;
steamAvatar = data.steam_avatar || null;
if (typeof data.steam_login_required === 'boolean') steamLoginRequired = data.steam_login_required;
updateSteamVerifyBlock();
}

function updateSteamVerifyBlock(){
const ok = document.getElementById('steamVerified');
if (!ok) return;
ok.style.display = steamVerified ? 'flex' : 'none';
document.getElementById('steamNotVerified').style.display = steamVerified ? 'none' : '';
document.getElementById('steamVerifiedName').textContent = steamPersona || 'Steam';
const img = document.getElementById('steamVerifiedAvatar');
if (steamAvatar){ img.src = steamAvatar; img.hidden = false; } else { img.hidden = true; }
}

function pollSteamStatus(){
clearInterval(steamLoginPoll);
let tries = 0;
steamLoginPoll = setInterval(() => {
if (++tries > 100){ clearInterval(steamLoginPoll); return; }
fetch(API_BASE + '/api/steam/status?init_data=' + encodeURIComponent(tg.initData))
.then(r => r.ok ? r.json() : null)
.then(data => {
if (!data || !data.steam_verified) return;
clearInterval(steamLoginPoll);
const dict = I18N[currentLang] || I18N.ru;
applySteamVerification(data);
hasSteamLink = !!data.has_steam_link;
updateProfileSteamBlock();
document.getElementById('steamLoginStatus').textContent = data.has_steam_link ? '' : dict.steam_login_relink;
showToast(dict.steam_login_ok, { type: 'success' });
})
.catch(() => {});
}, 3000);
}

function startSteamLogin(){
const dict = I18N[currentLang] || I18N.ru;
const status = document.getElementById('steamLoginStatus');
if (!tg || !tg.initData){ status.textContent = errorMessage('unauthorized'); return; }
status.textContent = dict.steam_login_opening;
fetch(API_BASE + '/api/steam/login_start', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData })
})
.then(r => { if (!r.ok) throw new Error(); return r.json(); })
.then(data => {
status.textContent = dict.steam_login_waiting;
if (tg.openLink) tg.openLink(data.url); else window.open(data.url, '_blank');
pollSteamStatus();
})
.catch(() => { status.textContent = dict.load_failed; });
}

document.getElementById('steamLoginBtn').addEventListener('click', startSteamLogin);


// ============================================================
// ПОДТВЕРЖДЕНИЕ ПОКУПАТЕЛЯ ДЛЯ КРУПНЫХ ПОКУПОК
//
// Сервер требует вход через Steam и номер телефона, когда покупки
// за сутки превышают порог. Окно показывает, чего не хватает, и
// само обновляется, пока человек подтверждает.
// ============================================================

let bvPoll = null;

function refreshBuyerVerify(){
Promise.all([
fetch(API_BASE + '/api/steam/status?init_data=' + encodeURIComponent(tg.initData)).then(r => r.ok ? r.json() : {}).catch(() => ({})),
fetch(API_BASE + '/api/kyc/phone?init_data=' + encodeURIComponent(tg.initData)).then(r => r.ok ? r.json() : {}).catch(() => ({})),
]).then(([steam, phone]) => {
const dict = I18N[currentLang] || I18N.ru;
if (steam.steam_verified) applySteamVerification(steam);
const steamOk = !!steam.steam_verified, phoneOk = !!phone.phone;
document.getElementById('bvSteamMark').textContent = steamOk ? '✅' : '❌';
document.getElementById('bvPhoneMark').textContent = phoneOk ? '✅' : '❌';
document.getElementById('bvSteamBtn').style.display = steamOk ? 'none' : '';
document.getElementById('bvPhoneBtn').style.display = phoneOk ? 'none' : '';
if (steamOk && phoneOk){
document.getElementById('bvStatus').textContent = dict.bv_done;
clearInterval(bvPoll);
}
});
}

function openBuyerVerify(data){
const dict = I18N[currentLang] || I18N.ru;
document.getElementById('bvHint').textContent = dict.bv_hint.replace('{sum}', formatCoins((data && data.threshold) || 0));
document.getElementById('bvStatus').textContent = '';
document.getElementById('buyerVerifyOverlay').classList.add('show');
refreshBuyerVerify();
clearInterval(bvPoll);
let tries = 0;
bvPoll = setInterval(() => {
if (++tries > 100 || !document.getElementById('buyerVerifyOverlay').classList.contains('show')){ clearInterval(bvPoll); return; }
refreshBuyerVerify();
}, 3000);
}

document.getElementById('bvSteamBtn').addEventListener('click', startSteamLogin);

document.getElementById('bvPhoneBtn').addEventListener('click', () => {
const dict = I18N[currentLang] || I18N.ru;
if (!tg || !tg.requestContact){ showAlert(dict.kyc_phone_unsupported); return; }
tg.requestContact(() => {
document.getElementById('bvStatus').textContent = dict.kyc_phone_checking;
});
});

document.getElementById('bvCloseBtn').addEventListener('click', () => {
clearInterval(bvPoll);
document.getElementById('buyerVerifyOverlay').classList.remove('show');
});
