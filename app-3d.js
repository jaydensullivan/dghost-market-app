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

const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js';
const D3_MODE_KEY = 'dg3d_mode';

let threeLoading = null;

function load3DLibrary(){
if (window.THREE) return Promise.resolve(window.THREE);
if (threeLoading) return threeLoading;
threeLoading = new Promise((resolve, reject) => {
const tag = document.createElement('script');
tag.src = THREE_CDN;
tag.onload = () => resolve(window.THREE);
tag.onerror = () => reject(new Error('three.js не загрузился'));
document.head.appendChild(tag);
});
return threeLoading;
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

const GLTF_LOADER_CDN = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js';

let gltfLoaderLoading = null;

function loadGltfLoader(){
if (window.THREE && window.THREE.GLTFLoader) return Promise.resolve();
if (gltfLoaderLoading) return gltfLoaderLoading;
gltfLoaderLoading = load3DLibrary().then(() => new Promise((resolve, reject) => {
const tag = document.createElement('script');
tag.src = GLTF_LOADER_CDN;
tag.onload = resolve;
tag.onerror = () => reject(new Error('GLTFLoader не загрузился'));
document.head.appendChild(tag);
}));
return gltfLoaderLoading;
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
const box = new THREE.Box3().setFromObject(object);
const size = box.getSize(new THREE.Vector3());
const center = box.getCenter(new THREE.Vector3());
const maxSide = Math.max(size.x, size.y, size.z) || 1;
object.scale.multiplyScalar(2 / maxSide);
box.setFromObject(object);
box.getCenter(center);
object.position.sub(center);
camera.position.set(0, 0.4, 4);
camera.lookAt(0, 0, 0);
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

function open3DViewer(modelUrl, title){
const dict = I18N[currentLang] || I18N.ru;
const mode = get3DMode() || 'full';
const status = document.getElementById('viewer3dStatus');
status.innerHTML = '';
document.getElementById('viewer3dTitle').textContent = title || dict.v3_title;
document.getElementById('viewer3dMode').textContent = mode === 'light' ? dict.v3_mode_light : dict.v3_mode_full;
status.textContent = dict.v3_loading;
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
if (magic !== 'glTF') throw new Error(dict.v3_err_parse);
status.textContent = dict.v3_size.replace('{mb}', (buffer.byteLength / 1048576).toFixed(1));
return buffer;
})
.then(buffer => new Promise((resolve, reject) => {
new THREE.GLTFLoader().parse(buffer, '', resolve, () => reject(new Error(dict.v3_err_parse)));
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
const object = gltf.scene;
scene.add(object);
fitObjectToView(THREE, object, camera);

// Свет по брендбуку: мягкая заливка + фиолетовый ключевой и
// розовый контровой — тот самый neon glow вокруг предмета.
scene.add(new THREE.AmbientLight(0xffffff, 0.4));
const key = new THREE.DirectionalLight(0xA855F7, 2.0);
key.position.set(3, 4, 5);
scene.add(key);
const rim = new THREE.DirectionalLight(0xFF2BD6, 1.4);
rim.position.set(-4, -1, -3);
scene.add(rim);
const fill = new THREE.DirectionalLight(0xffffff, 0.6);
fill.position.set(0, 2, 6);
scene.add(fill);

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
camera.position.z = Math.min(9, Math.max(1.6, camera.position.z * (pinchStart / dist)));
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

status.textContent = `${dict.v3_triangles}: ${countTriangles(THREE, object).toLocaleString('ru-RU')}`;
setTimeout(() => { status.textContent = ''; }, 2500);
})
.catch(err => {
// Путь показываем рядом с причиной — чаще всего ошибка именно в нём.
status.innerHTML = `${escapeHtml(err.message || dict.v3_failed)}<br><span style="opacity:.7;">${escapeHtml(modelUrl)}</span>`;
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
open3DViewer(url, null);
});
}
