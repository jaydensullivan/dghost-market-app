// Маркет подарков Telegram за сумы (бот: gift_market.py).
// «Купить» — подарки в продаже, фильтр по коллекции, сортировка,
// карточка с моделью/узором/фоном и редкостью, покупка с баланса.
// «Мои подарки» — подарки из профиля Telegram («Выставить на продажу» → сразу
// на витрине; купили — передаёшь покупателю сам), сделки и старое хранилище.

let gfItems = [];
let gfInfo = { enabled: false, fee_percent: 5, escrow_username: null };
let gfMineItems = [];
let gfCollection = '';
let gfLoaded = false;

function gfDict(){ return I18N[currentLang] || I18N.ru; }

function gfPct(perMille){
if (perMille == null) return '';
const v = perMille / 10;
return (v < 1 ? v.toFixed(1) : String(Math.round(v * 10) / 10)) + '%';
}

// Цвет фона подарка из Telegram (число RGB) → CSS.
function gfColor(n, fallback){
if (typeof n !== 'number') return fallback;
return '#' + n.toString(16).padStart(6, '0');
}

function gfBg(item){
const c = item.backdrop_colors;
if (!c) return 'var(--surface)';
return `radial-gradient(circle at 50% 42%, ${gfColor(c.center, '#3b2a55')} 0%, ${gfColor(c.edge, '#171022')} 78%)`;
}

function gfRarityScore(item){
// Чем меньше доля, тем реже: суммируем «редкость» трёх признаков.
return [item.model_rarity, item.symbol_rarity, item.backdrop_rarity].reduce((s, r) => s + (r ? 1000 / r : 0), 0);
}

function gfCardHtml(item){
const d = gfDict();
return `<button type="button" class="gf-card" data-gf-id="${item.id}">
<span class="gf-card-art" style="background:${gfBg(item)}"><img src="${escapeHtml(item.image || '')}" alt="" loading="lazy"></span>
<span class="gf-card-body">
<span class="gf-card-name">${escapeHtml(item.title)}</span>
<span class="gf-card-model">${escapeHtml(item.model || '')} <b>${gfPct(item.model_rarity)}</b></span>
<span class="gf-card-price">${item.price_uzs ? escapeHtml(formatCoins(item.price_uzs)) : escapeHtml(d.gf_no_price)}</span>
</span>
</button>`;
}

function renderGiftsGrid(){
const d = gfDict();
const grid = document.getElementById('gfGrid');
const q = (document.getElementById('gfSearch').value || '').trim().toLowerCase();
const sort = document.getElementById('gfSort').value;
let list = gfItems.filter(it => !gfCollection || it.base_name === gfCollection);
if (q) list = list.filter(it => [it.title, it.model, it.symbol, it.backdrop].join(' ').toLowerCase().includes(q));
if (sort === 'cheap') list = list.slice().sort((a, b) => a.price_uzs - b.price_uzs);
else if (sort === 'expensive') list = list.slice().sort((a, b) => b.price_uzs - a.price_uzs);
else if (sort === 'rare') list = list.slice().sort((a, b) => gfRarityScore(b) - gfRarityScore(a));
grid.innerHTML = list.length ? list.map(gfCardHtml).join('')
: `<div class="skins-empty skins-empty-md">${escapeHtml(gfItems.length ? d.gf_nothing_found : d.gf_empty)}</div>`;
}

function renderGiftChips(){
const d = gfDict();
const names = [...new Set(gfItems.map(it => it.base_name).filter(Boolean))].sort();
const box = document.getElementById('gfChips');
box.innerHTML = names.length < 2 ? '' : [['', d.gf_all]].concat(names.map(n => [n, n])).map(([v, label]) =>
`<button type="button" class="gf-chip${v === gfCollection ? ' active' : ''}" data-gf-col="${escapeHtml(v)}">${escapeHtml(label)}</button>`).join('');
}

function loadGifts(){
return fetch(API_BASE + '/api/gifts')
.then(r => r.json())
.then(data => {
gfInfo = data || gfInfo;
gfItems = (data && data.items) || [];
gfLoaded = true;
document.getElementById('giftsEntry').hidden = !(data && data.enabled);
renderGiftChips();
renderGiftsGrid();
})
.catch(() => {
if (!gfLoaded) document.getElementById('gfGrid').innerHTML = `<div class="skins-empty skins-empty-md">${escapeHtml(gfDict().gf_load_failed)}</div>`;
});
}

