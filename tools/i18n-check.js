#!/usr/bin/env node
// Проверка словарей мини-аппа (app-i18n.js): RU — эталон, UZ и EN
// должны его повторять. Запуск: node tools/i18n-check.js [--json]
// Ничего не меняет — только печатает отчёт. Нужен Переводчику-корректору
// (еженедельная рутина) и для ручной проверки перед PR.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SRC_FILE = path.join(ROOT, 'app-i18n.js');
const src = fs.readFileSync(SRC_FILE, 'utf8');

// Берём только литерал словаря: остальной файл трогает DOM.
const start = src.indexOf('const I18N = {');
const end = src.indexOf('\n};', start);
if (start < 0 || end < 0) throw new Error('I18N не найден в app-i18n.js');
const literal = src.slice(start, end + 3);
const I18N = vm.runInNewContext(literal + '\nI18N;');
const LANGS = Object.keys(I18N);
const BASE = 'ru';

// Строка исходника для ключа в словаре языка — чтобы в отчёте была ссылка.
const blockStart = {};
for (const lang of LANGS) blockStart[lang] = src.indexOf('\n' + lang + ': {', start);
function lineOf(lang, key){
  const from = blockStart[lang];
  const re = new RegExp('\\n\\s*["\']?' + key + '["\']?\\s*:', 'g');
  re.lastIndex = from;
  const m = re.exec(src);
  return m ? src.slice(0, m.index + 1).split('\n').length : null;
}

// Ключ, повторённый внутри одного словаря: JS молча берёт последний.
function duplicates(lang){
  const from = blockStart[lang];
  const nextStarts = LANGS.map(l => blockStart[l]).filter(p => p > from);
  const to = nextStarts.length ? Math.min(...nextStarts) : start + literal.length;
  const seen = new Map(); const dup = [];
  const re = /^\s*["']?([A-Za-z0-9_]+)["']?\s*:/gm;
  const block = src.slice(from, to);
  let m;
  while ((m = re.exec(block))){
    const key = m[1];
    if (key === lang) continue;
    if (seen.has(key)) dup.push(key); else seen.set(key, true);
  }
  return dup;
}

const CYR = /[А-Яа-яЁё]/;
// Подстановки: {fee}, {n}, %s, ${x}.
function placeholders(s){
  return (String(s).match(/\{[a-z0-9_]+\}|%[sd]|\$\{[^}]+\}/gi) || []).sort().join(' ');
}
// Не перевод, а одинаковое во всех языках: бренды, числа, эмодзи, коды.
function languageNeutral(s){
  const t = String(s).replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}️]/gu, '').trim();
  if (!t) return true;
  if (!/[A-Za-zА-Яа-яЁё]/.test(t)) return true;
  return /^(Steam|CS2|USDT|TON|BTC|UZS|USD|FN|MW|FT|WW|BS|StatTrak™?|Souvenir|Telegram|OK|ID|P2P|Click|Payme|Uzcard|Humo|Visa|Mastercard|DGhostMarket|3D|GIF|URL|Trade URL|E-mail|Email|PIN|API|FAQ)$/i.test(t);
}

