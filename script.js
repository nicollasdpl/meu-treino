/*************** Firebase ***************/
const FIREBASE_CFG = {
  apiKey: "AIzaSyAEewjrcLxpXSZMoOPo4nkuTg3lTZI-J78",
  authDomain: "meu-treino-e4592.firebaseapp.com",
  projectId: "meu-treino-e4592",
  storageBucket: "meu-treino-e4592.firebasestorage.app",
  messagingSenderId: "245894818340",
  appId: "1:245894818340:web:dd6ba010356c05b9d846b1",
  measurementId: "G-QW4TNPPE3X"
};
let fb = { app:null, auth:null, provider:null, db:null, user:null, _:{} };
let firebaseOk = false;

(async function initFirebase(){
  try{
    const [{ initializeApp }, { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut },
           { getFirestore, doc, setDoc, getDoc, collection, getDocs }] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js')
    ]);
    fb.app = initializeApp(FIREBASE_CFG);
    fb.auth = getAuth(fb.app);
    fb.provider = new GoogleAuthProvider();
    fb.db = getFirestore(fb.app);
    fb._ = { doc, setDoc, getDoc, collection, getDocs, onAuthStateChanged, signInWithPopup, signOut };
    firebaseOk = true;

    qs('#userStatus').textContent = 'Firebase carregado';

    fb._.onAuthStateChanged(fb.auth, async (user)=>{
      fb.user = user || null;
      if(user){
        qs('#userStatus').textContent = `Logado: ${user.displayName || user.email}`;
        qs('#btnLogin').style.display = 'none';
        qs('#btnLogout').style.display = '';
        qs('#syncInfo').textContent = 'Sincronização: Conectado';
        await puxarDoFirestoreMesclarLocal();
        atualizarPerfilUI();
      }else{
        qs('#userStatus').textContent = 'Não logado';
        qs('#btnLogin').style.display = '';
        qs('#btnLogout').style.display = 'none';
        qs('#syncInfo').textContent = 'Sincronização: Offline';
        atualizarPerfilUI();
      }
      atualizarResumoHome();
    });

    qs('#btnLogin').addEventListener('click', async ()=>{
      try{ await fb._.signInWithPopup(fb.auth, fb.provider); }catch(e){ alert('Falha no login'); }
    });
    qs('#btnLogout').addEventListener('click', async ()=>{
      try{ await fb._.signOut(fb.auth); }catch(_){}
    });
  }catch(e){
    qs('#userStatus').textContent = 'Firebase indisponível (modo local)';
    qs('#syncInfo').textContent = 'Sincronização: —';
    qs('#btnLogin').style.display = 'none';
    qs('#btnLogout').style.display = 'none';
  }
})();

/*************** Utils ***************/
const qs = sel => document.querySelector(sel);
const qsa = sel => [...document.querySelectorAll(sel)];
const todayStr = () => new Date().toISOString().slice(0,10);

/*************** Treinos ***************/
const TREINOS = {
  segunda: [
    {nome:'Puxada triângulo alta', alvo:'3x8–12'},
    {nome:'Puxada barra reta alta', alvo:'3x8–12'},
    {nome:'Remada máquina', alvo:'3x8–12'},
    {nome:'Rosca direta barra', alvo:'3x8–12'},
    {nome:'Martelo', alvo:'3x10–12'},
    {nome:'Banco Scott', alvo:'3x8–12'},
    {nome:'Lombar máquina', alvo:'3x15–20'}
  ],
  terca: [
    {nome:'Supino máquina vertical', alvo:'3x8–12'},
    {nome:'Supino reto com halteres', alvo:'3x8–12'},
    {nome:'Crucifixo reto com halteres', alvo:'3x10–12'},
    {nome:'Supino declinado convergente', alvo:'3x8–12'},
    {nome:'Tríceps francês', alvo:'3x10–12'},
    {nome:'Tríceps polia barra reta', alvo:'3x12–15'}
  ],
  quarta: [
    {nome:'Desenvolvimento máquina', alvo:'3x8–12'},
    {nome:'Elevação lateral', alvo:'3x12–15'},
    {nome:'Crucifixo inverso / Face pull', alvo:'3x12–15'},
    {nome:'Encolhimento trapézio', alvo:'3x12–15'}
  ],
  quinta: [
    {nome:'Hack squat', alvo:'3x8–12'},
    {nome:'Leg press', alvo:'3x10–12'},
    {nome:'Cadeira extensora', alvo:'3x12–15'},
    {nome:'Cadeira flexora', alvo:'3x12–15'},
    {nome:'Mesa flexora', alvo:'3x10–12'},
    {nome:'Panturrilha banco', alvo:'3x15–20'}
  ],
  sexta: [
    {nome:'Rosca direta barra', alvo:'3x8–12'},
    {nome:'Martelo', alvo:'3x10–12'},
    {nome:'Tríceps francês', alvo:'3x10–12'},
    {nome:'Tríceps polia barra reta', alvo:'3x12–15'},
    {nome:'Abdômen (prancha, infra, polia)', alvo:'3 séries'}
  ]
};
const DIAS_MAP = {0:'domingo',1:'segunda',2:'terca',3:'quarta',4:'quinta',5:'sexta',6:'sabado'};

