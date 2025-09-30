<script type="module">
// =========================
//  Firebase-only App Shell
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
  getFirestore, collection, getDocs, doc, setDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

/* ---- Helpers DOM ---- */
const qs  = (s, r=document) => r.querySelector(s);
const qsa = (s, r=document) => [...r.querySelectorAll(s)];

/* ---- Estado global ---- */
const fb = {
  app: initializeApp(FIREBASE_CFG),
  auth: null,
  provider: null,
  db: null,
  user: null,
};
fb.auth    = getAuth(fb.app);
fb.provider= new GoogleAuthProvider();
fb.db      = getFirestore(fb.app);

/* Cache em memória das sessões (nada de localStorage) */
let SESSOES_CACHE = []; // [{data:'YYYY-MM-DD', duracao, dia, exercicios:[{nome,peso,reps,obs}]}]

/* ============ LOGIN GATE ============ */
/* Se não existir a camada de login, eu crio dinamicamente */
let gate = qs('#loginGate');
if(!gate){
  gate = document.createElement('div');
  gate.id = 'loginGate';
  gate.style.cssText = `
    position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
    background:rgba(0,0,0,.6);z-index:9999;
  `;
  gate.innerHTML = `
    <div style="background:#1f1f25;color:#fff;border:1px solid #2a2e35;
                width:min(90vw,420px);border-radius:18px;padding:24px;text-align:center">
      <h2 style="margin:0 0 10px">Meu Treino</h2>
      <p style="margin:0 0 18px;opacity:.9">Entre com sua conta Google para continuar.</p>
      <button id="btnGoogleLogin" style="
        padding:12px 16px;border-radius:12px;border:0;background:#8b5cf6;color:#fff;
        font-size:16px;cursor:pointer;width:100%">Entrar com Google</button>
    </div>`;
  document.body.appendChild(gate);
}
const appRoot = qs('#app') || document.body; // área do app (se tiver wrapper #app, usamos)

qs('#btnGoogleLogin', gate)?.addEventListener('click', async ()=>{
  try{ await signInWithPopup(fb.auth, fb.provider); }catch(e){ alert('Falha no login'); }
});

/* onAuthStateChanged controla o fluxo: sem login => mostra gate; com login => carrega dados */
onAuthStateChanged(fb.auth, async (user)=>{
  fb.user = user || null;
  if(!user){
    gate.style.display = 'flex';
    // Se quiser esconder todo conteúdo até logar:
    if(appRoot && appRoot !== document.body) appRoot.style.filter = 'blur(6px)';
    return;
  }
  // logado
  gate.style.display = 'none';
  if(appRoot && appRoot !== document.body) appRoot.style.filter = '';
  await syncFromFirestore();      // baixa as sessões
  safeInitUI();                   // monta UI + timers + abas
});

/* ============ PERSISTÊNCIA (Firestore) ============ */

// baixa tudo do usuário e guarda em cache
async function syncFromFirestore(){
  if(!fb.user) return;
  const ref = collection(fb.db, 'users', fb.user.uid, 'sessoes');
  const snap = await getDocs(ref);
  const arr = [];
  snap.forEach(d => arr.push(d.data()));
  arr.sort((a,b)=> a.data.localeCompare(b.data));
  SESSOES_CACHE = arr;
}

// retorno sempre o cache (sem disco)
function getSessoes(){ return SESSOES_CACHE; }

// salva/atualiza UMA sessão (doc id = data)
async function salvarNoFirestore(sessao){
  if(!fb.user) return;
  const ref = doc(fb.db, 'users', fb.user.uid, 'sessoes', sessao.data);
  await setDoc(ref, sessao, { merge:true });
  // atualiza o cache em memória
  const sem = SESSOES_CACHE.filter(s => s.data !== sessao.data);
  sem.push(sessao);
  sem.sort((a,b)=> a.data.localeCompare(b.data));
  SESSOES_CACHE = sem;
}

// cria sessão vazia pela data (para marcar calendário)
async function adicionarSessaoVazia(dataStr){
  const sess = getSessoes();
  if(!sess.find(s=>s.data===dataStr)){
    const nova = {data:dataStr, duracao:0, dia:null, exercicios:[]};
    await salvarNoFirestore(nova);
  }
}

// remove doc da data
async function removerSessaoPorData(dataStr){
  if(!fb.user) return;
  await deleteDoc(doc(fb.db, 'users', fb.user.uid, 'sessoes', dataStr));
  SESSOES_CACHE = SESSOES_CACHE.filter(s=>s.data!==dataStr);
}

/* ============ SUA LÓGICA DO APP (ajustada p/ Firestore) ============ */

/* --- Treinos --- */
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
    {nome:'Leg press', alvo:'3x10–15'}, // <-- incluí o leg press que você pediu
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
const subheader = qs('#subheader'); if(subheader) subheader.textContent = textoTreinoHoje();

