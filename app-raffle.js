// ============================================================
// РОЗЫГРЫШ
//
// Страница «🎁 Розыгрыш»: приз (GIF с 3D-рендером или фото + кнопка
// 3D), таймер, участники, прогресс «пригласи 2 друзей», номер
// участника и билеты. Когда время выходит, бот сам выбирает
// победителя — здесь показываем итог, проверку честности и ведём в
// маркетплейс. Ниже — прошлые розыгрыши.
// ============================================================

// Карточка приза из инвентаря (общая с админкой). withClear — кнопка
// «убрать» для админки, иначе «3D», если для скина есть модель.
function prizeSkinHtml(ps, withClear){
const dict = I18N[currentLang] || I18N.ru;
const meta = [
ps.stattrak ? 'ST™' : '',
ps.wear || '',
(ps.float_value !== null && ps.float_value !== undefined) ? 'float ' + Number(ps.float_value).toFixed(4) : '',
].filter(Boolean).join(' · ');
return (ps.photo_url ? `<img src="${escapeHtml(ps.photo_url)}" alt="">` : '')
+ `<div class="gps-body"><div class="gps-title">${escapeHtml(ps.title)}</div>`
+ (meta ? `<div class="gps-meta">${escapeHtml(meta)}</div>` : '') + '</div>'
+ (withClear
? `<button type="button" data-gps-clear>✕</button>`
: `<button type="button" data-gps-3d style="display:none;">${dict.btn_3d}</button>`);
}

// Запись для 3D-просмотрщика, если скин есть в models/index.json.
// app-3d.js грузится позже этого файла — ждём загрузки страницы.
function rafflePrizeModel(title){
if (typeof loadModelIndex !== 'function'){
return new Promise(resolve => {
if (document.readyState === 'complete') return resolve(null);
window.addEventListener('load', () => resolve(rafflePrizeModel(title)), { once: true });
});
}
return loadModelIndex().then(map => map[modelIndexKey(title)] || null).catch(() => null);
}

let raffleData = null;
let raffleTimer = null;
let raffleInviteLink = '';

function rfDict(){ return I18N[currentLang] || I18N.ru; }

