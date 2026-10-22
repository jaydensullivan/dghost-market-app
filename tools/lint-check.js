#!/usr/bin/env node
// Проверка кода мини-аппа: вызовы несуществующих функций и переменных,
// повторные ключи в объектах, недостижимый код. Все app-*.js работают в
// одном глобальном пространстве страницы, поэтому проверяем их вместе:
// склеиваем в порядке index.html (плюс лениво грузящиеся 3D и админку
// и app-embed.js) и запускаем eslint. Ошибки печатаются как файл:строка.
//
//   node tools/lint-check.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const files = [];
const add = f => { if (!files.includes(f) && fs.existsSync(path.join(ROOT, f))) files.push(f); };
for (const m of html.matchAll(/<script src="(app-[a-z0-9-]+\.js)/g)) add(m[1]);
for (const m of html.matchAll(/window\.DG_[A-Z0-9_]+_SRC = '(app-[a-z0-9-]+\.js)/g)) add(m[1]);
add('app-embed.js');

// Глобальные имена браузера и подключаемых библиотек.
const GLOBALS = `window document navigator location localStorage sessionStorage fetch console
setTimeout clearTimeout setInterval clearInterval requestAnimationFrame cancelAnimationFrame
URL URLSearchParams Image Blob File FileReader FormData performance getComputedStyle matchMedia
history screen alert confirm Intl IntersectionObserver ResizeObserver MutationObserver
AbortController TextEncoder TextDecoder crypto atob btoa CustomEvent Event HTMLElement
DeviceOrientationEvent createImageBitmap OffscreenCanvas Worker Audio AudioContext innerWidth
innerHeight scrollY scrollTo open self queueMicrotask structuredClone ImageData DOMParser
XMLHttpRequest Response Request Headers devicePixelRatio visualViewport Node Element
KeyboardEvent MouseEvent TouchEvent PointerEvent DataTransfer ClipboardItem Notification
HTMLCanvasElement HTMLImageElement HTMLVideoElement globalThis Promise ImageBitmap Path2D
DOMRect DOMMatrix CSS getSelection NodeFilter MediaRecorder THREE Telegram YT`.split(/\s+/);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dg-lint-'));
const map = [];
let out = '';
for (const f of files){
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const start = out.split('\n').length;
  out += src + '\n';
  map.push({ file: f, start, lines: src.split('\n').length });
}
fs.writeFileSync(path.join(tmp, 'all.js'), out);
fs.writeFileSync(path.join(tmp, 'eslint.config.mjs'), `export default [{
  files: ['all.js'],
  languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: ${JSON.stringify(Object.fromEntries(GLOBALS.map(g => [g, 'readonly'])))} },
  rules: { 'no-undef': ['error', { typeof: false }], 'no-dupe-keys': 'error', 'no-unreachable': 'error',
    'no-self-assign': 'error', 'no-dupe-else-if': 'error', 'no-const-assign': 'error',
    'use-isnan': 'error', 'valid-typeof': 'error', 'no-redeclare': 'error' },
}];`);

let report;
try {
  report = execFileSync('npx', ['--yes', 'eslint@9.15.0', '-f', 'json', 'all.js'], { cwd: tmp, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20 });
} catch (e) {
  report = e.stdout;
  if (!report){ console.error('eslint не запустился:', e.message); process.exit(2); }
}
const msgs = JSON.parse(report)[0].messages;
const where = line => { const m = map.find(x => line >= x.start && line < x.start + x.lines); return m ? `${m.file}:${line - m.start + 1}` : `?:${line}`; };
// Вызов, защищённый проверкой «typeof X === 'function'» в той же строке, — не ошибка:
// так вызываются функции из файлов, которые грузятся позже.
const srcLines = out.split('\n');
const real = msgs.filter(m => !(m.ruleId === 'no-undef' && /typeof\s+([A-Za-z_$][\w$]*)/.test(srcLines[m.line - 1] || '')
  && srcLines[m.line - 1].includes('typeof ' + (m.message.match(/'([^']+)'/) || [])[1])));
console.log(`# Проверка кода мини-аппа (${files.length} файлов)`);
for (const m of real) console.log(`${where(m.line)}  ${m.ruleId}: ${m.message}`);
fs.rmSync(tmp, { recursive: true, force: true });
if (real.length){ console.log(`\n❌ Ошибок: ${real.length}`); process.exit(1); }
console.log('✅ Ошибок нет');