// ---------- мои подарки ----------

function gfStatusLabel(item){
const d = gfDict();
return { held: d.gf_st_held, listed: d.gf_st_listed, selling: d.gf_st_selling, returning: d.gf_st_returning, dispute: d.gf_st_dispute }[item.status] || item.status;
}

function renderGiftsHow(){
const d = gfDict();
const box = document.getElementById('gfHow');
const who = gfInfo.escrow_username ? '@' + gfInfo.escrow_username : '—';
box.innerHTML = `<div class="gf-how-title">${escapeHtml(d.gf_how_title)}</div>
<ol class="gf-how-steps">
<li>${escapeHtml(d.gf_how_1).replace('{who}', `<b class="gf-copy" data-gf-copy="${escapeHtml(who)}">${escapeHtml(who)}</b>`)}</li>
<li>${escapeHtml(d.gf_how_2)}</li>
<li>${escapeHtml(d.gf_how_3.replace('{fee}', String(gfInfo.fee_percent)))}</li>
</ol>`;
}

function renderGiftsMine(){
const d = gfDict();
const box = document.getElementById('gfMine');
// Выставленное из профиля показываем в сетке профиля; здесь — сделки и хранилище.
const list = gfMineItems.filter(it => !(it.p2p && it.status === 'listed'));
if (!list.length){
box.innerHTML = `<div class="skins-empty skins-empty-md">${escapeHtml(d.gf_mine_empty)}</div>`;
return;
}
box.innerHTML = list.map(it => it.p2p ? `
<div class="gf-mine">
<span class="gf-mine-art" style="background:${gfBg(it)}"><img src="${escapeHtml(it.image || '')}" alt="" loading="lazy"></span>
<div class="gf-mine-body">
<div class="gf-mine-name">${escapeHtml(it.title)}</div>
<div class="gf-mine-status selling">${escapeHtml(it.status === 'selling' ? d.gf_pass_to.replace('{who}', it.buyer_username ? '@' + it.buyer_username : '—') : d.gf_st_dispute)}${it.price_uzs ? ' · ' + escapeHtml(formatCoins(it.price_uzs)) : ''}</div>
${it.status === 'selling' ? `<div class="gf-mine-hint">${escapeHtml(d.gf_pass_hint)}</div>
<div class="gf-mine-row"><a class="pf-btn gf-set gf-open-tg" href="${escapeHtml(it.link)}" data-gf-tg="${escapeHtml(it.link)}">${escapeHtml(d.gf_btn_open_gift)}</a></div>` : ''}
</div>
</div>` : `
<div class="gf-mine" data-gf-mine="${it.id}">
<span class="gf-mine-art" style="background:${gfBg(it)}"><img src="${escapeHtml(it.image || '')}" alt="" loading="lazy"></span>
<div class="gf-mine-body">
<div class="gf-mine-name">${escapeHtml(it.title)}</div>
<div class="gf-mine-status ${escapeHtml(it.status)}">${escapeHtml(gfStatusLabel(it))}${it.price_uzs ? ' · ' + escapeHtml(formatCoins(it.price_uzs)) : ''}</div>
${(it.status === 'held' || it.status === 'listed') ? `
<div class="gf-mine-row">
<input type="text" inputmode="numeric" class="gf-price-input" placeholder="${escapeHtml(d.gf_price_ph)}" value="${it.price_uzs || ''}">
<button type="button" class="pf-btn gf-set" data-gf-set="${it.id}">${escapeHtml(it.status === 'listed' ? d.gf_btn_change : d.gf_btn_list)}</button>
</div>
<div class="gf-mine-hint" data-gf-payout="${it.id}">${it.payout_uzs ? escapeHtml(d.gf_you_get.replace('{sum}', formatCoins(it.payout_uzs))) : ''}</div>
<div class="gf-mine-row">
${it.status === 'listed' ? `<button type="button" class="pf-btn gf-ghost" data-gf-unlist="${it.id}">${escapeHtml(d.gf_btn_unlist)}</button>` : ''}
<button type="button" class="pf-btn gf-ghost" data-gf-return="${it.id}">${escapeHtml(d.gf_btn_return)}</button>
</div>` : ''}
</div>
</div>`).join('');
}

