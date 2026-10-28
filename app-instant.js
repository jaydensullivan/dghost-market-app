// ============================================================
// «ПРОДАТЬ ГАРАНТУ» — продажа скина сразу, без проверки паспорта
//
// Продавец (Steam + телефон) выбирает скин из инвентаря, скидку 5–15%
// от цены рынка и гаранта из списка — тому уходит заявка. Гарант принял
// — дальше обычная сделка в «Сделках» (обмен в Steam, 8 дней удержания),
// потом деньги можно вывести. Гаранты (тариф «Гарант») здесь же пишут
// свои условия и отвечают на заявки. Сервер — instant_sell.py в боте.
// ============================================================

const instantOverlay = document.getElementById('instantOverlay');
const instantStatus = document.getElementById('instantStatus');

let instantState = {
tab: 'sell',
info: null,
items: null,
item: null,
quote: null,
discount: null,
garantId: null,
};

function instantDict(){
return I18N[currentLang] || I18N.ru;
}

function instantFetch(path, body){
const isGet = !body;
const url = API_BASE + path + (isGet ? (path.includes('?') ? '&' : '?') + 'init_data=' + encodeURIComponent(tg.initData) : '');
const opts = isGet ? {} : {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(Object.assign({ init_data: tg.initData }, body)),
};
return fetch(url, opts).then(async r => {
const data = await r.json().catch(() => ({}));
if (!r.ok) throw new Error(errorMessage(data.error) || errorMessage('network'));
return data;
});
}

function openInstantSell(item){
if (!tg || !tg.initData) return;
instantState = { tab: 'sell', info: null, items: null, item: null, quote: null, discount: null, garantId: null };
instantStatus.textContent = '';
instantOverlay.classList.add('show');
renderInstant();
instantFetch('/api/instant/garants')
.then(info => {
instantState.info = info;
if (item && !info.seller_problem) pickInstantItem(item);
renderInstant();
})
.catch(err => { instantStatus.textContent = friendlyErrorMessage(err); });
}

function closeInstantSell(){
instantOverlay.classList.remove('show');
}

function setInstantTab(tab){
instantState.tab = tab;
instantStatus.textContent = '';
renderInstant();
if (tab === 'mine' || tab === 'garant') loadInstantRequests();
}

function renderInstant(){
const dict = instantDict();
const info = instantState.info;
document.querySelectorAll('#instantTabs [data-instant-tab]').forEach(b => {
b.classList.toggle('on', b.dataset.instantTab === instantState.tab);
if (b.dataset.instantTab === 'garant') b.hidden = !(info && info.is_garant);
});
const body = document.getElementById('instantBody');
if (!info){
body.innerHTML = `<div class="instant-muted">${escapeHtml(dict.is_loading)}</div>`;
return;
}
if (instantState.tab === 'sell') body.innerHTML = renderInstantSell(info);
else if (instantState.tab === 'mine') body.innerHTML = renderInstantMine();
else body.innerHTML = renderInstantGarant(info);
}

// ---------- продать ----------

