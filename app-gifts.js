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

// ---------- анимация подарка (Lottie) ----------
// Уникальные: готовая анимация Fragment (фон, узор, модель). Обычные из
// магазина: стикер через бота. Картинка видна сразу, анимация — поверх,
// когда загрузится. «Меньше анимаций» — только картинка.

const GF_LOTTIE_SRC = 'https://cdn.jsdelivr.net/npm/lottie-web@5.12.2/build/player/lottie_light.min.js';
let gfLottieLib = null;
let gfAnim = null;

function gfLoadLottie(){
if (window.lottie) return Promise.resolve(window.lottie);
if (!gfLottieLib) gfLottieLib = new Promise((res, rej) => {
const sc = document.createElement('script');
sc.src = GF_LOTTIE_SRC; sc.async = true;
sc.onload = () => window.lottie ? res(window.lottie) : rej(new Error('no lottie'));
sc.onerror = () => { gfLottieLib = null; rej(new Error('lottie load')); };
document.head.appendChild(sc);
});
return gfLottieLib;
}

function gfStopAnim(){ if (gfAnim){ try { gfAnim.destroy(); } catch (e) {} gfAnim = null; } }

function gfPlayAnim(hero, url){
gfStopAnim();
if (!hero || !url || (typeof dgMotionCalm === 'function' && dgMotionCalm())) return;
Promise.all([gfLoadLottie(), fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })])
.then(([lottie, data]) => {
if (!hero.isConnected) return;
const box = document.createElement('div');
box.className = 'gf-anim';
hero.appendChild(box);
gfStopAnim();
gfAnim = lottie.loadAnimation({ container: box, renderer: 'svg', loop: true, autoplay: true, animationData: data });
gfAnim.addEventListener('DOMLoaded', () => hero.classList.add('is-anim'));
})
.catch(() => {});
}

function gfAnimUrl(item){ return item.name ? `https://nft.fragment.com/gift/${String(item.name).toLowerCase()}.lottie.json` : null; }

// ---------- цена рынка (Fragment) ----------

function gfTon(v){ return (Math.round(Number(v) * 10) / 10).toLocaleString('ru-RU'); }

function gfDiscount(item){
if (!item.market_uzs || !item.price_uzs || item.price_uzs >= item.market_uzs) return 0;
return Math.round((1 - item.price_uzs / item.market_uzs) * 100);
}

function gfMarketLine(item){
const d = gfDict();
if (!item.market_uzs) return '';
const base = d.gf_market_line.replace('{ton}', gfTon(item.market_ton)).replace('{sum}', item.market_uzs ? formatCoins(item.market_uzs) : '—');
const off = gfDiscount(item);
return `<div class="gf-market">${escapeHtml(base)}${off >= 1 ? ` <b>${escapeHtml(d.gf_cheaper.replace('{pct}', off))}</b>` : ''}</div>`;
}

function gfRarityScore(item){
// Чем меньше доля, тем реже: суммируем «редкость» трёх признаков.
return [item.model_rarity, item.symbol_rarity, item.backdrop_rarity].reduce((s, r) => s + (r ? 1000 / r : 0), 0);
}

