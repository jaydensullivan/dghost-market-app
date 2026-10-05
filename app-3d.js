// ============================================================
// 3D-РЕНДЕР СКИНОВ — ЭТАП 1: ПРОВЕРКА УСТРОЙСТВА
//
// Прежде чем грузить модели CS2 в мини-апп, нужно понять, что
// устройство вообще потянет: на слабых телефонах three.js даст
// 10 fps и всё будет хуже, чем с обычной картинкой. Здесь —
// сбор характеристик, короткий тест кадров и сохранение режима
// (full / light / off), на который потом будут опираться
// следующие этапы.
//
// three.js подгружается только в момент теста, поэтому обычным
// пользователям он ничего не стоит.
// ============================================================

// three.js грузим современной версии (модулем): r128 не понимает
// часть возможностей glTF, которые использует экспорт из CS2 —
// файл при этом валидный и в сторонних просмотрщиках открывается.
// Если модули почему-то не заведутся (старый WebView), откатываемся
// на классическую сборку r128 — лучше хоть что-то, чем ничего.
const THREE_VERSION = '0.160.0';
const THREE_ESM = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js`;
const THREE_ADDONS = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/examples/jsm/`;
const THREE_LEGACY = 'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js';
const THREE_LEGACY_GLTF = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js';
const D3_MODE_KEY = 'dg3d_mode';
const APP3D_VERSION = 36;

let threeLoading = null;

function loadScript(src){
return new Promise((resolve, reject) => {
const tag = document.createElement('script');
tag.src = src;
tag.onload = resolve;
tag.onerror = () => reject(new Error('не загрузился ' + src));
document.head.appendChild(tag);
});
}

// import() из обычного скрипта — через new Function, чтобы старые
// парсеры не спотыкались на синтаксисе.
const dynamicImport = new Function('u', 'return import(u);');

function loadThreeModern(){
// Карта импортов нужна, потому что GLTFLoader внутри пишет
// import ... from 'three' — без неё браузер не поймёт, откуда брать.
if (!document.getElementById('threeImportMap')){
const map = document.createElement('script');
map.type = 'importmap';
map.id = 'threeImportMap';
map.textContent = JSON.stringify({
imports: { 'three': THREE_ESM, 'three/addons/': THREE_ADDONS }
});
document.head.appendChild(map);
}

return Promise.all([
dynamicImport('three'),
dynamicImport(THREE_ADDONS + 'loaders/GLTFLoader.js'),
]).then(([three, gltf]) => {
// Объект модуля доступен только для чтения — дописать в него
// GLTFLoader нельзя, присваивание молча роняло всю загрузку.
// Поэтому копируем экспорты в обычный объект.
window.THREE = Object.assign({}, three, { GLTFLoader: gltf.GLTFLoader });
console.log('3D: three.js', three.REVISION);
return window.THREE;
});
}

function loadThreeLegacy(){
return loadScript(THREE_LEGACY)
.then(() => loadScript(THREE_LEGACY_GLTF))
.then(() => {
console.warn('3D: откат на three.js r128');
return window.THREE;
});
}

function load3DLibrary(){
if (window.THREE) return Promise.resolve(window.THREE);
if (threeLoading) return threeLoading;
threeLoading = loadThreeModern().catch(err => {
console.warn('3D: современная three.js не загрузилась —', err);
return loadThreeLegacy();
});
return threeLoading;
}

// Загрузчик .glb теперь приезжает вместе с библиотекой.
function loadGltfLoader(){
return load3DLibrary().then(() => {
if (!window.THREE){
throw new Error('three.js не загрузилась');
}
if (!window.THREE.GLTFLoader){
// Библиотека есть, а загрузчика нет — такое бывает при откате
// на старую сборку: дотягиваем его отдельным скриптом.
return loadScript(THREE_LEGACY_GLTF).then(() => {
if (!window.THREE.GLTFLoader) throw new Error('GLTFLoader недоступен');
});
}
});
}

// Характеристики устройства — без запуска рендера.
function probe3DCapabilities(){
const canvas = document.createElement('canvas');
const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
if (!gl) return { webgl: null, renderer: null, maxTexture: null, cores: navigator.hardwareConcurrency || null, memory: navigator.deviceMemory || null };
const dbg = gl.getExtension('WEBGL_debug_renderer_info');
return {
webgl: canvas.getContext('webgl2') ? 2 : 1,
renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : null,
maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE),
cores: navigator.hardwareConcurrency || null,
memory: navigator.deviceMemory || null,
};
}

function get3DMode(){
try { return localStorage.getItem(D3_MODE_KEY) || null; } catch(e) { return null; }
}

function save3DMode(mode){
try { localStorage.setItem(D3_MODE_KEY, mode); } catch(e) {}
}

function verdictFromFps(fps){
if (fps >= 45) return 'full';
if (fps >= 25) return 'light';
return 'off';
}