function renderInstantSell(info){
const dict = instantDict();
if (info.seller_problem){
const map = {
steam_login_required: [dict.is_need_steam, dict.is_btn_steam, 'steam'],
phone_required: [dict.is_need_phone, dict.is_btn_phone, 'phone'],
trade_link_required: [dict.is_need_trade, dict.is_btn_profile, 'profile'],
};
const [text, btn, action] = map[info.seller_problem] || [errorMessage(info.seller_problem), '', ''];
return `<p class="instant-intro">${escapeHtml(dict.is_intro)}</p>
<div class="instant-need">${escapeHtml(text)}</div>
${btn ? `<button type="button" class="save instant-wide" data-instant-fix="${action}">${escapeHtml(btn)}</button>` : ''}`;
}
const left = Math.max(0, (info.week_limit || 0) - (info.week_sold || 0));
let html = `<p class="instant-intro">${escapeHtml(dict.is_intro)}</p>
<div class="instant-muted">${escapeHtml(dict.is_week_left.replace('{sum}', formatCoins(left)))}</div>
<h3 class="instant-step">${escapeHtml(dict.is_pick_item)}</h3>`;
if (!instantState.item){
if (!instantState.items){
loadInstantItems();
return html + `<div class="instant-muted">${escapeHtml(dict.is_loading)}</div>`;
}
if (!instantState.items.length) return html + `<div class="instant-muted">${escapeHtml(dict.is_no_items)}</div>`;
return html + `<div class="instant-items">${instantState.items.map((it, i) => instantItemRow(it, `data-instant-item="${i}"`)).join('')}</div>`;
}
html += instantItemRow(instantState.item, 'data-instant-change="1"', true);
const quote = instantState.quote;
if (!quote) return html + `<div class="instant-muted">${escapeHtml(dict.is_loading)}</div>`;
html += `<div class="instant-muted">${escapeHtml(dict.is_market.replace('{sum}', formatCoins(quote.market_price)))}</div>
<h3 class="instant-step">${escapeHtml(dict.is_pick_discount)}</h3>
<div class="instant-discounts">${Object.keys(quote.prices).map(d => `<button type="button" class="qs-chip${Number(d) === instantState.discount ? ' on' : ''}" data-instant-discount="${d}"><b>−${d}%</b><span>${escapeHtml(formatCoins(quote.prices[d]))}</span></button>`).join('')}</div>`;
if (!instantState.discount) return html;
const price = quote.prices[String(instantState.discount)];
html += `<h3 class="instant-step">${escapeHtml(dict.is_pick_garant)}</h3>`;
if (!info.garants.length) return html + `<div class="instant-muted">${escapeHtml(dict.is_no_garants)}</div>`;
html += `<div class="instant-garants">${info.garants.map(g => {
let why = '';
if (instantState.discount < g.min_discount) why = dict.is_garant_skip_discount.replace('{p}', g.min_discount);
else if (price < g.min_price || (g.max_price && price > g.max_price)) why = dict.is_garant_skip_price;
const range = (g.min_price || g.max_price)
? dict.is_garant_range.replace('{min}', formatCoins(g.min_price || 0)).replace('{max}', g.max_price ? formatCoins(g.max_price) : '∞')
: dict.is_garant_any;
return `<button type="button" class="instant-garant${g.id === instantState.garantId ? ' on' : ''}" data-instant-garant="${g.id}"${why ? ' disabled' : ''}>
<div class="instant-garant-top"><b>${escapeHtml(g.name)}</b><span>${escapeHtml(dict.is_garant_deals.replace('{n}', g.deals))}</span></div>
<div class="instant-muted">${escapeHtml(dict.is_garant_from.replace('{p}', g.min_discount))} · ${escapeHtml(range)}</div>
${g.note ? `<div class="instant-note">${escapeHtml(g.note)}</div>` : ''}
${why ? `<div class="instant-why">${escapeHtml(why)}</div>` : ''}
</button>`;
}).join('')}</div>`;
html += `<button type="button" class="save instant-wide" id="instantSendBtn"${instantState.garantId ? '' : ' disabled'}>${escapeHtml(dict.is_send)} · ${escapeHtml(formatCoins(price))}</button>`;
return html;
}

function instantItemRow(it, attrs, selected){
const parts = [it.wear ? (WEAR_LABELS[it.wear] || it.wear) : '', it.float_value != null ? formatFloat(it.float_value) : ''].filter(Boolean);
return `<button type="button" class="instant-item${selected ? ' on' : ''}" ${attrs}>
${it.photo_url ? `<img src="${escapeHtml(it.photo_url)}" alt="">` : '<span></span>'}
<div><b>${escapeHtml((it.stattrak ? 'ST™ ' : '') + (it.title || ''))}</b><div class="instant-muted">${escapeHtml(parts.join(' · '))}</div></div>
</button>`;
}

