// Hot Potato main logic
const $ = (sel) => document.querySelector(sel);

const state = {
  lang: localStorage.getItem('hp_lang') || 'en',
  i18n: null,
  safe: false,
  enabledCategories: new Set(),
  phase: 'lang', // 'intro' | 'playing' | 'prompt'
  round: 0,
  randomTimer: null,
  prompts: [],
  recentPromptIds: [],
  audio: {
    bg: null,
    scream: null,
    muted: false
  },
  gifs: []
};

// Load available GIFs by scanning a static list (fallback) or index.json if provided
async function loadGifList(){
  // Try to fetch an optional index.json in gifs folder; if missing, we will list default names
  try {
    const res = await fetch('/assets/gifs/index.json');
    if(res.ok){
      state.gifs = await res.json();
      return;
    }
  }catch(e){}
  // Fallback: attempt some common names (will be cached by SW)
  const defaults = [];
  for (let i=1;i<=30;i++) defaults.push(`gif${i}.gif`);
  state.gifs = defaults;
}

// Utility to choose a random element
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

// i18n loader
async function loadLocale(lang){
  const res = await fetch(`/locales/${lang}.json`);
  state.i18n = await res.json();
  document.documentElement.lang = lang;
}

function t(key, fallback=''){
  const parts = key.split('.');
  let cur = state.i18n;
  for (const p of parts){
    cur = cur?.[p];
  }
  return cur ?? fallback ?? key;
}

// UI: populate language list
const languages = [
  { code:'en', name:'English' },
  { code:'el', name:'Ελληνικά' },
  { code:'bg', name:'Български' },
  { code:'mk', name:'Македонски' },
  { code:'sq', name:'Shqip' }
];

async function init(){
  await loadLocale(state.lang);
  await loadGifList();

  // Update static text
  $('#tagline').textContent = t('ui.tagline');
  $('#languageSelectLabel').textContent = t('ui.languageSelect');
  $('#langHint').textContent = t('ui.langHint');
  $('#instructionsTitle').textContent = t('ui.instructionsTitle');
  $('#startBtn').textContent = t('ui.start');
  $('#helpBtn').textContent = t('ui.support');
  $('#changeLangBtn').textContent = t('ui.changeLanguage');
  $('#safeModeLabel').textContent = t('ui.safeMode');
  $('#playingLabel').textContent = t('ui.playingLabel');
  $('#stopBtn').textContent = t('ui.stop');
  $('#muteBtn').textContent = t('ui.mute');
  $('#nextBtn').textContent = t('ui.nextRound');
  $('#skipBtn').textContent = t('ui.skip');
  $('#pauseAudioBtn').textContent = t('ui.pauseAudio');
  $('#supportTitle').textContent = t('ui.supportTitle');
  $('#closeSupport').textContent = t('ui.close');
  $('#footerNote').textContent = t('ui.footer');

  renderLanguageGrid();
  setPhase(localStorage.getItem('hp_lang') ? 'intro' : 'lang');

  // Audio setup
  state.audio.bg = $('#bgMusic');
  state.audio.scream = $('#sfxScream');
  updateAudioState();

  // Settings categories list
  buildCategoryList();

  // Listeners
  $('#startBtn').addEventListener('click', startRound);
  $('#stopBtn').addEventListener('click', stopRoundManual);
  $('#muteBtn').addEventListener('click', toggleMute);
  $('#nextBtn').addEventListener('click', nextRound);
  $('#skipBtn').addEventListener('click', skipPrompt);
  $('#pauseAudioBtn').addEventListener('click', pauseAllAudio);
  $('#changeLangBtn').addEventListener('click', ()=>setPhase('lang'));
  $('#helpBtn').addEventListener('click', ()=>$('#supportModal').style.display='block');
  $('#closeSupport').addEventListener('click', ()=>$('#supportModal').style.display='none');

  // Safe mode toggle
  $('#safeMode').addEventListener('change', (e)=>{
    state.safe = e.target.checked;
    buildCategoryList();
  });

  // Keyboard helpers
  document.addEventListener('keydown', (e)=>{
    if(e.code === 'Space'){
      if(state.phase === 'playing'){ stopRoundManual(); }
      else if(state.phase === 'intro'){ startRound(); }
      else if(state.phase === 'prompt'){ nextRound(); }
      e.preventDefault();
    }
  });

  // PWA SW registration
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('/sw.js');
  }
}

function setPhase(phase){
  state.phase = phase;
  $('#langScreen').style.display = phase === 'lang' ? 'block' : 'none';
  $('#introScreen').style.display = phase === 'intro' ? 'block' : 'none';
  $('#playingScreen').style.display = phase === 'playing' ? 'block' : 'none';
  $('#promptScreen').style.display = phase === 'prompt' ? 'block' : 'none';
  $('#supportModal').style.display = 'none';
  if(phase === 'lang'){
    renderLanguageGrid();
  }
  if(phase === 'intro'){
    $('#instructionsList').innerHTML = `<ul>${t('ui.instructions').map(i=>`<li>${i}</li>`).join('')}</ul>`;
  }
  if(phase === 'playing'){
    $('#playingViz').style.display = 'flex';
    const gifFile = pickAnyGif();
    $('#loopGif').src = gifFile;
  }
}