// Тестовая сцена: глянцевый объект в неоновом свете — та же
// нагрузка, что и у будущей модели скина (материал с отражениями,
// два источника света, вращение).
function run3DBenchmark(seconds, onTick){
return load3DLibrary().then(THREE => {
const canvas = document.getElementById('d3Canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
camera.position.set(0, 0.6, 4);

const geometry = new THREE.TorusKnotGeometry(0.9, 0.3, 160, 32);
const material = new THREE.MeshStandardMaterial({ color: 0x7B2CFF, metalness: 0.7, roughness: 0.25 });
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const key = new THREE.PointLight(0xA855F7, 2.2, 20);
key.position.set(3, 3, 4);
scene.add(key);
const rim = new THREE.PointLight(0xFF2BD6, 1.8, 20);
rim.position.set(-3, -2, 2);
scene.add(rim);

return new Promise(resolve => {
let frames = 0;
const started = performance.now();
const tick = () => {
const elapsed = (performance.now() - started) / 1000;
if (elapsed >= seconds){
const fps = Math.round(frames / elapsed);
renderer.dispose();
geometry.dispose();
material.dispose();
resolve(fps);
return;
}
mesh.rotation.x += 0.012;
mesh.rotation.y += 0.02;
renderer.render(scene, camera);
frames += 1;
if (onTick) onTick(Math.max(0, Math.ceil(seconds - elapsed)));
requestAnimationFrame(tick);
};
requestAnimationFrame(tick);
});
});
}

function render3DTable(caps, fps){
const dict = I18N[currentLang] || I18N.ru;
const rows = [
[dict.d3_device, caps.renderer || '—'],
[dict.d3_webgl, caps.webgl ? ('WebGL ' + caps.webgl) : '—'],
[dict.d3_cores, caps.cores || '—'],
[dict.d3_memory, caps.memory ? caps.memory + ' GB' : '—'],
[dict.d3_maxtex, caps.maxTexture ? caps.maxTexture + ' px' : '—'],
];
if (fps !== undefined && fps !== null){
const mode = verdictFromFps(fps);
rows.push([dict.d3_fps, String(fps)]);
rows.push([dict.d3_verdict, dict['d3_' + (mode === 'full' ? 'ok' : mode === 'light' ? 'light' : 'off')]]);
}
document.getElementById('d3Table').innerHTML = rows.map(([k, v]) =>
`<div class="d3-row"><span>${escapeHtml(k)}</span><b>${escapeHtml(String(v))}</b></div>`).join('');
}

const d3RunBtn = document.getElementById('d3RunBtn');

if (d3RunBtn){
const caps = probe3DCapabilities();
render3DTable(caps, null);

if (!caps.webgl){
d3RunBtn.disabled = true;
document.getElementById('d3Status').textContent = (I18N[currentLang] || I18N.ru).d3_no_webgl;
save3DMode('off');
}

d3RunBtn.addEventListener('click', () => {
const dict = I18N[currentLang] || I18N.ru;
const status = document.getElementById('d3Status');
d3RunBtn.disabled = true;
status.textContent = dict.d3_running.replace('{s}', 5);
run3DBenchmark(5, left => { status.textContent = dict.d3_running.replace('{s}', left); })
.then(fps => {
const mode = verdictFromFps(fps);
save3DMode(mode);
render3DTable(caps, fps);
status.textContent = dict.d3_saved;
haptic(mode === 'off' ? 'warning' : 'success');
})
.catch(err => {
status.textContent = friendlyErrorMessage(err);
})
.finally(() => { d3RunBtn.disabled = false; });
});
}


// ============================================================
// ЭТАП 2: ПРОСМОТРЩИК МОДЕЛЕЙ
//
// Грузит .glb (экспорт из CS2 через extract-ak47.sh), ставит свет
// по брендбуку (Ghost Purple + Neon Pink) и даёт крутить модель
// пальцем. Качество зависит от режима, который выставил тест
// устройства: full — полное разрешение и сглаживание, light —
// без сглаживания и с pixelRatio 1.
//
// Всё грузится лениво: three.js и загрузчик .glb подтягиваются
// только при первом открытии просмотрщика.
// ============================================================


// Убирает из .glb все картинки и ссылки на них, оставляя геометрию.
// Нужно, когда WebKit не может декодировать текстуры: лучше серая
// модель, чем пустой экран. Работаем прямо с бинарником: заголовок
// 12 байт, дальше чанки (длина, тип, данные); JSON — первый чанк.
function stripTexturesFromGlb(buffer){
const view = new DataView(buffer);
const jsonLength = view.getUint32(12, true);
const jsonStart = 20;
const jsonBytes = new Uint8Array(buffer, jsonStart, jsonLength);

let jsonText = '';
for (let i = 0; i < jsonBytes.length; i += 8192){
jsonText += String.fromCharCode.apply(null, jsonBytes.subarray(i, i + 8192));
}
jsonText = decodeURIComponent(escape(jsonText));

const json = JSON.parse(jsonText);
delete json.images;
delete json.textures;
delete json.samplers;

(json.materials || []).forEach(m => {
delete m.normalTexture;
delete m.occlusionTexture;
delete m.emissiveTexture;
if (m.pbrMetallicRoughness){
delete m.pbrMetallicRoughness.baseColorTexture;
delete m.pbrMetallicRoughness.metallicRoughnessTexture;
}
delete m.extensions;
});
delete json.extensionsUsed;
delete json.extensionsRequired;

// Собираем новый JSON-чанк (длина кратна 4, добивается пробелами).
let newJson = JSON.stringify(json);
while (newJson.length % 4 !== 0) newJson += ' ';
const newJsonBytes = new Uint8Array(newJson.length);
for (let i = 0; i < newJson.length; i++) newJsonBytes[i] = newJson.charCodeAt(i) & 0xff;

// Бинарный чанк (вершины) переносим как есть.
const binStart = jsonStart + jsonLength;
const binLength = binStart < buffer.byteLength ? view.getUint32(binStart, true) : 0;
const binBytes = binLength
? new Uint8Array(buffer, binStart + 8, binLength)
: new Uint8Array(0);

const total = 12 + 8 + newJsonBytes.length + (binLength ? 8 + binLength : 0);
const out = new ArrayBuffer(total);
const outView = new DataView(out);
const outBytes = new Uint8Array(out);

outView.setUint32(0, 0x46546C67, true);  // "glTF"
outView.setUint32(4, 2, true);
outView.setUint32(8, total, true);
outView.setUint32(12, newJsonBytes.length, true);
outView.setUint32(16, 0x4E4F534A, true); // "JSON"
outBytes.set(newJsonBytes, 20);

if (binLength){
const o = 20 + newJsonBytes.length;
outView.setUint32(o, binLength, true);
outView.setUint32(o + 4, 0x004E4942, true); // "BIN"
outBytes.set(binBytes, o + 8);
}

return out;
}

// Разбор .glb с временно спрятанным createImageBitmap: WebView в
// Telegram не пишет "Safari" в User-Agent, three.js принимает его за
// Chrome и грузит текстуры через createImageBitmap, а движок Apple
// на них падает.
function parseGlb(buffer){
return new Promise((resolve, reject) => {
const native = window.createImageBitmap;
window.createImageBitmap = undefined;
const restore = () => { if (native) window.createImageBitmap = native; };
new THREE.GLTFLoader().parse(
buffer, '',
(gltf) => { restore(); resolve(gltf); },
(e) => { restore(); reject(e); }
);
});
}

const viewer3dOverlay = document.getElementById('viewer3dOverlay');
let viewer3d = null; // { renderer, scene, camera, object, raf }

function dispose3DViewer(){
if (!viewer3d) return;
cancelAnimationFrame(viewer3d.raf);
viewer3d.renderer.dispose();
viewer3d.scene.traverse(node => {
if (node.geometry) node.geometry.dispose();
if (node.material){
const mats = Array.isArray(node.material) ? node.material : [node.material];
mats.forEach(m => {
Object.values(m).forEach(v => { if (v && v.isTexture) v.dispose(); });
m.dispose();
});
}
});
viewer3d = null;
}

// Модель приходит произвольного размера и центра — приводим её к
// единому масштабу, чтобы камера всегда стояла одинаково.
function fitObjectToView(THREE, object, camera){
// Считаем габариты ТОЛЬКО по мешам: в экспорте CS2 есть пустые
// узлы и вспомогательные точки далеко от ствола, из-за них общий
// бокс раздувается и модель получается крошечной в кадре.
const box = new THREE.Box3();
let hasMesh = false;
object.updateMatrixWorld(true);

object.traverse(node => {
if (node.isMesh && node.geometry){
node.geometry.computeBoundingBox();
box.expandByObject(node);
hasMesh = true;
}
});

if (!hasMesh) box.setFromObject(object);

const size = box.getSize(new THREE.Vector3());
const center = box.getCenter(new THREE.Vector3());
const maxSide = Math.max(size.x, size.y, size.z) || 1;

// Приводим к единому размеру и ставим центр модели в начало координат.
object.scale.multiplyScalar(2 / maxSide);
object.position.sub(center.multiplyScalar(2 / maxSide));

// Расстояние камеры — по настоящим габаритам (ствол длинный и
// плоский, а не куб) и по более узкому углу обзора: на телефоне
// кадр вертикальный, и тесно становится по ширине.
const radius = size.length() / maxSide;
const vFov = camera.fov * Math.PI / 180;
const hFov = 2 * Math.atan(Math.tan(vFov / 2) * (camera.aspect || 1));
const distance = radius / Math.sin(Math.min(vFov, hFov) / 2);
camera.position.set(0, 0.35, distance);
camera.lookAt(0, 0, 0);
camera.near = distance / 50;
camera.far = distance * 10;
camera.updateProjectionMatrix();

return distance;
}

function countTriangles(THREE, object){
let tris = 0;
object.traverse(node => {
if (node.isMesh && node.geometry){
const g = node.geometry;
tris += g.index ? g.index.count / 3 : (g.attributes.position ? g.attributes.position.count / 3 : 0);
}
});
return Math.round(tris);
}


// ============================================================
// ЭТАП 3: РАСКРАСКА СКИНА НА МОДЕЛИ
//
// Собирается так же, как в самой игре, но упрощённо:
//   узор (pattern) поверх металла,
//   сверху грязь (grunge),
//   сверху потёртость: краска стирается там, где маска износа
//   меньше значения float этого конкретного лота.
//
// Благодаря этому один комплект текстур даёт и Factory New, и
// Battle-Scarred — ровно как в CS2.
// ============================================================

// isColor=true — текстура цвета (sRGB), иначе это данные: маски,
// шероховатость, затенение. Раньше маски грузились как цвет, и
// из-за этого по стволу шли белёсые разводы.
function loadSkinTexture(THREE, url, isColor){
return new Promise((resolve) => {
// В WebView Telegram createImageBitmap ломается на части картинок —
// прячем его и здесь (см. parseGlb).
const native = window.createImageBitmap;
window.createImageBitmap = undefined;
new THREE.TextureLoader().load(
url,
(tex) => {
if (native) window.createImageBitmap = native;
if ('colorSpace' in tex){
tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
}
tex.flipY = false; // как в glTF
tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
resolve(tex);
},
undefined,
() => { if (native) window.createImageBitmap = native; resolve(null); }
);
});
}


// Базовые текстуры самого ствола: родной цвет, маска покраски,
// шероховатость, затенение. Без маски узор ложился на всю модель
// целиком, включая детали, которые в игре краской не покрываются.
// Имена файлов, как и у скинов, берутся из params.json ствола;
// без него — прежние color/masks/rough/ao.webp.
function loadWeaponPack(THREE, dir){
const base = modelsUrl(dir).replace(/\/+$/, '') + '/';
return fetch(base + 'params.json')
.then(r => r.ok ? r.json() : {})
.catch(() => ({}))
.then(meta => {
const textures = Object.assign({
color: 'color.webp',
masks: 'masks.webp',
rough: 'rough.webp',
ao: 'ao.webp',
}, meta.textures || {});
const names = ['color', 'masks', 'rough', 'ao'];
return Promise.all(names.map(name =>
loadSkinTexture(THREE, resolveSkinPath(base, textures[name]), name === 'color')
)).then(loaded => {
const pack = { name: weaponNameFromDir(dir) };
names.forEach((name, i) => { pack[name] = loaded[i]; });
return pack;
});
});
}

// Имя ствола из пути вида models/weapons/knife_butterfly.
function weaponNameFromDir(dir){
const parts = String(dir || '').replace(/\/+$/, '').split('/');
return parts[parts.length - 1] || '';
}

// Масштаб узора у каждого ствола (items_game.txt → paint_data →
// UVScale). Развёртка маленького Deagle и длинного AWP занимает одну и
// ту же текстуру, и игра умножает pattern_scale на UVScale, чтобы узор
// был одного размера на любом стволе. Без этого на пистолетах узор
// выходил в 2–3 раза мельче (Meteorite превращался в светлую сетку).
const WEAPON_UV_SCALE = {
deagle: 0.3, elite: 0.282, fiveseven: 0.264, glock: 0.446, hkp2000: 0.288,
p250: 0.371, cz75a: 0.4, tec9: 0.427, bizon: 0.596, mac10: 0.495,
mp7: 0.446, mp5sd: 0.446, mp9: 0.485, p90: 0.537, ump45: 0.882,
ak47: 0.549, aug: 0.763, famas: 0.66, galilar: 0.75, m4a1: 0.425,
sg556: 0.809, awp: 1.029, g3sg1: 0.703, scar20: 0.84, ssg08: 1.084,
mag7: 0.612, nova: 0.744, sawedoff: 0.445, xm1014: 0.54, m249: 1.151,
negev: 0.74, m4a1_silencer: 0.9167, usp_silencer: 0.516, revolver: 0.5,
bayonet: 0.505, knife_css: 0.36, knife_flip: 0.411, knife_gut: 0.733,
knife_karambit: 0.438, knife_m9_bayonet: 0.506, knife_tactical: 0.506,
knife_falchion: 0.36, knife_survival_bowie: 0.4617, knife_butterfly: 0.506,
knife_push: 0.5836, knife_cord: 0.36, knife_canis: 0.36, knife_ursus: 0.36,
knife_gypsy_jackknife: 0.36, knife_outdoor: 0.36, knife_stiletto: 0.36,
knife_widowmaker: 0.36, knife_skeleton: 0.36, knife_kukri: 0.36,
};

// Узор-маска (гидрография, спрей, анодирование мультицвет и
// аэрография, патина) масштабируется по стволу — и в развёртке, и в
// проекции сбоку. Кастомная раскраска нарисована прямо по развёртке.
// У нового формата (шаблоны и vcompmat) в рецепте почти всегда
// g_bIgnoreWeaponSizeScale = true — масштаб ствола к ним не применяем
// (иначе полосы MP7 Amberline растягивались на весь ствол).
function weaponPatternScale(skin, weaponName){
const params = skin.params;
if (skin.format === 'template' || skin.format === 'vcompmat') return 1;
if ([1, 2, 4, 5, 7].indexOf(params.paint_style) === -1) return 1;
return WEAPON_UV_SCALE[weaponName] || 1;
}

function isKnifeName(name){
return name === 'bayonet' || name.indexOf('knife') === 0;
}

// Стили CS2 (F_PAINT_STYLE): 0 однотонный, 1 гидрография, 2 спрей,
// 3 анодирование, 4 анодирование мультицвет, 5 аэрография (Fade),
// 6 кастомная, 7 патина, 8 Gunsmith. У 1, 2, 4 и 5 узор — маска,
// где R/G/B говорят, какой из четырёх цветов материала лежит в этой
// точке; цвета генератор кладёт в params.json → shader.colors. Без
// стиля 5 Fade-скины (Acid Fade, Fade) показывали саму маску радугой.
function skinUsesColorMask(params){
return [1, 2, 4, 5].indexOf(params.paint_style) !== -1
&& Array.isArray(params.colors) && params.colors.length >= 4;
}

function skinIsSingleColor(params){
const list = Array.isArray(params.colors) ? params.colors.slice(1, 4) : [];
return list.every(c => !c || Math.max(c[0] || 0, c[1] || 0, c[2] || 0) < 0.01);
}

function skinColors(THREE, params){
const list = Array.isArray(params.colors) ? params.colors : [];
const out = [];
for (let i = 0; i < 4; i++){
const c = list[i] || [0, 0, 0];
const color = new THREE.Color();
// Цвета из материала — в sRGB; шейдеру нужны линейные.
if (THREE.SRGBColorSpace) color.setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
else color.setRGB(c[0], c[1], c[2]);
out.push(new THREE.Vector3(color.r, color.g, color.b));
}
return out;
}

// Анодирование (стили 3, 4, 5: Fade, Doppler, Slaughter, Moonrise) в
// игре — это окрашенный полированный металл, а не краска поверх.
// Матовой краской они выходили пастельными; металлом с шероховатостью
// ствола — тёмными. Полированный металл и более яркие отражения дают
// насыщенный цвет, как на картинках Steam.
const ANODIZED = { metalness: 1, roughness: 0.3, envIntensity: 5 };
function isAnodized(params){
return [3, 4, 5].indexOf(params.paint_style) !== -1;
}
function paintMetalness(params){
const own = Number(params.paint_metalness) || 0;
if (own > 0) return own;
return isAnodized(params) ? ANODIZED.metalness : 0;
}

// ---------- pattern seed ----------
// Генератор случайных чисел Valve (CUniformRandomStream из Source SDK).
// Игра сеет его paint seed предмета и по очереди берёт сдвиг узора по
// X, по Y и поворот — отсюда «blue gem», процент Fade и т.п. Тот же
// алгоритм используют CSFloat, Skinport и калькуляторы Fade.
function ValveRandom(seed){
this.idum = seed >= 0 ? -seed : seed;
this.iy = 0;
this.iv = [];
}
ValveRandom.prototype.next = function(){
const NTAB = 32, IA = 16807, IM = 2147483647, IQ = 127773, IR = 2836;
const NDIV = 1 + Math.floor((IM - 1) / NTAB);
let j, k;
if (this.idum <= 0 || !this.iy){
this.idum = -this.idum < 1 ? 1 : -this.idum;
for (j = NTAB + 7; j >= 0; j--){
k = Math.floor(this.idum / IQ);
this.idum = IA * (this.idum - k * IQ) - IR * k;
if (this.idum < 0) this.idum += IM;
if (j < NTAB) this.iv[j] = this.idum;
}
this.iy = this.iv[0];
}
k = Math.floor(this.idum / IQ);
this.idum = IA * (this.idum - k * IQ) - IR * k;
if (this.idum < 0) this.idum += IM;
j = Math.floor(this.iy / NDIV);
this.iy = this.iv[j];
this.iv[j] = this.idum;
return this.iy;
};
// Как RandomFloat в игре: вычисления во float32.
ValveRandom.prototype.float = function(low, high){
let f = Math.fround(this.next() / 2147483647);
if (f > 1 - 1.2e-7) f = Math.fround(1 - 1.2e-7);
return Math.fround(Math.fround(f * Math.fround(high - low)) + low);
};

// Pattern в лоте — строка (её можно было ввести руками); берём только
// настоящий seed 0…1000.
function parsePaintSeed(value){
const text = String(value === null || value === undefined ? '' : value).trim().replace(/^#/, '');
if (!/^\d{1,4}$/.test(text)) return null;
const seed = Number(text);
return seed <= 1000 ? seed : null;
}

// Сдвиг и поворот узора для конкретного предмета. Диапазоны берёт
// сборка из рецепта раскраски (params.json → shader.seed_roll); без
// них или без seed узор лежит как раньше.
function seedPlacement(params, seed){
const placement = { offset: [0, 0], rotation: Number(params.pattern_rotation) || 0, rolled: false };
const roll = params.seed_roll;
seed = parsePaintSeed(seed);
if (!roll || seed === null) return placement;
const range = r => Array.isArray(r) && r.length === 2 ? r.map(Number) : null;
const ox = range(roll.offset_x) || [0, 0];
const oy = range(roll.offset_y) || [0, 0];
const rot = range(roll.rotation) || [placement.rotation, placement.rotation];
const rng = new ValveRandom(seed);
placement.offset = [rng.float(ox[0], ox[1]), rng.float(oy[0], oy[1])];
placement.rotation = rng.float(rot[0], rot[1]);
placement.rolled = true;
return placement;
}

// В моделях CS2 два корпуса: body_legacy — под старые раскраски,
// body_hd — новая HD-модель, под которую нарисованы раскраски нового
// формата (Zeno, AWP Printstream, Amberline…). Показывать оба сразу
// нельзя: новая раскраска ложилась на старый корпус с чужой развёрткой
// и выходила почти белой. Если в модели один корпус — не трогаем.
function selectModelBody(object, useHd){
let hasHd = false, hasLegacy = false;
object.traverse(node => {
const name = String(node.name || '').toLowerCase();
if (name.indexOf('body_hd') !== -1) hasHd = true;
if (name.indexOf('body_legacy') !== -1) hasLegacy = true;
});
if (!hasHd || !hasLegacy) return false;
object.traverse(node => {
const name = String(node.name || '').toLowerCase();
if (name.indexOf('body_hd') !== -1) node.visible = useHd;
else if (name.indexOf('body_legacy') !== -1) node.visible = !useHd;
});
return useHd;
}

// Под какой корпус раскраска: флаг use_legacy_model из items_game
// (сборка пишет его в params.json), а без него — по формату: новый
// (vcompmat, шаблоны) рисуется под HD-модель.
function skinUsesHdBody(skin){
if (!skin) return false;
if (typeof skin.params.legacy_model === 'boolean') return !skin.params.legacy_model;
return skin.format === 'vcompmat' || skin.format === 'template';
}

// wear — float предмета (0 = новый, 1 = полностью убитый).
function applySkinToModel(THREE, object, skin, wear, weapon, maskChannel, seed){
// true — только если у модели правда есть HD-корпус и он включён.
// У ножей корпус один, и маска ствола им нужна всегда (иначе краска
// ложилась и на рукоять — Falchion Gamma Doppler).
const useHd = selectModelBody(object, skinUsesHdBody(skin));
// Текстуры ствола (маски зон, цвет, AO) сняты со старого корпуса — на
// HD-корпусе развёртка другая, и они дают розовые края и пятна.
// Раскраска нового формата и так покрывает ствол целиком.
if (useHd) weapon = null;
// 0,1,2 — каналы маски; 3 — красить всё без маски; 4 — показать
// саму маску цветом (отладка: видно, какой канал за что отвечает).
const CHANNELS = { r: 0, g: 1, b: 2, none: 3, debug: 4 };
// По умолчанию — без маски: у стилей вроде custom paint (Redline)
// краска покрывает ствол целиком, а текстура masks в CS2 хранит не
// зоны покраски, а свойства поверхности.
// R в маске ствола — металлические детали. У ножей это клинок
// (рукоять остаётся родной: Butterfly — чёрная с красной вставкой),
// а анодирование (Fade, Doppler, Moonrise) в игре ложится только на
// металл: у Glock Moonrise окрашен затвор, рамка остаётся серой.
const weaponName = weapon ? weapon.name || '' : '';
let maskName = String(maskChannel || 'none').toLowerCase();
if (maskName === 'none' && weapon && weapon.masks
&& (isKnifeName(weaponName) || isAnodized(skin.params))) maskName = 'r';
const channel = CHANNELS[maskName] ?? 3;

// Однотонной раскраске узор не нужен, но сэмплер в шейдере должен
// на что-то указывать — подставляем чёрный пиксель.
let pattern = skin.pattern;
if (!pattern){
pattern = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
pattern.needsUpdate = true;
}

const placement = seedPlacement(skin.params, seed);
// Закалка (gsch_…): палитра цветов, место в ней выбирает альфа узора.
const hardening = skin.ramp ? (skin.params.case_hardening || {}) : null;

const uniforms = {
uPattern: { value: pattern },
uRamp: { value: skin.ramp || pattern },
// Палитру закалки пока не применяем: у Zeno она (красный→синий)
// красила весь ствол в красный — как именно игра её смешивает,
// надо сверить с картинкой Steam.
uHasRamp: { value: 0 },
uRampInfluence: { value: hardening ? Number(hardening.pattern_influence ?? 1) : 1 },
uRampOffset: { value: hardening ? Number(hardening.ramp_offset) || 0 : 0 },
// 1 — несколько цветов по зонам ствола, 2 — один цвет (анодирование:
// остальные цвета в материале нулевые) только на окрашиваемых деталях.
uSolid: { value: !skin.solid ? 0 : (skinIsSingleColor(skin.params) ? 2 : 1) },
uWearMask: { value: skin.wear },
uGrunge: { value: skin.grunge },
uSkinMask: { value: skin.mask },
// В составных материалах (vcompmat) material_mask размечает зоны
// материалов, а не покрытие краской: как маска покраски он гасил
// почти весь узор, и сквозь него проступал родной ствол.
uHasSkinMask: { value: skin.mask && skin.format !== 'vcompmat' ? 1 : 0 },
uHasGrunge: { value: skin.grunge ? 1 : 0 },
uHasWear: { value: skin.wear ? 1 : 0 },
uBaseColor: { value: weapon ? weapon.color : null },
uPaintMask: { value: weapon ? weapon.masks : null },
uAo: { value: weapon ? weapon.ao : null },
uWearAmount: { value: Math.max(0, Math.min(1, wear || 0)) },
uPatternScale: { value: (skin.params.pattern_scale || 1) * weaponPatternScale(skin, weaponName) },
// Поворот узора в params.json — в градусах.
uPatternRotation: { value: placement.rotation * Math.PI / 180 },
// Сдвиг узора по seed (в долях текстуры).
uPatternOffset: { value: new THREE.Vector2(placement.offset[0], placement.offset[1]) },
uWearScale: { value: skin.params.wear_scale || 1 },
uGrungeScale: { value: skin.params.grunge_scale || 1 },
uPaintMetalness: { value: paintMetalness(skin.params) },
// Своя карта металличности краски (Zeno — серый металлик).
uSkinMetal: { value: skin.metalness || pattern },
uHasSkinMetal: { value: skin.metalness ? 1 : 0 },
uPaintRoughness: { value: ANODIZED.roughness },
uHasPaintRoughness: { value: isAnodized(skin.params) ? 1 : 0 },
uUseColors: { value: skin.solid || skinUsesColorMask(skin.params) ? 1 : 0 },
uColors: { value: skinColors(THREE, skin.params) },
// Узор грузится как sRGB, а маске нужны исходные значения каналов.
uMaskGamma: { value: THREE.SRGBColorSpace ? 1 / 2.2 : 1 },
uColorBrightness: { value: skin.params.color_brightness || 1 },
uMaskChannel: { value: channel },
uHasWeapon: { value: weapon && weapon.color ? 1 : 0 },
};

// Спрей (2) и аэрография (5) в CS наносятся проекцией сбоку на всё
// оружие, а не по развёртке: развёртка разрезана на куски, и Fade по
// ней ложился пятнами. Проекция — по двум самым длинным осям модели
// (длина и высота), нормированным на её габариты.
const projected = [2, 5].indexOf(skin.params.paint_style) !== -1 && !!skin.pattern;
object.updateMatrixWorld(true);
const rootInverse = new THREE.Matrix4().copy(object.matrixWorld).invert();
const box = new THREE.Box3();
object.traverse(node => {
if (!node.isMesh || !node.geometry) return;
if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
const local = node.geometry.boundingBox.clone()
.applyMatrix4(new THREE.Matrix4().multiplyMatrices(rootInverse, node.matrixWorld));
box.union(local);
});
const boxSize = new THREE.Vector3();
box.getSize(boxSize);
const axes = [0, 1, 2].sort((a, b) => boxSize.getComponent(b) - boxSize.getComponent(a));
const projU = new THREE.Vector3(); projU.setComponent(axes[0], 1);
const projV = new THREE.Vector3(); projV.setComponent(axes[1], 1);
const projLen = Math.max(boxSize.getComponent(axes[0]), 1e-6);
// Проекция — от центра модели: середина текстуры приходится на
// середину ствола, а масштаб узора (с UVScale ствола) растягивает её
// вокруг этой точки. От угла габаритов узор съезжал: у Glock Moonrise
// город оказывался на рамке, а не по нижнему краю затвора.
const projCenter = box.getCenter(new THREE.Vector3());

object.traverse(node => {
if (!node.isMesh) return;

const material = new THREE.MeshStandardMaterial({
color: 0xffffff,
metalness: 0.7,
roughness: 0.5,
});
// Шероховатость: своя у скина точнее, чем общая у ствола. В карте
// уже абсолютные значения — множитель 1, иначе краска выходила
// вдвое глянцевее и отражала окружение как хром (Zeno, Printstream).
if (skin.rough){
material.roughnessMap = skin.rough;
material.roughness = 1.0;
} else if (weapon && weapon.rough) material.roughnessMap = weapon.rough;
if (isAnodized(skin.params)) material.envMapIntensity = ANODIZED.envIntensity;

// Рельеф и затенение из комплекта скина — новый формат отдаёт их
// отдельными слоями, и с ними металл перестаёт быть плоским.
if (skin.normal) material.normalMap = skin.normal;
if (skin.ao){
material.aoMap = skin.ao;
if (node.geometry.attributes.uv && !node.geometry.attributes.uv2){
node.geometry.setAttribute('uv2', node.geometry.attributes.uv);
}
}

const toRoot = new THREE.Matrix4().multiplyMatrices(rootInverse, node.matrixWorld);
const meshUniforms = {
uProjected: { value: projected ? 1 : 0 },
uToRoot: { value: toRoot },
uProjU: { value: projU },
uProjV: { value: projV },
uProjMin: { value: projCenter.clone() },
uProjLen: { value: projLen },
};

material.onBeforeCompile = (shader) => {
Object.assign(shader.uniforms, uniforms, meshUniforms);

// Своя UV-переменная: в three r152+ общий vUv убрали, у каждой
// текстуры теперь своя (vMapUv, vRoughnessMapUv…), и ссылка на
// vUv роняла компиляцию шейдера — меш просто исчезал.
shader.vertexShader = shader.vertexShader
.replace('#include <common>', `#include <common>
varying vec2 vSkinUv;
varying vec2 vProjUv;
uniform mat4 uToRoot;
uniform vec3 uProjU;
uniform vec3 uProjV;
uniform vec3 uProjMin;
uniform float uProjLen;`)
.replace('#include <begin_vertex>', `#include <begin_vertex>
vSkinUv = uv;
// Проекция сбоку: обе оси делим на длину оружия, чтобы узор не
// растягивался по высоте.
vec3 rootPos = (uToRoot * vec4(position, 1.0)).xyz - uProjMin;
vProjUv = vec2(dot(rootPos, uProjU), dot(rootPos, uProjV)) / uProjLen;`);

shader.fragmentShader = shader.fragmentShader
.replace('#include <common>', `#include <common>
uniform sampler2D uPattern;
uniform sampler2D uRamp;
uniform int uHasRamp;
uniform float uRampInfluence;
uniform float uRampOffset;
uniform sampler2D uWearMask;
uniform sampler2D uGrunge;
uniform sampler2D uSkinMask;
uniform int uHasSkinMask;
uniform int uHasGrunge;
uniform int uHasWear;
uniform sampler2D uBaseColor;
uniform sampler2D uPaintMask;
uniform sampler2D uAo;
uniform float uWearAmount;
uniform float uPatternScale;
uniform float uPatternRotation;
uniform vec2 uPatternOffset;
uniform float uWearScale;
uniform float uGrungeScale;
uniform float uPaintMetalness;
uniform float uPaintRoughness;
uniform sampler2D uSkinMetal;
uniform int uHasSkinMetal;
uniform int uHasPaintRoughness;
uniform int uUseColors;
uniform int uSolid;
uniform vec3 uColors[4];
uniform float uMaskGamma;
uniform float uColorBrightness;
uniform int uMaskChannel;
uniform int uHasWeapon;
uniform int uProjected;
varying vec2 vSkinUv;
varying vec2 vProjUv;`)
.replace('#include <color_fragment>', `#include <color_fragment>
// Доля покрытия краской — нужна ниже, для металличности.
float skinCover = 0.0;
{
// Родной вид ствола: то, что видно на неокрашиваемых деталях.
vec3 base = uHasWeapon == 1 ? texture2D(uBaseColor, vSkinUv).rgb : vec3(0.22);

// Маска покраски: где краска вообще может лежать. Канал
// выбирается настройкой — у разных стволов он разный.
float paintable = 1.0;
vec4 masks = uHasWeapon == 1 ? texture2D(uPaintMask, vSkinUv) : vec4(1.0);
if (uHasWeapon == 1 && uMaskChannel < 3){
paintable = uMaskChannel == 1 ? masks.g : (uMaskChannel == 2 ? masks.b : masks.r);
}

// Режим отладки: показываем саму маску, чтобы увидеть, какой
// канал какие детали покрывает.
if (uMaskChannel == 4){
diffuseColor.rgb = masks.rgb;
}

// Поворот узора — вокруг центра развёртки, как в игре.
float rc = cos(uPatternRotation), rs = sin(uPatternRotation);
// Проекция (vProjUv) уже отсчитана от центра модели и масштабируется
// вокруг него; развёртка — от угла, как раньше.
vec2 puv = uProjected == 1 ? vProjUv : vSkinUv - 0.5;
puv = vec2(rc * puv.x - rs * puv.y, rs * puv.x + rc * puv.y);
vec2 patternUv = uProjected == 1 ? puv * uPatternScale + 0.5 : (puv + 0.5) * uPatternScale;
vec4 patternTex = texture2D(uPattern, patternUv + uPatternOffset);
vec3 pattern = patternTex.rgb;
// Закалка: альфа узора выбирает цвет палитры, альбедо его оттеняет.
if (uHasRamp == 1){
float rampU = fract(patternTex.a * uRampInfluence + uRampOffset);
// По диагонали: палитра бывает и горизонтальной, и вертикальной
// (у Zeno — квадрат 256×256 с градиентом сверху вниз).
float rampT = clamp(rampU, 0.002, 0.998);
pattern *= texture2D(uRamp, vec2(rampT, rampT)).rgb;
}
if (uUseColors == 1){
// Первый цвет — основа, остальные ложатся по каналам маски.
// У однотонных раскрасок маской служат зоны покраски самого ствола.
vec3 m = uSolid == 1 && uHasWeapon == 1 ? masks.rgb
: (uSolid == 2 ? vec3(0.0) : pow(pattern, vec3(uMaskGamma)));
if (uSolid == 2 && uHasWeapon == 1) paintable *= masks.r;
pattern = uColors[0];
pattern = mix(pattern, uColors[1], m.r);
pattern = mix(pattern, uColors[2], m.g);
pattern = mix(pattern, uColors[3], m.b);
}
pattern *= uColorBrightness;

// Потёртость: краска сходит там, где маска износа меньше float.
// У части новых скинов своей маски износа нет — тогда считаем
// краску целой, иначе ствол выглядел бы полностью облезлым.
float kept = 1.0;
if (uHasWear == 1){
float wearMask = texture2D(uWearMask, vSkinUv * uWearScale).r;
// float напрямую как порог стирал краску слишком рано: при 0.8
// оставалось меньше 5%. Порог 0.25 + 0.5·float держит FN/MW целыми,
// а на Battle-Scarred оставляет часть краски, как в игре.
float wearCut = 0.25 + 0.5 * uWearAmount;
kept = smoothstep(wearCut - 0.08, wearCut + 0.04, wearMask);
}

// Грязь и царапины — общий слой, тоже необязательный.
float grunge = uHasGrunge == 1 ? texture2D(uGrunge, vSkinUv * uGrungeScale).r : 1.0;

// Своя маска скина (новый формат) точнее общей маски ствола:
// она говорит, где именно лежит краска у этой конкретной раскраски.
if (uHasSkinMask == 1){
paintable *= texture2D(uSkinMask, vSkinUv).r;
}

vec3 painted = pattern * mix(0.88, 1.0, grunge);
skinCover = paintable * kept;
vec3 result = mix(base, painted, skinCover);

if (uHasWeapon == 1){
result *= mix(0.55, 1.0, texture2D(uAo, vSkinUv).r);
}

if (uMaskChannel != 4) diffuseColor.rgb = result;
}`)
// Краска бывает и не металлической (большинство скинов), и
// металлической (paint_metalness = 1): там, где она лежит, берём
// металличность из params.json, на голом металле — как было.
.replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
metalnessFactor = mix(metalnessFactor,
uHasSkinMetal == 1 ? texture2D(uSkinMetal, vSkinUv).r : uPaintMetalness, skinCover);`)
// Анодированная краска — полированная, где бы она ни лежала.
.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
if (uHasPaintRoughness == 1) roughnessFactor = mix(roughnessFactor, uPaintRoughness, skinCover);`);
};

node.material = material;
node.material.needsUpdate = true;
});

return uniforms;
}

// Грузит комплект раскраски из models/skins/<имя>/.
//
// Имена файлов НЕ зашиты в коде: берутся из params.json, из блока
// textures. У старых скинов там pattern/wear/grunge/rough, у новых
// добавляются normal, ao, material_mask, sfx. Благодаря этому новый
// формат не требует правок просмотрщика — достаточно, чтобы
// генератор положил нужные пути в params.json.
//
// Общие для всех скинов маски (износ, грязь) лежат один раз в
// models/shared/, и путь к ним тоже приходит из params.json.

// Какие слои считаем цветными (sRGB), а какие данными (линейное
// пространство). Ошибка здесь даёт белёсые разводы на стволе.
const SKIN_COLOR_LAYERS = ['pattern', 'albedo', 'color'];

// Синонимы: один и тот же слой в разных форматах зовётся по-разному.
const SKIN_LAYER_ALIASES = {
grunge: ['grunge', 'sfx'],
rough: ['rough', 'roughness'],
mask: ['material_mask', 'mask'],
normal: ['normal', 'normal_map'],
ao: ['ao', 'ambient_occlusion'],
};

function pickLayer(textures, names){
for (const name of names){
if (textures[name]) return textures[name];
}
return null;
}

// Путь из params.json: просто имя файла — ищем в папке скина;
// "models/...", "/..." или http(s) — берём как есть (так указываются
// общие ресурсы из models/shared/); "../" работает относительно скина.
function resolveSkinPath(base, file){
if (file.indexOf('models/') === 0) return modelsUrl(file);
if (/^(https?:)?\/\//.test(file) || file.charAt(0) === '/') return file;
return base + file;
}

function loadSkinPack(THREE, dir){
const base = modelsUrl(dir).replace(/\/+$/, '') + '/';

return fetch(base + 'params.json')
.then(r => {
if (!r.ok) throw new Error('нет params.json в ' + base);
return r.json();
})
.then(meta => {
const textures = meta.textures || {};

// Старые комплекты могли не иметь блока textures — тогда
// подставляем прежние имена файлов.
if (!Object.keys(textures).length){
Object.assign(textures, {
pattern: 'pattern.webp',
wear: 'wear.webp',
grunge: 'grunge.webp',
rough: 'rough.webp',
});
}

const wanted = {
pattern: textures.pattern || pickLayer(textures, SKIN_COLOR_LAYERS),
wear: textures.wear || null,
grunge: pickLayer(textures, SKIN_LAYER_ALIASES.grunge),
rough: pickLayer(textures, SKIN_LAYER_ALIASES.rough),
mask: pickLayer(textures, SKIN_LAYER_ALIASES.mask),
normal: pickLayer(textures, SKIN_LAYER_ALIASES.normal),
ao: pickLayer(textures, SKIN_LAYER_ALIASES.ao),
ramp: textures.ramp || null,
metalness: textures.metalness || null,
};

const names = Object.keys(wanted);

return Promise.all(names.map(name => {
const file = wanted[name];
if (!file) return Promise.resolve(null);
const isColor = SKIN_COLOR_LAYERS.indexOf(name) !== -1 || name === 'ramp';
return loadSkinTexture(THREE, resolveSkinPath(base, file), isColor);
})).then(loaded => {
const pack = { params: meta.shader || {}, format: meta.format || null };
names.forEach((name, i) => { pack[name] = loaded[i]; });
// Однотонные раскраски (so_, an_ и т. п.): узора у них в игре нет,
// есть только цвета из материала — красим ими по маскам ствола.
pack.solid = !pack.pattern && Array.isArray(pack.params.colors) && pack.params.colors.length >= 4;
console.log('3D: слои раскраски —',
names.filter(n => pack[n]).join(', ') || 'ничего не загрузилось');
return pack;
});
});
}

// Цвет, тонмаппинг, свет и отражения — общие для просмотрщика и GIF,
// чтобы анимация в чате выглядела так же, как 3D в приложении.
// Возвращает промис, который выполняется, когда готовы отражения.
function setupViewerScene(THREE, renderer, scene){
// В three r152+ цвета по умолчанию в линейном пространстве —
// без этого металл выглядит блёклым. В r128 свойства нет, и
// присваивание просто игнорируется.
if (renderer.debug) renderer.debug.checkShaderErrors = true;
if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

// Нейтральный белый свет — чтобы металл читался как металл, а не
// как розовая пластмасса. Неон по брендбуку — лишь лёгкий оттенок:
// ярче он красил белые скины (Printstream, Amberline) в розовый.
scene.add(new THREE.AmbientLight(0xffffff, 0.55));

const key = new THREE.DirectionalLight(0xffffff, 2.4);
key.position.set(3, 4, 5);
scene.add(key);

const front = new THREE.DirectionalLight(0xffffff, 1.2);
front.position.set(0, 1, 6);
scene.add(front);

const neonKey = new THREE.DirectionalLight(0xA855F7, 0.25);
neonKey.position.set(-3, 3, 2);
scene.add(neonKey);

const neonRim = new THREE.DirectionalLight(0xFF2BD6, 0.2);
neonRim.position.set(-4, -1, -3);
scene.add(neonRim);

// Блики на металле дают отражения окружения. Если модуль окружения
// не подгрузится (старый WebView, откат на r128) — просто остаёмся
// со светом выше.
if (!THREE.PMREMGenerator) return Promise.resolve();
return dynamicImport(THREE_ADDONS + 'environments/RoomEnvironment.js')
.then(mod => {
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new mod.RoomEnvironment(), 0.04).texture;
})
.catch(() => {});
}

function open3DViewer(modelUrl, title, skinDir, wearValue, weaponDir, maskChannel, seed){
const dict = I18N[currentLang] || I18N.ru;
const mode = get3DMode() || 'full';
const status = document.getElementById('viewer3dStatus');
status.innerHTML = '';
document.getElementById('viewer3dTitle').textContent = title || dict.v3_title;
document.getElementById('viewer3dMode').textContent = (mode === 'light' ? dict.v3_mode_light : dict.v3_mode_full) + ' · v' + APP3D_VERSION;
status.textContent = dict.v3_loading;
let magicWarning = null;
let texturesDropped = false;
viewer3dOverlay.classList.add('show');

// Сначала качаем файл сами — так видно настоящую причину: нет
// файла (404), отдаётся HTML вместо модели (неверный путь) или
// файл битый. GLTFLoader на все эти случаи даёт одну ошибку.
loadGltfLoader()
.catch(() => { throw new Error(dict.v3_err_lib); })
// Индекс заодно выбирает, откуда брать файлы (Cloudflare или сайт).
.then(() => loadModelIndex())
.then(() => fetch(modelsUrl(modelUrl), { cache: 'no-store' }).catch(() => { throw new Error(dict.v3_err_net); }))
.then(async response => {
if (response.status === 404) throw new Error(dict.v3_err_404);
if (!response.ok) throw new Error(dict.v3_err_net + ' (HTTP ' + response.status + ')');
const type = (response.headers.get('content-type') || '').toLowerCase();
if (type.includes('text/html')) throw new Error(dict.v3_err_html);
const buffer = await response.arrayBuffer();
// Каждый .glb начинается с сигнатуры "glTF" — читаем байты
// напрямую, без TextDecoder (его нет в части старых WebView).
const head = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
const magic = String.fromCharCode.apply(null, head);
if (magic !== 'glTF'){
// Не бросаем ошибку сразу: моя проверка может ошибаться (например,
// файл пришёл сжатым). Просто запоминаем, что увидели, и всё равно
// отдаём буфер загрузчику — последнее слово за ним.
const preview = String.fromCharCode.apply(
null, new Uint8Array(buffer, 0, Math.min(60, buffer.byteLength))
).replace(/[^\x20-\x7e]/g, '.');
magicWarning = `${(buffer.byteLength / 1024).toFixed(0)} КБ · начало: ${preview}`;
console.warn('3D: неожиданное начало файла —', magicWarning);
}
status.textContent = dict.v3_size.replace('{mb}', (buffer.byteLength / 1048576).toFixed(1));
return buffer;
})
.then(buffer => parseGlb(buffer).catch(err => {
// Текстуры не декодируются — показываем хотя бы геометрию.
console.warn('3D: разбор с текстурами не удался, пробую без них —', err);
texturesDropped = true;
return parseGlb(stripTexturesFromGlb(buffer)).catch(() => {
const wrapped = new Error(dict.v3_err_parse);
wrapped.detail = [(err && err.message) || String(err), magicWarning].filter(Boolean).join(' · ');
throw wrapped;
});
}))
.then(gltf => {
dispose3DViewer();
const canvas = document.getElementById('viewer3dCanvas');
const renderer = new THREE.WebGLRenderer({
canvas, antialias: mode !== 'light', alpha: true,
});
renderer.setPixelRatio(mode === 'light' ? 1 : Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, canvas.clientWidth / canvas.clientHeight, 0.05, 100);
// Крутим не саму модель, а группу вокруг её центра — иначе ствол
// вращался вокруг начала координат файла и уезжал из кадра.
const object = new THREE.Group();
object.add(gltf.scene);
// Без раскраски (или пока она грузится) — старый корпус, как в игре
// у стандартного оружия.
selectModelBody(object, false);
scene.add(object);
const baseDistance = fitObjectToView(THREE, gltf.scene, camera);

setupViewerScene(THREE, renderer, scene);

// Раскраска лота, если она указана.
if (skinDir){
Promise.all([
loadSkinPack(THREE, skinDir),
weaponDir ? loadWeaponPack(THREE, weaponDir).catch(() => null) : Promise.resolve(null),
])
.then(([skin, weapon]) => {
if (!skin.pattern && !skin.solid) throw new Error('не загрузился узор');
applySkinToModel(THREE, object, skin, wearValue, weapon, maskChannel, seed);
status.textContent = `${dict.v3_skin_on} · float ${formatFloat(wearValue || 0)}`;
setTimeout(() => { status.textContent = ''; }, 3000);
})
.catch(err => {
console.warn('3D: раскраска не применилась —', err);
status.textContent = dict.v3_skin_failed;
});
}

let autoRotate = true;
let dragging = false, lastX = 0, lastY = 0, pinchStart = 0;

const onStart = (e) => {
if (e.touches && e.touches.length === 2){
pinchStart = Math.hypot(
e.touches[0].clientX - e.touches[1].clientX,
e.touches[0].clientY - e.touches[1].clientY
);
return;
}
dragging = true;
autoRotate = false;
const p = e.touches ? e.touches[0] : e;
lastX = p.clientX;
lastY = p.clientY;
};
const onMove = (e) => {
if (e.touches && e.touches.length === 2 && pinchStart){
const dist = Math.hypot(
e.touches[0].clientX - e.touches[1].clientX,
e.touches[0].clientY - e.touches[1].clientY
);
camera.position.z = Math.min(baseDistance * 2.2, Math.max(baseDistance * 0.45, camera.position.z * (pinchStart / dist)));
pinchStart = dist;
e.preventDefault();
return;
}
if (!dragging) return;
const p = e.touches ? e.touches[0] : e;
object.rotation.y += (p.clientX - lastX) * 0.01;
object.rotation.x += (p.clientY - lastY) * 0.01;
lastX = p.clientX;
lastY = p.clientY;
e.preventDefault();
};
const onEnd = () => { dragging = false; pinchStart = 0; };

canvas.addEventListener('touchstart', onStart, { passive: true });
canvas.addEventListener('touchmove', onMove, { passive: false });
canvas.addEventListener('touchend', onEnd);
canvas.addEventListener('mousedown', onStart);
canvas.addEventListener('mousemove', onMove);
canvas.addEventListener('mouseup', onEnd);

const animate = () => {
if (autoRotate) object.rotation.y += 0.006;
renderer.render(scene, camera);
viewer3d.raf = requestAnimationFrame(animate);
};

viewer3d = { renderer, scene, camera, object, raf: 0 };
animate();

status.textContent = `${dict.v3_triangles}: ${countTriangles(THREE, object).toLocaleString('ru-RU')}`
+ (texturesDropped ? ' · без текстур' : '');
setTimeout(() => { status.textContent = ''; }, 2500);
})
.catch(err => {
// Путь показываем рядом с причиной — чаще всего ошибка именно в нём.
status.innerHTML = `${escapeHtml(err.message || dict.v3_failed)}<br><span style="opacity:.7;">${escapeHtml(modelUrl)}</span>`
+ (err.detail ? `<br><span class="v3-detail">${escapeHtml(err.detail)}</span>` : '');
});
}

document.getElementById('viewer3dCloseBtn').addEventListener('click', () => {
viewer3dOverlay.classList.remove('show');
dispose3DViewer();
});

const d3ViewBtn = document.getElementById('d3ViewBtn');

if (d3ViewBtn){
d3ViewBtn.addEventListener('click', () => {
const url = document.getElementById('d3ModelUrl').value.trim();
if (!url) return;
if (!get3DMode()) document.getElementById('d3Status').textContent = (I18N[currentLang] || I18N.ru).v3_no_mode;
const skinDir = document.getElementById('d3SkinDir').value.trim();
const wear = Number(document.getElementById('d3Float').value) || 0;
const weaponDir = document.getElementById('d3WeaponDir').value.trim();
const maskChannel = document.getElementById('d3MaskChannel').value;
open3DViewer(url, null, skinDir || null, wear, weaponDir || null, maskChannel);
});
}

// ---------- 3D в окне покупки ----------
// models/index.json (его строит build-index.sh) сопоставляет название
// лота «AK-47 | Redline» с моделью и раскраской. Кнопка «3D» видна
// только у тех лотов, для которых всё это лежит в репозитории.
let modelIndexLoading = null;

// 3D-файлы раздаются с Cloudflare Pages (ветка 3d-assets, workflow
// deploy-3d.yml): там нет лимита GitHub Pages в 1 ГБ. В main папки
// models/ больше нет; запасной путь «с этого же сайта» оставлен для
// локальной проверки (положить models/ рядом с index.html).
const MODELS_CDN = 'https://dghost-3d.pages.dev/';
let modelsBase = '';

// «models/…» → полный адрес на выбранном хранилище; остальное как есть.
function modelsUrl(path){
path = String(path || '');
return path.indexOf('models/') === 0 ? modelsBase + path : path;
}

function fetchModelIndex(base){
return fetch(base + 'models/index.json', { cache: 'no-cache' })
.then(r => {
if (!r.ok) throw new Error('index ' + r.status);
return r.json();
})
.then(index => { modelsBase = base; return index; });
}

function loadModelIndex(){
if (!modelIndexLoading){
modelIndexLoading = (MODELS_CDN ? fetchModelIndex(MODELS_CDN).catch(() => fetchModelIndex('')) : fetchModelIndex(''))
.catch(() => ({}))
.then(index => {
// Ключи без учёта регистра — названия в базе и в игре иногда
// расходятся заглавными буквами.
const map = {};
Object.keys(index || {}).forEach(name => { map[name.toLowerCase()] = index[name]; });
return map;
});
}
return modelIndexLoading;
}

// «StatTrak™ AK-47 | Redline (Field-Tested)» → «ak-47 | redline».
function modelIndexKey(title){
return String(title || '')
.replace(/^\s*(★\s*)?(StatTrak™\s*|Souvenir\s+)?/i, '')
.replace(/\s*\([^)]*\)\s*$/, '')
.trim()
.toLowerCase();
}