function formatRaffleLeft(ms){
const dict = rfDict();
const total = Math.max(0, Math.floor(ms / 1000));
const d = Math.floor(total / 86400);
const h = Math.floor((total % 86400) / 3600);
const m = Math.floor((total % 3600) / 60);
const s = total % 60;
const pad = n => String(n).padStart(2, '0');
if (d > 0) return dict.rf_left_days.replace('{d}', d).replace('{h}', h);
return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function raffleDate(iso){
if (!iso) return '';
const locale = currentLang === 'uz' ? 'uz-UZ' : (currentLang === 'en' ? 'en-US' : 'ru-RU');
return new Date(iso).toLocaleString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

// Коротко для плашки: «28.09 12:13».
function raffleShortDate(iso){
if (!iso) return '—';
const d = new Date(iso);
const pad = n => String(n).padStart(2, '0');
return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function tickRaffle(){
const c = raffleData && raffleData.current;
const el = document.getElementById('rfCountdown');
if (!c || c.status !== 'active'){ clearInterval(raffleTimer); raffleTimer = null; return; }
const left = new Date(c.ends_at).getTime() - Date.now();
el.textContent = formatRaffleLeft(left);
// Время вышло — бот подводит итоги в течение нескольких секунд.
if (left <= 0){
clearInterval(raffleTimer);
raffleTimer = null;
el.textContent = rfDict().rf_drawing;
setTimeout(loadRaffle, 8000);
}
}

function renderRaffleHero(c){
const hero = document.getElementById('rfHero');
const ps = c.prize_skin || {};
const img = c.gif_url || ps.photo_url;
hero.innerHTML = (img ? `<img src="${escapeHtml(img)}" alt="">` : `<div class="raffle-hero-empty">🎁</div>`)
+ `<button type="button" class="raffle-3d-btn" id="rf3dBtn" style="display:none;">${rfDict().rf_open_3d}</button>`;
const meta = [
ps.stattrak ? 'StatTrak™' : '',
ps.wear || '',
(ps.float_value !== null && ps.float_value !== undefined) ? 'float ' + Number(ps.float_value).toFixed(4) : '',
].filter(Boolean).join(' · ');
const metaEl = document.getElementById('rfMeta');
metaEl.textContent = meta;
metaEl.style.display = meta ? '' : 'none';
rafflePrizeModel(ps.title || c.title).then(entry => {
const btn = document.getElementById('rf3dBtn');
if (!entry || !btn) return;
btn.style.display = '';
btn.onclick = () => open3DViewer(entry.model, ps.title || c.title, entry.skin, Number(ps.float_value) || 0, entry.weapon || null, 'none');
});
}

function renderRaffleJoin(c, me){
const dict = rfDict();
const need = raffleData.invites_required;
const perTicket = raffleData.invites_per_ticket;
const have = me ? me.invites : 0;
document.getElementById('rfCondition').textContent = dict.rf_condition.replace('{n}', need);
document.getElementById('rfInvCount').textContent = have >= need ? `${have} ✅` : `${have}/${need}`;
document.getElementById('rfInvBar').style.width = Math.min(100, Math.round(have / need * 100)) + '%';
document.getElementById('rfJoin').classList.toggle('done', !!(me && me.entered));
const status = document.getElementById('rfStatus');
if (me && me.entered){
status.innerHTML = `<div class="raffle-in">${dict.rf_you_in}</div>`
+ `<div class="raffle-ticket">🎟️ ${dict.rf_entry_number} <b>#${me.entry_number}</b> · ${dict.rf_tickets.replace('{n}', me.tickets)}</div>`
+ `<div class="raffle-hint">${dict.rf_more_tickets.replace('{n}', perTicket)}</div>`;
} else {
status.innerHTML = `<div class="raffle-hint">${dict.rf_need_more.replace('{n}', Math.max(0, need - have))}</div>`;
}
const pending = document.getElementById('rfPending');
pending.textContent = me && me.invites_pending ? dict.rf_pending.replace('{n}', me.invites_pending) : '';
pending.style.display = pending.textContent ? '' : 'none';
document.getElementById('rfRules').innerHTML = dict.rf_rules_html
.replace(/\{n\}/g, need).replace(/\{t\}/g, perTicket);
}

function renderRaffleResult(c, me){
const dict = rfDict();
const box = document.getElementById('rfResult');
const won = me && me.is_winner;
box.innerHTML = `<div class="raffle-result-title">${dict.rf_finished}</div>`
+ (c.winner
? `<div class="raffle-result-row">🏆 ${dict.rf_winner}: <b>${escapeHtml(c.winner)}</b>${won ? ` <span class="gw-you">${dict.gw_you}</span>` : ''}</div>`
: `<div class="raffle-result-row">${dict.rf_no_winner}</div>`)
+ `<div class="raffle-result-row">🎁 ${dict.rf_prize}: <b>${escapeHtml(c.title)}</b></div>`
+ (won ? `<div class="raffle-hint">${c.delivered ? dict.rf_delivered : dict.rf_you_won}</div>` : '')
+ (!won ? `<div class="raffle-lost">${dict.rf_not_won}</div>`
+ `<button type="button" class="cta raffle-cta" id="rfMarketBtn">${dict.rf_open_market}</button>` : '');
const btn = document.getElementById('rfMarketBtn');
if (btn) btn.onclick = () => openMarketFor(c.title);
}

function renderRaffleProof(c){
const dict = rfDict();
const body = document.getElementById('rfProofBody');
const rows = [
[dict.rf_proof_id, c.id],
[dict.rf_proof_hash, `<code>${escapeHtml(c.seed_hash)}</code>`],
];
if (c.status === 'finished'){
rows.push(
[dict.rf_proof_seed, `<code>${escapeHtml(c.seed)}</code>`],
[dict.rf_proof_time, escapeHtml(raffleDate(c.drawn_at))],
[dict.rf_proof_tickets, c.tickets],
[dict.rf_proof_ticket, c.winner_ticket || '—'],
);
}
body.innerHTML = rows.map(([k, v]) => `<div class="raffle-proof-row"><span>${k}</span><b>${v}</b></div>`).join('')
+ `<div class="raffle-hint">${c.status === 'finished' ? dict.rf_proof_how_done : dict.rf_proof_how_active}</div>`
+ (c.status === 'finished' ? `<button type="button" class="steam-link-btn secondary" id="rfProofListBtn">${dict.rf_proof_list}</button><div id="rfProofList"></div>` : '');
const listBtn = document.getElementById('rfProofListBtn');
if (listBtn) listBtn.onclick = () => loadRaffleProofList(c.id);
}

function loadRaffleProofList(id){
const box = document.getElementById('rfProofList');
box.textContent = rfDict().loading;
fetch(API_BASE + '/api/giveaway/proof?id=' + id)
.then(r => r.json())
.then(data => {
let from = 1;
box.innerHTML = (data.snapshot || []).map(s => {
const to = from + s.tickets - 1;
const range = s.tickets > 1 ? `${from}–${to}` : `${from}`;
const win = data.winner_ticket >= from && data.winner_ticket <= to;
from = to + 1;
return `<div class="raffle-proof-row${win ? ' win' : ''}"><span>#${s.entry} ${escapeHtml(s.username || '')}</span><b>🎟 ${range}</b></div>`;
}).join('') || rfDict().rf_no_winner;
})
.catch(() => { box.textContent = rfDict().load_failed; });
}

function renderRaffleHistory(items){
const dict = rfDict();
const box = document.getElementById('rfHistory');
if (!items || !items.length){ box.style.display = 'none'; return; }
box.innerHTML = `<div class="gw-block-title">${dict.rf_history}</div>` + items.map(h => `
<div class="gw-winner${h.is_me ? ' me' : ''}">
<div class="gw-winner-icon">${h.prize_skin && h.prize_skin.photo_url ? `<img src="${escapeHtml(h.prize_skin.photo_url)}" alt="">` : '🎁'}</div>
<div class="gw-winner-info">
<div class="gw-winner-name">${escapeHtml(h.title)}</div>
<div class="gw-winner-sub">${dict.rf_finished_short}${h.winner ? ' · 🏆 ' + escapeHtml(h.winner) : ''}${h.is_me ? ` <span class="gw-you">${dict.gw_you}</span>` : ''} · ${escapeHtml(raffleDate(h.drawn_at))}</div>
</div>
</div>`).join('');
box.style.display = '';
}

function renderRaffle(){
const dict = rfDict();
const data = raffleData || {};
const c = data.current;
const me = data.me;
document.getElementById('rfEmpty').style.display = c ? 'none' : '';
document.getElementById('rfCurrent').style.display = c ? '' : 'none';
renderRaffleHistory(data.history);
renderRaffleBanner();
if (!c){
document.getElementById('rfEyebrow').textContent = '';
document.getElementById('rfTitle').textContent = dict.rf_page_title;
return;
}
const active = c.status === 'active';
document.getElementById('rfEyebrow').textContent = active ? dict.rf_now : dict.rf_finished_eyebrow;
document.getElementById('rfTitle').textContent = c.title;
renderRaffleHero(c);
document.getElementById('rfValue').textContent = c.prize_value ? formatCoins(c.prize_value) : '—';
document.getElementById('rfParticipants').textContent = c.participants;
document.getElementById('rfJoin').style.display = active ? '' : 'none';
document.getElementById('rfResult').style.display = active ? 'none' : '';
document.getElementById('rfTimeLabel').textContent = active ? dict.rf_left : dict.rf_drawn_at;
if (active){
renderRaffleJoin(c, me);
if (!raffleTimer){ raffleTimer = setInterval(tickRaffle, 1000); }
tickRaffle();
prefetchRaffleLink();
} else {
document.getElementById('rfCountdown').textContent = raffleShortDate(c.drawn_at);
renderRaffleResult(c, me);
}
renderRaffleProof(c);
}

// Розыгрыш есть в промо-баннере на главной — обновляем его.
function renderRaffleBanner(){
if (typeof renderPromo === 'function') renderPromo();
}

function loadRaffle(){
const q = (tg && tg.initData) ? '?init_data=' + encodeURIComponent(tg.initData) : '';
return fetch(API_BASE + '/api/giveaway' + q)
.then(r => r.json())
.then(data => { raffleData = data; renderRaffle(); })
.catch(() => {});
}

// Маркетплейс с похожими скинами: то же оружие, что разыгрывалось.
function openMarketFor(title){
const weapon = String(title || '').replace(/^StatTrak™\s*/, '').split('|')[0].trim();
currentCategory = 'all';
goToScreen('shop');
if (typeof skinSearch !== 'undefined'){
skinSearch.value = weapon;
if (typeof applyFiltersAndRender === 'function') applyFiltersAndRender();
}
}

// ---------- приглашения ----------

// Ссылку грузим заранее: тогда «Копировать» работает сразу.
function prefetchRaffleLink(){
if (raffleInviteLink || !tg || !tg.initData) return;
fetch(API_BASE + '/api/referral_info?init_data=' + encodeURIComponent(tg.initData))
.then(r => r.json())
.then(data => {
if (!data.link) return;
raffleInviteLink = data.link;
document.getElementById('rfLinkText').textContent = data.link.replace(/^https:\/\//, '');
document.getElementById('rfLinkRow').style.display = '';
})
.catch(() => {});
}

// Выбор чата, куда бот сам вставляет карточку розыгрыша (GIF с 3D и
// кнопкой «Участвовать в DGhost»). Проверено на Android и iOS; нужен
// включённый Inline Mode у бота. Без него — окно «Поделиться ссылкой».
function inviteToRaffle(){
if (!tg || !tg.initData){
showAlert(errorMessage('unauthorized'));
return;
}
haptic('light');
if (typeof tg.switchInlineQuery === 'function' && (!tg.isVersionAtLeast || tg.isVersionAtLeast('6.7'))){
try {
tg.switchInlineQuery('invite', ['users', 'groups', 'channels']);
return;
} catch (e) {}
}
if (raffleInviteLink){
const c = raffleData && raffleData.current;
const text = rfDict().rf_share_text.replace('{title}', c ? c.title : '');
tg.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(raffleInviteLink) + '&text=' + encodeURIComponent(text));
return;
}
sendRaffleInviteToDm();
}

async function sendRaffleInviteToDm(){
const dict = rfDict();
if (!tg || !tg.initData) return;
const btn = document.getElementById('rfDmBtn');
if (btn.disabled) return;
btn.disabled = true;
try {
const r = await fetch(API_BASE + '/api/giveaway/invite_send', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData }),
});
const data = await r.json().catch(() => ({}));
if (r.ok) showToast(dict.gw_invite_dm_sent);
else if (data.error === 'too_often') showToast(dict.gw_invite_dm_wait);
else if (data.error === 'dm_failed') showErrorToast(new Error(dict.gw_invite_dm_need_start));
else showErrorToast(new Error(errorMessage(data.error)));
} catch (e) {
showErrorToast(e);
} finally {
btn.disabled = false;
}
}

