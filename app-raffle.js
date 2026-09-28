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