function loadInstantItems(){
if (instantState.itemsLoading) return;
instantState.itemsLoading = true;
instantFetch('/api/steam/inventory')
.then(data => {
instantState.items = (data.items || []).filter(it => it.tradable && it.asset_id);
})
.catch(err => {
instantState.items = [];
instantStatus.textContent = friendlyErrorMessage(err);
})
.finally(() => { instantState.itemsLoading = false; renderInstant(); });
}

function pickInstantItem(item){
instantState.item = item;
instantState.quote = null;
instantState.discount = null;
instantState.garantId = null;
instantStatus.textContent = '';
instantFetch('/api/instant/quote', { asset_id: String(item.asset_id) })
.then(quote => { instantState.quote = quote; })
.catch(err => {
instantState.item = null;
instantStatus.textContent = friendlyErrorMessage(err);
})
.finally(renderInstant);
}

function sendInstantRequest(btn){
btn.disabled = true;
instantFetch('/api/instant/requests', {
asset_id: String(instantState.item.asset_id),
garant_id: instantState.garantId,
discount: instantState.discount,
})
.then(() => {
haptic('success');
setInstantTab('mine');
instantStatus.textContent = instantDict().is_sent;
})
.catch(err => {
btn.disabled = false;
instantStatus.textContent = friendlyErrorMessage(err);
});
}

// ---------- заявки ----------

function loadInstantRequests(){
instantFetch('/api/instant/requests')
.then(data => {
instantState.mine = data.as_seller || [];
instantState.incoming = data.as_garant || [];
renderInstant();
})
.catch(err => { instantStatus.textContent = friendlyErrorMessage(err); });
}

function instantRequestRow(r, actions){
const dict = instantDict();
const status = dict['is_status_' + r.status] || r.status;
return `<div class="instant-request">
${instantItemRow(r, 'tabindex="-1"')}
<div class="instant-request-row"><b>${escapeHtml(formatCoins(r.price))}</b><span>−${r.discount}% · ${escapeHtml(status)}</span></div>
${r.seller_username ? `<div class="instant-muted">${escapeHtml(r.seller_username)}</div>` : ''}
${actions || ''}
</div>`;
}

function renderInstantMine(){
const dict = instantDict();
const list = instantState.mine;
if (!list) return `<div class="instant-muted">${escapeHtml(dict.is_loading)}</div>`;
if (!list.length) return `<div class="instant-muted">${escapeHtml(dict.is_mine_empty)}</div>`;
return list.map(r => instantRequestRow(r, r.status === 'pending'
? `<button type="button" class="instant-small" data-instant-cancel="${r.id}">${escapeHtml(dict.is_cancel)}</button>`
: '')).join('');
}

// ---------- гарант ----------

function renderInstantGarant(info){
const dict = instantDict();
const p = info.profile || { enabled: 0, min_discount: 10, min_price: 0, max_price: 0, note: '' };
const options = [];
for (let d = info.discount_min; d <= info.discount_max; d++){
options.push(`<option value="${d}"${d === p.min_discount ? ' selected' : ''}>−${d}%</option>`);
}
const incoming = instantState.incoming;
let html = `<div class="instant-muted">${escapeHtml(dict.is_g_fee.replace('{p}', info.fee_percent))}</div>
<label class="instant-check"><input type="checkbox" id="instantGEnabled"${p.enabled ? ' checked' : ''}> ${escapeHtml(dict.is_g_enabled)}</label>
<div class="edit-field"><label for="instantGDiscount">${escapeHtml(dict.is_g_min_discount)}</label><select id="instantGDiscount">${options.join('')}</select></div>
<div class="edit-field"><label for="instantGMin">${escapeHtml(dict.is_g_min_price)}</label><input id="instantGMin" type="number" min="0" value="${Number(p.min_price) || 0}"></div>
<div class="edit-field"><label for="instantGMax">${escapeHtml(dict.is_g_max_price)}</label><input id="instantGMax" type="number" min="0" value="${Number(p.max_price) || 0}"></div>
<div class="edit-field"><label for="instantGNote">${escapeHtml(dict.is_g_note)}</label><input id="instantGNote" type="text" maxlength="200" value="${escapeHtml(p.note || '')}"></div>
<button type="button" class="save instant-wide" id="instantGSave">${escapeHtml(dict.is_g_save)}</button>
<h3 class="instant-step">${escapeHtml(dict.is_g_incoming)}</h3>`;
if (!incoming) return html + `<div class="instant-muted">${escapeHtml(dict.is_loading)}</div>`;
if (!incoming.length) return html + `<div class="instant-muted">${escapeHtml(dict.is_mine_empty)}</div>`;
return html + incoming.map(r => instantRequestRow(r, r.status === 'pending'
? `<div class="instant-actions"><button type="button" class="instant-small" data-instant-decide="${r.id}" data-accept="0">${escapeHtml(dict.is_decline)}</button><button type="button" class="save instant-small" data-instant-decide="${r.id}" data-accept="1">${escapeHtml(dict.is_accept)}</button></div>`
: '')).join('');
}

