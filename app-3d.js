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
const APP3D_VERSION = 69;

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

// Кадр для «Поделиться»: модель целиком и по центру на всех углах
// покачивания. Считаем только видимые меши (у ножей и стволов в файле
// есть скрытый второй корпус — из-за него центр уезжал вбок, а нож
// обрезался сверху и снизу). Сверху место под логотип, снизу — под
// подпись; модель встаёт в середину оставшейся полосы.
const SHARE_FRAME = { top: 0.1, bottom: 0.16, side: 0.06 };
function frameShareView(THREE, object, camera, angles){
const isShown = (node) => { for (let n = node; n; n = n.parent){ if (n.visible === false) return false; } return true; };
const keep = object.rotation.y;
// Углы бокса каждого видимого меша на каждом угле покачивания — точнее
// общего бокса: длинный ствол, уходя в глубину, не раздувает кадр.
const points = [];
const corner = new THREE.Vector3();
angles.forEach(a => {
object.rotation.y = a;
object.updateMatrixWorld(true);
object.traverse(node => {
if (!node.isMesh || !node.geometry || !isShown(node)) return;
if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
const bb = node.geometry.boundingBox;
for (let i = 0; i < 8; i++){
corner.set(i & 1 ? bb.max.x : bb.min.x, i & 2 ? bb.max.y : bb.min.y, i & 4 ? bb.max.z : bb.min.z);
points.push(corner.clone().applyMatrix4(node.matrixWorld));
}
});
});
object.rotation.y = keep;
if (!points.length) return;
const box = new THREE.Box3().setFromPoints(points);
const center = box.getCenter(new THREE.Vector3());
const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
const tanH = tanV * camera.aspect;
const fillV = 1 - SHARE_FRAME.top - SHARE_FRAME.bottom;
const fillH = 1 - 2 * SHARE_FRAME.side;
// Камера смотрит вдоль -Z на центр: каждая точка должна попасть в
// свою долю кадра на своей глубине.
let dist = 0;
points.forEach(p => {
const dx = Math.abs(p.x - center.x), dy = Math.abs(p.y - center.y), dz = p.z - center.z;
dist = Math.max(dist, dx / (tanH * fillH) + dz, dy / (tanV * fillV) + dz);
});
// Середина полосы между логотипом и подписью — чуть выше центра кадра.
const shift = (SHARE_FRAME.bottom - SHARE_FRAME.top) * tanV * dist;
camera.position.set(center.x, center.y - shift, center.z + dist);
camera.lookAt(center.x, center.y - shift, center.z);
camera.near = Math.max(dist / 100, 0.001);
camera.far = dist * 10;
camera.updateProjectionMatrix();
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
return loadWeaponTextures(THREE, base, textures).then(pack => {
pack.name = weaponNameFromDir(dir);
// Текстуры HD-корпуса (маска зон, родной цвет, AO) — грузятся, только
// когда раскраска легла на HD-корпус (loadSkinWithWeapon).
pack.hdBase = base;
pack.hdTextures = meta.hd && meta.hd.textures ? meta.hd.textures : null;
// Слоты наклеек из материала ствола (prep-stickers.sh).
pack.stickerSlots = Array.isArray(meta.stickers) ? meta.stickers : [];
return pack;
});
});
}

// ---------- Наклейки ----------
// В игре наклейка ложится по второй развёртке модели (TEXCOORD_1): её
// центр — в точке uv1 = 0.5 + смещение слота из материала ствола,
// ширина — 1/масштаб. Сверено со скриншотами CSFloat (AK-47, Glock-18,
// Desert Eagle). Все наклейки лота — в одном холсте-атласе: так они
// занимают один текстурный слот, а не пять.
const STICKER_CELL = 256;
const STICKER_MAX = 5;

// Картинки наклеек — с CDN Steam, а он не отдаёт CORS-заголовок; без
// него WebGL картинку не возьмёт, поэтому — через бота.
function stickerImageUrl(url){
const big = /\/economy\/image\/[^/]+$/.test(url) ? url + '/256fx256f' : url;
return API_BASE + '/api/sticker_image?url=' + encodeURIComponent(big);
}

function loadStickerImage(url){
return new Promise((resolve) => {
const img = new Image();
img.crossOrigin = 'anonymous';
img.onload = () => resolve(img);
img.onerror = () => resolve(null);
img.src = stickerImageUrl(url);
});
}

// Наклейки лота ({slot, image, wear}) → атлас и список для шейдера.
// Наклейки без картинки или со слотом, которого у ствола нет, пропускаем.
async function loadStickerAtlas(THREE, stickers){
const list = (Array.isArray(stickers) ? stickers : [])
.filter(st => st && st.image && Number.isInteger(Number(st.slot)))
.slice(0, STICKER_MAX);
if (!list.length) return null;
const images = await Promise.all(list.map(st => loadStickerImage(st.image)));
const canvas = document.createElement('canvas');
canvas.width = STICKER_CELL * STICKER_MAX;
canvas.height = STICKER_CELL;
const ctx = canvas.getContext('2d');
const items = [];
images.forEach((img, i) => {
if (!img) return;
const k = Math.min(STICKER_CELL / img.width, STICKER_CELL / img.height);
const w = img.width * k, h = img.height * k;
ctx.drawImage(img, i * STICKER_CELL + (STICKER_CELL - w) / 2, (STICKER_CELL - h) / 2, w, h);
items.push({ cell: i, slot: Number(list[i].slot), wear: Math.min(1, Math.max(0, Number(list[i].wear) || 0)) });
});
if (!items.length) return null;
const texture = new THREE.CanvasTexture(canvas);
if ('colorSpace' in texture) texture.colorSpace = THREE.SRGBColorSpace;
texture.flipY = false;
texture.needsUpdate = true;
return { texture, items };
}

// Параметры наклеек для шейдера: по слоту лота — позиция из ствола.
function stickerUniforms(THREE, atlas, weapon){
const P = [], Q = [];
const slots = weapon && weapon.stickerSlots ? weapon.stickerSlots : [];
(atlas ? atlas.items : []).forEach(it => {
const def = slots.find(sl => Number(sl.slot) === it.slot);
if (!def || P.length >= STICKER_MAX) return;
const sc = Array.isArray(def.scale) ? def.scale : [def.scale, def.scale];
P.push(new THREE.Vector4(def.off[0], def.off[1], sc[0], def.rot || 0));
Q.push(new THREE.Vector4(it.cell, it.wear, sc[1] || sc[0], 0));
});
const count = P.length;
while (P.length < STICKER_MAX){ P.push(new THREE.Vector4()); Q.push(new THREE.Vector4()); }
return { count, P, Q };
}

let whiteTex = null;
function whiteTexture(THREE){
if (!whiteTex){
whiteTex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
whiteTex.needsUpdate = true;
}
return whiteTex;
}

function loadWeaponTextures(THREE, base, textures){
const names = ['color', 'masks', 'rough', 'ao'];
return Promise.all(names.map(name => textures[name]
? loadSkinTexture(THREE, resolveSkinPath(base, textures[name]), name === 'color')
: Promise.resolve(null)
)).then(loaded => {
const pack = {};
names.forEach((name, i) => { pack[name] = loaded[i]; });
pack.masksRedEmpty = maskChannelEmpty(pack.masks, 0);
return pack;
});
}

// Пустой канал маски (у Shadow Daggers и Zeus сборка взяла чёрную маску):
// по нему краска не ложилась бы никуда — ствол оставался без скина.
function maskChannelEmpty(tex, channel){
const img = tex && tex.image;
if (!img || !img.width) return false;
try {
const c = document.createElement('canvas');
c.width = c.height = 32;
const ctx = c.getContext('2d', { willReadFrequently: true });
ctx.drawImage(img, 0, 0, 32, 32);
const d = ctx.getImageData(0, 0, 32, 32).data;
for (let i = channel; i < d.length; i += 4) if (d[i] > 24) return false;
return true;
} catch (e) {
return false;
}
}