function gfCardHtml(item){
const d = gfDict();
const promo = Array.isArray(item.promo) ? item.promo : [];
const promoCls = promo.length ? ' is-promo' + (promo.includes('highlight') ? ' promo-hl' : '') : '';
return `<button type="button" class="gf-card${promoCls}" data-gf-id="${item.id}">
<span class="gf-card-art" style="background:${gfBg(item)}"><img src="${escapeHtml(item.image || '')}" alt="" loading="lazy">${promo.length ? `<span class="promo-tag">${escapeHtml(d.promo_tag)}</span>` : ''}</span>
<span class="gf-card-body">
<span class="gf-card-name">${escapeHtml(item.title)}</span>
<span class="gf-card-model">${escapeHtml(item.model || '')} <b>${gfPct(item.model_rarity)}</b></span>
<span class="gf-card-price">${item.price_uzs ? escapeHtml(formatCoins(item.price_uzs)) : escapeHtml(d.gf_no_price)}</span>
${gfDiscount(item) >= 1 ? `<span class="gf-card-off">${escapeHtml(d.gf_cheaper.replace('{pct}', gfDiscount(item)))}</span>` : ''}
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
// Редкость — по самому редкому из трёх признаков (доля в промилле).
const rarity = Number(document.getElementById('gfRarity').value) || 0;
if (rarity) list = list.filter(it => {
const r = [it.model_rarity, it.symbol_rarity, it.backdrop_rarity].filter(v => v != null);
return r.length && Math.min(...r) <= rarity;
});
const pMin = Number(document.getElementById('gfPriceMin').value) || 0;
const pMax = Number(document.getElementById('gfPriceMax').value) || 0;
if (pMin) list = list.filter(it => it.price_uzs && it.price_uzs >= pMin);
if (pMax) list = list.filter(it => it.price_uzs && it.price_uzs <= pMax);
if (sort === 'cheap') list = list.slice().sort((a, b) => a.price_uzs - b.price_uzs);
else if (sort === 'expensive') list = list.slice().sort((a, b) => b.price_uzs - a.price_uzs);
else if (sort === 'rare') list = list.slice().sort((a, b) => gfRarityScore(b) - gfRarityScore(a));
// Продвижение (бот: promo) — только при витринной сортировке «Новые».
if (sort === 'new' && typeof dgPromoOrder === 'function') list = dgPromoOrder(list, true);
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
${it.status === 'listed' ? `<button type="button" class="pf-btn promo-open-btn" data-promo-open="gifts:${it.id}">${escapeHtml(d.promo_btn)}</button>` : ''}
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
<div class="gf-hero" id="gfHero" style="background:${gfBg(item)}"><img src="${escapeHtml(item.image || '')}" alt=""></div>
<div class="gf-detail-name">${escapeHtml(item.title)}</div>
<div class="gf-traits">${traits.map(([k, v, r]) => `<div class="gf-trait"><span>${escapeHtml(k)}</span><b>${escapeHtml(v || '—')}</b><i>${gfPct(r)}</i></div>`).join('')}</div>
${busy ? `<div class="gf-step">${escapeHtml(l.status === 'selling' ? d.gf_sold_pass_long : d.gf_st_dispute)}</div>
<a class="welcome-btn primary u-w100 gf-open-tg" href="${escapeHtml(item.link)}" data-gf-tg="${escapeHtml(item.link)}">${escapeHtml(d.gf_btn_open_gift)}</a>` : `
${listed ? `<div class="gf-detail-note">${escapeHtml(d.gf_on_sale.replace('{price}', formatCoins(l.price_uzs)))}</div>` : ''}
<div class="gf-sell-row">
<input type="text" inputmode="numeric" class="gf-price-input" id="gfSellPrice" placeholder="${escapeHtml(d.gf_price_ph)}" value="${listed ? l.price_uzs : ''}">
</div>
<div class="gf-mine-hint" id="gfSellHint"></div>
<div id="gfSellMarket"></div>
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
// Подсказка цены: цена рынка в сумах и быстрые кнопки «рынок −5% / −10%».
const showMarket = (m) => {
const box = document.getElementById('gfSellMarket');
if (!box || !m || !m.uzs) return;
const line = d.gf_market_line.replace('{ton}', gfTon(m.ton)).replace('{sum}', m.uzs ? formatCoins(m.uzs) : '—');
box.innerHTML = `<div class="gf-market">${escapeHtml(line)}</div>` + (m.uzs ? `<div class="gf-quick">${[0, 5, 10].map(p => {
const v = Math.max(10000, Math.round(m.uzs * (1 - p / 100) / 1000) * 1000);
return `<button type="button" data-gf-quick="${v}">${escapeHtml(p ? d.gf_market_minus.replace('{pct}', p) : d.gf_market_eq)}</button>`;
}).join('')}</div>` : '');
box.querySelectorAll('[data-gf-quick]').forEach(b => b.onclick = () => { input.value = b.dataset.gfQuick; updHint(); });
};
if (item.market_ton) showMarket({ ton: item.market_ton, uzs: item.market_uzs });
else fetch(API_BASE + '/api/gifts/market?name=' + encodeURIComponent(item.name) + '&model=' + encodeURIComponent(item.model || ''))
.then(r => r.json()).then(m => { item.market_ton = m.ton; item.market_uzs = m.uzs; showMarket(m); }).catch(() => {});
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
// Лимит тарифа: текст с цифрами и предложение открыть тарифы (app-pro.js).
status.textContent = (typeof offerPlans === 'function' && offerPlans(data)) ? planErrorMessage(data) : gfError(data.error);
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
gfPlayAnim(document.getElementById('gfHero'), gfAnimUrl(item));
}