function loadGiftsMine(){
if (!tg || !tg.initData){ gfMineItems = []; renderGiftsMine(); return Promise.resolve(); }
return fetch(API_BASE + '/api/gifts/mine?init_data=' + encodeURIComponent(tg.initData))
.then(r => r.json())
.then(data => { gfMineItems = (data && data.items) || []; renderGiftsMine(); })
.catch(() => {});
}

// ---------- из профиля Telegram (P2P, без хранилища) ----------
// Подарок выставляется прямо из профиля и остаётся у продавца. Купили —
// бот пишет продавцу, кому передать; деньги у маркета, пока подарок не дойдёт.

let gfProfileItems = [];
let gfProfileState = 'idle';   // idle | loading | ok | failed

function loadGiftsProfile(fresh){
if (!tg || !tg.initData){ gfProfileItems = []; gfProfileState = 'ok'; renderGiftsProfile(); return Promise.resolve(); }
if (!gfProfileItems.length) { gfProfileState = 'loading'; renderGiftsProfile(); }
return fetch(API_BASE + '/api/gifts/profile?init_data=' + encodeURIComponent(tg.initData) + (fresh ? '&fresh=1' : ''))
.then(r => r.json().then(data => ({ ok: r.ok, data })))
.then(({ ok, data }) => {
if (!ok){ gfProfileState = 'failed'; renderGiftsProfile(); return; }
gfProfileItems = data.items || [];
if (data.fee_percent != null) gfInfo.fee_percent = data.fee_percent;
gfProfileState = 'ok';
renderGiftsProfile();
})
.catch(() => { gfProfileState = 'failed'; renderGiftsProfile(); });
}

function gfProfileBadge(it){
const d = gfDict();
const l = it.listing;
if (!l) return ['is-sell', d.gf_btn_sell];
if (l.status === 'listed') return ['', d.gf_on_sale.replace('{price}', formatCoins(l.price_uzs))];
if (l.status === 'selling') return ['is-wait', d.gf_sold_pass];
return ['is-wait', d.gf_st_dispute];
}

function renderGiftsProfile(){
const d = gfDict();
const box = document.getElementById('gfProfile');
if (!box) return;
if (gfProfileState === 'loading'){ box.innerHTML = `<div class="gf-empty-note">${escapeHtml(d.gf_profile_loading)}</div>`; return; }
if (gfProfileState === 'failed'){ box.innerHTML = `<div class="gf-empty-note">${escapeHtml(d.gf_err_profile_failed)}</div>`; return; }
if (!gfProfileItems.length){ box.innerHTML = `<div class="gf-empty-note">${escapeHtml(d.gf_profile_empty)}</div>`; return; }
box.innerHTML = gfProfileItems.map(it => {
const [cls, label] = gfProfileBadge(it);
return `<button type="button" class="gf-card" data-gf-prof="${escapeHtml(it.name)}">
<span class="gf-card-art" style="background:${gfBg(it)}"><img src="${escapeHtml(it.image || '')}" alt="" loading="lazy"></span>
<span class="gf-card-body">
<span class="gf-card-name">${escapeHtml(it.title)}</span>
<span class="gf-card-model">${escapeHtml(it.model || '')} <b>${gfPct(it.model_rarity)}</b></span>
<span class="gf-card-price ${cls}">${escapeHtml(label)}</span>
</span>
</button>`;
}).join('');
}

