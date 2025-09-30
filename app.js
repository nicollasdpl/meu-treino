// =========================
//  Firebase-only App
// =========================

/* ---- CONFIG ---- */
const FIREBASE_CFG = {
  apiKey: "AIzaSyAEewjrcLxpXSZMoOPo4nkuTg3lTZI-J78",
  authDomain: "meu-treino-e4592.firebaseapp.com",
  projectId: "meu-treino-e4592",
  storageBucket: "meu-treino-e4592.firebasestorage.app",
  messagingSenderId: "245894818340",
  appId: "1:245894818340:web:dd6ba010356c05b9d846b1",
  measurementId: "G-QW4TNPPE3X"
};

/* ---- Imports Firebase ---- */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, onAuthStateChanged,
  signInWithPopup, signOut
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import {
  getFirestore, collection, getDocs, doc, setDoc, deleteDoc, getDoc
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

/* ---- Helpers ---- */
const qs  = (s, r=document) => r.querySelector(s);
const qsa = (s, r=document) => [...r.querySelectorAll(s)];

/* ---- Firebase init ---- */
const fb = {
  app: initializeApp(FIREBASE_CFG),
  auth: null,
  provider: null,
  db: null,
  user: null,
};
fb.auth     = getAuth(fb.app);
fb.provider = new GoogleAuthProvider();
fb.db       = getFirestore(fb.app);

const loginScreen = qs('#loginScreen');
const appHeader   = qs('#appHeader');
const appMain     = qs('#appMain');
const appNav      = qs('#appNav');
const headerToday = qs('#headerToday');

qs('#btnLoginGoogle')?.addEventListener('click', async ()=>{
  try{
    await signInWithPopup(fb.auth, fb.provider);
  }catch(e){
    qs('#loginError').textContent = 'Falha no login. Tente novamente.';
  }
});
qs('#btnLogout')?.addEventListener('click', async ()=>{ try{ await signOut(fb.auth); }catch(_){} });

/* ---- Estado em memória ---- */
let SESSOES_CACHE = []; // [{data:'YYYY-MM-DD', duracao, dia, exercicios:[{nome,peso,reps,obs}]}]
let HABITOS_CACHE = {}; // { 'YYYY-MM-DD': {chave:true/false, ...} }

/* ---- Auth gate ---- */
onAuthStateChanged(fb.auth, async (user)=>{
  fb.user = user || null;
  if(!user){
    // mostrar login
    loginScreen?.classList.remove('hidden');
    appHeader?.classList.add('hidden');
    appMain?.classList.add('hidden');
    appNav?.classList.add('hidden');
    return;
  }
  // pós-login
  loginScreen?.classList.add('hidden');
  appHeader?.classList.remove('hidden');
  appMain?.classList.remove('hidden');
  appNav?.classList.remove('hidden');

  // header "Hoje"
  if(headerToday) headerToday.textContent = textoTreinoHoje();

  // Perfil (foto/nome/email)
  qs('#fotoPerfil').src = user.photoURL || 'icons/apple-touch-icon.png';
  qs('#nomePerfil').textContent = user.displayName || (user.email?.split('@')[0] ?? '—');
  qs('#emailPerfil').textContent = user.email || '—';

  // Estado Firebase
  qs('#firebaseStatus').textContent = 'Firebase conectado';
  qs('#syncInfo').textContent      = 'Sincronização: —';

  await Promise.all([syncFromFirestore(), carregarHabitosHoje()]);
  safeInitUI();
});

/* ================== Firestore ================== */
async function syncFromFirestore(){
  if(!fb.user) return;
  const ref = collection(fb.db, 'users', fb.user.uid, 'sessoes');
  const snap = await getDocs(ref);
  const arr = [];
  snap.forEach(d => arr.push(d.data()));
  arr.sort((a,b)=> a.data.localeCompare(b.data));
  SESSOES_CACHE = arr;
  qs('#syncInfo').textContent = 'Sincronização: OK';
}
function getSessoes(){ return SESSOES_CACHE; }

async function salvarNoFirestore(sessao){
  if(!fb.user) return;
  const ref = doc(fb.db, 'users', fb.user.uid, 'sessoes', sessao.data);
  await setDoc(ref, sessao, { merge:true });
  const sem = SESSOES_CACHE.filter(s => s.data !== sessao.data);
  sem.push(sessao);
  sem.sort((a,b)=> a.data.localeCompare(b.data));
  SESSOES_CACHE = sem;
  qs('#syncInfo').textContent = 'Sincronização: OK';
}
async function adicionarSessaoVazia(dataStr){
  if(!fb.user) return;
  const ref = doc(fb.db, 'users', fb.user.uid, 'sessoes', dataStr);
  const got = await getDoc(ref);
  if(!got.exists()){
    const nova = {data:dataStr, duracao:0, dia:null, exercicios:[]};
    await setDoc(ref, nova);
    SESSOES_CACHE.push(nova);
    SESSOES_CACHE.sort((a,b)=> a.data.localeCompare(b.data));
  }
}
async function removerSessaoPorData(dataStr){
  if(!fb.user) return;
  await deleteDoc(doc(fb.db, 'users', fb.user.uid, 'sessoes', dataStr));
  SESSOES_CACHE = SESSOES_CACHE.filter(s=>s.data!==dataStr);
}

/* ---- Hábitos (coleção users/{uid}/habitos) ---- */
const HABITOS_LIST = [
  {key:'acordar', label:'Acordar no horário'},
  {key:'cafe',    label:'Café da manhã'},
  {key:'creatina',label:'Creatina'},
  {key:'almoco',  label:'Almoço'},
  {key:'pre',     label:'Pré-treino'},
  {key:'agua',    label:'Beber 2,5L'},
  {key:'sono',    label:'Dormir > 7h'},
];
function dataISOHoje(){ return new Date().toISOString().slice(0,10); }

async function carregarHabitosHoje(){
  if(!fb.user) return;
  const data = dataISOHoje();
  const ref = doc(fb.db, 'users', fb.user.uid, 'habitos', data);
  const got = await getDoc(ref);
  HABITOS_CACHE[data] = got.exists() ? (got.data()||{}) : {};
  montarHabitosUI();
}
function montarHabitosUI(){
  const wrap = qs('#habitos'); if(!wrap) return;
  wrap.innerHTML = '';
  const data = dataISOHoje();
  HABITOS_LIST.forEach(item=>{
    const id = `hab_${item.key}`;
    const checked = !!HABITOS_CACHE[data]?.[item.key];
    const div = document.createElement('label');
    div.className='item';
    div.innerHTML = `
      <input id="${id}" type="checkbox" ${checked?'checked':''}>
      <span>${item.label}</span>
    `;
    wrap.appendChild(div);
    qs('#'+id).addEventListener('change', async (e)=>{
      const val = e.target.checked;
      HABITOS_CACHE[data] = HABITOS_CACHE[data] || {};
      HABITOS_CACHE[data][item.key] = val;
      await setDoc(doc(fb.db,'users',fb.user.uid,'habitos',data), HABITOS_CACHE[data], {merge:true});
    });
  });
}

/* ================== App UI / Lógica ================== */

/* Treinos */
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
    {nome:'Leg press', alvo:'3x10–15'},
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

/* Calendário */
let viewAno, viewMes;
const mesLabel = qs('#mesAno');
const calEl    = qs('#calendario');
qs('#prevMes')?.addEventListener('click', ()=>{ viewMes--; if(viewMes<0){viewMes=11; viewAno--; } montarCalendario(); });
qs('#proxMes')?.addEventListener('click', ()=>{ viewMes++; if(viewMes>11){viewMes=0; viewAno++; } montarCalendario(); });

function initCalendar(){
  const hoje = new Date();
  viewAno = hoje.getFullYear();
  viewMes = hoje.getMonth();
  montarCalendario();
}
function montarCalendario(){
  if(!mesLabel || !calEl) return;
  mesLabel.textContent = new Date(viewAno, viewMes).toLocaleString('pt-BR',{month:'long',year:'numeric'});
  calEl.innerHTML='';
  const first = new Date(viewAno, viewMes, 1);
  const lastDay = new Date(viewAno, viewMes+1, 0).getDate();
  const offset = first.getDay();
  for(let i=0;i<offset;i++){
    const d = document.createElement('div'); d.className='dia fora'; calEl.appendChild(d);
  }
  const hoje = new Date();
  // só marca como 'treino' se teve duração > 0 OU algum exercício preenchido
  const setDatasTreino = new Set(
    getSessoes()
      .filter(s => (s.duracao>0) || ((s.exercicios||[]).some(e=> e.peso || e.reps || e.obs)))
      .map(s=>s.data)
  );
  for(let dia=1; dia<=lastDay; dia++){
    const d = document.createElement('div');
    d.className='dia'; d.dataset.dia = String(dia).padStart(2,'0');
    d.textContent = dia;
    const dataStr = `${viewAno}-${String(viewMes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
    if(setDatasTreino.has(dataStr)) d.classList.add('treino'); else d.classList.add('nao-treino');
    if(dia===hoje.getDate() && viewMes===hoje.getMonth() && viewAno===hoje.getFullYear()) d.classList.add('hoje');

    d.addEventListener('click', async ()=>{
      // toggle manual
      if(d.classList.contains('treino')){
        d.classList.remove('treino'); d.classList.add('nao-treino');
        await removerSessaoPorData(dataStr);
      }else{
        d.classList.remove('nao-treino'); d.classList.add('treino');
        await adicionarSessaoVazia(dataStr);
      }
      atualizarResumoHome();
    });
    calEl.appendChild(d);
  }
  atualizarResumoHome();
}

/* Resumo Home */
function fmtDuracao(sec){
  const h=String(Math.floor(sec/3600)).padStart(2,'0');
  const m=String(Math.floor((sec%3600)/60)).padStart(2,'0');
  const s=String(sec%60).padStart(2,'0');
  return `${h}:${m}:${s}`;
}
function atualizarResumoHome(){
  const diasTreinadosMes = qs('#diasTreinadosMes');
  const ultimoTreino     = qs('#ultimoTreino');
  const duracaoMedia     = qs('#duracaoMedia');
  if(!diasTreinadosMes || !ultimoTreino || !duracaoMedia) return;

  const sess = getSessoes().filter(s => {
    const dt = new Date(s.data);
    return dt.getFullYear()===viewAno && dt.getMonth()===viewMes;
  });
  // conta só dias com treino "real"
  const diasTreinados = new Set(
    sess.filter(s => (s.duracao>0) || ((s.exercicios||[]).some(e=> e.peso || e.reps || e.obs)))
        .map(s=>s.data)
  );
  diasTreinadosMes.textContent = diasTreinados.size;

  const ult = getSessoes().slice(-1)[0];
  ultimoTreino.textContent = ult ? `${ult.data} (${fmtDuracao(ult.duracao||0)})` : '—';

  const dur = getSessoes().map(s=>s.duracao||0);
  const media = dur.length? Math.round(dur.reduce((a,b)=>a+b,0)/dur.length):0;
  duracaoMedia.textContent = dur.length? fmtDuracao(media) : '—';
}

/* Timer principal */
let timerId=null, startEpoch=null;
const timerEl = qs('#timer');
qs('#btnTimer')?.addEventListener('click', async ()=>{
  if(timerId){
    clearInterval(timerId); timerId=null;
    const duracao = Math.floor((Date.now()-startEpoch)/1000);
    qs('#btnTimer').textContent='Iniciar';
    await salvarSessaoAtual(duracao);
  }else{
    startEpoch = Date.now();
    timerId = setInterval(()=>{ if(timerEl) timerEl.textContent = fmtDuracao(Math.floor((Date.now()-startEpoch)/1000)); }, 1000);
    qs('#btnTimer').textContent='Finalizar';
  }
});

/* Descanso */
let audioCtx=null;
function ensureAudioCtx(){
  if(!audioCtx){
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = AC ? new AC() : null;
  }
  if(audioCtx?.state==='suspended'){ audioCtx.resume?.(); }
}
async function ensureNotifyPermission(){
  if(!("Notification" in window)) return false;
  if(Notification.permission==="granted") return true;
  if(Notification.permission!=="denied"){
    const p = await Notification.requestPermission();
    return p==="granted";
  }
  return false;
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
let notifReady=false;
qs('#btnNotify')?.addEventListener('click', async ()=>{
  ensureAudioCtx();
  notifReady = await ensureNotifyPermission();
  qs('#btnNotify').textContent = notifReady ? '🔔' : '🔕';
});
let restId=null, restLeft=0, beepLoop=null;
const restSeg     = qs('#restSeg');
const restDisplay = qs('#restDisplay');
const overlay     = qs('#restOverlay');
qs('#btnOverlayOk')?.addEventListener('click', ()=>{ overlay?.classList.add('hidden'); clearInterval(beepLoop); beepLoop=null; });
qs('#btnOverlayBuzz')?.addEventListener('click', ()=>{ try{ navigator.vibrate && navigator.vibrate([200,100,300]); }catch(_){} ensureAudioCtx(); beep(2,1250,200); });
qs('#btnRest')?.addEventListener('click', async ()=>{
  if(restId){
    clearInterval(restId); restId=null; if(restDisplay) restDisplay.textContent='—';
    clearInterval(beepLoop); beepLoop=null; overlay?.classList.add('hidden');
    return;
  }
  ensureAudioCtx();
  notifReady = await ensureNotifyPermission();
  restLeft = Math.max(10, Number(restSeg?.value || 60));
  if(restDisplay) restDisplay.textContent = `${restLeft}s`;
  restId = setInterval(()=>{
    restLeft--; if(restDisplay) restDisplay.textContent = `${restLeft}s`;
    if(restLeft<=0){
      clearInterval(restId); restId=null;
      if(restDisplay) restDisplay.textContent='⏰ Descanso finalizado!';
      try{ navigator.vibrate && navigator.vibrate([250,120,250,120,400]); }catch(_){}
      beep(3, 1100, 220);
      overlay?.classList.remove('hidden');
      if(notifReady){ try{ new Notification('Descanso finalizado!', { body:'Bora pra próxima série.' }); }catch(_){} }
      beepLoop = setInterval(()=>{ ensureAudioCtx(); beep(1,1200,180); }, 1200);
      const base=document.title; let f=0; const blink=setInterval(()=>{ document.title=(++f%2)?'⏰ Descanso!':base; if(f>10){clearInterval(blink); document.title=base;} },500);
    }
  },1000);
});

/* UI Treino */
const listaExEl   = qs('#listaExercicios');
const treinoDoDia = qs('#treinoDoDia');
const salvarBtn   = qs('#salvarTreino');
const copyBtn     = qs('#btnCopyLast');
const tabs        = qsa('.tab-btn');

tabs.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    tabs.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    montarExercicios(btn.dataset.dia, true);
  });
});
copyBtn?.addEventListener('click', ()=>{ const key = qs('.tab-btn.active')?.dataset.dia || 'segunda'; preencherComUltima(key); });

function labelDia(key){
  return {segunda:'Segunda (Costas+Bíceps)', terca:'Terça (Peito+Tríceps)', quarta:'Quarta (Ombro)', quinta:'Quinta (Perna)', sexta:'Sexta (Braços+Abs)'}[key] || key;
}
function ultimaCarga(nomeEx, historico){
  for(let i=historico.length-1;i>=0;i--){
    const e = historico[i].exercicios?.find(x=>x.nome===nomeEx);
    if(e) return e;
  }
  return null;
}
function coletarInputsExercicios(){
  const inputs = qsa('[data-ex]');
  const map = {};
  inputs.forEach(el=>{
    const nome = el.dataset.ex;
    const field= el.dataset.field;
    map[nome] = map[nome] || {nome};
    map[nome][field] = el.value;
  });
  return Object.values(map);
}
function montarExercicios(diaKey, prefill=true){
  if(!listaExEl || !treinoDoDia) return;
  const arr = TREINOS[diaKey] || [];
  treinoDoDia.textContent = `Dia selecionado: ${labelDia(diaKey)} · Registre as cargas e reps (meta: 8–12 reps).`;
  listaExEl.innerHTML = '';
  const historico = getSessoes();
  arr.forEach(ex=>{
    const last = prefill ? ultimaCarga(ex.nome, historico) : null;
    const card = document.createElement('div');
    card.className='ex-card';
    card.innerHTML = `
      <div><b>${ex.nome}</b><br><small>${ex.alvo}</small></div>
      <div><input type="number" step="0.5" placeholder="kg"   data-field="peso" data-ex="${ex.nome}" value="${last?.peso??''}"/></div>
      <div><input type="number"          placeholder="reps"    data-field="reps" data-ex="${ex.nome}" value="${last?.reps??''}"/></div>
      <div><textarea rows="1" placeholder="obs" data-field="obs" data-ex="${ex.nome}">${last?.obs??''}</textarea></div>
    `;
    listaExEl.appendChild(card);
  });
}
function preencherComUltima(diaKey){
  const arr = TREINOS[diaKey] || [];
  const hist = getSessoes();
  arr.forEach(ex=>{
    const last = ultimaCarga(ex.nome, hist);
    if(last){
      const peso = qs(`[data-ex="${CSS.escape(ex.nome)}"][data-field="peso"]`);
      const reps = qs(`[data-ex="${CSS.escape(ex.nome)}"][data-field="reps"]`);
      const obs  = qs(`[data-ex="${CSS.escape(ex.nome)}"][data-field="obs"]`);
      if(peso) peso.value = last.peso ?? '';
      if(reps) reps.value = last.reps ?? '';
      if(obs)  obs.value  = last.obs  ?? '';
    }
  });
}

/* Salvar sessão */
async function salvarSessaoAtual(duracao){
  const hoje = new Date();
  const dataStr = hoje.toISOString().slice(0,10);
  const diaKey  = qs('.tab-btn.active')?.dataset.dia || DIAS_MAP[hoje.getDay()];
  const exercicios = coletarInputsExercicios();
  const nova = {data:dataStr, duracao:duracao||0, dia:diaKey, exercicios};
  await salvarNoFirestore(nova);
  marcarHojeNoCalendario();
  const st = qs('#statusSave'); if(st){ st.textContent = '✅ Sessão salva!'; setTimeout(()=> st.textContent='', 1800); }
  desenharGrafico(); desenharVolume(); preencherSessoesDetalhe();
}
salvarBtn?.addEventListener('click', ()=> salvarSessaoAtual(null));

function marcarHojeNoCalendario(){
  const hoje = new Date();
  if(hoje.getFullYear()===viewAno && hoje.getMonth()===viewMes){
    const diaSel = String(hoje.getDate()).padStart(2,'0');
    const el = [...document.querySelectorAll('.dia')].find(d=>d.dataset.dia===diaSel);
    if(el){ el.classList.remove('nao-treino'); el.classList.add('treino'); }
  }
  atualizarResumoHome();
}

/* Evolução */
let chart, volumeChart;
const selectEx            = qs('#selectExercicio');
const periodoSel          = qs('#periodo');
const listaSessoesDetalhe = qs('#listaSessoesDetalhe');

function popularListaExerciciosChart(){
  if(!selectEx) return;
  const nomes = new Set();
  getSessoes().forEach(s => (s.exercicios||[]).forEach(e=>nomes.add(e.nome)));
  Object.values(TREINOS).flat().forEach(e=>nomes.add(e.nome));
  selectEx.innerHTML='';
  [...nomes].sort().forEach(n=>{
    const op=document.createElement('option'); op.value=n; op.textContent=n; selectEx.appendChild(op);
  });
}
selectEx?.addEventListener('change', ()=>{ desenharGrafico(); desenharVolume(); preencherSessoesDetalhe(); });
periodoSel?.addEventListener('change', ()=>{ desenharGrafico(); desenharVolume(); preencherSessoesDetalhe(); });

function filtrarSessoes(){
  const days = Number(periodoSel?.value||90);
  const desde = new Date(); desde.setDate(desde.getDate()-days);
  return getSessoes()
    .filter(s => new Date(s.data) >= desde)
    .sort((a,b)=>a.data.localeCompare(b.data));
}
function desenharGrafico(){
  if(!window.Chart || !selectEx) return;
  const nome = selectEx.value; if(!nome) return;
  const dados = [];
  filtrarSessoes().forEach(s=>{
    const e = (s.exercicios||[]).find(x=>x.nome===nome);
    if(e && e.peso) dados.push({data:s.data, peso:Number(e.peso)});
  });
  dados.sort((a,b)=> a.data.localeCompare(b.data));
  const ctx = qs('#chartCanvas')?.getContext('2d'); if(!ctx) return;
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
  d.setUTCDate(d.getUTCDate()+4-dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const week = Math.ceil((((d - yearStart)/86400000)+1)/7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2,'0')}`;
}
function volumeSessao(s){
  let vol = 0;
  (s.exercicios||[]).forEach(e=>{
    const kg = Number(e.peso||0), reps = Number(e.reps||0);
    if(kg>0 && reps>0) vol += kg*reps;
  });
  return vol;
}
function desenharVolume(){
  if(!window.Chart) return;
  const dados = new Map();
  filtrarSessoes().forEach(s=>{
    const w = isoWeek(new Date(s.data));
    dados.set(w, (dados.get(w)||0)+volumeSessao(s));
  });
  const labels=[...dados.keys()].sort();
  const values=labels.map(k=>dados.get(k));
  const ctx = qs('#volumeCanvas')?.getContext('2d'); if(!ctx) return;
  if(volumeChart) volumeChart.destroy();
  volumeChart = new Chart(ctx, {
    type:'bar',
    data:{ labels, datasets:[{ label:'Volume (kg·reps) por semana', data:values }] },
    options:{ responsive:true, scales:{ y:{ beginAtZero:true } } }
  });
}
function preencherSessoesDetalhe(){
  if(!listaSessoesDetalhe) return;
  const arr = filtrarSessoes().slice(-12).reverse();
  listaSessoesDetalhe.innerHTML='';
  arr.forEach(s=>{
    const box = document.createElement('div');
    box.className='card-mini';
    const title = `${s.data} · ${labelDia(s.dia||'')} · ${fmtDuracao(s.duracao||0)} · Vol: ${volumeSessao(s)} kg·reps`;
    const lista = (s.exercicios||[]).map(e=>{
      const kg=e.peso||'-', r=e.reps||'-';
      return `<li>${e.nome}: <b>${kg}</b> kg × <b>${r}</b>${e.obs?` <span class="muted">(${e.obs})</span>`:''}</li>`;
    }).join('');
    box.innerHTML = `<div><strong>${title}</strong><ul>${lista||'<li class="muted">sem exercícios</li>'}</ul></div>`;
    listaSessoesDetalhe.appendChild(box);
  });
}

/* Navegação */
function mostrarPagina(id){
  qsa('.pagina').forEach(p=>p.classList.add('hidden'));
  qs('#'+id)?.classList.remove('hidden');
  if(id==='graficos'){ popularListaExerciciosChart(); desenharGrafico(); desenharVolume(); preencherSessoesDetalhe(); }
  if(id==='home'){ atualizarResumoHome(); }
}
qsa('nav [data-go]').forEach(btn=>{
  btn.addEventListener('click', ()=> mostrarPagina(btn.dataset.go));
});

/* Tema */
(function themeInit(){
  const saved = localStorage.getItem('theme') || 'dark';
  if(saved==='dark') document.documentElement.classList.add('dark');
  qs('#btnTheme').textContent = document.documentElement.classList.contains('dark')?'☀️':'🌙';
})();
qs('#btnTheme')?.addEventListener('click', ()=>{
  document.documentElement.classList.toggle('dark');
  const dark = document.documentElement.classList.contains('dark');
  localStorage.setItem('theme', dark?'dark':'light');
  qs('#btnTheme').textContent = dark?'☀️':'🌙';
});

/* Boot UI */
function safeInitUI(){
  initCalendar();
  // selecionar dia padrão
  const d = new Date().getDay();
  let key='segunda'; if(d===2) key='terca'; if(d===3) key='quarta'; if(d===4) key='quinta'; if(d===5) key='sexta';
  const tabs = qsa('.tab-btn');
  tabs.forEach(b=>b.classList.remove('active'));
  const chosen = [...tabs].find(b=>b.dataset.dia===key) || tabs[0];
  if(chosen){ chosen.classList.add('active'); montarExercicios(chosen.dataset.dia); }

  // home primeiro
  mostrarPagina('home');
  // gráficos
  popularListaExerciciosChart(); desenharGrafico(); desenharVolume(); preencherSessoesDetalhe();
}