// ---------- «Отправить»: обычные подарки Telegram за сумы ----------
// Бот покупает подарок за свои звёзды и отправляет себе или другу.

let gsItems = [];
let gsState = 'idle';   // idle | loading | ok | failed | off
let gsTo = 'self';

function loadGiftShop(){
if (gsState === 'ok' && gsItems.length) { renderGiftShop(); return Promise.resolve(); }
gsState = 'loading'; renderGiftShop();
return fetch(API_BASE + '/api/gifts/shop?lang=' + encodeURIComponent(currentLang || 'ru'))
.then(r => r.json().then(data => ({ ok: r.ok, data })))
.then(({ ok, data }) => {
if (!ok){ gsState = 'failed'; renderGiftShop(); return; }
gsItems = data.items || [];
gsState = data.enabled === false ? 'off' : 'ok';
// Цена «от» — для подписи Подарков на экране выбора раздела (app-spaces.js).
const from = gsItems.reduce((m, it) => (it.price_uzs > 0 && (!m || it.price_uzs < m) ? it.price_uzs : m), 0);
if (from && typeof window.dgGiftsFrom === 'function') window.dgGiftsFrom(from);
renderGiftShop();
})
.catch(() => { gsState = 'failed'; renderGiftShop(); });
}

function gsArt(it, cls){
const img = it.img ? `<img src="${escapeHtml(API_BASE + it.img)}" alt="" loading="lazy" data-gs-emoji="${escapeHtml(it.emoji || '🎁')}">` : '';
return `<span class="${cls}">${img || `<span class="gs-emoji">${escapeHtml(it.emoji || '🎁')}</span>`}</span>`;
}

// Ряд обычных подарков на главной Подарков (вкладка «Купить»): сначала
// самые дешёвые; нажатие — вкладка «Отправить» и сразу окно покупки.
function renderGiftStrip(){
const box = document.getElementById('gsStrip');
if (!box) return;
const ok = gsState === 'ok' && gsItems.length > 0;
box.hidden = !ok;
if (!ok) return;
const d = gfDict();
const items = gsItems.slice().sort((a, b) => a.price_uzs - b.price_uzs);
document.getElementById('gsStripFrom').textContent = d.gs_strip_from.replace('{price}', formatCoins(items[0].price_uzs));
document.getElementById('gsStripRow').innerHTML = items.map(it => `<button type="button" class="gs-chip" data-gs-strip="${escapeHtml(it.id)}" aria-label="${escapeHtml(it.name + ' · ' + formatCoins(it.price_uzs))}">
${gsArt(it, 'gs-chip-art')}
<span class="gs-chip-price">${escapeHtml(formatCoins(it.price_uzs))}</span>
</button>`).join('');
}