// Ключи, которые использует код: data-i18n в HTML и шаблонах JS, dict.key.
function usedKeys(){
  const used = new Map();
  const add = (key, file) => { if (!used.has(key)) used.set(key, new Set()); used.get(key).add(file); };
  const files = fs.readdirSync(ROOT).filter(f => /^(index\.html|app.*\.js)$/.test(f));
  for (const f of files){
    const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const m of text.matchAll(/data-i18n(?:-placeholder)?=["']([A-Za-z0-9_]+)["']/g)) add(m[1], f);
    for (const m of text.matchAll(/\b(?:dict|I18N\[[^\]]+\]|\(I18N\[currentLang\] \|\| I18N\.ru\))\.([A-Za-z0-9_]+)/g)) add(m[1], f);
  }
  return used;
}

// Русский текст, зашитый прямо в JS (мимо словаря): в UZ/EN останется русским.
function hardcodedRussian(){
  const out = [];
  const files = fs.readdirSync(ROOT).filter(f => /^app.*\.js$/.test(f) && f !== 'app-admin.js'); // админка только на русском
  for (const f of files){
    const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const lines = text.split('\n');
    const from = f === 'app-i18n.js' ? src.slice(0, end).split('\n').length : 0;
    // Словарь вида NAME_RU = { … } с парными NAME_UZ и NAME_EN — переведён.
    let inPairedRu = false;
    lines.forEach((line, i) => {
      const open = line.match(/^const ([A-Z0-9_]+)_RU = \{/);
      if (open) inPairedRu = text.includes(open[1] + '_UZ') && text.includes(open[1] + '_EN');
      if (inPairedRu){ if (/^\};?\s*$/.test(line)) inPairedRu = false; return; }
      if (i < from) return;
      const code = line.replace(/\/\/.*$/, '');
      if (/^\s*\*|^\s*\/\*/.test(line)) return;
      // Сообщения в консоль видит только разработчик.
      if (/\bconsole\.(log|warn|error|info)\(/.test(code)) return;
      const lits = code.match(/(['"`])(?:\\.|(?!\1).)*\1/g) || [];
      if (lits.some(l => CYR.test(l))) out.push({ file: f, line: i + 1, text: line.trim().slice(0, 140) });
    });
  }
  return out;
}

const report = { languages: LANGS, counts: {}, missing: {}, extra: {}, cyrillic: {}, same_as_ru: {}, placeholders: {}, empty: {}, duplicates: {}, unused: [], undefined_keys: [], hardcoded_ru: [] };
const base = I18N[BASE];
for (const lang of LANGS){
  const dict = I18N[lang];
  report.counts[lang] = Object.keys(dict).length;
  report.duplicates[lang] = duplicates(lang);
  report.empty[lang] = Object.keys(dict).filter(k => !String(dict[k]).trim());
  if (lang === BASE) continue;
  report.missing[lang] = Object.keys(base).filter(k => !(k in dict));
  report.extra[lang] = Object.keys(dict).filter(k => !(k in base));
  report.cyrillic[lang] = Object.keys(dict).filter(k => CYR.test(dict[k])).map(k => ({ key: k, line: lineOf(lang, k), text: dict[k] }));
  report.same_as_ru[lang] = Object.keys(dict).filter(k => k in base && dict[k] === base[k] && CYR.test(base[k]) && !languageNeutral(dict[k])).map(k => ({ key: k, line: lineOf(lang, k), text: dict[k] }));
  report.placeholders[lang] = Object.keys(dict).filter(k => k in base && placeholders(dict[k]) !== placeholders(base[k])).map(k => ({ key: k, line: lineOf(lang, k), ru: placeholders(base[k]), [lang]: placeholders(dict[k]) }));
}
// Словари сообщений в JS вида NAME_RU / NAME_UZ / NAME_EN: ключи должны совпадать.
report.paired_maps = [];
for (const f of fs.readdirSync(ROOT).filter(f => /^app.*\.js$/.test(f))){
  const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of text.matchAll(/^const ([A-Z0-9_]+)_RU = \{/gm)){
    const keysOf = lang => {
      const at = text.indexOf(`const ${m[1]}_${lang} = {`);
      if (at < 0) return null;
      const body = text.slice(at, text.indexOf('\n};', at));
      return new Set([...body.matchAll(/^\s*['"]?([A-Za-z0-9_ -]+?)['"]?\s*:/gm)].map(x => x[1]).filter(k => !k.startsWith('const ')));
    };
    const ru = keysOf('RU');
    for (const lang of ['UZ', 'EN']){
      const other = keysOf(lang);
      if (!other) { report.paired_maps.push({ file: f, map: m[1], lang, missing: ['(нет словаря ' + m[1] + '_' + lang + ')'] }); continue; }
      const missing = [...ru].filter(k => !other.has(k));
      if (missing.length) report.paired_maps.push({ file: f, map: m[1], lang, missing });
    }
  }
}
const used = usedKeys();
report.undefined_keys = [...used.keys()].filter(k => !(k in base)).map(k => ({ key: k, files: [...used.get(k)] }));
report.hardcoded_ru = hardcodedRussian();

if (process.argv.includes('--json')){
  process.stdout.write(JSON.stringify(report, null, 1) + '\n');
  process.exit(0);
}

const out = [];
const list = (title, items, fmt) => {
  if (!items.length) return;
  out.push(`\n## ${title} (${items.length})`);
  for (const x of items.slice(0, 60)) out.push('- ' + fmt(x));
  if (items.length > 60) out.push(`- … и ещё ${items.length - 60}`);
};
out.push('# Проверка словарей app-i18n.js');
out.push('Ключей: ' + LANGS.map(l => `${l.toUpperCase()} ${report.counts[l]}`).join(', '));
for (const lang of LANGS.filter(l => l !== BASE)){
  const L = lang.toUpperCase();
  list(`${L}: нет перевода (ключ есть только в RU)`, report.missing[lang], k => `\`${k}\` — RU: ${base[k]}`);
  list(`${L}: лишние ключи (нет в RU)`, report.extra[lang], k => `\`${k}\``);
  list(`${L}: кириллица в тексте`, report.cyrillic[lang], x => `\`${x.key}\` (стр. ${x.line}): ${x.text}`);
  list(`${L}: совпадает с RU — похоже, не переведено`, report.same_as_ru[lang], x => `\`${x.key}\` (стр. ${x.line}): ${x.text}`);
  list(`${L}: подстановки не совпадают с RU`, report.placeholders[lang], x => `\`${x.key}\` (стр. ${x.line}): RU «${x.ru}», ${L} «${x[lang]}»`);
}
for (const lang of LANGS){
  list(`${lang.toUpperCase()}: ключ повторяется (действует последний)`, report.duplicates[lang], k => `\`${k}\``);
  list(`${lang.toUpperCase()}: пустой текст`, report.empty[lang], k => `\`${k}\``);
}
list('Словари сообщений в JS: нет перевода ключей', report.paired_maps, x => `${x.file} ${x.map}_${x.lang}: ${x.missing.join(', ')}`);
list('Код использует ключ, которого нет в словаре', report.undefined_keys, x => `\`${x.key}\` — ${x.files.join(', ')}`);
list('Русский текст в JS мимо словаря (в UZ/EN останется русским)', report.hardcoded_ru, x => `${x.file}:${x.line} — ${x.text}`);
process.stdout.write(out.join('\n') + '\n');
