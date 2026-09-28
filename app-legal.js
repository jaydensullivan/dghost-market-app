// ============================================================
// ПРАВИЛА И ОФЕРТЫ
//
// Тексты приходят с сервера (/api/agreement → docs): комиссии и
// сроки там подставлены из текущих настроек, поэтому здесь их не
// дублируем. Одно окно на всё — просмотр любого документа из меню,
// из окна оплаты и с экрана соглашения, а в режиме оферты продавца
// снизу появляются чекбокс и кнопка «Принять».
// ============================================================

let legalDocs = null;
let legalDocsPromise = null;
let legalOnAccept = null;

function loadLegalDocs(){
if (legalDocs) return Promise.resolve(legalDocs);
if (!legalDocsPromise){
legalDocsPromise = fetch(API_BASE + '/api/agreement')
.then(r => r.json())
.then(data => {
if (!data.docs) throw new Error('no docs');
legalDocs = data.docs;
return legalDocs;
})
.catch(err => {
legalDocsPromise = null;
throw err;
});
}
return legalDocsPromise;
}

function showLegalDoc(key){
const dict = I18N[currentLang] || I18N.ru;
const box = document.getElementById('legalText');
document.querySelectorAll('#legalTabs [data-legal-tab]').forEach(b => {
b.classList.toggle('active', b.dataset.legalTab === key);
});
box.textContent = dict.loading || 'Загрузка...';
loadLegalDocs()
.then(docs => {
const doc = docs[key] || docs.terms;
box.textContent = (currentLang !== 'ru' ? dict.legal_ru_only + '\n\n' : '') + doc.text;
box.scrollTop = 0;
})
.catch(() => {
box.textContent = dict.legal_load_failed;
});
}

function openLegal(key, onAccept){
const overlay = document.getElementById('legalOverlay');
legalOnAccept = onAccept || null;
const accept = document.getElementById('legalAccept');
const check = document.getElementById('legalAcceptCheck');
const btn = document.getElementById('legalAcceptBtn');
accept.style.display = legalOnAccept ? '' : 'none';
// Пока принимают оферту, переключаться на другие документы незачем.
document.getElementById('legalTabs').style.visibility = legalOnAccept ? 'hidden' : '';
check.checked = false;
btn.disabled = true;
document.getElementById('legalAcceptStatus').textContent = '';
if (legalOnAccept){
const dict = I18N[currentLang] || I18N.ru;
const fee = (typeof saleFeePercent !== 'undefined' && saleFeePercent !== null) ? saleFeePercent : '—';
document.getElementById('legalAcceptLabel').textContent = dict.legal_seller_accept_label.replace('{fee}', fee);
}
showLegalDoc(key);
overlay.classList.add('show');
}

function closeLegal(){
document.getElementById('legalOverlay').classList.remove('show');
legalOnAccept = null;
}

// Оферта продавца перед первым лотом. onDone вызывается после того,
// как сервер записал принятие.
function openSellerOffer(onDone){
openLegal('seller', onDone);
}

document.getElementById('legalCloseBtn').addEventListener('click', closeLegal);

document.getElementById('legalOverlay').addEventListener('click', (e) => {
if (e.target.id === 'legalOverlay') closeLegal();
});

document.getElementById('legalTabs').addEventListener('click', (e) => {
const b = e.target.closest('[data-legal-tab]');
if (b) showLegalDoc(b.dataset.legalTab);
});

document.getElementById('legalAcceptCheck').addEventListener('change', (e) => {
document.getElementById('legalAcceptBtn').disabled = !e.target.checked;
});

document.getElementById('legalAcceptBtn').addEventListener('click', () => {
if (!tg || !tg.initData) return;
const dict = I18N[currentLang] || I18N.ru;
const btn = document.getElementById('legalAcceptBtn');
const status = document.getElementById('legalAcceptStatus');
const done = legalOnAccept;
btn.disabled = true;
status.textContent = dict.agreement_saving;
fetch(API_BASE + '/api/offer/seller/accept', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData })
})
.then(async r => {
if (!r.ok){
const data = await r.json().catch(() => ({}));
throw new Error(errorMessage(data.error));
}
return r.json();
})
.then(() => {
sellerOfferAccepted = true;
closeLegal();
if (done) done();
})
.catch(err => {
status.textContent = friendlyErrorMessage(err);
btn.disabled = false;
});
});

// Ссылки на документы в любом месте интерфейса.
document.addEventListener('click', (e) => {
const a = e.target.closest('[data-legal-doc]');
if (!a) return;
e.preventDefault();
openLegal(a.dataset.legalDoc);
});