function renderGiftShop(){
renderGiftStrip();
const d = gfDict();
const box = document.getElementById('gsGrid');
if (!box) return;
if (gsState === 'loading'){ box.innerHTML = `<div class="gf-empty-note">${escapeHtml(d.gs_loading)}</div>`; return; }
if (gsState === 'failed'){ box.innerHTML = `<div class="gf-empty-note">${escapeHtml(d.gs_load_failed)}</div>`; return; }
if (gsState === 'off' || !gsItems.length){ box.innerHTML = `<div class="gf-empty-note">${escapeHtml(d.gs_off)}</div>`; return; }
box.innerHTML = gsItems.map(it => `<button type="button" class="gf-card gs-card" data-gs-id="${escapeHtml(it.id)}">
${gsArt(it, 'gs-art')}
<span class="gf-card-body">
<span class="gf-card-name">${escapeHtml(it.name)}</span>
${it.limited && it.remaining != null ? `<span class="gs-limited">${escapeHtml(d.gs_left.replace('{n}', Number(it.remaining).toLocaleString('ru-RU')))}</span>` : ''}
<span class="gf-card-price">${escapeHtml(formatCoins(it.price_uzs))}</span>
</span>
</button>`).join('');
}

function gsRecipient(){
const d = gfDict();
if (gsTo === 'self') return { to: 'self', label: d.gs_to_self };
const u = String(document.getElementById('gsUsername').value || '').trim().replace(/^@/, '');
return { to: 'friend', username: u, label: '@' + u };
}

function openShopGift(it){
const d = gfDict();
const rec = gsRecipient();
const total = (up) => it.price_uzs + (up && it.upgrade_price_uzs ? it.upgrade_price_uzs : 0);
document.getElementById('gfDetail').innerHTML = `
${gsArt(it, 'gs-hero')}
<div class="gf-detail-name" style="text-align:center">${escapeHtml(it.name)}</div>
<div class="gf-detail-note" style="text-align:center">${escapeHtml(d.gs_for.replace('{who}', rec.to === 'self' ? d.gs_to_self_long : rec.label))}</div>
${it.upgrade_price_uzs ? `<label class="gs-check"><input type="checkbox" id="gsUpgrade"><span>${escapeHtml(d.gs_upgrade.replace('{sum}', formatCoins(it.upgrade_price_uzs)))}</span></label>` : ''}
<button type="button" class="welcome-btn primary u-w100" id="gsSendBtn" data-tg-start="gifts_send">${escapeHtml(d.gs_btn_send.replace('{price}', formatCoins(total(false))))}</button>
<div class="edit-status" id="gsStatus"></div>`;
const up = document.getElementById('gsUpgrade');
const btn = document.getElementById('gsSendBtn');
if (up) up.addEventListener('change', () => { btn.textContent = d.gs_btn_send.replace('{price}', formatCoins(total(up.checked))); });
btn.onclick = () => {
const status = document.getElementById('gsStatus');
if (!tg || !tg.initData){ status.className = 'edit-status is-error'; status.textContent = d.gf_err_unauthorized; return; }
if (rec.to === 'friend' && !/^[A-Za-z0-9_]{4,32}$/.test(rec.username || '')){ status.className = 'edit-status is-error'; status.textContent = d.gs_err_username; return; }
btn.disabled = true;
status.className = 'edit-status';
status.textContent = d.gs_sending;
gfPost('/api/gifts/shop/send', { gift_id: it.id, to: rec.to, username: rec.username || '', text: document.getElementById('gsText').value || '', upgrade: !!(up && up.checked) })
.then(({ ok, data }) => {
if (!ok){
if (data.error === 'insufficient_balance'){
status.className = 'edit-status is-error';
status.textContent = d.gf_err_insufficient_balance;
if (typeof haptic === 'function') haptic('error');
setTimeout(() => { closeGift(); const t = document.getElementById('openTopupBtn'); if (t) t.click(); }, 900);
return;
}
status.className = 'edit-status is-error';
status.textContent = d['gs_err_' + data.error] || gfError(data.error);
if (typeof haptic === 'function') haptic('error');
return;
}
closeGift();
if (typeof dgSuccess === 'function') dgSuccess(d.gs_sent, data.self ? d.gs_sent_self : d.gs_sent_friend.replace('{who}', rec.label));
else showToast(d.gs_sent);
document.getElementById('gsText').value = '';
if (typeof loadMe === 'function') loadMe();
})
.catch(() => { status.className = 'edit-status is-error'; status.textContent = d.gf_err_generic; })
.finally(() => { btn.disabled = false; });
};
document.getElementById('giftOverlay').classList.add('show');
if (it.anim) gfPlayAnim(document.querySelector('#gfDetail .gs-hero'), API_BASE + it.anim);
}

