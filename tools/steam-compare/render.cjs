// Рендер скинов для сверки со Steam: открывает мини-апп в безголовом
// Chromium и для каждой записи из jobs.json сохраняет кадр 3D без фона
// (render3DGif(..., 'transparent')) в out/ours/<slug>.png.
//
//   node render.cjs <адрес мини-аппа> <jobs.json> <папка out>
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const [base, jobsFile, outDir] = process.argv.slice(2);
const jobs = JSON.parse(fs.readFileSync(jobsFile, 'utf8'));
const oursDir = path.join(outDir, 'ours');
fs.mkdirSync(oursDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 420, height: 800 } });
  page.on('pageerror', e => console.log('  ошибка страницы:', e.message));
  // Для проверки без интернета: three.js из локальной папки (THREE_LOCAL=…/three/package).
  if (process.env.THREE_LOCAL){
    await page.route('https://cdn.jsdelivr.net/npm/three@*/**', route => {
      const rel = route.request().url().replace(/^.*?three@[^/]+\//, '').split('?')[0];
      const file = path.join(process.env.THREE_LOCAL, rel);
      return fs.existsSync(file) ? route.fulfill({ path: file, contentType: 'application/javascript' }) : route.abort();
    });
  }
  if (process.env.TPL_SCALE){
    await page.addInitScript(k => { window.DGHOST_TPL_SCALE = Number(k); }, process.env.TPL_SCALE);
  }
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForTimeout(3000);

  let ok = 0, failed = 0;
  for (const [i, job] of jobs.entries()){
    const started = Date.now();
    const result = await Promise.race([
      page.evaluate(async ([entry, wear, seed]) => {
        try {
          const bytes = await render3DGif(entry, wear, '', null, seed, 'transparent');
          return { b64: bytesToBase64(bytes) };
        } catch (e) {
          return { error: String(e && e.message || e) };
        }
      }, [job.entry, job.wear ?? 0.05, job.seed ?? null]),
      new Promise(resolve => setTimeout(() => resolve({ error: 'таймаут 90 с' }), 90000)),
    ]);
    if (result.b64){
      fs.writeFileSync(path.join(oursDir, job.slug + '.png'), Buffer.from(result.b64, 'base64'));
      ok++;
    } else {
      failed++;
      console.log(`  ✗ ${job.name}: ${result.error}`);
    }
    if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${jobs.length} (${((Date.now() - started) / 1000).toFixed(1)} с на последний)`);
  }
  console.log(`Отрендерено: ${ok}, не вышло: ${failed}`);
  await browser.close();
})();