function textoTreinoHoje(){
  const d = new Date().getDay();
  let nome = 'Descanso';
  if(d===1) nome='Costas + Bíceps';
  if(d===2) nome='Peito + Tríceps';
  if(d===3) nome='Ombro';
  if(d===4) nome='Perna';
  if(d===5) nome='Bíceps + Tríceps + Abdômen';
  return `Hoje é ${new Date().toLocaleDateString()} · Treino do dia: ${nome}`;
}
qs('#subheader').textContent = textoTreinoHoje();

/*************** Tema + Navegação ***************/
(function themeInit(){
  const saved = localStorage.getItem('theme') || 'dark';
  if(saved==='dark') document.documentElement.classList.add('dark');
  qs('#btnTheme').textContent = document.documentElement.classList.contains('dark')?'☀️':'🌙';
})();
qs('#btnTheme').addEventListener('click', ()=>{
  document.documentElement.classList.toggle('dark');
  const dark = document.documentElement.classList.contains('dark');
  localStorage.setItem('theme', dark?'dark':'light');
  qs('#btnTheme').textContent = dark?'☀️':'🌙';
});

window.mostrarPagina = function(id){
  qsa('.pagina').forEach(p=>p.style.display='none');
  qs('#'+id).style.display='block';
  if(id==='graficos'){ popularListaExerciciosChart(); atualizarEvolucaoUI(); }
  if(id==='home'){ atualizarResumoHome(); }
  if(id==='perfil'){ atualizarPerfilUI(); }
};

/*************** Storage sessões (com migração p/ sets) ***************/
function getSessoes(){
  const raw = JSON.parse(localStorage.getItem('sessoes')||'[]');
  raw.forEach(sess=>{
    (sess.exercicios||[]).forEach(e=>{
      if(!e.sets){
        const peso = e.peso ?? '';
        const reps = e.reps ?? '';
        e.sets = [{peso,reps,done:false},{peso,reps,done:false},{peso,reps,done:false}];
      }else{
        e.sets = e.sets.map(s=>({peso:s.peso??'', reps:s.reps??'', done:!!s.done}));
      }
      if(typeof e.obs!=='string') e.obs = e.obs ?? '';
    });
  });
  return raw;
}
function setSessoes(a){ localStorage.setItem('sessoes', JSON.stringify(a)); }

/*************** Firestore sessões ***************/
async function puxarDoFirestoreMesclarLocal(){
  if(!firebaseOk || !fb.user) return;
  const { collection, getDocs } = fb._;
  const ref = collection(fb.db, 'users', fb.user.uid, 'sessoes');
  const snap = await getDocs(ref);
  const cloud = []; snap.forEach(d => cloud.push(d.data()));
  const local = getSessoes();
  const byDate = new Map();
  [...local, ...cloud].forEach(s=>{
    const old = byDate.get(s.data);
    if(!old) byDate.set(s.data, s);
    else{
      const pick = (old.exercicios?.length||0) >= (s.exercicios?.length||0) ? old : s;
      byDate.set(s.data, pick);
    }
  });
  const merged = [...byDate.values()].sort((a,b)=>a.data.localeCompare(b.data));
  setSessoes(merged);
  qs('#syncInfo').textContent = 'Sincronização: Sincronizado';
  montarCalendario(); atualizarResumoHome(); atualizarEvolucaoUI();
}
async function salvarNoFirestore(sessao){
  if(!firebaseOk || !fb.user) return;
  const { doc, setDoc } = fb._;
  const ref = doc(fb.db, 'users', fb.user.uid, 'sessoes', sessao.data);
  await setDoc(ref, sessao, { merge:true });
  qs('#syncInfo').textContent = 'Sincronização: Sincronizado';
}

/*************** Calendário ***************/
let viewAno, viewMes;
const mesLabel = qs('#mesAno');
const calEl = qs('#calendario');
qs('#prevMes').addEventListener('click', ()=>{ viewMes--; if(viewMes<0){viewMes=11; viewAno--; } montarCalendario(); });
qs('#proxMes').addEventListener('click', ()=>{ viewMes++; if(viewMes>11){viewMes=0; viewAno++; } montarCalendario(); });

(function initCalendar(){
  const hoje = new Date();
  viewAno = hoje.getFullYear();
  viewMes = hoje.getMonth();
  montarCalendario();
})();