// Превью стикера не загрузилось — показываем эмодзи.
document.addEventListener('error', (e) => {
const img = e.target;
if (!(img instanceof HTMLImageElement) || !img.dataset.gsEmoji) return;
const span = document.createElement('span');
span.className = 'gs-emoji';
span.textContent = img.dataset.gsEmoji;
img.replaceWith(span);
}, true);

// ---------- «Сообщить, когда появится» ----------

let gfWants = [];

function gfCollections(){
const names = new Set(gfItems.map(it => it.base_name).filter(Boolean));
(gfProfileItems || []).forEach(it => it.base_name && names.add(it.base_name));
['Plush Pepe', 'Durov\'s Cap', 'Precious Peach', 'Heart Locket', 'Mad Pumpkin', 'Jester Hat', 'Love Potion', 'Swiss Watch', 'Eternal Rose', 'Signet Ring',
'Vintage Cigar', 'Lol Pop', 'Homemade Cake', 'Snoop Dogg', 'Toy Bear', 'Light Sword', 'Mighty Arm', 'Kissed Frog', 'Scared Cat', 'Witch Hat'].forEach(n => names.add(n));
return [...names].sort();
}

function renderWants(){
const d = gfDict();
const box = document.getElementById('gfWantsList');
if (!box) return;
box.innerHTML = gfWants.length ? gfWants.map(w => `<div class="gf-want"><span>🔔 ${escapeHtml(w.base_name)}${w.model ? ' · ' + escapeHtml(w.model) : ''}${w.max_price ? ' · ' + escapeHtml(d.gf_want_upto.replace('{sum}', formatCoins(w.max_price))) : ''}</span>
<button type="button" data-gf-want-del="${w.id}" aria-label="×">×</button></div>`).join('') : `<div class="gs-note">${escapeHtml(d.gf_wants_empty)}</div>`;
}

function openWants(){
const d = gfDict();
document.getElementById('gfDetail').innerHTML = `
<div class="gf-detail-name">${escapeHtml(d.gf_wants_title)}</div>
<div class="gf-detail-note">${escapeHtml(d.gf_wants_sub)}</div>
<input type="text" id="gfWantName" class="gf-price-input gs-input" list="gfWantNames" placeholder="${escapeHtml(d.gf_want_name_ph)}" autocomplete="off">
<datalist id="gfWantNames">${gfCollections().map(n => `<option value="${escapeHtml(n)}">`).join('')}</datalist>
<input type="text" id="gfWantModel" class="gf-price-input gs-input" placeholder="${escapeHtml(d.gf_want_model_ph)}" autocomplete="off">
<input type="text" inputmode="numeric" id="gfWantPrice" class="gf-price-input gs-input" placeholder="${escapeHtml(d.gf_want_price_ph)}">
<button type="button" class="welcome-btn primary u-w100" id="gfWantAdd">${escapeHtml(d.gf_want_add)}</button>
<div class="edit-status" id="gfWantStatus"></div>
<div class="gf-wants" id="gfWantsList"></div>`;
renderWants();
if (tg && tg.initData) fetch(API_BASE + '/api/gifts/wants?init_data=' + encodeURIComponent(tg.initData)).then(r => r.json()).then(data => { gfWants = data.items || []; renderWants(); }).catch(() => {});
document.getElementById('gfWantAdd').onclick = () => {
const status = document.getElementById('gfWantStatus');
if (!tg || !tg.initData){ status.className = 'edit-status is-error'; status.textContent = d.gf_err_unauthorized; return; }
const price = parseInt(String(document.getElementById('gfWantPrice').value).replace(/\D/g, ''), 10) || 0;
gfPost('/api/gifts/wants', { base_name: document.getElementById('gfWantName').value, model: document.getElementById('gfWantModel').value, max_price: price || null })
.then(({ ok, data }) => {
if (!ok){ status.className = 'edit-status is-error'; status.textContent = d['gf_want_err_' + data.error] || gfError(data.error); return; }
status.className = 'edit-status'; status.textContent = d.gf_want_saved;
gfWants = data.items || []; renderWants();
['gfWantName', 'gfWantModel', 'gfWantPrice'].forEach(id => { document.getElementById(id).value = ''; });
if (typeof haptic === 'function') haptic('success');
}).catch(() => { status.className = 'edit-status is-error'; status.textContent = d.gf_err_generic; });
};
document.getElementById('giftOverlay').classList.add('show');
}

