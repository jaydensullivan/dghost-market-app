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
const APP3D_VERSION = 13;

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
const material = new THREE.MeshStandardMaterial({ color: 0x7B2CFF, metalness: 0.85, roughness: 0.25 });
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

// Расстояние камеры считаем из угла обзора, чтобы модель занимала
// кадр целиком, с небольшим запасом по краям.
const radius = Math.sqrt(3);
const fov = camera.fov * Math.PI / 180;
const distance = (radius / Math.sin(fov / 2)) * 0.85;
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

function loadSkinTexture(THREE, url){
return new Promise((resolve) => {
// В WebView Telegram createImageBitmap ломается на части картинок —
// прячем его и здесь (см. parseGlb).
const native = window.createImageBitmap;
window.createImageBitmap = undefined;
new THREE.TextureLoader().load(
url,
(tex) => {
if (native) window.createImageBitmap = native;
if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
tex.flipY = false; // как в glTF
tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
resolve(tex);
},
undefined,
() => { if (native) window.createImageBitmap = native; resolve(null); }
);
});
}

// wear — float предмета (0 = новый, 1 = полностью убитый).
function applySkinToModel(THREE, object, skin, wear){
const uniforms = {
uPattern: { value: skin.pattern },
uWearMask: { value: skin.wear },
uGrunge: { value: skin.grunge },
uWearAmount: { value: Math.max(0, Math.min(1, wear || 0)) },
uPatternScale: { value: skin.params.pattern_scale || 1 },
uColorBrightness: { value: skin.params.color_brightness || 1 },
};

// Ошибку компиляции шейдера WebGL сообщает молча — ловим её и
// показываем, иначе модель просто исчезает без объяснений.
object.traverse(node => {
if (!node.isMesh) return;

const material = new THREE.MeshStandardMaterial({
color: 0xffffff,
metalness: 0.9,
roughness: 0.45,
});
if (skin.rough) material.roughnessMap = skin.rough;

material.onBeforeCompile = (shader) => {
Object.assign(shader.uniforms, uniforms);

// Своя UV-переменная: в three r152+ общий vUv убрали, у каждой
// текстуры теперь своя (vMapUv, vRoughnessMapUv…), и ссылка на
// vUv роняла компиляцию шейдера — меш просто исчезал.
shader.vertexShader = shader.vertexShader
.replace('#include <common>', `#include <common>
varying vec2 vSkinUv;`)
.replace('#include <begin_vertex>', `#include <begin_vertex>
vSkinUv = uv;`);

shader.fragmentShader = shader.fragmentShader
.replace('#include <common>', `#include <common>
uniform sampler2D uPattern;
uniform sampler2D uWearMask;
uniform sampler2D uGrunge;
uniform float uWearAmount;
uniform float uPatternScale;
uniform float uColorBrightness;
varying vec2 vSkinUv;`)
.replace('#include <color_fragment>', `#include <color_fragment>
{
vec2 skinUv = vSkinUv * uPatternScale;
vec3 pattern = texture2D(uPattern, skinUv).rgb * uColorBrightness;

// Маска износа: чем меньше её значение, тем раньше краска
// сотрётся в этом месте (грани, выступы).
float wearMask = texture2D(uWearMask, vSkinUv).r;
float painted = smoothstep(uWearAmount - 0.08, uWearAmount + 0.08, wearMask);

// Грязь и царапины — общий слой поверх всего.
float grunge = texture2D(uGrunge, vSkinUv).r;

vec3 bareMetal = vec3(0.32, 0.31, 0.30);
vec3 skinColor = mix(bareMetal, pattern, painted);
skinColor *= mix(0.72, 1.0, grunge);

diffuseColor.rgb = skinColor;
}`);
};

node.material = material;
node.material.needsUpdate = true;
});

return uniforms;
}

// Грузит комплект раскраски из models/skins/<имя>/.
function loadSkinPack(THREE, dir){
const base = dir.replace(/\/+$/, '') + '/';
return fetch(base + 'params.json')
.then(r => {
if (!r.ok) throw new Error('нет params.json в ' + base);
return r.json();
})
.then(meta => Promise.all([
loadSkinTexture(THREE, base + 'pattern.webp'),
loadSkinTexture(THREE, base + 'wear.webp'),
loadSkinTexture(THREE, base + 'grunge.webp'),
loadSkinTexture(THREE, base + 'rough.webp'),
]).then(([pattern, wear, grunge, rough]) => ({
params: meta.shader || {},
pattern, wear, grunge, rough,
})));
}

function open3DViewer(modelUrl, title, skinDir, wearValue){
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
.then(() => fetch(modelUrl, { cache: 'no-store' }).catch(() => { throw new Error(dict.v3_err_net); }))
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

// В three r152+ цвета по умолчанию в линейном пространстве —
// без этого металл выглядит блёклым. В r128 свойства нет, и
// присваивание просто игнорируется.
if (renderer.debug) renderer.debug.checkShaderErrors = true;
if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, canvas.clientWidth / canvas.clientHeight, 0.05, 100);
const object = gltf.scene;
scene.add(object);
const baseDistance = fitObjectToView(THREE, object, camera);

// Нейтральный белый свет — чтобы металл читался как металл, а не
// как розовая пластмасса. Неон по брендбуку идёт сверху, контровым
// и заполняющим, но приглушённо.
scene.add(new THREE.AmbientLight(0xffffff, 0.55));

const key = new THREE.DirectionalLight(0xffffff, 2.4);
key.position.set(3, 4, 5);
scene.add(key);

const front = new THREE.DirectionalLight(0xffffff, 1.2);
front.position.set(0, 1, 6);
scene.add(front);

const neonKey = new THREE.DirectionalLight(0xA855F7, 0.9);
neonKey.position.set(-3, 3, 2);
scene.add(neonKey);

const neonRim = new THREE.DirectionalLight(0xFF2BD6, 0.8);
neonRim.position.set(-4, -1, -3);
scene.add(neonRim);

// Блики на металле дают отражения окружения. Если модуль окружения
// не подгрузится (старый WebView, откат на r128) — просто остаёмся
// со светом выше.
if (THREE.PMREMGenerator){
dynamicImport(THREE_ADDONS + 'environments/RoomEnvironment.js')
.then(mod => {
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new mod.RoomEnvironment(), 0.04).texture;
})
.catch(() => {});
}

// Раскраска лота, если она указана.
if (skinDir){
loadSkinPack(THREE, skinDir)
.then(skin => {
if (!skin.pattern) throw new Error('не загрузился узор');
applySkinToModel(THREE, object, skin, wearValue);
status.textContent = `${dict.v3_skin_on} · float ${Number(wearValue || 0).toFixed(4)}`;
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
open3DViewer(url, null, skinDir || null, wear);
});
}
