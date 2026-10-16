#!/usr/bin/env node
// Проверка кэша: если PR меняет app-*.js или app.css, номер ?v= этого
// файла в index.html должен стать больше, чем в базовой ветке. Иначе
// Telegram на телефонах держит старый файл из кэша, а новая разметка
// оказывается без своих стилей и кода (так сломался шаблон лота в #110).
// Версии смотрим в index.html и embed.html (3D-виджет).
// Запуск: node tools/version-check.js <base-ref>   (например origin/main)
'use strict';
const { execFileSync } = require('child_process');
const base = process.argv[2] || 'origin/main';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const changed = git('diff', '--name-only', `${base}...HEAD`).split('\n').filter(Boolean);
const assets = changed.filter(f => /^app[-\w]*\.(js|css)$/.test(f));
if (!assets.length){ console.log('Ресурсы мини-аппа не менялись.'); process.exit(0); }
const versions = html => {
  const map = {};
  for (const m of html.matchAll(/(app[-\w]*\.(?:js|css))\?v=(\d+)/g)) map[m[1]] = Number(m[2]);
  return map;
};
// Страницы со своими <script>: мини-апп и 3D-виджет (embed.html).
const PAGES = ['index.html', 'embed.html'];
const show = (ref, file) => { try { return execFileSync('git', ['show', `${ref}:${file}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { return ''; } };
const merged = ref => Object.assign({}, ...PAGES.map(f => versions(show(ref, f))).reverse());
const before = merged(base);
const after = merged('HEAD');
const bad = [];
// Общие файлы (app-3d.js, app.css…) виджет должен грузить с той же
// версией, что и мини-апп, — иначе на чужих сайтах останется старый код.
const mainV = versions(show('HEAD', 'index.html'));
const embedV = versions(show('HEAD', 'embed.html'));
for (const f of Object.keys(embedV)){
  if (f in mainV && embedV[f] !== mainV[f]) bad.push(`${f}: в embed.html ?v=${embedV[f]}, а в index.html ?v=${mainV[f]} — сделай одинаковыми`);
}
for (const f of assets){
  if (!(f in after)){ bad.push(`${f}: нет ?v= ни в index.html, ни в embed.html`); continue; }
  if (f in before && after[f] <= before[f]) bad.push(`${f}: ?v=${after[f]} — подними выше ${before[f]}`);
}
if (bad.length){
  console.log('❌ Поднимите версию изменённых файлов в index.html (иначе у пользователей останется старый кэш):');
  bad.forEach(b => console.log('  - ' + b));
  process.exit(1);
}
console.log('✅ Версии подняты: ' + assets.map(f => `${f}?v=${after[f]}`).join(', '));