const buy3dBtn = document.getElementById('buy3dBtn');
let buy3dEntry = null;
let buy3dSkin = null;

function update3DButton(skin){
if (!buy3dBtn) return;
buy3dBtn.style.display = 'none';
buy3dEntry = null;
buy3dSkin = skin;
loadModelIndex().then(map => {
// Пока грузился индекс, могли открыть другой лот.
if (buy3dSkin !== skin) return;
const entry = map[modelIndexKey(skin && skin.title)];
if (!entry || !entry.model || !entry.skin) return;
buy3dEntry = entry;
buy3dBtn.style.display = '';
});
}

if (buy3dBtn){
buy3dBtn.addEventListener('click', () => {
if (!buy3dEntry || !buy3dSkin) return;
const skin = buy3dSkin;
const title = skin.stattrak ? 'StatTrak™ ' + skin.title : skin.title;
open3DViewer(buy3dEntry.model, title, buy3dEntry.skin, Number(skin.float_value) || 0, buy3dEntry.weapon || null, 'none', skin.pattern);
});
}

// ---------- GIF с 3D-рендером для «Поделиться» ----------
// Рендерим оборот ствола в маленький холст, собираем GIF (gifenc,
// ~10 КБ) и отдаём боту. Бот готовит сообщение (savePreparedInlineMessage),
// а Telegram.WebApp.shareMessage показывает окно выбора чата.
// Если что-то из этого недоступно — «Поделиться» работает по-старому,
// ссылкой.
const GIFENC_URL = 'https://cdn.jsdelivr.net/npm/gifenc@1.0.3/dist/gifenc.esm.js';
const SHARE_GIF = { width: 360, height: 240, frames: 36, delay: 70, colors: 128 };
// Картинка для «Поделиться» — один кадр крупнее, чем у GIF.
const SHARE_PHOTO = { width: 1080, height: 720, quality: 0.9 };
let gifencLoading = null;