function copyRaffleLink(){
if (!raffleInviteLink) return;
const done = () => showToast(rfDict().gw_invite_copied);
if (navigator.clipboard && navigator.clipboard.writeText){
navigator.clipboard.writeText(raffleInviteLink).then(done).catch(fallback);
} else {
fallback();
}
function fallback(){
const ta = document.createElement('textarea');
ta.value = raffleInviteLink;
document.body.appendChild(ta);
ta.select();
try { document.execCommand('copy'); done(); } catch (e) {}
ta.remove();
}
}

document.getElementById('rfInviteBtn').addEventListener('click', inviteToRaffle);
document.getElementById('rfDmBtn').addEventListener('click', sendRaffleInviteToDm);
document.getElementById('rfCopyBtn').addEventListener('click', copyRaffleLink);
document.getElementById('rfBackBtn').addEventListener('click', () => goToScreen('welcome'));

// Вернулся из чата после приглашения — обновляем прогресс.
document.addEventListener('visibilitychange', () => {
if (!document.hidden && typeof currentTab !== 'undefined' && currentTab === 'timer') loadRaffle();
});

// Счётчик участников живой, пока человек смотрит на страницу.
setInterval(() => {
if (!document.hidden && typeof currentTab !== 'undefined' && currentTab === 'timer') loadRaffle();
}, 30000);

loadRaffle();