// Ссылка из поста/уведомления: ?startapp=gift_<id> — открыть подарок на витрине.
function openGiftById(id){
goToScreen('gifts');
setGiftsTab('buy');
let tries = 0;
const tick = () => {
const it = gfItems.find(x => String(x.id) === String(id));
if (it){ openGift(it); return; }
if (++tries < 20) setTimeout(tick, 300);
};
tick();
}

function setGiftsTab(tab){
document.querySelectorAll('#gfTabs [data-gf-tab]').forEach(b => b.classList.toggle('active', b.dataset.gfTab === tab));
document.getElementById('gfBuyPane').hidden = tab !== 'buy';
document.getElementById('gfMinePane').hidden = tab !== 'mine';
document.getElementById('gfSendPane').hidden = tab !== 'send';
if (tab === 'mine'){ renderGiftsHow(); loadGiftsMine(); loadGiftsProfile(); }
if (tab === 'send') loadGiftShop();
}

function loadGiftsScreen(){
loadGifts().then(() => renderGiftsHow());
loadGiftShop();
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
<div class="gf-hero" id="gfHero" style="background:${gfBg(item)}"><img src="${escapeHtml(item.image || '')}" alt=""></div>
<div class="gf-detail-name">${escapeHtml(item.title)}</div>
<div class="gf-traits">${traits.map(([k, v, r]) => `<div class="gf-trait"><span>${escapeHtml(k)}</span><b>${escapeHtml(v || '—')}</b><i>${gfPct(r)}</i></div>`).join('')}</div>
<div class="gf-detail-price">${escapeHtml(formatCoins(item.price_uzs))}</div>
${gfMarketLine(item)}
<div class="gf-detail-note">${escapeHtml(item.p2p ? d.gf_buy_note_p2p : (gfInfo.manual ? d.gf_buy_note_manual : d.gf_buy_note))}</div>
<button type="button" class="welcome-btn primary u-w100" id="gfBuyBtn" data-tg-start="gift_${Number(item.id)}">${escapeHtml(d.gf_btn_buy.replace('{price}', formatCoins(item.price_uzs)))}</button>
<div class="edit-status" id="gfBuyStatus"></div>`;
document.getElementById('gfBuyBtn').onclick = () => buyGift(item);
document.getElementById('giftOverlay').classList.add('show');
gfPlayAnim(document.getElementById('gfHero'), gfAnimUrl(item));
}

function closeGift(){ gfStopAnim(); document.getElementById('giftOverlay').classList.remove('show'); }

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
if (tgLink){ e.preventDefault(); if (tg && typeof tg.openTelegramLink === 'function') tg.openTelegramLink(tgLink.dataset.gfTg); else window.open(tgLink.dataset.gfTg, '_blank'); return; }
const del = e.target.closest('[data-gf-want-del]');
if (del){ gfPost('/api/gifts/wants/delete', { id: Number(del.dataset.gfWantDel) }).then(({ data }) => { gfWants = (data && data.items) || []; renderWants(); }).catch(() => {}); }
});
document.getElementById('gfSort').addEventListener('change', renderGiftsGrid);
document.getElementById('gfRarity').addEventListener('change', renderGiftsGrid);
let gfSearchTimer = null;
document.getElementById('gfSearch').addEventListener('input', () => { clearTimeout(gfSearchTimer); gfSearchTimer = setTimeout(renderGiftsGrid, 200); });
['gfPriceMin', 'gfPriceMax'].forEach(id => document.getElementById(id).addEventListener('input', () => { clearTimeout(gfSearchTimer); gfSearchTimer = setTimeout(renderGiftsGrid, 300); }));

// Сортировка и фильтры — под иконкой; на иконке — сколько включено.
function gfFiltersCount(){
const n = (document.getElementById('gfSort').value !== 'new' ? 1 : 0)
+ (document.getElementById('gfRarity').value ? 1 : 0)
+ (document.getElementById('gfPriceMin').value ? 1 : 0)
+ (document.getElementById('gfPriceMax').value ? 1 : 0);
const badge = document.getElementById('gfFiltersCount');
badge.textContent = n;
badge.style.display = n ? '' : 'none';
}
document.getElementById('gfFiltersBtn').addEventListener('click', () => {
const box = document.getElementById('gfFilters');
box.hidden = !box.hidden;
document.getElementById('gfFiltersBtn').setAttribute('aria-expanded', String(!box.hidden));
});
document.getElementById('gfFilters').addEventListener('input', gfFiltersCount);
document.getElementById('gfFilters').addEventListener('change', gfFiltersCount);

document.getElementById('screenGifts').addEventListener('click', (e) => {
const tab = e.target.closest('[data-gf-tab]');
if (tab){ setGiftsTab(tab.dataset.gfTab); return; }
const chip = e.target.closest('[data-gf-col]');
if (chip){ gfCollection = chip.dataset.gfCol; if (typeof dgArm === 'function') dgArm('gfGrid'); renderGiftChips(); renderGiftsGrid(); return; }
const tgLink = e.target.closest('[data-gf-tg]');
if (tgLink){ e.preventDefault(); if (tg && typeof tg.openTelegramLink === 'function') tg.openTelegramLink(tgLink.dataset.gfTg); else window.open(tgLink.dataset.gfTg, '_blank'); return; }
if (e.target.closest('#gfWantsBtn')){ openWants(); return; }
const gsTab = e.target.closest('[data-gs-to]');
if (gsTab){
gsTo = gsTab.dataset.gsTo;
document.querySelectorAll('#gsTo [data-gs-to]').forEach(b => b.classList.toggle('active', b === gsTab));
const u = document.getElementById('gsUsername');
u.hidden = gsTo !== 'friend';
if (gsTo === 'friend') u.focus();
return;
}
const stripCard = e.target.closest('[data-gs-strip]');
if (stripCard){
const it = gsItems.find(x => x.id === stripCard.dataset.gsStrip);
setGiftsTab('send');
if (it) openShopGift(it);
return;
}
if (e.target.closest('[data-gs-all]')){ setGiftsTab('send'); window.scrollTo(0, 0); return; }
const gsCard = e.target.closest('[data-gs-id]');
if (gsCard){ const it = gsItems.find(x => x.id === gsCard.dataset.gsId); if (it) openShopGift(it); return; }
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
if (!ok){
if (!(typeof offerPlans === 'function' && offerPlans(data))) showToast(gfError(data.error));
if (typeof haptic === 'function') haptic('error');
return;
}
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