function gfTransferAfter(item){
if (!item.next_transfer_at) return '';
const t = new Date(item.next_transfer_at);
if (!(t > new Date())) return '';
return gfDict().gf_transfer_after.replace('{date}', t.toLocaleString(currentLang === 'en' ? 'en-GB' : 'ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }));
}

function gfRefreshAll(){ loadGiftsProfile(true); loadGiftsMine(); loadGifts(); }

function openProfileGift(item){
const d = gfDict();
const traits = [[d.gf_model, item.model, item.model_rarity], [d.gf_symbol, item.symbol, item.symbol_rarity], [d.gf_backdrop, item.backdrop, item.backdrop_rarity]];
const l = item.listing;
const listed = l && l.status === 'listed';
const busy = l && !listed;
const after = gfTransferAfter(item);
document.getElementById('gfDetail').innerHTML = `
<div class="gf-hero" style="background:${gfBg(item)}"><img src="${escapeHtml(item.image || '')}" alt=""></div>
<div class="gf-detail-name">${escapeHtml(item.title)}</div>
<div class="gf-traits">${traits.map(([k, v, r]) => `<div class="gf-trait"><span>${escapeHtml(k)}</span><b>${escapeHtml(v || '—')}</b><i>${gfPct(r)}</i></div>`).join('')}</div>
${busy ? `<div class="gf-step">${escapeHtml(l.status === 'selling' ? d.gf_sold_pass_long : d.gf_st_dispute)}</div>
<a class="welcome-btn primary u-w100 gf-open-tg" href="${escapeHtml(item.link)}" data-gf-tg="${escapeHtml(item.link)}">${escapeHtml(d.gf_btn_open_gift)}</a>` : `
${listed ? `<div class="gf-detail-note">${escapeHtml(d.gf_on_sale.replace('{price}', formatCoins(l.price_uzs)))}</div>` : ''}
<div class="gf-sell-row">
<input type="text" inputmode="numeric" class="gf-price-input" id="gfSellPrice" placeholder="${escapeHtml(d.gf_price_ph)}" value="${listed ? l.price_uzs : ''}">
</div>
<div class="gf-mine-hint" id="gfSellHint"></div>
${after ? `<div class="gf-detail-note">${escapeHtml(after)}</div>` : `<div class="gf-detail-note">${escapeHtml(d.gf_sell_note)}</div>`}
<button type="button" class="welcome-btn primary u-w100" id="gfSellBtn"${after ? ' disabled' : ''}>${escapeHtml(listed ? d.gf_btn_change : d.gf_btn_sell)}</button>
${listed ? `<button type="button" class="gf-link-btn" id="gfSellCancel">${escapeHtml(d.gf_btn_unlist)}</button>` : ''}
<div class="edit-status" id="gfSellStatus"></div>`}`;
const input = document.getElementById('gfSellPrice');
if (input){
const hint = document.getElementById('gfSellHint');
const updHint = () => {
const price = parseInt(String(input.value).replace(/\D/g, ''), 10) || 0;
const fee = Number(gfInfo.fee_percent) || 0;
hint.textContent = price ? d.gf_you_get.replace('{sum}', formatCoins(Math.max(0, price - Math.round(price * fee / 100 / 100) * 100))) : '';
};
input.addEventListener('input', updHint);
updHint();
document.getElementById('gfSellBtn').onclick = () => {
const btn = document.getElementById('gfSellBtn');
const status = document.getElementById('gfSellStatus');
const price = parseInt(String(input.value).replace(/\D/g, ''), 10) || 0;
status.className = 'edit-status';
status.textContent = d.gf_saving;
btn.disabled = true;
gfPost('/api/gifts/prelist', { name: item.name, price_uzs: price }).then(({ ok, data }) => {
if (!ok){
status.className = 'edit-status is-error';
status.textContent = gfError(data.error);
input.classList.add('field-error');
if (typeof haptic === 'function') haptic('error');
return;
}
closeGift();
if (typeof haptic === 'function') haptic('success');
if (typeof dgSuccess === 'function') dgSuccess(d.gf_listed_title, d.gf_listed_sub);
else showToast(d.gf_listed_ok);
gfRefreshAll();
}).catch(() => { status.className = 'edit-status is-error'; status.textContent = d.gf_err_generic; })
.finally(() => { btn.disabled = false; });
};
}
const cancelBtn = document.getElementById('gfSellCancel');
if (cancelBtn) cancelBtn.onclick = () => {
gfPost('/api/gifts/prelist_cancel', { name: item.name }).then(() => { closeGift(); showToast(d.gf_unlisted_ok); gfRefreshAll(); });
};
document.getElementById('giftOverlay').classList.add('show');
}

function setGiftsTab(tab){
document.querySelectorAll('#gfTabs [data-gf-tab]').forEach(b => b.classList.toggle('active', b.dataset.gfTab === tab));
document.getElementById('gfBuyPane').hidden = tab !== 'buy';
document.getElementById('gfMinePane').hidden = tab !== 'mine';
if (tab === 'mine'){ renderGiftsHow(); loadGiftsMine(); loadGiftsProfile(); }
}

function loadGiftsScreen(){
loadGifts().then(() => renderGiftsHow());
}

function gfPost(path, body){
return fetch(API_BASE + path, {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(Object.assign({ init_data: tg.initData }, body)),
}).then(r => r.json().then(data => ({ ok: r.ok, data })));
}

function gfError(code){
const d = gfDict();
return d['gf_err_' + code] || d.gf_err_generic;
}

// ---------- карточка и покупка ----------

function openGift(item){
const d = gfDict();
const traits = [[d.gf_model, item.model, item.model_rarity], [d.gf_symbol, item.symbol, item.symbol_rarity], [d.gf_backdrop, item.backdrop, item.backdrop_rarity]];
document.getElementById('gfDetail').innerHTML = `
<div class="gf-hero" style="background:${gfBg(item)}"><img src="${escapeHtml(item.image || '')}" alt=""></div>
<div class="gf-detail-name">${escapeHtml(item.title)}</div>
<div class="gf-traits">${traits.map(([k, v, r]) => `<div class="gf-trait"><span>${escapeHtml(k)}</span><b>${escapeHtml(v || '—')}</b><i>${gfPct(r)}</i></div>`).join('')}</div>
<div class="gf-detail-price">${escapeHtml(formatCoins(item.price_uzs))}</div>
<div class="gf-detail-note">${escapeHtml(item.p2p ? d.gf_buy_note_p2p : (gfInfo.manual ? d.gf_buy_note_manual : d.gf_buy_note))}</div>
<button type="button" class="welcome-btn primary u-w100" id="gfBuyBtn">${escapeHtml(d.gf_btn_buy.replace('{price}', formatCoins(item.price_uzs)))}</button>
<div class="edit-status" id="gfBuyStatus"></div>`;
document.getElementById('gfBuyBtn').onclick = () => buyGift(item);
document.getElementById('giftOverlay').classList.add('show');
}

function closeGift(){ document.getElementById('giftOverlay').classList.remove('show'); }

function buyGift(item){
const d = gfDict();
const status = document.getElementById('gfBuyStatus');
const btn = document.getElementById('gfBuyBtn');
if (!tg || !tg.initData){ status.textContent = d.open_via_telegram || gfError('unauthorized'); return; }
btn.disabled = true;
status.textContent = d.gf_buying;
gfPost('/api/gifts/buy', { id: item.id })
.then(({ ok, data }) => {
if (!ok){
if (data.error === 'insufficient_balance'){
status.textContent = d.gf_err_insufficient_balance;
if (typeof haptic === 'function') haptic('error');
setTimeout(() => { closeGift(); const t = document.getElementById('openTopupBtn'); if (t) t.click(); }, 900);
return;
}
status.textContent = gfError(data.error);
if (typeof haptic === 'function') haptic('error');
loadGifts();
return;
}
status.textContent = '';
closeGift();
if (typeof dgSuccess === 'function') dgSuccess(data.manual || data.p2p ? d.gf_paid : d.gf_bought, data.p2p ? d.gf_paid_sub_p2p : (data.manual ? d.gf_paid_sub : d.gf_bought_sub));
if (typeof loadMe === 'function') loadMe();
loadGifts();
})
.catch(() => { status.textContent = d.gf_err_generic; })
.finally(() => { btn.disabled = false; });
}

// ---------- события ----------

document.getElementById('giftsEntry').addEventListener('click', () => { goToScreen('gifts'); setGiftsTab('buy'); });
document.getElementById('gfBackBtn').addEventListener('click', () => goToScreen('shop'));
document.getElementById('gfClose').addEventListener('click', closeGift);
document.getElementById('giftOverlay').addEventListener('click', (e) => {
if (e.target.id === 'giftOverlay'){ closeGift(); return; }
const tgLink = e.target.closest('[data-gf-tg]');
if (tgLink){ e.preventDefault(); if (tg && typeof tg.openTelegramLink === 'function') tg.openTelegramLink(tgLink.dataset.gfTg); else window.open(tgLink.dataset.gfTg, '_blank'); }
});
document.getElementById('gfSort').addEventListener('change', renderGiftsGrid);
let gfSearchTimer = null;
document.getElementById('gfSearch').addEventListener('input', () => { clearTimeout(gfSearchTimer); gfSearchTimer = setTimeout(renderGiftsGrid, 200); });

document.getElementById('screenGifts').addEventListener('click', (e) => {
const tab = e.target.closest('[data-gf-tab]');
if (tab){ setGiftsTab(tab.dataset.gfTab); return; }
const chip = e.target.closest('[data-gf-col]');
if (chip){ gfCollection = chip.dataset.gfCol; if (typeof dgArm === 'function') dgArm('gfGrid'); renderGiftChips(); renderGiftsGrid(); return; }
const tgLink = e.target.closest('[data-gf-tg]');
if (tgLink){ e.preventDefault(); if (tg && typeof tg.openTelegramLink === 'function') tg.openTelegramLink(tgLink.dataset.gfTg); else window.open(tgLink.dataset.gfTg, '_blank'); return; }
const prof = e.target.closest('[data-gf-prof]');
if (prof){ const it = gfProfileItems.find(x => x.name === prof.dataset.gfProf); if (it) openProfileGift(it); return; }
const card = e.target.closest('[data-gf-id]');
if (card){ const it = gfItems.find(x => String(x.id) === card.dataset.gfId); if (it) openGift(it); return; }
const copy = e.target.closest('[data-gf-copy]');
if (copy){
const text = copy.dataset.gfCopy;
try { navigator.clipboard.writeText(text).then(() => showToast(gfDict().gf_copied)); } catch (err) {}
return;
}
const d = gfDict();
const set = e.target.closest('[data-gf-set]');
if (set){
const row = set.closest('.gf-mine');
const price = parseInt(String(row.querySelector('.gf-price-input').value).replace(/\D/g, ''), 10) || 0;
set.disabled = true;
gfPost('/api/gifts/price', { id: Number(set.dataset.gfSet), price_uzs: price })
.then(({ ok, data }) => {
if (!ok){ showToast(gfError(data.error)); if (typeof haptic === 'function') haptic('error'); return; }
showToast(d.gf_listed_ok);
if (typeof haptic === 'function') haptic('success');
loadGiftsMine(); loadGifts();
})
.catch(() => showToast(d.gf_err_generic))
.finally(() => { set.disabled = false; });
return;
}
const un = e.target.closest('[data-gf-unlist]');
if (un){
gfPost('/api/gifts/unlist', { id: Number(un.dataset.gfUnlist) })
.then(({ ok, data }) => { showToast(ok ? d.gf_unlisted_ok : gfError(data.error)); loadGiftsMine(); loadGifts(); })
.catch(() => showToast(d.gf_err_generic));
return;
}
const ret = e.target.closest('[data-gf-return]');
if (ret){
ret.disabled = true;
gfPost('/api/gifts/return', { id: Number(ret.dataset.gfReturn) })
.then(({ ok, data }) => {
showToast(ok ? (data.manual ? d.gf_return_requested : d.gf_returned_ok) : gfError(data.error));
loadGiftsMine(); loadGifts();
})
.catch(() => showToast(d.gf_err_generic))
.finally(() => { ret.disabled = false; });
}
});

// «Получишь X» под ценой — сразу при вводе.
document.getElementById('screenGifts').addEventListener('input', (e) => {
const input = e.target.closest('.gf-price-input');
if (!input) return;
const row = input.closest('.gf-mine');
const price = parseInt(String(input.value).replace(/\D/g, ''), 10) || 0;
const hint = row.querySelector('[data-gf-payout]');
const fee = Number(gfInfo.fee_percent) || 0;
const payout = Math.max(0, price - Math.round(price * fee / 100 / 100) * 100);
if (hint) hint.textContent = price ? gfDict().gf_you_get.replace('{sum}', formatCoins(payout)) : '';
});

// Fragment иногда отдаёт картинку подарка с ошибкой с первого раза (рисует её
// при первом запросе) — пробуем ещё дважды с паузой.
document.addEventListener('error', (e) => {
const img = e.target;
if (!(img instanceof HTMLImageElement) || !/nft\.fragment\.com\/gift\//.test(img.src)) return;
const n = Number(img.dataset.gfRetry || 0);
if (n >= 2) return;
img.dataset.gfRetry = String(n + 1);
setTimeout(() => { img.src = img.src.split('?')[0] + '?r=' + (n + 1); }, 1500 * (n + 1));
}, true);

// Вход на главной показываем, только если маркет работает.
loadGifts();