/* --- Calendário --- */
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
  const setDatas = new Set(getSessoes().map(s=>s.data));
  for(let dia=1; dia<=lastDay; dia++){
    const d = document.createElement('div');
    d.className='dia'; d.dataset.dia = String(dia).padStart(2,'0');
    d.textContent = dia;
    const dataStr = `${viewAno}-${String(viewMes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
    if(setDatas.has(dataStr)) d.classList.add('treino'); else d.classList.add('nao-treino');
    if(dia===hoje.getDate() && viewMes===hoje.getMonth() && viewAno===hoje.getFullYear()) d.classList.add('hoje');
    d.addEventListener('click', async ()=>{
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

/* --- Resumo --- */
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
  diasTreinadosMes.textContent = new Set(sess.map(s=>s.data)).size;
  const ult = getSessoes().slice(-1)[0];
  ultimoTreino.textContent = ult ? `${ult.data} (${fmtDuracao(ult.duracao||0)})` : '—';
  const dur = getSessoes().map(s=>s.duracao||0);
  const media = dur.length? Math.round(dur.reduce((a,b)=>a+b,0)/dur.length):0;
  duracaoMedia.textContent = dur.length? fmtDuracao(media) : '—';
}

/* --- Timer de treino (cronômetro principal) --- */
let timerId=null, startEpoch=null;
const timerEl = qs('#timer');
qs('#btnTimer')?.addEventListener('click', async ()=>{
  if(timerId){
    clearInterval(timerId); timerId=null;
    const duracao = Math.floor((Date.now()-startEpoch)/1000);
    qs('#btnTimer').textContent='Iniciar';
    await salvarSessaoAtual(duracao);   // grava no Firestore
  }else{
    startEpoch = Date.now();
    timerId = setInterval(()=>{ if(timerEl) timerEl.textContent = fmtDuracao(Math.floor((Date.now()-startEpoch)/1000)); }, 1000);
    qs('#btnTimer').textContent='Finalizar';
  }
});

/* --- Descanso (vibração/áudio/overlay) --- */
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

/* --- UI do treino (inputs) --- */
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
      <div><input type="number"          placeholder="reps"  data-field="reps" data-ex="${ex.nome}" value="${last?.reps??''}"/></div>
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

/* Salvar sessão (Firestore-only) */
async function salvarSessaoAtual(duracao){
  const hoje = new Date();
  const dataStr = hoje.toISOString().slice(0,10);
  const diaKey  = qs('.tab-btn.active')?.dataset.dia || DIAS_MAP[hoje.getDay()];
  const exercicios = coletarInputsExercicios();
  const nova = {data:dataStr, duracao:duracao||0, dia:diaKey, exercicios};
  await salvarNoFirestore(nova);
  marcarHojeNoCalendario();
  qs('#statusSave')?.replaceChildren(document.createTextNode('✅ Sessão salva!'));
  setTimeout(()=>{ const el=qs('#statusSave'); if(el) el.textContent=''; }, 1800);
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

/* --- Evolução (gráficos) --- */
let chart, volumeChart;
const selectEx           = qs('#selectExercicio');
const filtroDiaWrap      = qs('#filtroDia');
const periodoSel         = qs('#periodo');
const listaSessoesDetalhe= qs('#listaSessoesDetalhe');

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
filtroDiaWrap?.addEventListener('click', (e)=>{
  const b=e.target.closest('.chip'); if(!b) return;
  [...filtroDiaWrap.querySelectorAll('.chip')].forEach(x=>x.classList.remove('active'));
  b.classList.add('active');
  desenharGrafico(); desenharVolume(); preencherSessoesDetalhe();
});
function getFiltroDia(){ return filtroDiaWrap?.querySelector('.chip.active')?.dataset.dia || 'all'; }
function filtrarSessoes(){
  const days = Number(periodoSel?.value||90);
  const desde = new Date(); desde.setDate(desde.getDate()-days);
  const diaFiltro = getFiltroDia();
  return getSessoes()
    .filter(s => new Date(s.data) >= desde && (diaFiltro==='all' || s.dia===diaFiltro))
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

/* --- Navegação (se tiver abas .pagina) --- */
window.mostrarPagina = function(id){
  qsa('.pagina').forEach(p=>p.style.display='none');
  qs('#'+id)?.style?.setProperty('display','block');
  if(id==='graficos'){ popularListaExerciciosChart(); desenharGrafico(); desenharVolume(); preencherSessoesDetalhe(); }
  if(id==='home'){ atualizarResumoHome(); }
};

/* --- Boot da UI (somente após login e sync) --- */
function safeInitUI(){
  initCalendar();
  // seleciona a aba do dia
  const d = new Date().getDay();
  let key='segunda'; if(d===2) key='terca'; if(d===3) key='quarta'; if(d===4) key='quinta'; if(d===5) key='sexta';
  tabs.forEach(b=>b.classList.remove('active'));
  const chosen = [...tabs].find(b=>b.dataset.dia===key) || tabs[0];
  if(chosen){ chosen.classList.add('active'); montarExercicios(chosen.dataset.dia); }
  // gráficos
  popularListaExerciciosChart(); desenharGrafico(); desenharVolume(); preencherSessoesDetalhe();
}
</script>
