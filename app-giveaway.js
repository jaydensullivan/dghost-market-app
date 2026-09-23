// ============================================================
// ЖИВЫЕ ДАННЫЕ РОЗЫГРЫША + РЕДАКТИРОВАНИЕ (только для админа)
// ============================================================

const editFab = document.getElementById('editFab');
const editOverlay = document.getElementById('editOverlay');
const editCancel = document.getElementById('editCancel');
const editSave = document.getElementById('editSave');
const editStatus = document.getElementById('editStatus');
const fTitle = document.getElementById('fTitle');
const fSubtitle = document.getElementById('fSubtitle');
const fPrize = document.getElementById('fPrize');
const fMinutes = document.getElementById('fMinutes');
const fConditions = document.getElementById('fConditions');

function applyGiveawayState(data){
if (!data) return;

if (data.title){
document.getElementById('title').textContent = data.title;
document.getElementById('title').setAttribute('data-text', data.title);
fTitle.value = data.title;
}
if (data.subtitle){
document.getElementById('subtitle').textContent = data.subtitle;
fSubtitle.value = data.subtitle;
}
if (data.prize){
document.getElementById('prize').innerHTML = COIN_ICON + ' <b>' + data.prize + '</b>';
fPrize.value = data.prize;
}
// Прозрачность розыгрыша: сколько уже участвует и на каких условиях.
renderGiveawayParticipants(data.participants_count);
renderGiveawayConditions(data.conditions);
if (fConditions) fConditions.value = data.conditions || '';

if (data.end_time){
endTime = data.end_time * 1000;
totalDuration = Math.max(1, endTime - Date.now());
// сброс "СТАРТ!"-состояния, если время снова в будущем
if (endTime - Date.now() > 0){
clockEl.style.display = '';
document.querySelector('.time-labels').style.display = '';
startedBadge.style.display = 'none';
ctaBtn.textContent = (I18N[currentLang] || I18N.ru).timer_cta_btn;
ctaBtn.classList.remove('live');
if (typeof timerId !== 'undefined') clearInterval(timerId);
window.timerId = setInterval(render, 1000);
}
}
render();
}

// Подтягиваем реальное состояние розыгрыша (переопределяет
// значения из URL — они могли устареть, если ссылка старая)
fetch(API_BASE + '/api/giveaway')
.then(r => r.json())
.then(applyGiveawayState)
.catch(() => {
// сервер бота недоступен — остаёмся на значениях из URL
});

// Админ-статус и баланс теперь приходят из loadMe() (см. ниже) —
// оттуда же управляется видимость кнопки ✎ через updateFabVisibility().

editFab.addEventListener('click', () => {
editOverlay.classList.add('show');
editStatus.textContent = '';
});

editCancel.addEventListener('click', () => {
editOverlay.classList.remove('show');
});

editSave.addEventListener('click', () => {

if (!tg || !tg.initData){
editStatus.textContent = (I18N[currentLang] || I18N.ru).status_open_via_telegram_full;
return;
}

editSave.disabled = true;
editStatus.textContent = (I18N[currentLang] || I18N.ru).discount_saving;

fetch(API_BASE + '/api/giveaway', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
init_data: tg.initData,
title: fTitle.value.trim(),
subtitle: fSubtitle.value.trim(),
prize: fPrize.value.trim(),
minutes: fMinutes.value ? Number(fMinutes.value) : null,
conditions: fConditions ? fConditions.value.trim() : undefined,
})
})
.then(async r => {
if (!r.ok){
if (r.status === 401 || r.status === 403){
throw new Error('Нет доступа — открой мини-апп через кнопку бота.');
}
throw new Error('Ошибка сохранения (' + r.status + ')');
}
return r.json();
})
.then(data => {
applyGiveawayState(data);
editStatus.textContent = (I18N[currentLang] || I18N.ru).status_saved_ok;
setTimeout(() => { editOverlay.classList.remove('show'); }, 600);
})
.catch(err => {
editStatus.textContent = friendlyErrorMessage(err);
})
.finally(() => {
editSave.disabled = false;
});
});



// ============================================================
// ПРОЗРАЧНОСТЬ РОЗЫГРЫША: СЧЁТЧИК УЧАСТНИКОВ, УСЛОВИЯ, АРХИВ
// ============================================================

function renderGiveawayParticipants(count){
const box = document.getElementById('gwParticipants');
if (!box) return;
if (count === undefined || count === null){
box.style.display = 'none';
return;
}
const dict = I18N[currentLang] || I18N.ru;
box.textContent = dict.gw_participants.replace('{n}', count);
box.style.display = '';
}

function renderGiveawayConditions(text){
const box = document.getElementById('gwConditions');
if (!box) return;
if (!text){
box.style.display = 'none';
box.innerHTML = '';
return;
}
const dict = I18N[currentLang] || I18N.ru;
box.innerHTML = `<div class="gw-block-title">${dict.gw_conditions}</div>
<div class="gw-conditions-text">${escapeHtml(text)}</div>`;
box.style.display = '';
}

function loadGiveawayWinners(){
const box = document.getElementById('gwWinners');
if (!box) return;
const q = (tg && tg.initData) ? '?init_data=' + encodeURIComponent(tg.initData) : '';
fetch(API_BASE + '/api/giveaway/winners' + q)
.then(r => r.json())
.then(data => {
const dict = I18N[currentLang] || I18N.ru;
const items = data.items || [];
if (!items.length){
box.style.display = 'none';
return;
}
const locale = currentLang === 'uz' ? 'uz-UZ' : (currentLang === 'en' ? 'en-US' : 'ru-RU');
box.innerHTML = `<div class="gw-block-title">${dict.gw_winners}</div>` + items.map(w => {
const date = w.ended_at ? new Date(w.ended_at).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : '';
const extra = [date, w.participants ? dict.gw_of_participants.replace('{n}', w.participants) : '']
.filter(Boolean).join(' · ');
return `<div class="gw-winner${w.is_me ? ' me' : ''}">
<div class="gw-winner-icon">🏆</div>
<div class="gw-winner-info">
<div class="gw-winner-name">${escapeHtml(w.winner)}${w.is_me ? ` <span class="gw-you">${dict.gw_you}</span>` : ''}</div>
<div class="gw-winner-sub">${escapeHtml(extra)}</div>
</div>
<div class="gw-winner-prize">${escapeHtml(w.prize || '')}</div>
</div>`;
}).join('');
box.style.display = '';
})
.catch(() => {});
}

loadGiveawayWinners();

// Счётчик участников обновляем, пока человек смотрит на таймер.
setInterval(() => {
if (document.hidden) return;
fetch(API_BASE + '/api/giveaway')
.then(r => r.json())
.then(data => renderGiveawayParticipants(data.participants_count))
.catch(() => {});
}, 20000);