function montarCalendario(){
  mesLabel.textContent = new Date(viewAno, viewMes).toLocaleString('pt-BR', {month:'long', year:'numeric'});
  calEl.innerHTML='';
  const first = new Date(viewAno, viewMes, 1);
  const lastDay = new Date(viewAno, viewMes+1, 0).getDate();
  const offset = first.getDay();
  for(let i=0;i<offset;i++){
    const d = document.createElement('div'); d.className='dia fora'; calEl.appendChild(d);
  }
  const hoje = new Date();
  const setDatas = new Set(getSessoes().map(s=>s.data));
  for(let dia=1; dia<=lastDay; dia++){
    const d = document.createElement('div');
    d.className='dia'; d.dataset.dia = String(dia).padStart(2,'0');
    d.textContent = dia;
    const dataStr = `${viewAno}-${String(viewMes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
    if(setDatas.has(dataStr)) d.classList.add('treino'); else d.classList.add('nao-treino');
    if(dia===hoje.getDate() && viewMes===hoje.getMonth() && viewAno===hoje.getFullYear()) d.classList.add('hoje');

    d.addEventListener('click', ()=>{
      if(d.classList.contains('treino')){
        d.classList.remove('treino'); d.classList.add('nao-treino');
        removerSessaoPorData(dataStr);
      }else{
        d.classList.remove('nao-treino'); d.classList.add('treino');
        adicionarSessaoVazia(dataStr);
      }
      atualizarResumoHome();
    });
    calEl.appendChild(d);
  }
  atualizarResumoHome();
}
function atualizarResumoHome(){
  const sess = getSessoes().filter(s => {
    const dt = new Date(s.data);
    return dt.getFullYear()===viewAno && dt.getMonth()===viewMes;
  });
  qs('#diasTreinadosMes').textContent = new Set(sess.map(s=>s.data)).size;
  const ult = getSessoes().slice(-1)[0];
  qs('#ultimoTreino').textContent = ult ? `${ult.data} (${fmtDuracao(ult.duracao||0)})` : '—';
  const dur = getSessoes().map(s=>s.duracao||0);
  const media = dur.length? Math.round(dur.reduce((a,b)=>a+b,0)/dur.length):0;
  qs('#duracaoMedia').textContent = dur.length? fmtDuracao(media) : '—';
}
function adicionarSessaoVazia(dataStr){
  const sess = getSessoes();
  if(!sess.find(s=>s.data===dataStr)){
    sess.push({data:dataStr, duracao:0, dia:null, exercicios:[]});
    setSessoes(sess);
  }
}
function removerSessaoPorData(dataStr){
  setSessoes(getSessoes().filter(s=>s.data!==dataStr));
}
function marcarHojeNoCalendario(){
  const hoje = new Date();
  if(hoje.getFullYear()===viewAno && hoje.getMonth()===viewMes){
    const diaSel = String(hoje.getDate()).padStart(2,'0');
    const el = [...document.querySelectorAll('.dia')].find(d=>d.dataset.dia===diaSel);
    if(el){ el.classList.remove('nao-treino'); el.classList.add('treino'); }
  }
  atualizarResumoHome();
}

/*************** Timer de treino ***************/
let timerId=null, startEpoch=Number(localStorage.getItem('sessionStart')||0);
const timerEl = qs('#timer');

function tick(){
  if(!startEpoch) return;
  const sec = Math.floor((Date.now()-startEpoch)/1000);
  if(timerEl) timerEl.textContent = fmtDuracao(sec);
}
function startSessionIfNeeded(){
  if(!startEpoch){
    startEpoch = Date.now();
    localStorage.setItem('sessionStart', String(startEpoch));
  }
  if(!timerId){ timerId = setInterval(tick,1000); }
  const btns = qsa('#treino #btnTimer');
  btns.forEach(b=> b.textContent='Finalizar');
}
function stopSession(){
  if(timerId){ clearInterval(timerId); timerId=null; }
  startEpoch = 0;
  localStorage.removeItem('sessionStart');
  const btns = qsa('#treino #btnTimer');
  btns.forEach(b=> b.textContent='Iniciar');
}
tick();
if(startEpoch) timerId=setInterval(tick,1000);
qsa('#btnTimer').forEach? qsa('#btnTimer').forEach(b=>b.addEventListener('click',toggleTimer)) : qs('#btnTimer').addEventListener('click',toggleTimer);
function toggleTimer(){
  if(timerId){
    clearInterval(timerId); timerId=null;
    const duracao = Math.floor((Date.now()-startEpoch)/1000);
    stopSession();
    salvarSessaoAtual(duracao);
  }else{
    startSessionIfNeeded();
  }
}
function fmtDuracao(sec){
  const h=String(Math.floor(sec/3600)).padStart(2,'0');
  const m=String(Math.floor((sec%3600)/60)).padStart(2,'0');
  const s=String(sec%60).padStart(2,'0');
  return `${h}:${m}:${s}`;
}

/*************** Descanso + Notificação ***************/
let audioCtx=null;
function ensureAudioCtx(){
  if(!audioCtx){
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = AC ? new AC() : null;
  }
  if(audioCtx?.state==='suspended'){ audioCtx.resume?.(); }
}
function beep(times=3, freq=880, dur=200){
  if(!audioCtx) return;
  let t=0;
  for(let i=0;i<times;i++){
    setTimeout(()=>{
      const o=audioCtx.createOscillator(), g=audioCtx.createGain();
      o.frequency.value=freq; o.type='sine';
      o.connect(g); g.connect(audioCtx.destination);
      g.gain.setValueAtTime(0.001, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.4, audioCtx.currentTime+0.01);
      o.start(); setTimeout(()=>{o.stop();}, dur);
    }, t);
    t+=dur+120;
  }
}
let notifReady = false;
async function ensureNotifyPermission(){
  if(!("Notification" in window)) return false;
  if(Notification.permission === "granted"){ notifReady = true; return true; }
  if(Notification.permission !== "denied"){
    const p = await Notification.requestPermission();
    notifReady = (p === "granted");
    return notifReady;
  }
  return false;
}
function notify(title, body){
  if(notifReady){
    try{ new Notification(title, { body }); }catch(_){}
  }
}
qs('#btnNotify').addEventListener('click', async ()=>{
  const ok = await ensureNotifyPermission();
  qs('#btnNotify').textContent = ok ? '🔔' : '🔕';
});

let restId=null, restLeft=0, beepLoop=null;
const restSeg = qs('#restSeg');
const restDisplay = qs('#restDisplay');
const overlay = qs('#restOverlay');

function iniciarDescansoAuto(segundos){
  if(restId){ clearInterval(restId); restId=null; }
  ensureAudioCtx();
  ensureNotifyPermission();
  restLeft = Math.max(10, Number(segundos||restSeg.value||60));
  restDisplay.textContent = `${restLeft}s`;
  restId = setInterval(()=>{
    restLeft--; restDisplay.textContent = `${restLeft}s`;
    if(restLeft<=0){
      clearInterval(restId); restId=null;
      restDisplay.textContent='⏰ Descanso finalizado!';
      try{ navigator.vibrate && navigator.vibrate([250,120,250,120,400]); }catch(_){}
      beep(3, 1100, 220);
      overlay.classList.remove('hidden');
      notify('Descanso finalizado!', 'Vamos para a próxima série.');
      beepLoop = setInterval(()=>{ ensureAudioCtx(); beep(1, 1200, 180); }, 1200);
      const baseTitle=document.title; let f=0;
      const blink=setInterval(()=>{ document.title = (++f%2)?'⏰ Descanso!' : baseTitle; if(f>10){clearInterval(blink); document.title=baseTitle;} },500);
    }
  },1000);
}
qs('#btnRest').addEventListener('click', ()=>{
  if(restId){
    clearInterval(restId); restId=null; restDisplay.textContent='—';
    clearInterval(beepLoop); beepLoop=null; overlay.classList.add('hidden');
    return;
  }
  iniciarDescansoAuto(Number(restSeg.value||60));
});
qs('#btnOverlayOk').addEventListener('click', ()=>{
  overlay.classList.add('hidden');
  clearInterval(beepLoop); beepLoop=null;
});
qs('#btnOverlayBuzz').addEventListener('click', ()=>{
  try{ navigator.vibrate && navigator.vibrate([200,100,300]); }catch(_){}
  ensureAudioCtx(); beep(2, 1250, 200);
});

/*************** UI Treino (3 séries + descanso auto + tonelagem) ***************/
const tabs = qsa('.tab-btn');
const listaExEl = qs('#listaExercicios');
const treinoDoDiaEl = qs('#treinoDoDia');
const salvarBtn = qs('#salvarTreino');
const copyBtn = qs('#btnCopyLast');

tabs.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    tabs.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    montarExercicios(btn.dataset.dia, true);
  });
});
copyBtn?.addEventListener('click', ()=>{
  const key = qs('.tab-btn.active')?.dataset.dia || 'segunda';
  preencherComUltima(key);
});

function montarExercicios(diaKey, prefill=true){
  const arr = TREINOS[diaKey] || [];
  treinoDoDiaEl.textContent = `Dia selecionado: ${labelDia(diaKey)} · Registre as cargas e reps (meta: 8–12 reps).`;
  listaExEl.innerHTML = '';

  arr.forEach(ex=>{
    const last = ultimaEntrada(ex.nome);
    const baseSets = last?.sets?.length ? last.sets : [{peso:'',reps:''},{peso:'',reps:''},{peso:'',reps:''}];

    const card = document.createElement('div');
    card.className='ex-card';
    card.innerHTML = `
      <div class="ex-head"><div><b>${ex.nome}</b><br><small>${ex.alvo}</small></div></div>
      <div class="sets" data-ex="${ex.nome}">
        ${[0,1,2].map(i => `
          <div class="set" data-set="${i}">
            <span class="tag">S${i+1}</span>
            <input type="number" step="0.5" placeholder="kg" class="inp peso" data-ex="${ex.nome}" data-set="${i}" value="${prefill ? (baseSets[i]?.peso??'') : ''}">
            <input type="number" placeholder="reps" class="inp reps" data-ex="${ex.nome}" data-set="${i}" value="${prefill ? (baseSets[i]?.reps??'') : ''}">
            <button class="tick" type="button" data-ex="${ex.nome}" data-set="${i}" aria-label="Marcar série">✓</button>
          </div>
        `).join('')}
      </div>
      <div class="obs-wrap"><textarea rows="1" placeholder="obs" data-field="obs" data-ex="${ex.nome}">${prefill ? (last?.obs??'') : ''}</textarea></div>
    `;
    listaExEl.appendChild(card);
  });

  // Check da série → inicia sessão + descanso + tonelagem
  listaExEl.querySelectorAll('button.tick').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      startSessionIfNeeded();
      const setEl = btn.closest('.set');
      setEl.classList.toggle('done');
      iniciarDescansoAuto();
      atualizarTonelagemDoDia();
    });
  });

  // Digitar S1 auto-preenche S2/S3 vazias
  listaExEl.querySelectorAll('.set[data-set="0"] .inp').forEach(inp=>{
    inp.addEventListener('change', ()=>{
      const nome = inp.dataset.ex;
      const field = inp.classList.contains('peso') ? '.peso' : '.reps';
      const val = inp.value;
      [1,2].forEach(i=>{
        const tgt = listaExEl.querySelector(`.sets[data-ex="${CSS.escape(nome)}"] .set[data-set="${i}"] ${field}`);
        if(tgt && !tgt.value) tgt.value = val;
      });
      atualizarTonelagemDoDia();
    });
  });

  listaExEl.querySelectorAll('.inp').forEach(i=> i.addEventListener('input', atualizarTonelagemDoDia));
  ensureTonelagemBox();
  atualizarTonelagemDoDia();
}
function labelDia(key){
  return {segunda:'Segunda (Costas+Bíceps)', terca:'Terça (Peito+Tríceps)', quarta:'Quarta (Ombro)', quinta:'Quinta (Perna)', sexta:'Sexta (Braços+Abs)'}[key] || key;
}
function ultimaEntrada(nomeEx){
  const historico = getSessoes();
  for(let i=historico.length-1;i>=0;i--){
    const e = historico[i].exercicios?.find(x=>x.nome===nomeEx);
    if(e) return e;
  }
  return null;
}

function coletarInputsExercicios(){
  const map = {}; // nome -> {sets:[], obs}
  qsa('.sets').forEach(box=>{
    const nome = box.dataset.ex;
    map[nome] = map[nome] || {nome, sets:[{},{},{}], obs:''};
    box.querySelectorAll('.set').forEach(setEl=>{
      const i = Number(setEl.dataset.set);
      const peso = setEl.querySelector('.peso')?.value || '';
      const reps = setEl.querySelector('.reps')?.value || '';
      const done = setEl.classList.contains('done');
      map[nome].sets[i] = {peso, reps, done};
    });
  });
  qsa('textarea[data-field="obs"]').forEach(t=>{
    const nome = t.dataset.ex;
    if (map[nome]) map[nome].obs = t.value;
  });
  // compat: salva "peso/reps" como max do dia
  Object.values(map).forEach(e=>{
    const pesos = e.sets.map(s=>Number(s.peso||0));
    const maxKg = Math.max(...pesos, 0);
    const idx = pesos.indexOf(maxKg);
    e.peso = maxKg || '';
    e.reps = idx>=0 ? (e.sets[idx].reps||'') : '';
  });
  return Object.values(map);
}

function preencherComUltima(diaKey){
  const arr = TREINOS[diaKey] || [];
  const hist = getSessoes();
  arr.forEach(ex=>{
    const last = hist.slice().reverse().map(s=>s.exercicios||[]).flat().find(e=>e.nome===ex.nome);
    if(last){
      last.sets?.forEach((s,i)=>{
        const p = qs(`.sets[data-ex="${CSS.escape(ex.nome)}"] .set[data-set="${i}"] .peso`);
        const r = qs(`.sets[data-ex="${CSS.escape(ex.nome)}"] .set[data-set="${i}"] .reps`);
        if(p) p.value = s.peso ?? '';
        if(r) r.value = s.reps ?? '';
        const row = qs(`.sets[data-ex="${CSS.escape(ex.nome)}"] .set[data-set="${i}"]`);
        row?.classList.toggle('done', !!s.done);
      });
      const obs = qs(`textarea[data-field="obs"][data-ex="${CSS.escape(ex.nome)}"]`);
      if(obs) obs.value = last.obs ?? '';
    }
  });
  atualizarTonelagemDoDia();
}

(function initTabs(){
  const d = new Date().getDay();
  let key = 'segunda'; if(d===2) key='terca'; if(d===3) key='quarta'; if(d===4) key='quinta'; if(d===5) key='sexta';
  tabs.forEach(b=>b.classList.remove('active'));
  const chosen = [...tabs].find(b=>b.dataset.dia===key) || tabs[0];
  chosen.classList.add('active');
  montarExercicios(chosen.dataset.dia);
})();
salvarBtn.addEventListener('click', ()=> salvarSessaoAtual(null));

// Tonelagem
function ensureTonelagemBox(){
  let box = qs('#tonelagemBox');
  if(!box){
    box = document.createElement('div');
    box.id = 'tonelagemBox';
    box.className = 'card';
    box.innerHTML = `<b>Tonelagem do dia</b><div id="tonelagemLista" class="small muted">—</div>`;
    salvarBtn?.parentElement?.insertBefore(box, salvarBtn.nextSibling);
  }
  return box;
}
function tonelagemExercicioFromUI(nome){
  let total = 0;
  qsa(`.sets[data-ex="${CSS.escape(nome)}"] .set`).forEach(row=>{
    if(row.classList.contains('done')){
      const kg = Number(row.querySelector('.peso')?.value||0);
      const reps = Number(row.querySelector('.reps')?.value||0);
      if(kg>0 && reps>0) total += kg*reps;
    }
  });
  return total;
}
function atualizarTonelagemDoDia(){
  const exs = [...new Set([...qsa('.sets')].map(s=>s.dataset.ex))];
  let html = '';
  let totalDia = 0;
  exs.forEach(n=>{
    const t = tonelagemExercicioFromUI(n);
    if(t>0){ html += `<div>${n}: <b>${t}</b> kg·reps</div>`; totalDia += t; }
  });
  if(!html) html = '—';
  ensureTonelagemBox();
  qs('#tonelagemLista').innerHTML = html + (totalDia? `<div style="margin-top:6px"><b>Total do dia:</b> ${totalDia} kg·reps</div>`:'');
}

function salvarSessaoAtual(duracaoParam){
  let duracaoFinal = 0;
  if(duracaoParam!=null){ duracaoFinal = duracaoParam; }
  else if(startEpoch){ duracaoFinal = Math.floor((Date.now()-startEpoch)/1000); }

  const dataStr = todayStr();
  const diaKey = qs('.tab-btn.active')?.dataset.dia || DIAS_MAP[new Date().getDay()];
  const exercicios = coletarInputsExercicios();

  const nova = {data:dataStr, duracao:duracaoFinal||0, dia:diaKey, exercicios};
  const sess = getSessoes().filter(s => s.data!==dataStr);
  sess.push(nova); sess.sort((a,b)=>a.data.localeCompare(b.data));
  setSessoes(sess);
  marcarHojeNoCalendario();
  qs('#statusSave').textContent = '✅ Sessão salva!';
  setTimeout(()=>qs('#statusSave').textContent='',2000);
  desenharGrafico(); desenharVolume(); preencherSessoesDetalhe(); montarPRs();
  salvarNoFirestore(nova).catch(()=>{});
  stopSession();
}

/*************** Evolução (KPIs + PRs + gráficos) ***************/
let chart, volumeChart;
const selectEx = qs('#selectExercicio');
const filtroDiaWrap = qs('#filtroDia');
const periodoSel = qs('#periodo');
const listaSessoesDetalhe = qs('#listaSessoesDetalhe');

function popularListaExerciciosChart(){
  const nomes = new Set();
  getSessoes().forEach(s => (s.exercicios||[]).forEach(e=>nomes.add(e.nome)));
  Object.values(TREINOS).flat().forEach(e=>nomes.add(e.nome));
  selectEx.innerHTML='';
  [...nomes].sort().forEach(n=>{
    const op=document.createElement('option'); op.value=n; op.textContent=n; selectEx.appendChild(op);
  });
}
selectEx.addEventListener('change', ()=>{ desenharGrafico(); desenharVolume(); preencherSessoesDetalhe(); });
periodoSel.addEventListener('change', ()=>{ desenharGrafico(); desenharVolume(); preencherSessoesDetalhe(); });
filtroDiaWrap.addEventListener('click', (e)=>{
  const b=e.target.closest('.chip'); if(!b) return;
  [...filtroDiaWrap.querySelectorAll('.chip')].forEach(x=>x.classList.remove('active'));
  b.classList.add('active');
  desenharGrafico(); desenharVolume(); preencherSessoesDetalhe();
});
function getFiltroDia(){ return filtroDiaWrap.querySelector('.chip.active')?.dataset.dia || 'all'; }
function filtrarSessoes(){
  const days = Number(periodoSel.value||90);
  const desde = new Date(); desde.setDate(desde.getDate()-days);
  const diaFiltro = getFiltroDia();
  return getSessoes()
    .filter(s => new Date(s.data) >= desde && (diaFiltro==='all' || s.dia===diaFiltro))
    .sort((a,b)=>a.data.localeCompare(b.data));
}
function maxPesoSessaoEx(s, nome){
  const e = (s.exercicios||[]).find(x=>x.nome===nome);
  if(!e) return null;
  const pesos = (e.sets||[]).map(z=>Number(z.peso||0));
  const m = Math.max(0, ...pesos);
  return m>0? m : (e.peso? Number(e.peso) : null);
}
function volumeSessao(s){
  let vol = 0, usouSets=false;
  (s.exercicios||[]).forEach(e=>{
    if(e.sets){
      e.sets.forEach(z=>{
        if(z.done){
          const kg = Number(z.peso||0), reps = Number(z.reps||0);
          if(kg>0 && reps>0){ vol += kg*reps; usouSets=true; }
        }
      });
    }
    if(!usouSets){
      const kg = Number(e.peso||0), reps = Number(e.reps||0);
      if(kg>0 && reps>0) vol += kg*reps;
    }
    usouSets=false;
  });
  return vol;
}
function desenharGrafico(){
  const nome = selectEx.value; if(!nome) return;
  const dados = [];
  filtrarSessoes().forEach(s=>{
    const m = maxPesoSessaoEx(s, nome);
    if(m!=null){ dados.push({data:s.data, peso:m}); }
  });
  dados.sort((a,b)=> a.data.localeCompare(b.data));
  const ctx = qs('#chartCanvas').getContext('2d');
  if(chart) chart.destroy();
  chart = new Chart(ctx, {
    type:'line',
    data:{ labels:dados.map(d=>d.data), datasets:[{ label:`${nome} (kg)`, data:dados.map(d=>d.peso), borderWidth:2, fill:false }]},
    options:{ responsive:true, plugins:{ legend:{display:true} }, scales:{ y:{ beginAtZero:true } } }
  });
}
function isoWeek(date){
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1)/7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2,'0')}`;
}
function desenharVolume(){
  const dados = new Map(); // week -> volume
  filtrarSessoes().forEach(s=>{
    const w = isoWeek(new Date(s.data));
    dados.set(w, (dados.get(w)||0) + volumeSessao(s));
  });
  const labels = [...dados.keys()].sort();
  const values = labels.map(k => dados.get(k));
  const ctx = qs('#volumeCanvas').getContext('2d');
  if(volumeChart) volumeChart.destroy();
  volumeChart = new Chart(ctx, {
    type:'bar',
    data:{ labels, datasets:[{ label:'Volume (kg·reps) por semana', data:values }] },
    options:{ responsive:true, scales:{ y:{ beginAtZero:true } } }
  });
}
function preencherSessoesDetalhe(){
  const arr = filtrarSessoes().slice(-12).reverse();
  listaSessoesDetalhe.innerHTML='';
  arr.forEach(s=>{
    const box = document.createElement('div');
    box.className='card-mini';
    const title = `${s.data} · ${labelDia(s.dia||'')} · ${fmtDuracao(s.duracao||0)} · Vol: ${volumeSessao(s)} kg·reps`;
    const lista = (s.exercicios||[]).map(e=>{
      if(e.sets){
        const setsStr = e.sets.map((z,i)=>`${i+1}:${z.peso||'-'}kg×${z.reps||'-'}${z.done?'✓':''}`).join(' | ');
        return `<li>${e.nome}: ${setsStr}${e.obs?` <span class="muted">(${e.obs})</span>`:''}</li>`;
      }else{
        return `<li>${e.nome}: <b>${e.peso||'-'}</b> kg × <b>${e.reps||'-'}</b>${e.obs?` <span class="muted">(${e.obs})</span>`:''}</li>`;
      }
    }).join('');
    box.innerHTML = `<div><strong>${title}</strong><ul>${lista||'<li class="muted">sem exercícios</li>'}</ul></div>`;
    listaSessoesDetalhe.appendChild(box);
  });
}

/* KPIs + PRs */
function atualizarKPIs(){
  const sess = getSessoes().sort((a,b)=>a.data.localeCompare(b.data));
  // 7 dias
  const d = new Date(); d.setDate(d.getDate()-7);
  const ult7 = sess.filter(s=> new Date(s.data)>=d);
  const vol7 = ult7.reduce((acc,s)=> acc+volumeSessao(s), 0);
  qs('#kpi7dSessoes').textContent = new Set(ult7.map(s=>s.data)).size;
  qs('#kpi7dVolume').textContent = vol7;

  // streak (consecutivos)
  let best=0, cur=0;
  const setDatas = new Set(sess.map(s=>s.data));
  const start = new Date(sess[0]?.data || todayStr());
  const end = new Date(sess[sess.length-1]?.data || todayStr());
  for(let dt=new Date(start); dt<=end; dt.setDate(dt.getDate()+1)){
    const iso = dt.toISOString().slice(0,10);
    if(setDatas.has(iso)){ cur++; best=Math.max(best,cur); } else { cur=0; }
  }
  qs('#kpiStreak').textContent = best;
}
function montarPRs(){
  const sess = getSessoes();
  const map = new Map(); // nome -> max kg
  sess.forEach(s => (s.exercicios||[]).forEach(e=>{
    const pesos = (e.sets||[]).map(z=>Number(z.peso||0));
    const m = Math.max(e.peso?Number(e.peso):0, ...pesos);
    if(m>0) map.set(e.nome, Math.max(map.get(e.nome)||0, m));
  }));
  const wrap = qs('#listaPRs'); wrap.innerHTML='';
  [...map.entries()].sort((a,b)=> a[0].localeCompare(b[0])).forEach(([nome,kg])=>{
    const c = document.createElement('div');
    c.className='card-mini';
    c.innerHTML = `<b>${nome}</b> <span class="muted">· PR:</span> <b>${kg} kg</b>`;
    wrap.appendChild(c);
  });
}
function atualizarEvolucaoUI(){
  popularListaExerciciosChart();
  desenharGrafico();
  desenharVolume();
  preencherSessoesDetalhe();
  montarPRs();
  atualizarKPIs();
}

/*************** PERFIL & HÁBITOS ***************/
const HABITOS = [
  'cafe','lanche_manha','almoco_ok','lanche_tarde','pre_treino','pos_treino',
  'creatina','agua_25','alongar','dormir7h','acordar_hora','passos8k'
];

function getHabitosLocal(){ return JSON.parse(localStorage.getItem('habitos')||'{}'); }
function setHabitosLocal(obj){ localStorage.setItem('habitos', JSON.stringify(obj)); }

async function salvarHabitosFirestore(dataStr, dados){
  if(!firebaseOk || !fb.user) return;
  const { doc, setDoc } = fb._;
  const ref = doc(fb.db, 'users', fb.user.uid, 'habitos', dataStr);
  await setDoc(ref, dados, {merge:true});
}
async function carregarHabitosFirestore(dataStr){
  if(!firebaseOk || !fb.user) return null;
  const { doc, getDoc } = fb._;
  const ref = doc(fb.db, 'users', fb.user.uid, 'habitos', dataStr);
  const snap = await getDoc(ref);
  return snap.exists()? snap.data() : null;
}

async function carregarHabitosHoje(){
  const d = todayStr();
  let dados = null;
  if(firebaseOk && fb.user){
    dados = await carregarHabitosFirestore(d);
  }
  if(!dados){
    const loc = getHabitosLocal();
    dados = loc[d] || null;
  }
  return dados || {};
}
async function salvarHabitosHoje(){
  const d = todayStr();
  const dados = {};
  HABITOS.forEach(k=>{
    const el = qs(`input[data-habit="${k}"]`);
    dados[k] = !!(el && el.checked);
  });
  // local
  const loc = getHabitosLocal(); loc[d]=dados; setHabitosLocal(loc);
  // cloud
  try{ await salvarHabitosFirestore(d, dados); qs('#statusHabitos').textContent='✅ Salvo'; }
  catch(_){ qs('#statusHabitos').textContent='💾 Salvo local (offline)'; }
  setTimeout(()=> qs('#statusHabitos').textContent='', 1500);
  montarResumoHabitos();
}
qs('#btnSalvarHabitos').addEventListener('click', salvarHabitosHoje);

async function atualizarPerfilUI(){
  // foto & nome
  const user = fb.user;
  const photo = qs('#userPhoto');
  const name = qs('#userName');
  if(user){
    name.textContent = user.displayName || user.email || 'Conectado';
    if(user.photoURL){ photo.src = user.photoURL; } else { photo.src=''; }
  }else{
    name.textContent = 'Visitante';
    photo.src = '';
  }
  // carregar hábitos de hoje na UI
  const dados = await carregarHabitosHoje();
  HABITOS.forEach(k=>{
    const el = qs(`input[data-habit="${k}"]`);
    if(el) el.checked = !!dados[k];
  });
  montarResumoHabitos();
}

function montarResumoHabitos(){
  // Resumo semanal: % concluído por hábito (últimos 7 dias)
  const ul = qs('#resumoHabitosSemana'); ul.innerHTML='';
  const loc = getHabitosLocal();
  const dias = Object.keys(loc).sort().slice(-7);
  HABITOS.forEach(k=>{
    const vals = dias.map(d => !!(loc[d] && loc[d][k]));
    const pct = vals.length? Math.round(vals.filter(v=>v).length*100/vals.length) : 0;
    const li = document.createElement('li');
    const rotulo = qs(`label input[data-habit="${k}"]`)?.parentElement?.innerText || k;
    li.innerHTML = `<b>${rotulo}</b>: ${pct}% nos últimos ${dias.length||0} dias`;
    ul.appendChild(li);
  });
  // Histórico 7 dias: "✅ x/N hábitos"
  const hist = qs('#historicoHabitos'); hist.innerHTML='';
  dias.reverse().forEach(d=>{
    const obj = loc[d] || {};
    const total = HABITOS.length;
    const ok = HABITOS.reduce((acc,k)=> acc + (obj[k]?1:0), 0);
    const badge = Math.round(ok*100/total);
    const box = document.createElement('div');
    box.className='card-mini';
    box.innerHTML = `<b>${d}</b> · ${ok}/${total} hábitos · <span class="muted">${badge}%</span>`;
    hist.appendChild(box);
  });
}
