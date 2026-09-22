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