function loadGifEncoder(){
if (!gifencLoading){
gifencLoading = dynamicImport(GIFENC_URL).catch(err => {
gifencLoading = null;
throw err;
});
}
return gifencLoading;
}

function drawShareFrame(ctx, glCanvas, title, size){
const { width: W, height: H } = size || SHARE_GIF;
// Шрифты и отступы — от ширины GIF (360), чтобы картинка выглядела так же.
const k = W / SHARE_GIF.width;
const bg = ctx.createRadialGradient(W / 2, H / 2, 10 * k, W / 2, H / 2, W * 0.7);
bg.addColorStop(0, '#2a1650');
bg.addColorStop(1, '#0c0816');
ctx.fillStyle = bg;
ctx.fillRect(0, 0, W, H);
ctx.drawImage(glCanvas, 0, 0, W, H);
ctx.font = `bold ${Math.round(13 * k)}px sans-serif`;
ctx.fillStyle = '#ffffff';
ctx.fillText(title, 12 * k, H - 14 * k, W - 24 * k);
ctx.font = `bold ${Math.round(10 * k)}px monospace`;
ctx.fillStyle = '#A855F7';
ctx.fillText('DGHOSTMARKET', 12 * k, 18 * k);
}

// still: true — вместо GIF один кадр JPEG (SHARE_PHOTO);
// 'transparent' — один кадр PNG без фона и подписи (сверка со Steam).
async function render3DGif(entry, wear, title, onProgress, seed, still){
const size = still ? SHARE_PHOTO : SHARE_GIF;
const { width: W, height: H } = size;
const { frames, delay, colors } = SHARE_GIF;
const [, gifenc] = await Promise.all([loadGltfLoader(), still ? null : loadGifEncoder()]);

await loadModelIndex();
const response = await fetch(modelsUrl(entry.model));
if (!response.ok) throw new Error('model ' + response.status);
const buffer = await response.arrayBuffer();
const gltf = await parseGlb(buffer).catch(() => parseGlb(stripTexturesFromGlb(buffer)));
const [skin, weapon] = await Promise.all([
loadSkinPack(THREE, entry.skin),
entry.weapon ? loadWeaponPack(THREE, entry.weapon).catch(() => null) : null,
]);
if (!skin.pattern && !skin.solid) throw new Error('не загрузился узор');

const glCanvas = document.createElement('canvas');
glCanvas.width = W;
glCanvas.height = H;
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
const scene = new THREE.Scene();
try {
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.setClearColor(0x000000, 0);

const camera = new THREE.PerspectiveCamera(40, W / H, 0.05, 100);
const object = new THREE.Group();
object.add(gltf.scene);
// Без раскраски (или пока она грузится) — старый корпус, как в игре
// у стандартного оружия.
selectModelBody(object, false);
scene.add(object);
fitObjectToView(THREE, gltf.scene, camera);
// Ствол только покачивается, запас под полный оборот не нужен.
// На картинке кадр один — оставляем запас, чтобы ножи (они стоят
// вертикально) не обрезались сверху и снизу.
if (!still) camera.position.multiplyScalar(0.78);
applySkinToModel(THREE, object, skin, wear, weapon, 'none', seed);
await setupViewerScene(THREE, renderer, scene);

const out = document.createElement('canvas');
out.width = W;
out.height = H;
const ctx = out.getContext('2d', { willReadFrequently: true });

if (still){
// Тот же ракурс, что в середине покачивания GIF, чуть повёрнутый к камере.
object.rotation.y = Math.PI / 2 + 0.3;
renderer.render(scene, camera);
if (still === 'transparent'){
const png = await new Promise(resolve => glCanvas.toBlob(resolve, 'image/png'));
if (!png) throw new Error('не получилось сохранить картинку');
return new Uint8Array(await png.arrayBuffer());
}
drawShareFrame(ctx, glCanvas, title, size);
if (onProgress) onProgress(1);
const blob = await new Promise(resolve => out.toBlob(resolve, 'image/jpeg', SHARE_PHOTO.quality));
if (!blob) throw new Error('не получилось сохранить картинку');
return new Uint8Array(await blob.arrayBuffer());
}

const encoder = gifenc.GIFEncoder();

for (let i = 0; i < frames; i++){
// Не полный оборот, а покачивание ±35° вокруг вида сбоку: при
// обороте ствол половину времени смотрел в камеру торцом.
object.rotation.y = Math.PI / 2 + 0.6 * Math.sin((i / frames) * Math.PI * 2);
renderer.render(scene, camera);
drawShareFrame(ctx, glCanvas, title);
const { data } = ctx.getImageData(0, 0, W, H);
const palette = gifenc.quantize(data, colors);
encoder.writeFrame(gifenc.applyPalette(data, palette), W, H, { palette, delay });
if (onProgress) onProgress((i + 1) / frames);
// Отдаём управление браузеру, чтобы окно не подвисало.
await new Promise(resolve => setTimeout(resolve, 0));
}
encoder.finish();
return encoder.bytes();
} finally {
scene.traverse(node => {
if (node.geometry) node.geometry.dispose();
if (node.material){
(Array.isArray(node.material) ? node.material : [node.material]).forEach(m => m.dispose());
}
});
renderer.dispose();
if (renderer.forceContextLoss) renderer.forceContextLoss();
}
}

