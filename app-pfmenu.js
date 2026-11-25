// Меню профиля: карточки сгруппированы в строки-аккордеон (index.html, #pfMenu).
// Открыта одна строка, остальные закрываются — как способы оплаты в пополнении.
// Справа у строки короткая подсказка: Stars за друзей, защита, статус продавца,
// язык и тема. Подсказки берём из уже отрисованных карточек, сами данные
// не запрашиваем.
(function(){
const menu = document.getElementById('pfMenu');
if (!menu) return;
const items = [...menu.querySelectorAll('.pf-acc[data-pfacc]')];
const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function pfmSetOpen(target){
items.forEach(it => {
const open = it === target;
it.classList.toggle('open', open);
it.querySelector('.pf-acc-hd').setAttribute('aria-expanded', open ? 'true' : 'false');
});
if (!target) return;
// Если раскрытая строка уходит за низ экрана — плавно подкручиваем к ней.
setTimeout(() => {
const r = target.getBoundingClientRect();
const bottom = window.innerHeight - 90;
if (r.bottom > bottom && r.top > 70){
window.scrollBy({ top: Math.min(r.bottom - bottom, r.top - 70), behavior: reduce ? 'auto' : 'smooth' });
}
}, reduce ? 0 : 380);
}

menu.addEventListener('click', (e) => {
const hd = e.target.closest('.pf-acc-hd');
if (!hd || hd.id === 'openWantsBtn') return;
const it = hd.closest('.pf-acc');
if (typeof haptic === 'function') haptic('select');
pfmSetOpen(it.classList.contains('open') ? null : it);
});

// ---------- подсказки справа ----------
const $ = id => document.getElementById(id);
const shown = el => !!el && !el.hidden && el.style.display !== 'none';

function pfmHints(){
const dict = I18N[currentLang] || I18N.ru;
const hints = {};
const starBox = $('starRefBox'), starVal = $('starRefValue'), wallet = $('referralWalletValue');
if (shown(starBox) && starVal && starVal.textContent !== '—') hints.ref = '⭐ ' + starVal.textContent;
// Денежный кошелёк — только если он показан (рефералка со Stars прячет его).
else if (wallet && wallet.textContent !== '—' && shown(wallet.closest('.pf-wallet'))) hints.ref = wallet.textContent;
const totp = $('totpSummaryStatus');
hints.sec = totp && totp.classList.contains('ok')
? '<span class="pf-acc-ok">🔒 ' + (dict.pfm_sec_on || '') + '</span>'
: '<span class="pf-acc-dot"></span>' + (dict.pfm_sec_off || '');
if (shown($('sellerStatusVerified')) || shown($('profileVerified'))) hints.seller = '<span class="pf-acc-ok">' + (dict.pfm_seller_verified || '✓') + '</span>';
else if (shown($('sellerStatusPending'))) hints.seller = '⏳';
const theme = document.querySelector('#themeSwitch .theme-btn.active');
hints.set = String(currentLang || 'ru').toUpperCase() + (theme ? ' · ' + theme.textContent.trim() : '');
items.forEach(it => {
const key = it.dataset.pfacc;
const el = $('pfmHint_' + key);
const html = hints[key] || '';
if (el && el.innerHTML !== html) el.innerHTML = html;
});
// Строка без видимых карточек (у проверенного покупателя нечего показать продавцу) — прячем.
items.forEach(it => {
const cards = [...it.querySelector('.pf-acc-in').children];
const empty = cards.length > 0 && !cards.some(c => !c.hidden && c.style.display !== 'none');
if (it.hidden !== empty){
it.hidden = empty;
if (empty && it.classList.contains('open')) pfmSetOpen(null);
}
});
}

let pfmQueued = false;
function pfmQueue(){
if (pfmQueued) return;
pfmQueued = true;
requestAnimationFrame(() => { pfmQueued = false; pfmHints(); });
}
// Карточки обновляют сами себя (рефералы, 2FA, KYC, PRO); следим и пересчитываем.
new MutationObserver(pfmQueue).observe(menu, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style', 'hidden', 'class'] });
const verified = $('profileVerified');
if (verified) new MutationObserver(pfmQueue).observe(verified, { attributes: true, attributeFilter: ['style'] });
pfmQueue();
})();