function renderLanguageGrid(){
  const grid = $('#langGrid');
  grid.innerHTML = '';
  languages.forEach(({code,name}) => {
    const btn = document.createElement('button');
    btn.className = 'lang-item';
    btn.setAttribute('aria-label', t('ui.selectLanguageAria', 'Select language') + ' ' + name);
    btn.textContent = name;
    btn.addEventListener('click', async ()=>{
      state.lang = code;
      localStorage.setItem('hp_lang', code);
      await loadLocale(code);
      await buildCategoryList();
      // Update all UI labels after language switch
      init(); // quick re-init to refresh texts
      setPhase('intro');
    });
    grid.appendChild(btn);
  });
}

function categories(){
  // Base categories list
  const cats = t('categories');
  // If safe mode on, filter out sensitive ones
  const sensitive = ['sexual_harassment','teacher_to_student_abuse','student_to_teacher_abuse','racism'];
  return Object.keys(cats).filter(k => !state.safe || !sensitive.includes(k));
}

async function buildCategoryList(){
  const list = $('#categoryList');
  list.innerHTML = '';
  const catMap = t('categories');
  const catKeys = Object.keys(catMap);
  const filtered = categories();
  // Initialize enabled set if empty
  if(state.enabledCategories.size === 0){
    filtered.forEach(k => state.enabledCategories.add(k));
  }
  catKeys.forEach((key)=>{
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type='checkbox';
    cb.checked = state.enabledCategories.has(key) && (!state.safe || filtered.includes(key));
    cb.disabled = state.safe && !filtered.includes(key);
    cb.addEventListener('change', ()=>{
      if(cb.checked) state.enabledCategories.add(key);
      else state.enabledCategories.delete(key);
    });
    const span = document.createElement('span');
    span.textContent = catMap[key];
    label.appendChild(cb);
    label.appendChild(span);
    list.appendChild(label);
  });
  // Preload prompts for enabled categories
  state.prompts = t('prompts');
}

function startRound(){
  setPhase('playing');
  state.round++;
  // Ensure audio starts due to user gesture
  playMusic();
  // Random timer
  const min = 10000, max = 30000;
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  clearTimeout(state.randomTimer);
  state.randomTimer = setTimeout(triggerPrompt, ms);
  $('#liveRegion').textContent = t('ui.startedAnnounce');
}

function stopRoundManual(){
  clearTimeout(state.randomTimer);
  pauseMusic();
  $('#liveRegion').textContent = t('ui.pausedAnnounce');
  // Do NOT trigger prompt automatically
}

function updateAudioState(){
  const muted = state.audio.muted;
  $('#audioState').textContent = muted ? t('ui.muted') : t('ui.soundOn');
}

function toggleMute(){
  state.audio.muted = !state.audio.muted;
  [state.audio.bg, state.audio.scream].forEach(a=>{ a.muted = state.audio.muted; });
  updateAudioState();
}

function pauseAllAudio(){
  state.audio.bg.pause();
  state.audio.scream.pause();
}

function playMusic(){
  state.audio.bg.muted = state.audio.muted;
  state.audio.bg.play().catch(()=>{});
  $('#playingLabel').textContent = t('ui.playingLabel');
  updateAudioState();
}

function pauseMusic(){
  state.audio.bg.pause();
}

function pickAnyGif(){
  // pick a file that exists; construct path
  const file = rand(state.gifs);
  return `/assets/gifs/${file}`;
}

function eligiblePrompts(){
  // Build a flat list from enabled categories
  const pool = [];
  const data = state.prompts;
  const enabled = categories().filter(k => state.enabledCategories.has(k));
  enabled.forEach((cat)=>{
    const arr = data[cat] || [];
    arr.forEach((p, idx)=> pool.push({ ...p, __id:`${cat}-${idx}`, category:cat }));
  });
  return pool;
}

function pickPrompt(){
  const pool = eligiblePrompts();
  if(pool.length === 0) return null;
  // Avoid last few repeats
  const filtered = pool.filter(p => !state.recentPromptIds.includes(p.__id));
  const chosen = rand(filtered.length ? filtered : pool);
  state.recentPromptIds.push(chosen.__id);
  if(state.recentPromptIds.length > 6) state.recentPromptIds.shift();
  return chosen;
}

function triggerPrompt(){
  pauseMusic();
  // Play scream
  state.audio.scream.currentTime = 0;
  state.audio.scream.muted = state.audio.muted;
  state.audio.scream.play().catch(()=>{});

  const chosen = pickPrompt();
  const catMap = t('categories');
  // Update UI
  setPhase('prompt');
  $('#boomGif').src = pickAnyGif();
  if(chosen){
    $('#promptText').textContent = chosen.text;
    $('#promptCategory').textContent = `${t('ui.categoryLabel')} ${catMap[chosen.category]}`;
  }else{
    $('#promptText').textContent = t('ui.noPrompt');
    $('#promptCategory').textContent = '';
  }
  $('#liveRegion').textContent = t('ui.promptAnnounce');
}

function nextRound(){
  setPhase('intro'); // brief reset screen
  // Immediately start again for streamlined flow
  startRound();
}

function skipPrompt(){
  const chosen = pickPrompt();
  const catMap = t('categories');
  if(chosen){
    $('#promptText').textContent = chosen.text;
    $('#promptCategory').textContent = `${t('ui.categoryLabel')} ${catMap[chosen.category]}`;
  }
}

init();
