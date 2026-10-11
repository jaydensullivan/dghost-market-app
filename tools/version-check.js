#!/usr/bin/env node
// Проверка кэша: если PR меняет app-*.js или app.css, номер ?v= этого
// файла в index.html должен стать больше, чем в базовой ветке. Иначе
// Telegram на телефонах держит старый файл из кэша, а новая разметка
// оказывается без своих стилей и кода (так сломался шаблон лота в #110).
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
let baseHtml = '';
try { baseHtml = git('show', `${base}:index.html`); } catch (e) {}
const before = versions(baseHtml);
const after = versions(git('show', 'HEAD:index.html'));
const bad = [];
for (const f of assets){
  if (!(f in after)){ bad.push(`${f}: нет ?v= в index.html`); continue; }
  if (f in before && after[f] <= before[f]) bad.push(`${f}: ?v=${after[f]} — подними выше ${before[f]}`);
}
if (bad.length){
  console.log('❌ Поднимите версию изменённых файлов в index.html (иначе у пользователей останется старый кэш):');
  bad.forEach(b => console.log('  - ' + b));
  process.exit(1);
}
console.log('✅ Версии подняты: ' + assets.map(f => `${f}?v=${after[f]}`).join(', '));
