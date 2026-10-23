// ============================================================
// ПОДДЕРЖКА: чат клиента и раздел «Поддержка» в админке
//
// Переписка общая с ботами: клиент может писать здесь или в
// @dghostmarketsupportbot, команда — отвечать из админки или из бота.
// Сервер: /api/support/* (support_chat.py в боте).
// ============================================================

let isSupportStaff = false;
let supportUnread = 0;
let supportTopic = '';
let supportSkinId = 0;
let supportPhotoData = null;
let supportReturnTab = 'profile';
let supportPollTimer = null;
let adminSupportState = 'open';
let adminSupportTicketId = null;

function supportDict(){
return I18N[currentLang] || I18N.ru;
}

function supportApi(path, body){
if (!tg || !tg.initData) return Promise.reject(new Error(errorMessage('unauthorized')));
const opts = body
? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ init_data: tg.initData }, body)) }
: {};
const url = body ? API_BASE + path : API_BASE + path + (path.includes('?') ? '&' : '?') + 'init_data=' + encodeURIComponent(tg.initData);
return fetch(url, opts).then(async r => {
const data = await r.json().catch(() => ({}));
if (!r.ok) throw new Error(errorMessage(data.error));
return data;
});
}

function supportTime(ts){
const d = new Date(ts * 1000);
const pad = n => String(n).padStart(2, '0');
return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function supportPhotoUrl(id){
return API_BASE + '/api/support/photo?id=' + id + '&init_data=' + encodeURIComponent(tg.initData);
}

// mine — чья это сторона: 'client' (чат клиента) или 'staff' (админка).
function renderSupportMessages(el, messages, mine, clientLabel){
const dict = supportDict();
if (!messages.length){
el.innerHTML = `<div class="skins-empty" style="padding:16px 4px;">${escapeHtml(dict.support_empty)}</div>`;
return;
}
el.innerHTML = messages.map(m => {
const own = m.author === mine;
const who = m.author === 'staff' ? dict.support_team : (mine === 'client' ? dict.support_you : (clientLabel || ''));
const photo = m.photo && m.id ? `<img class="support-photo" src="${supportPhotoUrl(m.id)}" alt="" loading="lazy">` : '';
const text = (m.photo && m.text === '📷') ? '' : `<div class="support-msg-text">${escapeHtml(m.text)}</div>`;
return `<div class="support-msg${own ? ' own' : ''}"><div class="support-msg-who">${escapeHtml(who)} · ${supportTime(m.at)}</div>${photo}${text}</div>`;
}).join('');
el.scrollTop = el.scrollHeight;
}

// ---------- клиент ----------

function applySupportMe(data){
isSupportStaff = !!data.support_staff;
supportUnread = Number(data.support_unread) || 0;
updateSupportBadges();
}

function updateSupportBadges(){
document.querySelectorAll('[data-header-action="support"], [data-pf-action="support"]').forEach(btn => {
let dot = btn.querySelector('.support-dot');
if (!dot){
dot = document.createElement('span');
dot.className = 'support-dot';
btn.appendChild(dot);
}
dot.textContent = supportUnread > 9 ? '9+' : String(supportUnread);
dot.hidden = !supportUnread;
});
}

function openSupport(opts){
opts = opts || {};
if (typeof currentTab === 'string' && currentTab !== 'support') supportReturnTab = currentTab;
supportTopic = opts.topic || supportTopic;
supportSkinId = Number(opts.skinId) || 0;
renderSupportContext();
switchTab('support');
}

function renderSupportContext(){
document.querySelectorAll('#supportTopics [data-support-topic]').forEach(b => {
b.classList.toggle('active', b.dataset.supportTopic === supportTopic);
});
const ctx = document.getElementById('supportContext');
if (supportSkinId){
ctx.innerHTML = `${escapeHtml(supportDict().support_lot.replace('{id}', supportSkinId))} <button type="button" id="supportContextClear" aria-label="✕">✕</button>`;
ctx.hidden = false;
} else {
ctx.hidden = true;
}
}

function loadSupportThread(){
clearTimeout(supportPollTimer);
supportApi('/api/support/thread')
.then(data => {
renderSupportMessages(document.getElementById('supportThread'), data.messages || [], 'client');
supportUnread = 0;
updateSupportBadges();
})
.catch(() => {
document.getElementById('supportThread').innerHTML = `<div class="skins-empty" style="padding:16px 4px;">${escapeHtml(supportDict().load_failed || '')}</div>`;
})
.finally(() => {
// Пока экран открыт — подтягиваем ответы раз в 15 секунд.
if (currentTab === 'support') supportPollTimer = setTimeout(() => { if (currentTab === 'support') loadSupportThread(); }, 15000);
});
}

// Фото уменьшаем до 1600 px и JPEG — запрос остаётся лёгким.
function readSupportPhoto(file){
return new Promise((resolve, reject) => {
const reader = new FileReader();
reader.onload = () => {
const img = new Image();
img.onload = () => {
const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
const canvas = document.createElement('canvas');
canvas.width = Math.round(img.width * scale);
canvas.height = Math.round(img.height * scale);
canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
resolve(canvas.toDataURL('image/jpeg', 0.85));
};
img.onerror = () => reject(new Error(errorMessage('bad_photo')));
img.src = reader.result;
};
reader.onerror = () => reject(new Error(errorMessage('bad_photo')));
reader.readAsDataURL(file);
});
}

function setSupportPhoto(dataUrl){
supportPhotoData = dataUrl;
document.getElementById('supportPhotoImg').src = dataUrl || '';
document.getElementById('supportPhotoPreview').hidden = !dataUrl;
}

function sendSupportMessage(){
const input = document.getElementById('supportInput');
const btn = document.getElementById('supportSendBtn');
const text = input.value.trim();
if (!text && !supportPhotoData) return;
btn.disabled = true;
supportApi('/api/support/send', {
text: text,
topic: supportTopic,
skin_id: supportSkinId || undefined,
photo_base64: supportPhotoData || undefined,
})
.then(() => {
input.value = '';
setSupportPhoto(null);
supportTopic = '';
supportSkinId = 0;
renderSupportContext();
loadSupportThread();
})
.catch(err => showAlert(err.message))
.finally(() => { btn.disabled = false; });
}

document.getElementById('supportSendBtn').addEventListener('click', sendSupportMessage);

document.getElementById('supportBackBtn').addEventListener('click', () => {
clearTimeout(supportPollTimer);
switchTab(supportReturnTab || 'profile');
});

document.getElementById('supportTopics').addEventListener('click', (e) => {
const chip = e.target.closest('[data-support-topic]');
if (!chip) return;
supportTopic = supportTopic === chip.dataset.supportTopic ? '' : chip.dataset.supportTopic;
renderSupportContext();
});

document.getElementById('supportContext').addEventListener('click', (e) => {
if (!e.target.closest('#supportContextClear')) return;
supportSkinId = 0;
renderSupportContext();
});

document.getElementById('supportAttachBtn').addEventListener('click', () => {
document.getElementById('supportPhotoInput').click();
});

document.getElementById('supportPhotoInput').addEventListener('change', (e) => {
const file = e.target.files && e.target.files[0];
e.target.value = '';
if (!file) return;
readSupportPhoto(file).then(setSupportPhoto).catch(err => showAlert(err.message));
});

document.getElementById('supportPhotoRemove').addEventListener('click', () => setSupportPhoto(null));

// Кнопка «Чат» под ответом поддержки в боте ведёт сюда (?open=support).
(function supportDeepLink(){
let open = false;
try { open = new URLSearchParams(location.search).get('open') === 'support'; } catch (e) {}
if (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param === 'support') open = true;
if (open) setTimeout(() => openSupport(), 300);
})();

// ---------- команда: раздел «Поддержка» в админке ----------

function supportStateLabel(state){
const dict = supportDict();
return dict['admin_support_state_' + state] || state;
}

function supportChannelLabel(channel){
const dict = supportDict();
return dict['admin_support_channel_' + channel] || channel;
}

function setSupportStaffBadge(count){
document.querySelectorAll('[data-support-badge]').forEach(badge => {
badge.textContent = count > 99 ? '99+' : String(count);
badge.hidden = !count;
});
}

function loadAdminSupport(){
const list = document.getElementById('adminSupportList');
const dict = supportDict();
document.getElementById('adminSupportTicket').hidden = true;
document.getElementById('adminSupportTabs').style.display = '';
list.hidden = false;
adminSupportTicketId = null;
supportApi('/api/support/staff/tickets?state=' + adminSupportState)
.then(data => {
setSupportStaffBadge(data.open_count || 0);
const items = data.tickets || [];
if (!items.length){
list.innerHTML = `<div class="skins-empty" style="padding:12px 4px;">${escapeHtml(dict.admin_support_empty)}</div>`;
return;
}
list.innerHTML = items.map(t => `<button type="button" class="support-ticket" data-support-ticket="${t.id}">
<div class="support-ticket-head"><b>#${t.id} · ${escapeHtml(t.who)}</b><span class="support-state support-state-${t.state}">${escapeHtml(supportStateLabel(t.state))}</span></div>
<div class="support-ticket-text">${t.has_draft ? '✍️ ' : ''}${escapeHtml(t.last_text)}</div>
<div class="deal-meta">${escapeHtml(supportChannelLabel(t.channel))} · ${supportTime(t.updated_at)}</div>
</button>`).join('');
})
.catch(err => {
list.innerHTML = `<div class="skins-empty" style="padding:12px 4px;">${escapeHtml(err.message)}</div>`;
});
}

function openAdminSupportTicket(id){
const dict = supportDict();
adminSupportTicketId = id;
document.getElementById('adminSupportList').hidden = true;
document.getElementById('adminSupportTabs').style.display = 'none';
document.getElementById('adminSupportTicket').hidden = false;
const thread = document.getElementById('adminSupportThread');
thread.innerHTML = `<div class="skins-empty" style="padding:12px 4px;">${escapeHtml(dict.loading || '')}</div>`;
supportApi('/api/support/staff/ticket?id=' + id)
.then(data => {
const c = data.client;
document.getElementById('adminSupportClient').innerHTML = `<b>#${data.ticket.id} · ${escapeHtml(c.who)}</b>
<div class="deal-meta">ID ${c.id} · ${escapeHtml(String(c.language || '').toUpperCase())} · ${escapeHtml(dict.admin_support_trades.replace('{n}', c.trades))}${c.blocked ? ' · ⛔ ' + escapeHtml(dict.admin_support_blocked) : ''}</div>
<div class="deal-meta">${escapeHtml(supportStateLabel(data.ticket.state))} · ${escapeHtml(supportChannelLabel(data.ticket.channel))}</div>`;
renderSupportMessages(thread, data.messages || [], 'staff', c.who);
const draftEl = document.getElementById('adminSupportDraft');
if (data.draft){
const draftText = `${data.draft.text_uz}\n\n🇷🇺 ${data.draft.text_ru}`;
draftEl.innerHTML = `<div class="support-msg-who">✍️ ${escapeHtml(dict.admin_support_draft)}</div><div class="support-msg-text">${escapeHtml(draftText)}</div>
<button type="button" class="pf-set-btn" id="adminSupportUseDraft">${escapeHtml(dict.admin_support_use_draft)}</button>`;
draftEl.hidden = false;
document.getElementById('adminSupportUseDraft').onclick = () => {
document.getElementById('adminSupportInput').value = draftText;
};
} else {
draftEl.hidden = true;
}
const open = data.ticket.state === 'open';
// У .pf-set-btn свой display — атрибут hidden его не перебивает.
document.getElementById('adminSupportClose').style.display = open ? '' : 'none';
document.getElementById('adminSupportReopen').style.display = open ? 'none' : '';
})
.catch(err => {
thread.innerHTML = `<div class="skins-empty" style="padding:12px 4px;">${escapeHtml(err.message)}</div>`;
});
}

document.getElementById('adminSupportList').addEventListener('click', (e) => {
const item = e.target.closest('[data-support-ticket]');
if (item) openAdminSupportTicket(Number(item.dataset.supportTicket));
});

document.getElementById('adminSupportTabs').addEventListener('click', (e) => {
const tab = e.target.closest('[data-support-state]');
if (!tab) return;
adminSupportState = tab.dataset.supportState;
document.querySelectorAll('#adminSupportTabs [data-support-state]').forEach(b => b.classList.toggle('active', b === tab));
loadAdminSupport();
});

document.getElementById('adminSupportBack').addEventListener('click', loadAdminSupport);

document.getElementById('adminSupportSend').addEventListener('click', () => {
const input = document.getElementById('adminSupportInput');
const btn = document.getElementById('adminSupportSend');
const text = input.value.trim();
if (!text || !adminSupportTicketId) return;
btn.disabled = true;
supportApi('/api/support/staff/reply', { task_id: adminSupportTicketId, text: text })
.then(data => {
input.value = '';
const dict = supportDict();
showAlert(data.delivered ? dict.admin_support_sent : dict.admin_support_not_delivered);
openAdminSupportTicket(adminSupportTicketId);
})
.catch(err => showAlert(err.message))
.finally(() => { btn.disabled = false; });
});

function changeAdminSupportStatus(action){
if (!adminSupportTicketId) return;
supportApi('/api/support/staff/status', { task_id: adminSupportTicketId, action: action })
.then(() => openAdminSupportTicket(adminSupportTicketId))
.catch(err => showAlert(err.message));
}

document.getElementById('adminSupportClose').addEventListener('click', () => changeAdminSupportStatus('close'));
document.getElementById('adminSupportReopen').addEventListener('click', () => changeAdminSupportStatus('reopen'));