function bytesToBase64(bytes){
let binary = '';
for (let i = 0; i < bytes.length; i += 0x8000){
binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
}
return btoa(binary);
}

// Есть ли у открытого лота 3D — без него картинку и GIF не сделать.
function canShare3DLot(skin){
return !!(skin && buy3dSkin === skin && buy3dEntry && tg && tg.initData);
}

// kind: 'photo' — картинка, 'gif' — анимация. Рисуем лот и загружаем
// боту; бот кладёт файл в Telegram и готовит сообщение для окна выбора
// чата. Возвращает { preparedId, name }: preparedId — для
// tg.shareMessage (может не быть), name — для отправки в личку.
async function prepareShare3DLot(skin, onStatus, kind){
if (!canShare3DLot(skin)) throw new Error('no_3d');
const still = kind === 'photo';
const dict = I18N[currentLang] || I18N.ru;
const title = (skin.stattrak ? 'StatTrak™ ' : '') + skin.title;
const say = (text) => { if (onStatus) onStatus(text); };
const preparing = still ? dict.share_photo_preparing : dict.share_gif_preparing;

say(preparing.replace('{p}', '0'));
const bytes = await render3DGif(buy3dEntry, Number(skin.float_value) || 0, title,
p => say(preparing.replace('{p}', Math.round(p * 100))), skin.pattern, still);

const payload = { init_data: tg.initData, skin_id: skin.id, kind: still ? 'photo' : 'gif' };
payload[still ? 'image_base64' : 'gif_base64'] = bytesToBase64(bytes);
const response = await fetch(API_BASE + '/api/share/prepare', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(payload),
});
const data = await response.json().catch(() => ({}));
if (!response.ok || !data.gif_url) throw new Error(data.error || ('HTTP ' + response.status));
return { preparedId: data.prepared_id || null, name: String(data.gif_url).split('/').pop() };
}

// Окно Telegram «выбрать, кому отправить» (Bot API 8.0+).
function canShareMessage(){
return !!(tg && typeof tg.shareMessage === 'function'
&& (typeof tg.isVersionAtLeast !== 'function' || tg.isVersionAtLeast('8.0')));
}

// Запасной путь: бот присылает картинку/GIF в личку, оттуда пересылают.
async function sendShareToDm(skin, name){
const sent = await fetch(API_BASE + '/api/share/send', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ init_data: tg.initData, skin_id: skin.id, name }),
});
const data = await sent.json().catch(() => ({}));
if (!sent.ok) throw new Error(data.error || ('HTTP ' + sent.status));
return true;
}