// Раскраска и текстуры ствола. Под HD-корпус у ствола свои маска зон и
// родной цвет: без них однотонные и шаблонные раскраски заливали всю
// модель одним цветом (M249 Impact Drill — целиком жёлтый).
function loadSkinWithWeapon(THREE, skinDir, weaponDir){
return Promise.all([
loadSkinPack(THREE, skinDir),
weaponDir ? loadWeaponPack(THREE, weaponDir).catch(() => null) : Promise.resolve(null),
]).then(([skin, weapon]) => {
if (!weapon || !weapon.hdTextures || !skinUsesHdBody(skin)) return [skin, weapon];
return loadWeaponTextures(THREE, weapon.hdBase, weapon.hdTextures)
.then(hd => {
hd.name = weapon.name;
// AO у HD-набора бывает не у всех стволов — тогда без затенения.
if (hd.masks && hd.color && !hd.ao) hd.ao = whiteTexture(THREE);
weapon.hd = hd.masks && hd.color ? hd : null;
return [skin, weapon];
})
.catch(() => [skin, weapon]);
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
// У ножей UVScale из items_game (у большинства — одна заглушка 0.36)
// растягивал узор втрое: Gamma Doppler на Falchion выходил одним сплошным
// пятном. Без него — как в игре (сверка со Steam по 60 Doppler/Gamma
// Doppler/Marble Fade: 69.4 → 71.1; на остальных ножах без изменений).
if (isKnifeName(weaponName)) return 1;
return WEAPON_UV_SCALE[weaponName] || 1;
}

// Только для сверки со Steam (tools/steam-compare, TPL_SCALE): множитель
// масштаба узора у шаблонных спрея и гидрографии — подбираем, как его
// понимает игра. В мини-аппе window.DGHOST_TPL_SCALE не задан — 1.
function templateScaleTest(skin){
const k = Number(window.DGHOST_TPL_SCALE) || 1;
return skin.format === 'template' && [1, 2].indexOf(skin.params.paint_style) !== -1 ? k : 1;
}

const PATINA_PATTERN_GAMMA = 1.8;
function legacyPatinaStyle(skin){
return (!skin.format || skin.format === 'legacy') && [7, 8].indexOf(skin.params.paint_style) !== -1;
}
// Патина (стиль 7): узор тонирует сам металл ствола — умножаем на его
// яркость (не цвет: у старых корпусов база бежевая/деревянная) и кладём
// только на металл (R маски ствола): у MAC-10 Carnivore в игре красная
// одна ствольная коробка, магазин и рукоять серые. Подобрано по CSFloat
// (10 скинов): ошибка яркости 16 → 7. Для gunsmith (8) — гамма.
// Новые скины на шаблоне gunsmith (gs_template: Run Run Run, Traitor,
// Half Sleeve, Arctic Camo Panels) без степени выходили светлее игры на
// 10–24 по яркости; степень 1.6 (по CSFloat) — ошибка 18 → 4.
const GUNSMITH_TEMPLATE_GAMMA = 1.6;
function gunsmithTemplate(skin){
return skin.format === 'vcompmat' && /^gs_(extended_)?template$/.test(String(skin.params.paint_template || ''));
}
function noiseCaseHardening(skin){
return !!skin.ramp && skin.format === 'vcompmat' && /^(aq|so)_case_hardening_template$/.test(String(skin.params.paint_template || ''));
}
// Тонировка цветом — только у патины со своими цветами. У Case Hardened
// (aq_oiled) цветов нет: цвет — сам узор, иначе ствол выходил чёрным.
function legacyPatinaBlend(skin){
return legacyPatinaMetal(skin) && Array.isArray(skin.params.colors) && skin.params.colors.length > 0;
}
// Патина и закалка старого формата — обработка металла: только по R маски.
function legacyPatinaMetal(skin){
return legacyPatinaStyle(skin) && skin.params.paint_style === 7;
}

// Фаза радуги и усиление подобраны по CSFloat (Leafhopper — зелёный,
// Marsh — салатовый): см. tools/steam-compare. Сила в шейдере не больше
// 0.5: у AK-47 Aphrodite в рецепте 1.26, а в игре приклад перламутровый,
// а не радужный.
const IRIDESCENT = { phase: 0.0, gain: 1.6 };
// x — зона (0 — везде, 1 — основа, 2–4 — R/G/B масок зон), y — сила,
// z — яркость (F_OVERLAY_MASK, g_fOverlayStrength/Brightness рецепта).
// Проверены режимы 0 и 4 и зоны 0–4; остальные (полутона Halftone:
// режим 2, зона 6) пока не рисуем, чтобы не испортить скин.
function overlayVec(THREE, params){
const o = params.overlay || {};
const blend = Number(o.blend) || 0, mask = Number(o.mask) || 0;
const known = (blend === 0 || blend === 4) && mask >= 0 && mask <= 4;
return new THREE.Vector3(mask, known ? (o.strength ?? 1) : 0, o.brightness ?? 1);
}
function iridescentVec(THREE, params){
const v = Array.isArray(params.iridescent) ? params.iridescent.map(Number) : [0, 1, 0];
return new THREE.Vector3(v[0] || 0, v[1] || 1, v[2] || 0);
}

function colorVec4(THREE, list){
const v = Array.isArray(list) ? list.map(Number) : [0, 0, 0, 0];
return new THREE.Vector4(v[0] || 0, v[1] || 0, v[2] || 0, v[3] || 0);
}

// Скины, у которых краска в игре лежит только на металле, хотя по
// текстуре узора этого не видно: у AK-47 Fire Serpent приклад, рукоять
// и цевьё остаются деревом (в узоре там тёмный фон). Сверено по CSFloat.
const SKIN_MASK_OVERRIDES = {
cu_fireserpent_ak47_bravo: 'r',
};

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
// knifeRoughness: клинки ножей в игре светлее, с белёсыми бликами — сверка
// со Steam по 60 Doppler/Gamma Doppler/Marble Fade: 71.1 → 73.2 (на
// анодированном огнестреле 0.45 хуже — там остаётся 0.3).
const ANODIZED = { metalness: 1, roughness: 0.3, knifeRoughness: 0.45, envIntensity: 5 };
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
function applySkinToModel(THREE, object, skin, wear, weapon, maskChannel, seed, stickerAtlas){
// true — только если у модели правда есть HD-корпус и он включён.
// У ножей корпус один, и маска ствола им нужна всегда (иначе краска
// ложилась и на рукоять — Falchion Gamma Doppler).
const useHd = selectModelBody(object, skinUsesHdBody(skin));
// Текстуры ствола (маски зон, цвет, AO) старого корпуса на HD-корпусе
// не годятся: развёртка другая, они дают розовые края и пятна. Для HD
// берём его собственный набор (если сборка его уже положила).
if (useHd) weapon = weapon && weapon.hd ? weapon.hd : null;
// 0,1,2 — каналы маски; 3 — красить всё без маски; 4 — показать
// саму маску цветом (отладка: видно, какой канал за что отвечает).
const CHANNELS = { r: 0, g: 1, b: 2, none: 3, debug: 4 };
// Ножи, где и не-анодированная раскраска лежит только на клинке
// (Crimson Web — паутина на клинке, рукоять родная): сверка 62.8 → 68.2.
const KNIFE_BLADE_ONLY = new Set(['hy_webs']);
// По умолчанию — без маски: у стилей вроде custom paint (Redline)
// краска покрывает ствол целиком, а текстура masks в CS2 хранит не
// зоны покраски, а свойства поверхности.
// R в маске ствола — металлические детали. Анодирование (Fade, Doppler,
// Moonrise) в игре ложится только на металл: у Glock Moonrise окрашен
// затвор, рамка серая; у ножей — клинок (рукоять Butterfly Fade родная).
// Так же и патина (стиль 7) — обработка металла. Остальные стили и у ножей
// красят всю модель (Bayonet Ultraviolet — фиолетовая рукоять, Butterfly
// Boreal Forest — рукоять в камуфляже): сверка со Steam по 60 ножам 66 → 69.
const weaponName = weapon ? weapon.name || '' : '';
let maskName = String(maskChannel || 'none').toLowerCase();
if (maskName === 'none' && SKIN_MASK_OVERRIDES[skin.finish] && weapon && weapon.masks) maskName = SKIN_MASK_OVERRIDES[skin.finish];
if (maskName === 'none' && weapon && weapon.masks && !weapon.masksRedEmpty
&& (isAnodized(skin.params) || legacyPatinaMetal(skin)
|| (isKnifeName(weaponName) && KNIFE_BLADE_ONLY.has(skin.finish)))) maskName = 'r';
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
// Закалка с шумом (aq_/so_case_hardening: Heat Treated, Rainbow Spoon,
// Solitude): цвет целиком из 2D-палитры. У gunsmith-закалки (Zeno) узор —
// настоящая картинка, и без палитры она ближе к игре — её не трогаем.
uHasRamp: { value: noiseCaseHardening(skin) ? 1 : 0 },
uRampGeo: { value: hardening ? Number(hardening.geometric_influence) || 0 : 0 },
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
// Свои маски зон скина — только для раскладки цветов и зоны оверлея;
// где краска лежит вообще (клинок ножа, металл), решает маска ствола.
uZones: { value: skin.zones || (weapon && weapon.masks) || pattern },
uHasZones: { value: skin.zones || (weapon && weapon.masks) ? 1 : 0 },
uAo: { value: weapon ? weapon.ao : null },
uWearAmount: { value: Math.max(0, Math.min(1, wear || 0)) },
uPatternScale: { value: (skin.params.pattern_scale || 1) * weaponPatternScale(skin, weaponName) * templateScaleTest(skin) },
// Поворот узора в params.json — в градусах.
uPatternRotation: { value: placement.rotation * Math.PI / 180 },
// Сдвиг узора по seed (в долях текстуры).
uPatternOffset: { value: new THREE.Vector2(placement.offset[0], placement.offset[1]) },
uWearScale: { value: skin.params.wear_scale || 1 },
uGrungeScale: { value: skin.params.grunge_scale || 1 },
uPaintMetalness: { value: paintMetalness(skin.params) },
// Своя карта металличности краски (Zeno — серый металлик).
uSkinMetal: { value: skin.metalness || pattern },
// Зоны покраски раскраски (paint by number): R/G/B — где лежат цвета
// 1–3 поверх узора. У MP7 Amberline так закрашены тёмным рукоять,
// магазин и мелкие детали.
uPbn: { value: skin.pbn || pattern },
uHasPbn: { value: skin.pbn ? 1 : 0 },
// Металличность и шероховатость каждого из четырёх цветов (шаблоны:
// у MP7 Amberline оранжевый и белый — металлик, тёмные детали — нет).
uColorMetal: { value: colorVec4(THREE, skin.params.color_metalness) },
uColorRough: { value: colorVec4(THREE, skin.params.color_roughness) },
uHasColorMetal: { value: Array.isArray(skin.params.color_metalness) ? 1 : 0 },
uHasColorRough: { value: Array.isArray(skin.params.color_roughness) ? 1 : 0 },
uHasSkinMetal: { value: skin.metalness ? 1 : 0 },
uPaintRoughness: { value: isKnifeName(weaponName) ? ANODIZED.knifeRoughness : ANODIZED.roughness },
uHasPaintRoughness: { value: isAnodized(skin.params) ? 1 : 0 },
uUseColors: { value: skin.solid || skinUsesColorMask(skin.params) ? 1 : 0 },
uColors: { value: skinColors(THREE, skin.params) },
// Узор грузится как sRGB, а маске нужны исходные значения каналов.
uMaskGamma: { value: THREE.SRGBColorSpace ? 1 / 2.2 : 1 },
uColorBrightness: { value: skin.params.color_brightness || 1 },
// Патина (7) и Gunsmith (8) старого формата выходили бледно-пастельными
// (по сверке с CSFloat светлее игры на 30–50 по яркости). Степень 1.8
// у узора возвращает и яркость, и оттенок: Decimator — тёмно-синий,
// Night Terror и Nebula Crusader — оранжевые, Magma — тёмная.
uPatternGamma: { value: legacyPatinaStyle(skin) && !legacyPatinaBlend(skin) ? PATINA_PATTERN_GAMMA : (gunsmithTemplate(skin) ? GUNSMITH_TEMPLATE_GAMMA : 1) },
uPatinaBlend: { value: legacyPatinaBlend(skin) ? 1 : 0 },
uMaskChannel: { value: channel },
// Иризация (шаблоны soe/aq: Leafhopper, Marsh, Pink Pearl): оттенок
// краски плывёт по радуге с углом взгляда. x — сила, y — масштаб,
// z — сдвиг оттенка (g_flIridescentStrength/Scale/HueShift рецепта).
uIrid: { value: iridescentVec(THREE, skin.params) },
uIridByMetal: { value: /^so_case_hardening/.test(String(skin.params.paint_template || '')) ? 1 : 0 },
uPearl: { value: skin.pearl || pattern },
uHasPearl: { value: skin.pearl ? 1 : 0 },
uOverlay: { value: skin.overlay || pattern },
uHasOverlay: { value: skin.overlay ? 1 : 0 },
uOverlayMask: { value: skin.overlayMask || pattern },
uHasOverlayMask: { value: skin.overlayMask ? 1 : 0 },
uOverlayParams: { value: overlayVec(THREE, skin.params) },
uIridPhase: { value: IRIDESCENT.phase },
uIridGain: { value: IRIDESCENT.gain },
uHasWeapon: { value: weapon && weapon.color ? 1 : 0 },
};
const stk = stickerUniforms(THREE, stickerAtlas, weapon);
if (stk.count){
uniforms.uStkAtlas = { value: stickerAtlas.texture };
uniforms.uStkCount = { value: stk.count };
uniforms.uStkP = { value: stk.P };
uniforms.uStkQ = { value: stk.Q };
}

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
// Сила отражений — из набора света (в three r160 у сцены её ещё нет).
material.envMapIntensity = (isAnodized(skin.params) ? ANODIZED.envIntensity : 1) * lightPreset().env;

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

// Наклейки — по второй развёртке (в three r160 это uv1, в старом
// r128 — uv2; uv2, скопированный из первой развёртки ради AO, не годится).
const g = node.geometry;
const stkUv = g && (g.attributes.uv1 || (g.attributes.uv2 !== g.attributes.uv ? g.attributes.uv2 : null));
const stickersHere = stk.count > 0 && !!stkUv;
if (stickersHere) g.setAttribute('dgStkUv', stkUv);

// Редкие слои подключаются только у тех скинов, где они есть: на
// телефонах обычно 16 текстурных слотов, и все сразу в шейдер не влезут.
const shaderDefines = [
stickersHere ? 'DG_STICKERS' : '',
uniforms.uHasRamp.value ? 'DG_RAMP' : '',
skin.metalness ? 'DG_SKIN_METAL' : '',
skin.pbn ? 'DG_PBN' : '',
skin.zones ? 'DG_ZONES' : '',
skin.overlay ? 'DG_OVERLAY' : '',
skin.overlayMask ? 'DG_OVERLAY_MASK' : '',
skin.pearl && !uniforms.uIridByMetal.value ? 'DG_PEARL' : '',
].filter(Boolean);
material.customProgramCacheKey = () => 'dghost-skin:' + shaderDefines.join(',');
material.onBeforeCompile = (shader) => {
Object.assign(shader.uniforms, uniforms, meshUniforms);

// Своя UV-переменная: в three r152+ общий vUv убрали, у каждой
// текстуры теперь своя (vMapUv, vRoughnessMapUv…), и ссылка на
// vUv роняла компиляцию шейдера — меш просто исчезал.
shader.vertexShader = shader.vertexShader
.replace('#include <common>', `#include <common>
${stickersHere ? '#define DG_STICKERS' : ''}
#ifdef DG_STICKERS
attribute vec2 dgStkUv;
varying vec2 vStkUv;
#endif
varying vec2 vSkinUv;
varying vec2 vProjUv;
uniform mat4 uToRoot;
uniform vec3 uProjU;
uniform vec3 uProjV;
uniform vec3 uProjMin;
uniform float uProjLen;`)
.replace('#include <begin_vertex>', `#include <begin_vertex>
vSkinUv = uv;
#ifdef DG_STICKERS
vStkUv = dgStkUv;
#endif
// Проекция сбоку: обе оси делим на длину оружия, чтобы узор не
// растягивался по высоте.
vec3 rootPos = (uToRoot * vec4(position, 1.0)).xyz - uProjMin;
vProjUv = vec2(dot(rootPos, uProjU), dot(rootPos, uProjV)) / uProjLen;
// Вдоль ствола узор идёт от дула к прикладу — сверено с реальными
// экземплярами CSFloat по паттернам (MP7 Amberline: совпадение цвета
// 68% → 78%; у Glock Moonrise луна встала ближе к дулу, как в игре).
vProjUv.x = -vProjUv.x;`);

shader.fragmentShader = shader.fragmentShader
.replace('#include <common>', `#include <common>
${shaderDefines.map(d => '#define ' + d).join('\n')}
uniform sampler2D uPattern;
#ifdef DG_STICKERS
uniform sampler2D uStkAtlas;
uniform int uStkCount;
uniform vec4 uStkP[${STICKER_MAX}];
uniform vec4 uStkQ[${STICKER_MAX}];
varying vec2 vStkUv;
#endif
#ifdef DG_RAMP
uniform sampler2D uRamp;
#endif
uniform int uHasRamp;
uniform float uRampInfluence;
uniform float uRampOffset;
uniform float uRampGeo;
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
#ifdef DG_SKIN_METAL
uniform sampler2D uSkinMetal;
#endif
#ifdef DG_PBN
uniform sampler2D uPbn;
#endif
uniform int uHasPbn;
uniform vec4 uColorMetal;
uniform vec4 uColorRough;
uniform int uHasColorMetal;
uniform int uHasColorRough;
uniform int uHasSkinMetal;
uniform int uHasPaintRoughness;
uniform int uUseColors;
uniform int uSolid;
uniform vec3 uColors[4];
uniform float uMaskGamma;
uniform float uColorBrightness;
uniform float uPatternGamma;
uniform vec3 uIrid;
uniform int uIridByMetal;
#ifdef DG_ZONES
uniform sampler2D uZones;
#define DG_ZONE_TEX uZones
#else
#define DG_ZONE_TEX uPaintMask
#endif
uniform int uHasZones;
#ifdef DG_OVERLAY
uniform sampler2D uOverlay;
#endif
uniform int uHasOverlay;
#ifdef DG_OVERLAY_MASK
uniform sampler2D uOverlayMask;
#endif
uniform int uHasOverlayMask;
uniform vec3 uOverlayParams;
#ifdef DG_PEARL
uniform sampler2D uPearl;
#endif
uniform int uHasPearl;
uniform float uIridPhase;
uniform float uIridGain;
uniform int uPatinaBlend;
uniform int uMaskChannel;
uniform int uHasWeapon;
uniform int uProjected;
varying vec2 vSkinUv;
varying vec2 vProjUv;`)
.replace('#include <color_fragment>', `#include <color_fragment>
// Доля покрытия краской — нужна ниже, для металличности.
float skinCover = 0.0;
// Доля покрытия наклейками — они матовые и не металлические.
float stkCover = 0.0;
// Какой из четырёх цветов где лежит — для металличности по цветам.
vec4 colorWeight = vec4(1.0, 0.0, 0.0, 0.0);
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
#ifdef DG_RAMP
if (uHasRamp == 1){
// Место в палитре: сдвиг + шум узора (R, исходные значения канала) +
// положение на оружии (g_flCaseHardeningGeometricInfluence) — вдоль
// ствола по горизонтали, по высоте по вертикали. Сверено по CSFloat:
// Heat Treated сине-пурпурный, Solitude синий с золотым рисунком.
float noiseR = pow(patternTex.r, uMaskGamma);
float rampU = fract(uRampOffset + uRampInfluence * noiseR + uRampGeo * (vProjUv.x + 0.5));
float rampV = 0.5 + uRampGeo * vProjUv.y;
pattern = texture2D(uRamp, clamp(vec2(rampU, rampV), 0.002, 0.998)).rgb;
}
#endif
if (uUseColors == 1){
// Первый цвет — основа, остальные ложатся по каналам маски.
// У однотонных раскрасок маской служат зоны покраски самого ствола.
vec3 m = uSolid == 1 && uHasZones == 1 ? texture2D(DG_ZONE_TEX, vSkinUv).rgb
: (uSolid == 2 ? vec3(0.0) : pow(pattern, vec3(uMaskGamma)));
if (uSolid == 2 && uHasWeapon == 1) paintable *= masks.r;
pattern = uColors[0];
pattern = mix(pattern, uColors[1], m.r);
pattern = mix(pattern, uColors[2], m.g);
pattern = mix(pattern, uColors[3], m.b);
colorWeight = mix(colorWeight, vec4(0.0, 1.0, 0.0, 0.0), m.r);
colorWeight = mix(colorWeight, vec4(0.0, 0.0, 1.0, 0.0), m.g);
colorWeight = mix(colorWeight, vec4(0.0, 0.0, 0.0, 1.0), m.b);
#ifdef DG_PBN
if (uHasPbn == 1){
vec3 zone = texture2D(uPbn, vSkinUv).rgb;
pattern = mix(pattern, uColors[1], zone.r);
pattern = mix(pattern, uColors[2], zone.g);
pattern = mix(pattern, uColors[3], zone.b);
colorWeight = mix(colorWeight, vec4(0.0, 1.0, 0.0, 0.0), zone.r);
colorWeight = mix(colorWeight, vec4(0.0, 0.0, 1.0, 0.0), zone.g);
colorWeight = mix(colorWeight, vec4(0.0, 0.0, 0.0, 1.0), zone.b);
}
#endif
}
if (uPatinaBlend == 1) pattern = pattern * uColors[0] * vec3(dot(base, vec3(0.299, 0.587, 0.114))) * 3.4;
else if (uPatternGamma != 1.0) pattern = pow(pattern, vec3(uPatternGamma));
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

// Оверлей: у непрозрачной картинки режимы 0 и 4 рецепта ведут себя
// как замена цвета (розовая рамка Pink Pearl, панели Arctic Camo).
#ifdef DG_OVERLAY
if (uHasOverlay == 1){
vec4 ov = texture2D(uOverlay, vSkinUv);
float ovW = ov.a * uOverlayParams.y;
if (uOverlayParams.x > 0.5){
vec3 zm = uHasZones == 1 ? texture2D(DG_ZONE_TEX, vSkinUv).rgb : vec3(0.0);
float zone = uOverlayParams.x < 1.5 ? 1.0 - max(zm.r, max(zm.g, zm.b))
: (uOverlayParams.x < 2.5 ? zm.r : (uOverlayParams.x < 3.5 ? zm.g : zm.b));
ovW *= zone;
}
#ifdef DG_OVERLAY_MASK
if (uHasOverlayMask == 1) ovW *= texture2D(uOverlayMask, vSkinUv).r;
#endif
painted = mix(painted, ov.rgb * uOverlayParams.z, clamp(ovW, 0.0, 1.0));
result = mix(base, painted, skinCover);
}
#endif

if (uIrid.x > 0.0){
float facing = 1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition)));
float hue = fract(uIridPhase - uIrid.z - uIrid.y * facing);
vec3 rainbow = clamp(abs(fract(hue + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0) - 1.0, 0.0, 1.0);
float iridMask = 1.0;
#ifdef DG_PEARL
if (uHasPearl == 1) iridMask = texture2D(uPearl, vSkinUv).r;
#endif
// У закалки (so_case_hardening: R8 Leafhopper) цвет даёт палитра на
// металле, а маска перламутра — это белая перламутровая рукоять:
// переливаем металл по металличности цветов.
if (uIridByMetal == 1) iridMask = uHasColorMetal == 1 ? dot(colorWeight, uColorMetal) : 1.0;
painted = mix(painted, painted * rainbow * uIridGain, clamp(uIrid.x, 0.0, 0.5) * iridMask);
result = mix(base, painted, skinCover);
}

if (uHasWeapon == 1){
result *= mix(0.55, 1.0, texture2D(uAo, vSkinUv).r);
}

if (uMaskChannel != 4) diffuseColor.rgb = result;
}
#ifdef DG_STICKERS
// Наклейки поверх краски. P: смещение слота (x, y), масштаб по x,
// поворот (рад); Q: ячейка атласа, затёртость, масштаб по y.
for (int i = 0; i < ${STICKER_MAX}; i++){
if (i >= uStkCount) break;
vec4 sp = uStkP[i];
vec4 sq = uStkQ[i];
vec2 d = vStkUv - 0.5 - sp.xy;
float rc = cos(sp.w), rs = sin(sp.w);
d = vec2(rc * d.x - rs * d.y, rs * d.x + rc * d.y) * vec2(sp.z, sq.z);
vec2 suv = d + 0.5;
if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) continue;
vec4 st = texture2D(uStkAtlas, vec2((sq.x + suv.x) / ${STICKER_MAX}.0, suv.y));
// Затёртость: наклейка бледнеет и истирается пятнами по маске износа.
float a = st.a;
if (sq.y > 0.0) a *= smoothstep(sq.y - 0.15, sq.y + 0.15, texture2D(uWearMask, vSkinUv).r * 0.6 + 0.4 * (1.0 - sq.y));
diffuseColor.rgb = mix(diffuseColor.rgb, st.rgb, a);
stkCover = max(stkCover, a);
}
#endif`)
// Краска бывает и не металлической (большинство скинов), и
// металлической (paint_metalness = 1): там, где она лежит, берём
// металличность из params.json, на голом металле — как было.
.replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
float paintMetal = uHasColorMetal == 1 ? dot(colorWeight, uColorMetal) : uPaintMetalness;
#ifdef DG_SKIN_METAL
if (uHasSkinMetal == 1) paintMetal = texture2D(uSkinMetal, vSkinUv).r;
#endif
#ifdef DG_RAMP
// Закалка — это цвет каленого металла: полированный металлик.
if (uHasRamp == 1) paintMetal = 1.0;
#endif
metalnessFactor = mix(metalnessFactor, paintMetal, skinCover);
metalnessFactor = mix(metalnessFactor, 0.0, stkCover);`)
// Анодированная краска — полированная, где бы она ни лежала.
.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
#ifdef DG_RAMP
if (uHasRamp == 1) roughnessFactor = mix(roughnessFactor, 0.3, skinCover);
#endif
if (uHasPaintRoughness == 1) roughnessFactor = mix(roughnessFactor, uPaintRoughness, skinCover);
if (uHasColorRough == 1) roughnessFactor = mix(roughnessFactor, dot(colorWeight, uColorRough), skinCover);
roughnessFactor = mix(roughnessFactor, 0.45, stkCover);`);
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
pbn: textures.pbn || null,
// Свои маски зон ствола (g_tPaintByNumberMasks при
// g_bOverrideDefaultMasks): цвета 1–3 шаблона ложатся по их R/G/B
// вместо масок самого ствола (Pink Pearl, Royal Guard, Leafhopper).
zones: textures.zones || null,
// Маска перламутра (g_tPearlescenceMask): где лежит иризация. У R8
// Leafhopper переливается металл, а рукоять остаётся белой.
pearl: textures.pearl || null,
// Оверлей поверх краски (розовая рамка Pink Pearl, монеты Royal Guard,
// панели Arctic Camo) и его своя маска.
overlay: textures.overlay || null,
overlayMask: textures.overlay_mask || null,
};

const names = Object.keys(wanted);

return Promise.all(names.map(name => {
const file = wanted[name];
if (!file) return Promise.resolve(null);
const isColor = SKIN_COLOR_LAYERS.indexOf(name) !== -1 || name === 'ramp' || name === 'overlay';
return loadSkinTexture(THREE, resolveSkinPath(base, file), isColor);
})).then(loaded => {
const pack = { params: meta.shader || {}, format: meta.format || null, finish: meta.finish || null };
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
// Наборы света. «game» — подобран по скриншотам осмотра в CS2 (CSFloat,
// 14 скинов): яркость как в игре (было светлее на 10 по L, стало ±0).
// «showcase» — прежний, ярче.
// window.DGHOST_LIGHT (только для сверки) подменяет параметры набора.
const LIGHT_PRESETS = {
showcase: { tone: 'aces', exposure: 1.1, ambient: 0.55, key: 2.4, front: 1.2, neon: 0.25, rim: 0.2, env: 1 },
game: { tone: 'aces', exposure: 0.7, ambient: 0.55, key: 2.4, front: 1.2, neon: 0.25, rim: 0.2, env: 1 },
};
let currentLightPreset = 'game';
function lightPreset(){
const base = LIGHT_PRESETS[currentLightPreset] || LIGHT_PRESETS.game;
const test = window.DGHOST_LIGHT;
return test && typeof test === 'object' ? Object.assign({}, base, test) : base;
}

function setupViewerScene(THREE, renderer, scene){
const L = lightPreset();
// В three r152+ цвета по умолчанию в линейном пространстве —
// без этого металл выглядит блёклым. В r128 свойства нет, и
// присваивание просто игнорируется.
if (renderer.debug) renderer.debug.checkShaderErrors = true;
if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
const TONE = { aces: 'ACESFilmicToneMapping', agx: 'AgXToneMapping', reinhard: 'ReinhardToneMapping', linear: 'LinearToneMapping' };
renderer.toneMapping = THREE[TONE[L.tone]] ?? THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = L.exposure;

// Нейтральный белый свет — чтобы металл читался как металл, а не
// как розовая пластмасса. Боковые подсветки тоже нейтральные: даже
// слабый фиолетовый и розовый «неон» на металлической краске (SSG 08
// Zeno) давал яркие розовые блики, а на белых скинах — розовый оттенок.
// Фирменный фиолетовый остаётся в фоне просмотрщика.
scene.add(new THREE.AmbientLight(0xffffff, L.ambient));

const key = new THREE.DirectionalLight(0xffffff, L.key);
key.position.set(3, 4, 5);
scene.add(key);

const front = new THREE.DirectionalLight(0xffffff, L.front);
front.position.set(0, 1, 6);
scene.add(front);

const neonKey = new THREE.DirectionalLight(0xCCD5FF, L.neon);
neonKey.position.set(-3, 3, 2);
scene.add(neonKey);

const neonRim = new THREE.DirectionalLight(0xCCD5FF, L.rim);
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

// ---------- фон 3D ----------
// Встроенные фоны и фоны карт CS2 (как в главном меню игры, где идёт
// осмотр). Картинки карт сборка кладёт на CDN 3D: models/backgrounds/
// index.json — [{ id, name, file }]. Выбор запоминается на устройстве.
const VIEWER_BG_KEY = 'dghost3dBg';
const VIEWER_BG_INSPECT = 'radial-gradient(ellipse at 50% 40%, #5a5f66 0%, #2b2e33 55%, #16181b 100%)';
let viewerBgList = null;
function loadViewerBackgrounds(){
if (viewerBgList) return Promise.resolve(viewerBgList);
return loadModelIndex()
.then(() => fetch(modelsUrl('models/backgrounds/index.json')))
.then(r => r.ok ? r.json() : [])
.catch(() => [])
.then(list => {
viewerBgList = Array.isArray(list) ? list.filter(b => b && b.id && /^[\w.-]+$/.test(b.file || "")) : [];
return viewerBgList;
});
}

// Эффекты фона карты, как при осмотре в игре: карта чуть не в фокусе
// (глубина резкости) и сдвигается при повороте скина (параллакс).
// window.DGHOST_BG_FX — только для проверки: { blur, parallax }.
const VIEWER_BG_FX = { blur: 3, parallax: 14 };
function viewerBgFx(){
const t = window.DGHOST_BG_FX;
return t && typeof t === 'object' ? Object.assign({}, VIEWER_BG_FX, t) : VIEWER_BG_FX;
}

// Слой с картинкой карты — отдельный элемент за холстом: размываем и
// двигаем только его, а не скин. Стили — прямо в style (кэш app.css).
function viewerBgLayer(stage){
let layer = stage.querySelector('.viewer3d-bglayer');
if (!layer){
layer = document.createElement('div');
layer.className = 'viewer3d-bglayer';
Object.assign(layer.style, {
position: 'absolute', inset: '-8%', zIndex: '0', pointerEvents: 'none',
backgroundPosition: 'center', backgroundSize: 'cover', backgroundRepeat: 'no-repeat',
willChange: 'transform',
});
stage.insertBefore(layer, stage.firstChild);
const canvas = stage.querySelector('canvas');
if (canvas){ canvas.style.position = 'relative'; canvas.style.zIndex = '1'; }
const status = stage.querySelector('.viewer3d-status');
if (status) status.style.zIndex = '2';
}
return layer;
}

// Параллакс: фон уходит в сторону, противоположную повороту скина.
function updateViewerBgParallax(rotationY){
const layer = document.querySelector('.viewer3d-stage .viewer3d-bglayer');
if (!layer || layer.style.display === 'none') return;
const shift = Math.sin(rotationY || 0) * viewerBgFx().parallax;
layer.style.transform = `translate3d(${(-shift).toFixed(1)}px, 0, 0)`;
}

function applyViewerBackground(id){
const stage = document.querySelector('.viewer3d-stage');
if (!stage) return;
const map = (viewerBgList || []).find(b => b.id === id);
const layer = viewerBgLayer(stage);
// Фон задаём прямо в style: WebView Telegram держит app.css в кэше, и
// фон через одни лишь CSS-правила мог не меняться.
stage.removeAttribute('data-bg');
stage.removeAttribute('data-bg-image');
stage.style.background = '';
layer.style.display = 'none';
if (map){
const fx = viewerBgFx();
stage.setAttribute('data-bg-image', id);
stage.style.background = '#15171a';
layer.style.display = 'block';
// Лёгкое затемнение — на пёстром скриншоте карты скин не теряется.
layer.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.25), rgba(0,0,0,0.25)), url("${modelsUrl('models/backgrounds/' + map.file)}")`;
layer.style.filter = fx.blur ? `blur(${fx.blur}px)` : '';
layer.style.transform = '';
} else if (id === 'inspect'){
stage.setAttribute('data-bg', 'inspect');
stage.style.background = VIEWER_BG_INSPECT;
}
document.querySelectorAll('#viewer3dBgs .viewer3d-bg').forEach(btn => {
btn.setAttribute('aria-checked', btn.dataset.bg === id ? 'true' : 'false');
});
}

function renderViewerBackgrounds(dict){
const box = document.getElementById('viewer3dBgs');
if (!box) return;
box.setAttribute('aria-label', dict.v3_bg_label || 'Background');
let saved = 'inspect';
try { saved = localStorage.getItem(VIEWER_BG_KEY) || 'inspect'; } catch (e) {}
const draw = (maps) => {
const items = [{ id: 'studio', name: dict.v3_bg_studio || 'Studio' }, { id: 'inspect', name: dict.v3_bg_inspect || 'CS2' }]
.concat(maps.map(m => ({ id: m.id, name: m.name || m.id })));
if (!items.some(i => i.id === saved)) saved = 'inspect';
box.innerHTML = '';
items.forEach(item => {
const btn = document.createElement('button');
btn.type = 'button';
btn.className = 'viewer3d-bg';
btn.dataset.bg = item.id;
btn.setAttribute('role', 'radio');
btn.textContent = item.name;
btn.addEventListener('click', () => {
try { localStorage.setItem(VIEWER_BG_KEY, item.id); } catch (e) {}
applyViewerBackground(item.id);
});
box.appendChild(btn);
});
applyViewerBackground(saved);
};
draw(viewerBgList || []);
if (!viewerBgList) loadViewerBackgrounds().then(maps => { if (maps.length) draw(maps); });
}

// Кнопки вида: «3D» и «В руках 1/2/3» (клипы осмотра из комплекта
// анимаций ножа). Без комплекта ряд скрыт.
function markViewerView(id){
document.querySelectorAll('#viewer3dViews .viewer3d-bg').forEach(btn => {
btn.setAttribute('aria-checked', btn.dataset.view === id ? 'true' : 'false');
});
}

function renderViewerViews(dict, knifeName, onPick){
const box = document.getElementById('viewer3dViews');
if (!box) return;
box.hidden = true;
box.innerHTML = '';
if (!/^[a-z0-9_]+$/.test(knifeName || '')) return;
fetch(modelsUrl('models/anim/' + knifeName + '/index.json'))
.then(r => r.ok ? r.json() : null)
.catch(() => null)
.then(index => {
const inspects = index && Array.isArray(index.clips) ? index.clips.filter(c => /^lookat/.test(c.id)) : [];
if (!inspects.length) return;
box.setAttribute('aria-label', dict.v3_view_label || 'View');
const items = [{ id: '3d', name: dict.v3_view_3d || '3D' }]
.concat(inspects.map((c, i) => ({ id: c.id, name: (dict.v3_view_inspect || 'In hands {n}').replace('{n}', i + 1) })));
items.forEach(item => {
const btn = document.createElement('button');
btn.type = 'button';
btn.className = 'viewer3d-bg';
btn.dataset.view = item.id;
btn.setAttribute('role', 'radio');
btn.textContent = item.name;
btn.addEventListener('click', () => onPick(item.id === '3d' ? null : item.id));
box.appendChild(btn);
});
markViewerView('3d');
box.hidden = false;
});
}

function open3DViewer(modelUrl, title, skinDir, wearValue, weaponDir, maskChannel, seed, stickers){
const dict = I18N[currentLang] || I18N.ru;
renderViewerBackgrounds(dict);
const mode = get3DMode() || 'full';
const status = document.getElementById('viewer3dStatus');
status.innerHTML = '';
document.getElementById('viewer3dTitle').textContent = title || dict.v3_title;
document.getElementById('viewer3dMode').textContent = (mode === 'light' ? dict.v3_mode_light : dict.v3_mode_full) + ' · v' + APP3D_VERSION;
document.getElementById('viewer3dCloseBtn').setAttribute('aria-label', dict.btn_close || 'Close');
setViewerFullscreen(false);
showViewerHint();
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
// Наклейки лота: не загрузились — ствол всё равно покажем. Один атлас —
// и для обычного вида, и для «в руках».
const stickerAtlasReady = loadStickerAtlas(THREE, stickers).catch(() => null);
if (skinDir){
Promise.all([
loadSkinWithWeapon(THREE, skinDir, weaponDir),
stickerAtlasReady,
])
.then(([[skin, weapon], atlas]) => {
if (!skin.pattern && !skin.solid) throw new Error('не загрузился узор');
applySkinToModel(THREE, object, skin, wearValue, weapon, maskChannel, seed, atlas);
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
// Режим «В руках»: анимация осмотра вместо вращения модели.
let hands = null;

const onStart = (e) => {
if (hands) return;
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

// Размер сцены меняется (во весь экран, поворот телефона) — подгоняем
// буфер холста и камеры, иначе картинка растянется.
// Сцена стала уже исходной (во весь экран на телефоне) — отдаляем
// камеру через zoom, чтобы ствол по ширине влезал так же, как раньше.
const size = { w: canvas.clientWidth, h: canvas.clientHeight };
const baseAspect = size.w / size.h;
const syncSize = () => {
const w = canvas.clientWidth, h = canvas.clientHeight;
if (!w || !h || (w === size.w && h === size.h)) return;
size.w = w; size.h = h;
renderer.setSize(w, h, false);
camera.aspect = w / h;
camera.zoom = Math.min(1, camera.aspect / baseAspect);
camera.updateProjectionMatrix();
if (hands) fitHandsCamera(hands.camera);
};

const clock = { last: performance.now() };
const animate = () => {
syncSize();
const now = performance.now();
const dt = Math.min(0.1, (now - clock.last) / 1000);
clock.last = now;
if (hands){
hands.t = (hands.t + dt) % hands.ih.duration;
hands.ih.setTime(hands.t);
updateViewerBgParallax(Math.sin(now / 2600) * 0.4);
renderer.render(scene, hands.camera);
} else {
if (autoRotate) object.rotation.y += 0.006;
updateViewerBgParallax(object.rotation.y);
renderer.render(scene, camera);
}
viewer3d.raf = requestAnimationFrame(animate);
};

viewer3d = { renderer, scene, camera, object, raf: 0 };
animate();

// Ножи с комплектом анимаций (models/anim/<нож>/) — кнопки «В руках».
const handsCache = {};
// viewmodel_fov в CS2 — по горизонтали кадра 4:3; на узком экране
// телефона расширяем вертикальный угол, чтобы руки и нож влезли.
function fitHandsCamera(handsCamera){
const aspect = canvas.clientWidth / canvas.clientHeight;
const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(IN_HANDS_FOV) / 2) * 4 / 3);
handsCamera.aspect = aspect;
handsCamera.fov = Math.max(IN_HANDS_FOV, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hfov / 2) / aspect)));
handsCamera.updateProjectionMatrix();
}
const setView = async (clipId) => {
if (!clipId){
if (hands){ scene.remove(hands.ih.root); hands = null; }
object.visible = true;
markViewerView('3d');
return;
}
const animDir = 'models/anim/' + knifeName + '/';
status.textContent = dict.v3_hands_loading;
markViewerView(clipId);
try {
if (!handsCache[clipId]){
const ih = await loadInHandsScene(THREE, animDir, clipId);
if (skinDir){
const [[skin, weapon], atlas] = await Promise.all([loadSkinWithWeapon(THREE, skinDir, weaponDir), stickerAtlasReady]);
applySkinToModel(THREE, ih.knifeGroup, skin, wearValue, weapon, maskChannel, seed, atlas);
}
handsCache[clipId] = ih;
}
if (!viewer3d || viewer3d.renderer !== renderer) return;
if (hands) scene.remove(hands.ih.root);
const ih = handsCache[clipId];
const handsCamera = new THREE.PerspectiveCamera(IN_HANDS_FOV, canvas.clientWidth / canvas.clientHeight, 0.01, 10);
placeInHandsCamera(THREE, ih, handsCamera);
fitHandsCamera(handsCamera);
scene.add(ih.root);
object.visible = false;
hands = { ih, camera: handsCamera, t: 0 };
status.textContent = '';
} catch (err) {
console.warn('3D: руки не загрузились —', err);
status.textContent = dict.v3_hands_failed;
markViewerView('3d');
}
};
const knifeName = ((String(modelUrl).match(/([a-z0-9_]+)\.glb$/i) || [])[1] || '').toLowerCase();
renderViewerViews(dict, knifeName, setView);

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
setViewerFullscreen(false);
viewer3dOverlay.classList.remove('show');
dispose3DViewer();
});

// Во весь экран: лист растягивается на всё окно (работает везде), а в
// Telegram 8.0+ ещё и прячется шапка Telegram. Выходим из полноэкранного
// режима Telegram, только если сами в него вошли.
let viewerTgFullscreen = false;
function setViewerFullscreen(on){
const sheet = document.getElementById('viewer3dSheet');
if (!sheet) return;
const dict = I18N[currentLang] || I18N.ru;
sheet.classList.toggle('full', on);
viewer3dOverlay.classList.toggle('v3-full', on);
const btn = document.getElementById('viewer3dFullBtn');
if (btn) btn.setAttribute('aria-label', on ? (dict.v3_fullscreen_exit || 'Exit full screen') : (dict.v3_fullscreen || 'Full screen'));
const tg = window.Telegram && window.Telegram.WebApp;
try {
if (on && tg && tg.requestFullscreen && tg.isVersionAtLeast && tg.isVersionAtLeast('8.0') && !tg.isFullscreen){
tg.requestFullscreen();
viewerTgFullscreen = true;
} else if (!on && viewerTgFullscreen && tg && tg.exitFullscreen){
tg.exitFullscreen();
viewerTgFullscreen = false;
}
} catch (e) { viewerTgFullscreen = false; }
}

document.getElementById('viewer3dFullBtn').addEventListener('click', () => {
setViewerFullscreen(!document.getElementById('viewer3dSheet').classList.contains('full'));
});

// Подсказка поверх сцены: исчезает через 4 с или с первым касанием.
let viewerHintTimer = 0;
function showViewerHint(){
const hint = document.getElementById('viewer3dHint');
if (!hint) return;
hint.classList.remove('gone');
clearTimeout(viewerHintTimer);
viewerHintTimer = setTimeout(() => hint.classList.add('gone'), 4000);
}
['pointerdown', 'touchstart'].forEach(type => {
document.getElementById('viewer3dCanvas').addEventListener(type, () => {
const hint = document.getElementById('viewer3dHint');
if (hint) hint.classList.add('gone');
}, { passive: true });
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

// 3D-файлы раздаёт Worker из закрытого бакета R2 (3d.dghostmarket.com,
// отдаёт только нашим страницам). Запасной путь «с этого же сайта» — для
// локальной проверки (положить models/ рядом с index.html).
const MODELS_CDNS = ['https://3d.dghostmarket.com/'];
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
modelIndexLoading = MODELS_CDNS.concat('').reduce((tried, base) => tried.catch(() => fetchModelIndex(base)), Promise.reject())
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

// Номер раскраски → папка (models/paint_index.json, строит
// build-index.sh). По названию «Karambit | Doppler» фазу не узнать, а
// по paint_index лота (его отдаёт inspect) — точно: Ruby, Sapphire,
// Black Pearl, Phase 1–4, Emerald.
let paintIndexLoading = null;
function loadPaintIndex(){
if (!paintIndexLoading){
paintIndexLoading = loadModelIndex()
.then(() => fetch(modelsBase + 'models/paint_index.json', { cache: 'no-cache' }))
.then(r => r.ok ? r.json() : {})
.catch(() => ({}));
}
return paintIndexLoading;
}

// Запись для 3D по лоту: по названию, а папку раскраски — по номеру
// раскраски лота, если он известен.
function modelEntryForSkin(map, paintMap, skin){
const entry = map[modelIndexKey(skin && skin.title)];
if (!entry) return null;
const exact = skin && skin.paint_index != null ? paintMap[String(skin.paint_index)] : null;
return exact && exact !== entry.skin ? Object.assign({}, entry, { skin: exact }) : entry;
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
Promise.all([loadModelIndex(), loadPaintIndex()]).then(([map, paintMap]) => {
// Пока грузился индекс, могли открыть другой лот.
if (buy3dSkin !== skin) return;
const entry = modelEntryForSkin(map, paintMap, skin);
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
open3DViewer(buy3dEntry.model, title, buy3dEntry.skin, Number(skin.float_value) || 0, buy3dEntry.weapon || null, 'none', skin.pattern, skin.stickers);
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
// Видео вместо GIF: Telegram показывает его той же «гифкой», но без
// потолка в 256 цветов — чётко и легче. Кадр рисуется вдвое крупнее и
// уменьшается (гладкие края), длина — один цикл покачивания.
const SHARE_VIDEO = { width: 960, height: 640, fps: 30, seconds: 4, bitrate: 5000000, supersample: 2 };

// Формат записи: MP4 (H.264) — Safari/iOS и свежий Chrome; иначе WebM
// (бот перекодирует его в MP4). null — запись видео недоступна.
function pickShareVideoMime(){
if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return null;
const list = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4',
'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
return list.find(type => { try { return MediaRecorder.isTypeSupported(type); } catch (e) { return false; } }) || null;
}

// Запись холста: кадры кладём в поток сами (requestFrame), время — по
// часам: на медленном телефоне кадров меньше, но скорость та же.
async function recordCanvasVideo(canvas, drawAt, opts, onProgress){
const mime = pickShareVideoMime();
if (!mime || !canvas.captureStream) throw new Error('video_unsupported');
const stream = canvas.captureStream(0);
const track = stream.getVideoTracks()[0];
const manual = track && typeof track.requestFrame === 'function';
const live = manual ? stream : canvas.captureStream(opts.fps);
const recorder = new MediaRecorder(live, { mimeType: mime, videoBitsPerSecond: opts.bitrate });
const chunks = [];
recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
const stopped = new Promise(resolve => { recorder.onstop = resolve; });
const total = opts.seconds * 1000;
drawAt(0);
recorder.start();
const start = performance.now();
for (;;){
const t = Math.min(performance.now() - start, total);
drawAt(t / total);
if (manual) track.requestFrame();
if (onProgress) onProgress(t / total);
if (t >= total) break;
const next = start + Math.ceil((t + 1) / (1000 / opts.fps)) * (1000 / opts.fps);
await new Promise(resolve => setTimeout(resolve, Math.max(0, next - performance.now())));
}
await new Promise(resolve => setTimeout(resolve, 1000 / opts.fps));
recorder.stop();
await stopped;
live.getTracks().forEach(tr => tr.stop());
const blob = new Blob(chunks, { type: mime.split(';')[0] });
if (!blob.size) throw new Error('video_empty');
return new Uint8Array(await blob.arrayBuffer());
}

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

function drawShareFrame(ctx, glCanvas, title, size, bgImage){
const { width: W, height: H } = size || SHARE_GIF;
// Шрифты и отступы — от ширины GIF (360), чтобы картинка выглядела так же.
const k = W / SHARE_GIF.width;
if (bgImage){
ctx.drawImage(bgImage, 0, 0, W, H);
} else {
const bg = ctx.createRadialGradient(W / 2, H / 2, 10 * k, W / 2, H / 2, W * 0.7);
bg.addColorStop(0, '#2a1650');
bg.addColorStop(1, '#0c0816');
ctx.fillStyle = bg;
ctx.fillRect(0, 0, W, H);
}
ctx.drawImage(glCanvas, 0, 0, W, H);
// На светлом фоне карты подписи терялись — тёмные полосы под ними.
if (bgImage){
const top = ctx.createLinearGradient(0, 0, 0, 34 * k);
top.addColorStop(0, 'rgba(8,6,14,0.75)'); top.addColorStop(1, 'rgba(8,6,14,0)');
ctx.fillStyle = top; ctx.fillRect(0, 0, W, 34 * k);
const bottom = ctx.createLinearGradient(0, H - 44 * k, 0, H);
bottom.addColorStop(0, 'rgba(8,6,14,0)'); bottom.addColorStop(1, 'rgba(8,6,14,0.8)');
ctx.fillStyle = bottom; ctx.fillRect(0, H - 44 * k, W, 44 * k);
}
ctx.font = `bold ${Math.round(13 * k)}px sans-serif`;
ctx.fillStyle = '#ffffff';
ctx.fillText(title, 12 * k, H - 14 * k, W - 24 * k);
ctx.font = `bold ${Math.round(10 * k)}px monospace`;
ctx.fillStyle = '#A855F7';
ctx.fillText('DGHOSTMARKET', 12 * k, 18 * k);
}

// still: true — вместо GIF один кадр JPEG (SHARE_PHOTO);
// 'transparent' — один кадр PNG без фона и подписи (сверка со Steam).
// still: 'video' — видео (MP4/WebM) вместо GIF (SHARE_VIDEO).
async function render3DGif(entry, wear, title, onProgress, seed, still, stickers){
const video = still === 'video';
if (video) still = false;
const size = still ? SHARE_PHOTO : (video ? SHARE_VIDEO : SHARE_GIF);
const { width: W, height: H } = size;
const { frames, delay, colors } = SHARE_GIF;
const ss = video ? SHARE_VIDEO.supersample : 1;
const [, gifenc] = await Promise.all([loadGltfLoader(), (still || video) ? null : loadGifEncoder()]);

await loadModelIndex();
const response = await fetch(modelsUrl(entry.model));
if (!response.ok) throw new Error('model ' + response.status);
const buffer = await response.arrayBuffer();
const gltf = await parseGlb(buffer).catch(() => parseGlb(stripTexturesFromGlb(buffer)));
const [[skin, weapon], stickerAtlas] = await Promise.all([
loadSkinWithWeapon(THREE, entry.skin, entry.weapon),
loadStickerAtlas(THREE, stickers).catch(() => null),
]);
if (!skin.pattern && !skin.solid) throw new Error('не загрузился узор');

const glCanvas = document.createElement('canvas');
glCanvas.width = W * ss;
glCanvas.height = H * ss;
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
const scene = new THREE.Scene();
try {
renderer.setPixelRatio(1);
renderer.setSize(W * ss, H * ss, false);
renderer.setClearColor(0x000000, 0);

const camera = new THREE.PerspectiveCamera(40, W / H, 0.05, 100);
const object = new THREE.Group();
object.add(gltf.scene);
// Без раскраски (или пока она грузится) — старый корпус, как в игре
// у стандартного оружия.
selectModelBody(object, false);
scene.add(object);
fitObjectToView(THREE, gltf.scene, camera);
applySkinToModel(THREE, object, skin, wear, weapon, 'none', seed, stickerAtlas);
// С наклейками — вид с той стороны, где они наклеены (дулом влево, как
// при осмотре в игре); без них — как раньше.
const side = stickerAtlas ? -Math.PI / 2 : Math.PI / 2;
const tilt = stickerAtlas ? -0.3 : 0.3;
// Кадр — по всем углам покачивания (у картинки — по её одному ракурсу).
if (still !== 'transparent'){
const swing = [];
for (let i = 0; i < 16; i++) swing.push(side + 0.6 * Math.sin(i / 16 * Math.PI * 2));
frameShareView(THREE, object, camera, still ? [side + tilt] : swing);
}
await setupViewerScene(THREE, renderer, scene);

const out = document.createElement('canvas');
out.width = W;
out.height = H;
const ctx = out.getContext('2d', { willReadFrequently: true });

if (still){
// Тот же ракурс, что в середине покачивания GIF, чуть повёрнутый к камере.
object.rotation.y = side + tilt;
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

if (video){
return await recordCanvasVideo(out, (p) => {
object.rotation.y = side + 0.6 * Math.sin(p * Math.PI * 2);
renderer.render(scene, camera);
drawShareFrame(ctx, glCanvas, title, size);
}, SHARE_VIDEO, onProgress);
}

const encoder = gifenc.GIFEncoder();

for (let i = 0; i < frames; i++){
// Не полный оборот, а покачивание ±35° вокруг вида сбоку: при
// обороте ствол половину времени смотрел в камеру торцом.
object.rotation.y = side + 0.6 * Math.sin((i / frames) * Math.PI * 2);
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

const progress = p => say(preparing.replace('{p}', Math.round(p * 100)));
const upload = async (bytes, sendKind) => {
const field = { photo: 'image_base64', gif: 'gif_base64', video: 'video_base64' }[sendKind];
const payload = { init_data: tg.initData, skin_id: skin.id, kind: sendKind };
payload[field] = bytesToBase64(bytes);
const response = await fetch(API_BASE + '/api/share/prepare', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(payload),
});
const data = await response.json().catch(() => ({}));
if (!response.ok || !data.gif_url) throw new Error(data.error || ('HTTP ' + response.status));
return { preparedId: data.prepared_id || null, name: String(data.gif_url).split('/').pop() };
};

if (kind === 'hands'){
const handsPreparing = dict.share_hands_preparing || preparing;
const clip = await render3DHandsVideo(buy3dEntry, Number(skin.float_value) || 0, title, skin.pattern,
p => say(handsPreparing.replace('{p}', Math.round(p * 100))), skin.stickers);
return await upload(clip, 'video');
}

say(preparing.replace('{p}', '0'));
// «GIF» — сначала видео (чётче, Telegram показывает его той же гифкой);
// не умеет браузер или бот не принял — обычный GIF.
if (!still && pickShareVideoMime()){
try {
const clip = await render3DGif(buy3dEntry, Number(skin.float_value) || 0, title, progress, skin.pattern, 'video', skin.stickers);
return await upload(clip, 'video');
} catch (e) {
console.warn('3D: видео для «Поделиться» не вышло, делаю GIF —', e);
say(preparing.replace('{p}', '0'));
}
}
const bytes = await render3DGif(buy3dEntry, Number(skin.float_value) || 0, title, progress, skin.pattern, still, skin.stickers);
return await upload(bytes, still ? 'photo' : 'gif');
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

// ---------- нож в руках (анимация осмотра, как на F в игре) ----------
// Комплект из сборки (build-anim.sh): models/anim/<нож>/ — руки и нож со
// скелетом, клипы (скелет вьюмодели: руки + кости ножа), текстуры рук.
// Скелет — из клипа: руки и нож привязываем к его костям по именам.
// Костей тела (ключицы, позвоночник, «скрутки» предплечья) в клипе нет —
// достраиваем их в скелете клипа под тем же родителем, что и в руках, с
// позой покоя рук, иначе вершины на них оставались на месте и тянулись.
function rebindToSkeleton(THREE, source, skeletonRoot){
const meshes = [];
source.traverse(node => { if (node.isSkinnedMesh) meshes.push(node); });
const ensure = (bone) => {
const found = skeletonRoot.getObjectByName(bone.name);
if (found) return found;
const parent = bone.parent && bone.parent.isBone ? ensure(bone.parent) : skeletonRoot;
const copy = new THREE.Bone();
copy.name = bone.name;
copy.position.copy(bone.position);
copy.quaternion.copy(bone.quaternion);
copy.scale.copy(bone.scale);
parent.add(copy);
return copy;
};
meshes.forEach(mesh => {
const old = mesh.skeleton;
const bones = old.bones.map(ensure);
mesh.bind(new THREE.Skeleton(bones, old.boneInverses), mesh.bindMatrix);
mesh.frustumCulled = false;
});
return meshes;
}

let IN_HANDS_AXIS_FIX = null;
async function loadInHandsScene(THREE, animDir, clipId){
if (!IN_HANDS_AXIS_FIX) IN_HANDS_AXIS_FIX = new THREE.Quaternion(-0.5, -0.5, -0.5, 0.5).invert();
await loadGltfLoader();
const base = modelsUrl(animDir).replace(/\/+$/, '') + '/';
const index = await fetch(base + 'index.json').then(r => r.ok ? r.json() : null);
if (!index || !index.arms || !index.knife || !index.clips || !index.clips.length) throw new Error('нет комплекта анимаций');
const clipInfo = index.clips.find(c => c.id === clipId) || index.clips.find(c => /^lookat/.test(c.id)) || index.clips[0];
const glb = (file) => fetch(base + file).then(r => {
if (!r.ok) throw new Error(file + ' ' + r.status);
return r.arrayBuffer();
}).then(parseGlb);
const [arms, knife, clip] = await Promise.all([glb(index.arms), glb(index.knife), glb(clipInfo.file)]);

const root = clip.scene;
root.traverse(node => { if (node.isPoints) node.visible = false; });
// Скелет оружия в клипе: у ножей …knife_karambit…, у огнестрела
// animation/skeletons/weapons/ak47.vnmskel (загрузчик glTF вырезает из
// имён «/» и «.»: animationskeletonsweaponsak47vnmskel).
const knifeSkel = root.children.find(c => /skeletons_?weapons|knife|bayonet/.test(c.name) && !/empty_?mesh/.test(c.name) && !c.isPoints);
const armMeshes = rebindToSkeleton(THREE, arms.scene, root);
armMeshes.forEach(m => root.add(m));
const knifeGroup = new THREE.Group();
// Кобура (у Dual Berettas — eholster) — для вида от третьего лица; в руках
// она висела огромной фигурой у камеры.
rebindToSkeleton(THREE, knife.scene, knifeSkel || root).forEach(m => { if (!/holster/i.test(m.name)) knifeGroup.add(m); });
root.add(knifeGroup);

// Точка хвата ножа (ag1_hand_r) — её нет в клипе, достраиваем под
// weapon_offset; каждый кадр ставим скелет ножа так, чтобы она совпала
// с кистью правой руки.
const grip = knife.scene.getObjectByName('ag1_hand_r');
const gripBone = grip ? (() => {
const b = new THREE.Object3D();
b.position.copy(grip.position); b.quaternion.copy(grip.quaternion);
(root.getObjectByName('weapon_offset') || knifeSkel || root).add(b);
return b;
})() : null;
const hand = root.getObjectByName('hand_R');

// Текстуры рук: кожа и перчатка.
const tex = index.textures || {};
const loadTex = (file) => file ? loadSkinTexture(THREE, base + file, true) : Promise.resolve(null);
const [skinTex, gloveTex] = await Promise.all([loadTex(tex.skin), loadTex(tex.glove)]);
armMeshes.forEach((mesh, i) => {
const isGlove = /glove/i.test((mesh.material && mesh.material.name) || '') || i > 0;
const t = isGlove ? (gloveTex || skinTex) : skinTex;
if (t) mesh.material = new THREE.MeshStandardMaterial({ map: t, roughness: 0.75, metalness: 0 });
});

const mixer = new THREE.AnimationMixer(root);
const action = mixer.clipAction(clip.animations[0]);
action.play();
const tmpA = new THREE.Matrix4(), tmpB = new THREE.Matrix4();
// gripMode: 'wpnfix' (по умолчанию) — скелет ножа на кости wpn без двойного
// поворота осей, сверено на Butterfly (нож в ладони, ручки раскрыты);
// 'wpn' — с двойным поворотом; 'hand' — точка хвата ag1_hand_r к кисти.
const ih = { root, knifeGroup, mixer, action, duration: clip.animations[0].duration, clips: index.clips, gripMode: 'wpnfix' };
ih.setTime = (t) => {
mixer.setTime(t);
if (!knifeSkel) return;
knifeSkel.position.set(0, 0, 0); knifeSkel.quaternion.identity(); knifeSkel.scale.set(1, 1, 1);
root.updateMatrixWorld(true);
const wpn = root.getObjectByName('wpn');
if ((ih.gripMode === 'wpn' || ih.gripMode === 'wpnfix') && wpn){
tmpA.copy(root.matrixWorld).invert().multiply(wpn.matrixWorld);
// Поворот осей (Z-вверх Source 2 → Y-вверх glTF) зашит и в root_motion
// рук, и в кость weapon ножа: на кости wpn он применился бы дважды.
if (ih.gripMode === 'wpnfix') tmpA.multiply(tmpB.makeRotationFromQuaternion(IN_HANDS_AXIS_FIX));
tmpA.decompose(knifeSkel.position, knifeSkel.quaternion, knifeSkel.scale);
} else if (gripBone && hand){
// мир(скелет ножа) = мир(кисть) · (мир(хват) при скелете в нуле)^-1
tmpA.copy(knifeSkel.matrixWorld).invert().multiply(gripBone.matrixWorld); // хват в системе скелета ножа
tmpB.copy(hand.matrixWorld).multiply(tmpA.invert());
tmpB.premultiply(tmpA.copy(root.matrixWorld).invert());
tmpB.decompose(knifeSkel.position, knifeSkel.quaternion, knifeSkel.scale);
}
root.updateMatrixWorld(true);
};
return ih;
}

// Камера от первого лица: глаз вьюмодели — начало координат клипа (кисти
// в ~40 см перед ним), смотрит вперёд (+Z) и чуть вниз, угол обзора как у
// оружия в CS2 (viewmodel_fov 68).
const IN_HANDS_FOV = 68;
function placeInHandsCamera(THREE, ih, camera){
camera.fov = IN_HANDS_FOV;
camera.near = 0.01;
camera.updateProjectionMatrix();
camera.position.set(0, 0, 0);
camera.lookAt(0, -0.12, 1);
}

// ---------- «Поделиться»: видео ножа в руках ----------
// Для ножей с комплектом анимаций (models/anim/<нож>/): руки крутят нож
// со скином лота — анимация осмотра, фон — карта CS2 (размыта и
// затемнена, как в просмотрщике), сверху логотип, снизу название.
const SHARE_HANDS = { clip: 'lookat01', background: 'de_mirage.webp' };
const handsPackCache = {};

function handsAnimDir(entry){
const name = ((String(entry && entry.model || '').match(/([a-z0-9_]+)\.glb$/i) || [])[1] || '').toLowerCase();
// Комплект «в руках» бывает и у ножей, и у огнестрела (models/anim/<модель>/);
// нет комплекта — index.json не найдётся, и режим просто не появится.
return name ? 'models/anim/' + name + '/' : null;
}

// Есть ли у ножа лота комплект анимаций (промис true/false).
function hasHandsPack(entry){
const dir = handsAnimDir(entry);
if (!dir) return Promise.resolve(false);
if (!(dir in handsPackCache)){
handsPackCache[dir] = loadModelIndex()
.then(() => fetch(modelsUrl(dir + 'index.json')))
.then(r => r.ok ? r.json() : null)
.then(index => !!(index && index.arms && index.knife && Array.isArray(index.clips)
&& index.clips.some(c => /^lookat/.test(c.id))))
.catch(() => false);
}
return handsPackCache[dir];
}

function canShareInHands(skin){
if (!canShare3DLot(skin) || !pickShareVideoMime()) return Promise.resolve(false);
return hasHandsPack(buy3dEntry);
}

// Фон карты для кадра: размытие — уменьшением и обратным растяжением
// (ctx.filter есть не во всех WebView), плюс затемнение.
function loadShareBackground(W, H){
return new Promise(resolve => {
const img = new Image();
img.crossOrigin = 'anonymous';
img.onload = () => {
const small = document.createElement('canvas');
small.width = Math.max(1, Math.round(W / 8));
small.height = Math.max(1, Math.round(H / 8));
const sctx = small.getContext('2d');
const r = Math.max(small.width / img.width, small.height / img.height);
sctx.drawImage(img, (small.width - img.width * r) / 2, (small.height - img.height * r) / 2, img.width * r, img.height * r);
const big = document.createElement('canvas');
big.width = W; big.height = H;
const bctx = big.getContext('2d');
bctx.imageSmoothingQuality = 'high';
bctx.drawImage(small, 0, 0, W, H);
bctx.fillStyle = 'rgba(0,0,0,0.3)';
bctx.fillRect(0, 0, W, H);
resolve(big);
};
img.onerror = () => resolve(null);
img.src = modelsUrl('models/backgrounds/' + SHARE_HANDS.background);
});
}

async function render3DHandsVideo(entry, wear, title, seed, onProgress, stickers){
await loadGltfLoader();
await loadModelIndex();
const dir = handsAnimDir(entry);
if (!dir) throw new Error('no_hands');
const { width: W, height: H, supersample: ss } = SHARE_VIDEO;
const [ih, [skin, weapon], bg, stickerAtlas] = await Promise.all([
loadInHandsScene(THREE, dir, SHARE_HANDS.clip),
loadSkinWithWeapon(THREE, entry.skin, entry.weapon),
loadShareBackground(W, H),
loadStickerAtlas(THREE, stickers).catch(() => null),
]);
applySkinToModel(THREE, ih.knifeGroup, skin, wear, weapon, 'none', seed, stickerAtlas);

const glCanvas = document.createElement('canvas');
glCanvas.width = W * ss;
glCanvas.height = H * ss;
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
const scene = new THREE.Scene();
try {
renderer.setPixelRatio(1);
renderer.setSize(W * ss, H * ss, false);
renderer.setClearColor(0x000000, 0);
await setupViewerScene(THREE, renderer, scene);
scene.add(ih.root);
const camera = new THREE.PerspectiveCamera(IN_HANDS_FOV, W / H, 0.01, 10);
placeInHandsCamera(THREE, ih, camera);
camera.aspect = W / H;
camera.updateProjectionMatrix();

const out = document.createElement('canvas');
out.width = W;
out.height = H;
const ctx = out.getContext('2d');
return await recordCanvasVideo(out, (p) => {
ih.setTime(Math.min(p, 0.999) * ih.duration);
renderer.render(scene, camera);
drawShareFrame(ctx, glCanvas, title, SHARE_VIDEO, bg);
}, Object.assign({}, SHARE_VIDEO, { seconds: ih.duration }), onProgress);
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