function saveInstantProfile(btn){
btn.disabled = true;
instantFetch('/api/instant/profile', {
enabled: document.getElementById('instantGEnabled').checked,
min_discount: Number(document.getElementById('instantGDiscount').value),
min_price: Number(document.getElementById('instantGMin').value) || 0,
max_price: Number(document.getElementById('instantGMax').value) || 0,
note: document.getElementById('instantGNote').value,
})
.then(data => {
instantState.info.profile = data.profile;
instantStatus.textContent = instantDict().is_g_saved;
})
.catch(err => { instantStatus.textContent = friendlyErrorMessage(err); })
.finally(() => { btn.disabled = false; });
}

function decideInstantRequest(btn){
btn.disabled = true;
const accept = btn.dataset.accept === '1';
instantFetch('/api/instant/requests/' + btn.dataset.instantDecide + '/decide', { accept })
.then(() => {
if (accept){
haptic('success');
instantStatus.textContent = instantDict().is_accepted_ok;
}
loadInstantRequests();
})
.catch(err => {
btn.disabled = false;
instantStatus.textContent = friendlyErrorMessage(err);
});
}

// ---------- события ----------

document.getElementById('instantTabs').addEventListener('click', (e) => {
const b = e.target.closest('[data-instant-tab]');
if (b) setInstantTab(b.dataset.instantTab);
});

document.getElementById('instantBody').addEventListener('click', (e) => {
const t = e.target.closest('button');
if (!t || t.disabled) return;
if (t.dataset.instantItem !== undefined){
pickInstantItem(instantState.items[Number(t.dataset.instantItem)]);
renderInstant();
} else if (t.dataset.instantChange){
instantState.item = null;
renderInstant();
} else if (t.dataset.instantDiscount){
haptic('light');
instantState.discount = Number(t.dataset.instantDiscount);
instantState.garantId = null;
renderInstant();
} else if (t.dataset.instantGarant){
haptic('light');
instantState.garantId = Number(t.dataset.instantGarant);
renderInstant();
} else if (t.id === 'instantSendBtn'){
sendInstantRequest(t);
} else if (t.dataset.instantCancel){
t.disabled = true;
instantFetch('/api/instant/requests/' + t.dataset.instantCancel + '/cancel', {})
.then(loadInstantRequests)
.catch(err => { t.disabled = false; instantStatus.textContent = friendlyErrorMessage(err); });
} else if (t.id === 'instantGSave'){
saveInstantProfile(t);
} else if (t.dataset.instantDecide){
decideInstantRequest(t);
} else if (t.dataset.instantFix === 'steam'){
startSteamLogin(instantStatus);
} else if (t.dataset.instantFix === 'phone'){
requestPhoneButtonInChat(instantStatus);
} else if (t.dataset.instantFix === 'profile'){
closeInstantSell();
goToScreen('profile');
}
});

document.getElementById('instantCloseBtn').addEventListener('click', closeInstantSell);
document.getElementById('instantSellBtn').addEventListener('click', () => openInstantSell(null));
