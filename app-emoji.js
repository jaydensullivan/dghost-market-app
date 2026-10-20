// ============================================================
// ЭМОДЗИ → ЗНАЧКИ
//
// В текстах интерфейса (переводы, разметка, ответы бота) много эмодзи:
// ✅ ⚠️ 🔒 🎁 … На разных телефонах они выглядят по-разному и не
// совпадают со стилем мини-аппа. Здесь эмодзи в тексте страницы
// подменяются объёмными значками gi-* из спрайта в index.html.
// Сами строки переводов не меняются: в уведомлениях Telegram, в
// сообщениях бота и при «Поделиться» эмодзи остаются эмодзи.
// ★ (звезда в названиях ножей и перчаток) не трогаем — это часть
// названия предмета.
// ============================================================

(function(){
if (!document.getElementById('giSprite')) return;

const EMOJI_ICON = {
'✅': 'check', '✔': 'check', '✓': 'check', '☑': 'check',
'❌': 'close', '✖': 'close', '✕': 'x', '🚫': 'close', '⛔': 'close',
'⚠': 'warning', '❗': 'warning', '‼': 'warning',
'⭐': 'star', '🌟': 'star', '🏆': 'trophy', '👑': 'trophy', '🥇': 'trophy', '🏅': 'trophy',
'🎁': 'gift', '🎉': 'sparkle', '🎊': 'sparkle', '✨': 'sparkle', '💎': 'sparkle',
'📢': 'megaphone', '📣': 'megaphone',
'🎞': 'image', '🎬': 'image', '📸': 'image', '📷': 'image', '🖼': 'image', '🎥': 'image',
'👥': 'people', '👤': 'user', '🧑': 'user',
'⏱': 'history', '⏳': 'history', '⌛': 'history', '🕒': 'history', '📅': 'history', '🗓': 'history', '⏰': 'history',
'🔒': 'lock', '🔐': 'lock', '🔑': 'lock',
'⚡': 'bolt', '🚀': 'bolt',
'🔨': 'gavel', '⚖': 'gavel',
'🔗': 'link', '📎': 'link',
'🔄': 'deals', '🔁': 'deals', '♻': 'refresh', '🔃': 'refresh',
'📨': 'mail', '📩': 'mail', '✉': 'mail', '📤': 'mail', '📥': 'mail', '📬': 'mail', '💬': 'help',
'🔍': 'search', '🔎': 'search', '👀': 'eye', '👁': 'eye',
'🖐': 'hand', '✋': 'hand', '🤝': 'deals',
'📱': 'phone', '📲': 'phone',
'🪪': 'idcard', '🆔': 'idcard',
'🏷': 'tag', '🎟': 'tag', '🎫': 'tag',
'💳': 'card', '🏦': 'card', '💰': 'coins', '💵': 'coins', '💸': 'coins', '🪙': 'coins',
'⚙': 'gear', '🛠': 'gear', '🔧': 'gear',
'🎯': 'target', '📊': 'chart', '📈': 'chart', '📉': 'chart',
'📜': 'doc', '📄': 'doc', '📝': 'doc', '📋': 'doc', '📑': 'doc',
'🔥': 'fire', '🛡': 'shield', '🛒': 'cart', '🎒': 'cart', '🗑': 'trash',
'❤': 'heart', '💖': 'heart', '💜': 'heart', '🔔': 'bell', '🆘': 'help', '❓': 'help', 'ℹ': 'help',
'🧊': 'cube', '📦': 'cube', '🌐': 'globe', '🎨': 'palette', '🎮': 'target',
'💾': 'check', '🏁': 'trophy', '⏹': 'close', '🔀': 'deals', '↻': 'refresh', '🤳': 'phone',
};

const keys = Object.keys(EMOJI_ICON).sort((a, b) => b.length - a.length);
// Эмодзи + необязательный селектор варианта (U+FE0F) и пробел за ним не трогаем.
const RE = new RegExp('(' + keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')️?', 'g');
const SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, OPTION: 1, SELECT: 1, CODE: 1, PRE: 1, svg: 1, title: 1 };

function iconNode(name){
const ns = 'http://www.w3.org/2000/svg';
const svg = document.createElementNS(ns, 'svg');
svg.setAttribute('class', 'gi gi-inline');
svg.setAttribute('aria-hidden', 'true');
const use = document.createElementNS(ns, 'use');
use.setAttribute('href', '#gi-' + name);
svg.appendChild(use);
return svg;
}

function replaceInTextNode(node){
const text = node.nodeValue;
RE.lastIndex = 0;
if (!RE.test(text)) return;
RE.lastIndex = 0;
const frag = document.createDocumentFragment();
let last = 0, m;
while ((m = RE.exec(text))){
if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
frag.appendChild(iconNode(EMOJI_ICON[m[1]]));
last = m.index + m[0].length;
}
if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
node.parentNode.replaceChild(frag, node);
}

function scan(root){
if (!root) return;
if (root.nodeType === 3){
if (root.parentNode && !SKIP[root.parentNode.nodeName] && !(root.parentNode.closest && root.parentNode.closest('[data-no-gi]'))) replaceInTextNode(root);
return;
}
if (root.nodeType !== 1 || SKIP[root.nodeName] || (root.closest && root.closest('[data-no-gi]'))) return;
const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
acceptNode(n){
const p = n.parentNode;
if (!p || SKIP[p.nodeName] || (p.closest && (p.closest('[data-no-gi]') || p.closest('svg')))) return NodeFilter.FILTER_REJECT;
return NodeFilter.FILTER_ACCEPT;
}
});
const nodes = [];
while (walker.nextNode()) nodes.push(walker.currentNode);
nodes.forEach(replaceInTextNode);
}

// Изменения DOM собираем и обрабатываем раз в кадр.
let pending = new Set();
let scheduled = false;
function flush(){
scheduled = false;
const list = Array.from(pending);
pending = new Set();
list.forEach(n => { if (n.isConnected) scan(n); });
}
const observer = new MutationObserver(records => {
records.forEach(r => {
if (r.type === 'characterData') pending.add(r.target);
else r.addedNodes.forEach(n => pending.add(n));
});
if (!scheduled && pending.size){ scheduled = true; requestAnimationFrame(flush); }
});

function start(){
scan(document.body);
observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
})();
