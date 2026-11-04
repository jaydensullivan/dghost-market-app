// ============================================================
// ПЛАСТИНКИ (Music Kit) — «Послушать» в карточке лота
// ============================================================
// Звук из файлов игры не раздаём: музыка принадлежит артистам. Играет
// встроенный плеер YouTube с роликом-превью пластинки. Для пластинки без
// известного ролика кнопка открывает поиск на YouTube.

// «артист, трек» (как в названии лота, строчными, без знаков препинания) → id ролика
// YouTube. Все пластинки CS2; ролики проверены встраиванием с app.dghostmarket.uz.
const MUSIC_KIT_VIDEOS = {
'3kliksphilip heading for the source': 'qok5kTT-eOU',
'adam beyer red room': 'GIf50k8j270',
'alrt dopamine hit': 'fehhzTMUvQ0',
'altare change my mind': 'rsahmfIoFYg',
'amon tobin all for dust': 'gk7h5rHCAK0',
'austin wintory bachram': 'joZPelvKQm8',
'austin wintory desert fire': 'fRLU6xyoeD8',
'austin wintory mocha petal': 'mwHTecB638E',
'austin wintory the devil went clubbing in georgia': 'j6UUxv0ag9w',
'awolnation i am': 'hKo3f96EG_g',
'bbno u mad': 'aDT24lCYCBY',
'beartooth aggressive': 'vnMSivyiFEE',
'beartooth disgusting': 'B3REasfNOac',
'ben bromfield rabbit hole': 'I1yzPG1RplA',
'blitz kids the good youth': '3aFh__HBYGM',
'borne give it to me': 'HurJaQhHQ44',
'chipzel yellow magic': 'THChLWmCEA4',
'damjan mravunac the talos principle': 'u6t54gTu23A',
'daniel sadowski crimson assault': 'puG4asobJTU',
'daniel sadowski dead shot': 'oTZT36d99l0',
'daniel sadowski eye of the dragon': 'RMtBiC1Y4cQ',
'daniel sadowski the 8bit kit': 'DtNu4Axqc6E',
'daniel sadowski total domination': 'RjRtSBhkfmY',
'darren korb hades music kit': '1AaHFrh-hP4',
'darude moments csgo': 'eOJp0EcemBY',
'denzel curry ultimate': 'WiW3u5lpWeU',
'dren deaths head demolition': 'vpZWkJ_P4YU',
'dren gunman taco truck': 't9mKfaacViw',
'dren mcdonald coffee kofe kahveh': '3aKx-eFyGv8',
'dryden feel the power': 'WsUJ4qLAnM4',
'feed me high noon': 'pLYXVpb30HQ',
'freaky dna vici': 'PAmQ6Xl6NkI',
'ghost skeletá': '3RUj0aCcXzU',
'halflife alyx anticitizen': 'k-cEMqXcLWM',
'halo the master chief collection': '1HwHThHEYV8',
'health rat wars': '5VSVvT9EQXI',
'humanitys last breath void': 'lW1BWdhl914',
'hundredth free': 'edZEdUzpvhA',
'ian hultquist lions mouth': 'hAVahJuPPnc',
'isoxo inhuman': 'ps-V1GQZPRM',
'james and the cold gun chewing glass': '9zjLoFqK0XQ',
'jesse harlin astro bellum': 'P4HpUNmo_AQ',
'jonathan young starship velociraptor': 'iai5rBxywJ0',
'juelz floorspace': 'BBgiopENh7g',
'juelz shooters': 'fFxoYk-pOGw',
'kelly bailey hazardous environments': 'Eg7QcPNHkss',
'kill script all night': 'IQHOVWMoaCQ',
'killer mike michael': 'uWJcKMl-5EI',
'kitheory molotov': '3TowOCyEznw',
'knock2 dashstar': 'OCxmJWVv31o',
'knock2 make u sweat': 'vekNwu9_VD4',
'laura shigihara work hard play hard': 'CJVr7wVRL70',
'lennie moore java havana funkaloo': 'MRSyWTN9CMo',
'mateo messina for no mankind': 'GA_S-seVRTg',
'matt lange isorhythm': '7-ER4z5r3Tk',
'matt levine agency': 'IMa9vkyz2lk',
'matt levine drifter': 'FgflyUoz878',
'meechy darko gothic luxury': 't9511XZ4ZUM',
'michael bross invasion': '1OkrYSEzrew',
'midnight riders all i want for christmas': 'EOtnKF8lxFM',
'mord fustang diamonds': 'XdQExqXg7Ng',
'neck deep lifes not out to get you': '-uynAoB9B4Y',
'neck deep the lowlife pack': '14BQXtixI9A',
'new beat fund sponge fingerz': '8ojR50Jbpnk',
'noisia sharpened': '1t-upZTkg_o',
'perfect world ay hey': '25SfdEaZTxY',
'perfect world 花脸 hua lian painted face': 'AzxA8mpxnZk',
'pirapus everynite': 'mPeXxKhIcH4',
'proxy battlepack': 'PBVfx7YLIQc',
'pvris evergreen': 'XbuXGoOMiqg',
'rad cat reason': 'IYMhhpg2nho',
'repiet julia kleijn on and on': 'ZNIdzoJDolw',
'roam backbone': 'mSIY1ro6pYY',
'robert allaire insurgency': 'KcMzyIkpRWo',
'sam marshall bodacious': 'MGtpurSDpSM',
'sam marshall clutch': 'KCERbxUbzHI',
'sarah schachner kolibri': 'G2bMJMber5g',
'sasha lnoe': '3XyGZU_fsZQ',
'scarlxrd chainawlxadxut': 'mEsP_eO9J7w',
'scarlxrd king scar': 'Ca7jc86w64E',
'sean murray ad8': 'SIfmBqGpCTM',
'selective response no love only pleasure': 'HkQPiag9u-Y',
'shockone voices': 'g8OuGcUnJFc',
'skog iiheadshot': '2hHijgDSvwg',
'skog iiiarena': 'g64i-WxGaiw',
'skog metal': 'I2Em1Vwbawo',
'starjunk 95 industrial sunset memories': 'Xrq0qp1BEmI',
'sullivan king lock me up': 'pusi6ezcZJ0',
'the verkkars ez4ence': 'PegAqCezsd8',
'the verkkars n0thing flashbang dance': 'MiPs_TNp_-w',
'tigercub the perfume of decay': 'i9sgCEI4KUg',
'tim huling devils paintbrush': 'vT0o6M0T9-k',
'tim huling neo noir': '5OfZ5wnHtUM',
'tree adams and ben bromfield mudd force': 'zNT9RPAqqUU',
'tree adams seventh moon': 'EA80gX35ATI',
'troels folmann uber blasto phone': 'BbWpHCiHYHo',
'twerl and ekko sidetrack under bright lights': 'DfLVovMioJg',
'twerl ekko sidetrack under bright lights': 'DfLVovMioJg',
'twin atlantic gla': 'evMfVaqYPHQ',
'valve counterstrike 2': 'divXog5a2Vg',
'valve csgo': 'JM_EVRC6JKU',
'various artists hotline miami': 'sdYCS6bl_cU',
};

const MUSIC_KIT_RE = /^(?:stattrak™?\s*)?(?:music kit|набор музыки)\s*\|\s*(.+)$/i;

// «Артист, Трек» из названия лота или '' — если это не пластинка.
function musicKitName(title){
const m = String(title || '').trim().match(MUSIC_KIT_RE);
return m ? m[1].trim() : '';
}

function musicKitVideoId(name){
const key = name.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
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
