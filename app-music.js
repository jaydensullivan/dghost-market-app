// ============================================================
// ПЛАСТИНКИ (Music Kit) — «Послушать» в карточке лота
// ============================================================
// Звук из файлов игры не раздаём: музыка принадлежит артистам. Играет
// встроенный плеер YouTube с роликом-превью пластинки. Для пластинки без
// известного ролика кнопка открывает поиск на YouTube.

// «артист, трек» (как в названии лота, строчными) → id ролика YouTube.
const MUSIC_KIT_VIDEOS = {
'amon tobin, all for dust': 'gk7h5rHCAK0',
'austin wintory, desert fire': 'fRLU6xyoeD8',
'awolnation, i am': 'HJXf6pRhqEc',
'beartooth, aggressive': 'vnMSivyiFEE',
'beartooth, disgusting': 'B3REasfNOac',
'daniel sadowski, crimson assault': 'puG4asobJTU',
'daniel sadowski, the 8-bit kit': '0og0htAkvkc',
'daniel sadowski, total domination': 'RjRtSBhkfmY',
'darude, moments cs:go': '9eAp6Qd6hLg',
'feed me, high noon': 'pLYXVpb30HQ',
'ian hultquist, lion\'s mouth': 'Y74pSRrzpUE',
'kelly bailey, hazardous environments': 'R8dRJDzYNN0',
'matt lange, isorhythm': '7-ER4z5r3Tk',
'mord fustang, diamonds': 'XdQExqXg7Ng',
'neck deep, the lowlife pack': '14BQXtixI9A',
'noisia, sharpened': '1t-upZTkg_o',
'sasha, lnoe': '3XyGZU_fsZQ',
'scarlxrd, king, scar': 'vPn8z-mDNGk',
'sean murray, a*d*8': 'SIfmBqGpCTM',
'the verkkars, ez4ence': 'zXYTnLyYVw4',
'troels folmann, uber blasto phone': 'm7DWRXujxAA',
'various artists, hotline miami': 'sdYCS6bl_cU',
};

const MUSIC_KIT_RE = /^(?:stattrak™?\s*)?(?:music kit|набор музыки)\s*\|\s*(.+)$/i;

// «Артист, Трек» из названия лота или '' — если это не пластинка.
function musicKitName(title){
const m = String(title || '').trim().match(MUSIC_KIT_RE);
return m ? m[1].trim() : '';
}

function musicKitVideoId(name){
const key = name.toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, ' ').trim();
return MUSIC_KIT_VIDEOS[key] || '';
}

function musicKitSearchUrl(name){
return 'https://www.youtube.com/results?search_query=' + encodeURIComponent(name + ' CS2 music kit');
}

function openExternal(url){
if (tg && typeof tg.openLink === 'function') tg.openLink(url);
else window.open(url, '_blank', 'noopener');
}

const musicOverlay = document.getElementById('musicOverlay');
const musicFrameBox = document.getElementById('musicFrameBox');
let musicCurrent = null;

function closeMusicPlayer(){
musicOverlay.classList.remove('show');
// Убираем iframe целиком — иначе звук продолжит играть.
musicFrameBox.innerHTML = '';
}

function openMusicPlayer(name){
const id = musicKitVideoId(name);
if (!id){
openExternal(musicKitSearchUrl(name));
return;
}
musicCurrent = { name, id };
document.getElementById('musicTitle').textContent = name;
const frame = document.createElement('iframe');
frame.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&playsinline=1&rel=0';
frame.allow = 'autoplay; encrypted-media; picture-in-picture';
frame.allowFullscreen = true;
frame.title = name;
musicFrameBox.innerHTML = '';
musicFrameBox.appendChild(frame);
musicOverlay.classList.add('show');
}

// Вызывается из openBuySheet: кнопка видна только у пластинок.
function updateMusicKitButton(skin){
const btn = document.getElementById('buyListenBtn');
const name = musicKitName(skin && skin.title);
btn.style.display = name ? '' : 'none';
btn.dataset.kit = name;
}

document.getElementById('buyListenBtn').addEventListener('click', (e) => {
const name = e.currentTarget.dataset.kit;
if (name) openMusicPlayer(name);
});
document.getElementById('musicCloseBtn').addEventListener('click', closeMusicPlayer);
musicOverlay.addEventListener('click', (e) => {
if (e.target === musicOverlay) closeMusicPlayer();
});
// Ролик может быть запрещён к встраиванию — тогда смотрят на YouTube.
document.getElementById('musicOpenYoutube').addEventListener('click', () => {
if (!musicCurrent) return;
const url = 'https://www.youtube.com/watch?v=' + musicCurrent.id;
closeMusicPlayer();
openExternal(url);
});
