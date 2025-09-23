/* ===== Firebase SDK v12 ===== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, getDocs, deleteDoc,
  collection, orderBy, query
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

/* ==== SUA CONFIG DO FIREBASE ==== */
const firebaseConfig = {
  apiKey: "AIzaSyAEewjrcLxpXSZMoOPo4nkuTg3lTZI-J78",
  authDomain: "meu-treino-e4592.firebaseapp.com",
  projectId: "meu-treino-e4592",
  storageBucket: "meu-treino-e4592.firebasestorage.app",
  messagingSenderId: "245894818340",
  appId: "1:245894818340:web:dd6ba010356c05b9d846b1",
  measurementId: "G-QW4TNPPE3X"
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

/* ===== helpers ===== */
const $ = (id)=>document.getElementById(id);
const setUserStatus = (t)=>{ const el=$("userStatus"); if(el) el.textContent=t; };
const setSyncInfo   = (t)=>{ const el=$("syncInfo");  if(el) el.textContent=t; };
const deepClone     = (o)=>JSON.parse(JSON.stringify(o));

/* ===== tema claro/escuro ===== */
function applyTheme(theme){
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  $("btnTheme").textContent = theme === 'dark' ? '🌞' : '🌙';
}
function initTheme(){
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));
}
$("btnTheme").addEventListener('click', ()=>{
  const now = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(now === 'light' ? 'dark' : 'light');
});

/* ===== navegação ===== */
window.mostrarPagina = function(id){
  document.querySelectorAll('.pagina').forEach(p=>p.style.display='none');
  document.getElementById(id).style.display='block';
  if(id==='graficos'){ popularListaExerciciosChart(); desenharGrafico(); }
  if(id==='home'){ atualizarResumoHome(); }
};
document.addEventListener('DOMContentLoaded', ()=>{
  initTheme();
  $("subheader").textContent = textoTreinoHoje();
  mostrarPagina('home');
  bindAuthButtons();
  bindEditorButtons();
  bindRestTimerUI();
  bindBackupButtons();
});

/* ===== auth ===== */
function bindAuthButtons(){
  $("btnLogin")?.addEventListener('click', async ()=>{
    try{ await signInWithPopup(auth, provider); }
    catch(e){
      if(e.code === 'auth/operation-not-supported-in-this-environment'){
        await signInWithRedirect(auth, provider);
      } else { alert('Erro no login: '+e.message); }
    }
  });
  $("btnLogout")?.addEventListener('click', ()=>signOut(auth));
}

onAuthStateChanged(auth, async (user)=>{
  if(user){
    $("btnLogin").style.display='none';
    $("btnLogout").style.display='inline-block';
    $("userName").textContent = user.displayName || user.email || 'Usuário';
    if(user.photoURL){ $("userPhoto").src=user.photoURL; $("userPhoto").style.display='inline-block'; }
    setUserStatus('Conectado');

    await cloudPullMerge();
    await loadUserTreinos();
    setSyncInfo('Sincronizado');
  } else {
    $("btnLogin").style.display='inline-block';
    $("btnLogout").style.display='none';
    $("userName").textContent='—';
    $("userPhoto").style.display='none';
    setUserStatus('Não logado');
    setSyncInfo('Somente local');
  }
});

/* ===== templates de treino ===== */
const DEFAULT_TREINOS = {
  segunda: [
    {nome:'Puxada triângulo alta', alvo:'3x8-12'},
    {nome:'Puxada barra reta alta', alvo:'3x8-12'},
    {nome:'Remada máquina', alvo:'3x8-12'},
    {nome:'Rosca direta barra', alvo:'3x8-12'},
    {nome:'Martelo', alvo:'3x10-12'},
    {nome:'Banco Scott', alvo:'3x8-12'},
    {nome:'Lombar máquina', alvo:'3x15-20'}
  ],
  terca: [
    {nome:'Supino máquina vertical', alvo:'3x8-12'},
    {nome:'Supino reto com halteres', alvo:'3x8-12'},
    {nome:'Crucifixo reto com halteres', alvo:'3x10-12'},
    {nome:'Supino declinado convergente', alvo:'3x8-12'},
    {nome:'Tríceps francês', alvo:'3x10-12'},
    {nome:'Tríceps polia barra reta', alvo:'3x12-15'}
  ],
  quarta: [
    {nome:'Desenvolvimento máquina', alvo:'3x8-12'},
    {nome:'Elevação lateral', alvo:'3x12-15'},
    {nome:'Crucifixo inverso / Face pull', alvo:'3x12-15'},
    {nome:'Encolhimento trapézio', alvo:'3x12-15'}
  ],
  quinta: [
    {nome:'Hack squat', alvo:'3x8-12'},
    {nome:'Cadeira extensora', alvo:'3x12-15'},
    {nome:'Cadeira flexora', alvo:'3x12-15'},
    {nome:'Mesa flexora', alvo:'3x10-12'},
    {nome:'Panturrilha banco', alvo:'3x15-20'}
  ],
  sexta: [
    {nome:'Rosca direta barra', alvo:'3x8-12'},
    {nome:'Martelo', alvo:'3x10-12'},
    {nome:'Tríceps francês', alvo:'3x10-12'},
    {nome:'Tríceps polia barra reta', alvo:'3x12-15'},
    {nome:'Abdômen (prancha, infra, polia)', alvo:'3 séries'}
  ]
};
let TREINOS = deepClone(DEFAULT_TREINOS);
let editorTreinos = deepClone(DEFAULT_TREINOS);
let editorDia = 'segunda';

/* ===== topo ===== */
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

/* ===== timer de sessão ===== */
let timerId=null, startEpoch=null;
const timerEl = $("timer"), btnTimer = $("btnTimer");
if(btnTimer){
  btnTimer.addEventListener('click', ()=>{
    if(timerId){
      clearInterval(timerId); timerId=null;
      const duracao = Math.floor((Date.now()-startEpoch)/1000);
      btnTimer.textContent='Iniciar';
      salvarSessaoAtual(duracao);
    }else{
      startEpoch = Date.now();
      timerId = setInterval(()=>{ timerEl.textContent = fmtDuracao(Math.floor((Date.now()-startEpoch)/1000)); }, 1000);
      btnTimer.textContent='Finalizar';
    }
  });
}
function fmtDuracao(sec){
  const h=String(Math.floor(sec/3600)).padStart(2,'0');
  const m=String(Math.floor((sec%3600)/60)).padStart(2,'0');
  const s=String(sec%60).padStart(2,'0');
  return `${h}:${m}:${s}`;
}

/* ===== calendário (home) ===== */
let viewAno, viewMes;
const mesLabel = $("mesAno"), calEl = $("calendario");
$("prevMes").addEventListener('click', ()=>{ viewMes--; if(viewMes<0){viewMes=11; viewAno--; } montarCalendario(); });
$("proxMes").addEventListener('click', ()=>{ viewMes++; if(viewMes>11){viewMes=0; viewAno++; } montarCalendario(); });

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
  for(let i=0;i<offset;i++){ const d=document.createElement('div'); d.className='dia fora'; calEl.appendChild(d); }
  const hoje = new Date();
  const datas = new Set(getSessoes().map(s=>s.data));
  for(let dia=1; dia<=lastDay; dia++){
    const dataStr = `${viewAno}-${String(viewMes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
    const d = document.createElement('div');
    d.className = `dia ${datas.has(dataStr)?'treino':'nao-treino'}`;
    d.dataset.dia=String(dia).padStart(2,'0'); d.textContent=dia;
    if(dia===hoje.getDate() && viewMes===hoje.getMonth() && viewAno===hoje.getFullYear()) d.classList.add('hoje');
    d.addEventListener('click', ()=>{
      if(d.classList.contains('treino')){ d.classList.replace('treino','nao-treino'); removerSessaoPorData(dataStr); }
      else { d.classList.replace('nao-treino','treino'); adicionarSessaoVazia(dataStr); }
      atualizarResumoHome();
    });
    calEl.appendChild(d);
  }
  atualizarResumoHome();
}
function atualizarResumoHome(){
  const sess = getSessoes().filter(s => { const dt=new Date(s.data); return dt.getFullYear()===viewAno && dt.getMonth()===viewMes; });
  $("diasTreinadosMes").textContent = new Set(sess.map(s=>s.data)).size;
  const ult = getSessoes().slice(-1)[0];
  $("ultimoTreino").textContent = ult ? `${ult.data} (${fmtDuracao(ult.duracao||0)})` : '—';
  const dur = getSessoes().map(s=>s.duracao||0);
  const media = dur.length ? Math.round(dur.reduce((a,b)=>a+b,0)/dur.length) : 0;
  $("duracaoMedia").textContent = dur.length ? fmtDuracao(media) : '—';
}

/* ===== armazenamento local ===== */
const getSessoes = ()=>JSON.parse(localStorage.getItem('sessoes')||'[]');
const setSessoes = (a)=>localStorage.setItem('sessoes', JSON.stringify(a));

/* ===== salvar sessão ===== */
async function salvarSessaoAtual(duracao){
  const hoje = new Date();
  const dataStr = hoje.toISOString().slice(0,10);
  const diaKey = document.querySelector('.tab-btn.active')?.dataset.dia || DIAS_MAP[hoje.getDay()];
  const exercicios = coletarInputsExercicios();

  const sess = getSessoes().filter(s => s.data!==dataStr);
  const salva = {data:dataStr, duracao:duracao||0, dia:diaKey, exercicios};
  sess.push(salva); setSessoes(sess);

  marcarHojeNoCalendario();
  $("statusSave").textContent = '✅ Sessão salva!';
  setTimeout(()=>$("statusSave").textContent='',2000);

  const user = auth.currentUser;
  if(user){ try{ await cloudUpsertSession(user.uid, salva); setSyncInfo('Sincronizado'); } catch{} }
  else setSyncInfo('Não logado (somente local)');

  refreshGraficosSeAbaAberta(exercicios);
}
function adicionarSessaoVazia(dataStr){
  const sess = getSessoes();
  if(!sess.find(s=>s.data===dataStr)){
    const nova = {data:dataStr, duracao:0, dia:null, exercicios:[]};
    sess.push(nova); setSessoes(sess);
    if(auth.currentUser) cloudUpsertSession(auth.currentUser.uid, nova).catch(()=>{});
  }
}
function removerSessaoPorData(dataStr){
  setSessoes(getSessoes().filter(s=>s.data!==dataStr));
  if(auth.currentUser) cloudDeleteSessionByDate(auth.currentUser.uid, dataStr).catch(()=>{});
}
function marcarHojeNoCalendario(){
  const hoje = new Date();
  if(hoje.getFullYear()===viewAno && hoje.getMonth()===viewMes){
    const diaSel = String(hoje.getDate()).padStart(2,'0');
    const el=[...document.querySelectorAll('.dia')].find(d=>d.dataset.dia===diaSel);
    if(el) el.classList.replace('nao-treino','treino');
  }
}

/* ===== UI treinos ===== */
const tabs = document.querySelectorAll('.tab-btn');
const listaExEl = $("listaExercicios");
const treinoDoDiaEl = $("treinoDoDia");
const salvarBtn = $("salvarTreino");

tabs.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    tabs.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    montarExercicios(btn.dataset.dia);
  });
});

function montarExercicios(diaKey){
  const arr = TREINOS[diaKey] || [];
  treinoDoDiaEl.textContent = `Dia selecionado: ${labelDia(diaKey)} · Registre as cargas e reps (meta: 8–12 reps).`;
  listaExEl.innerHTML = '';
  const hist = getSessoes();
  arr.forEach(ex=>{
    const last = ultimaCarga(ex.nome, hist);
    const card = document.createElement('div');
    card.className='ex-card';
    card.innerHTML = `
      <div><b>${ex.nome}</b><br><small>${ex.alvo}</small></div>
      <div><input type="number" step="0.5" placeholder="kg" data-field="peso" data-ex="${ex.nome}" value="${last?.peso??''}"/></div>
      <div><input type="number" placeholder="reps" data-field="reps" data-ex="${ex.nome}" value="${last?.reps??''}"/></div>
      <div><textarea rows="1" placeholder="obs" data-field="obs" data-ex="${ex.nome}">${last?.obs??''}</textarea></div>
    `;
    listaExEl.appendChild(card);
  });
}
function labelDia(key){
  return {segunda:'Segunda (Costas+Bíceps)',terca:'Terça (Peito+Tríceps)',quarta:'Quarta (Ombro)',quinta:'Quinta (Perna)',sexta:'Sexta (Braços+Abs)'}[key]||key;
}
function ultimaCarga(nomeEx, historico){
  for(let i=historico.length-1;i>=0;i--){
    const e = historico[i].exercicios?.find(x=>x.nome===nomeEx);
    if(e) return e;
  }
  return null;
}
function coletarInputsExercicios(){
  const inputs = document.querySelectorAll('[data-ex]');
  const map = {};
  inputs.forEach(el=>{
    const nome = el.dataset.ex, field = el.dataset.field;
    map[nome] = map[nome] || {nome}; map[nome][field] = el.value;
  });
  return Object.values(map);
}
(function initTreinoTabs(){
  const d = new Date().getDay();
  let key='segunda'; if(d===2) key='terca'; if(d===3) key='quarta'; if(d===4) key='quinta'; if(d===5) key='sexta';
  tabs.forEach(b=>b.classList.remove('active'));
  const chosen = [...tabs].find(b=>b.dataset.dia===key) || tabs[0];
  chosen.classList.add('active'); montarExercicios(chosen.dataset.dia);
})();
if(salvarBtn) salvarBtn.addEventListener('click', ()=> salvarSessaoAtual(null));

/* ===== Copiar última sessão do dia ===== */
$("btnCopiarUltima").addEventListener('click', ()=>{
  const dayKey = document.querySelector('.tab-btn.active')?.dataset.dia || 'segunda';
  const last = getSessoes().slice().reverse().find(s => s.dia===dayKey);
  if(!last){ alert('Ainda não há sessão salva para esse dia.'); return; }
  const map = new Map((last.exercicios||[]).map(e=>[e.nome,e]));
  document.querySelectorAll('[data-ex]').forEach(el=>{
    const exNome = el.dataset.ex; const field = el.dataset.field;
    const src = map.get(exNome); if(src && src[field]!==undefined) el.value = src[field];
  });
});

/* ===== Timer de descanso ===== */
let restInterval=null, restRemaining=0;
const restDisplay = $("restDisplay");
function setRest(seconds){
  restRemaining = Math.max(0, Number(seconds||0));
  updateRestDisplay();
}
function updateRestDisplay(){
  const m = String(Math.floor(restRemaining/60)).padStart(2,'0');
  const s = String(restRemaining%60).padStart(2,'0');
  restDisplay.textContent = `${m}:${s}`;
}
function vibrate(ms){ if(navigator.vibrate) try{ navigator.vibrate(ms);}catch{} }
function beep(){
  try{
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type='sine'; o.frequency.value=880; o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime+0.01);
    o.start(); setTimeout(()=>{ o.stop(); ctx.close(); }, 250);
  }catch{}
}
function bindRestTimerUI(){
  document.querySelectorAll('[data-rest]').forEach(btn=>{
    btn.addEventListener('click', ()=>{ setRest(btn.dataset.rest); });
  });
  $("restStart").addEventListener('click', ()=>{
    const custom = Number($("restCustom").value);
    if(custom>0) setRest(custom);
    if(restRemaining<=0) setRest(60);
    if(restInterval) clearInterval(restInterval);
    restInterval = setInterval(()=>{
      restRemaining--; updateRestDisplay();
      if(restRemaining<=0){ clearInterval(restInterval); restInterval=null; vibrate([200,100,200]); beep(); }
    },1000);
  });
  $("restStop").addEventListener('click', ()=>{
    if(restInterval) clearInterval(restInterval); restInterval=null; setRest(0);
  });
  setRest(60);
}

/* ===== Gráficos ===== */
let chart;
const selectEx = $("selectExercicio");
const listaUltimas = $("listaUltimas");
const prEx = $("prExercicio");
const qtdSessEx = $("qtdSessoesEx");

function popularListaExerciciosChart(){
  const nomes = new Set();
  getSessoes().forEach(s => (s.exercicios||[]).filter(e => e.peso && !isNaN(Number(e.peso))).forEach(e=>nomes.add(e.nome)));
  Object.values(TREINOS).flat().forEach(e=>nomes.add(e.nome));
  if(!selectEx) return;
  const atual = selectEx.value; selectEx.innerHTML='';
  [...nomes].sort().forEach(n=>{ const op=document.createElement('option'); op.value=n; op.textContent=n; selectEx.appendChild(op); });
  if(atual && [...nomes].has(atual)) selectEx.value=atual; else if(selectEx.options.length) selectEx.selectedIndex=0;
}
if(selectEx) selectEx.addEventListener('change', desenharGrafico);

function desenharGrafico(){
  if(!selectEx || !selectEx.value) return;
  const nome = selectEx.value;
  const dados = [];
  getSessoes().forEach(s=>{
    const e = (s.exercicios||[]).find(x=>x.nome===nome);
    if(e && e.peso && !isNaN(Number(e.peso))) dados.push({data:s.data, peso:Number(e.peso)});
  });
  dados.sort((a,b)=>a.data.localeCompare(b.data));
  const ctx = document.getElementById('chartCanvas')?.getContext('2d');
  if(!ctx) return;
  if(chart) chart.destroy();

  if(dados.length===0){
    chart = new Chart(ctx,{type:'line',data:{labels:[],datasets:[{label:`${nome} (kg)`,data:[]}]},options:{scales:{y:{beginAtZero:true}}}});
    listaUltimas.innerHTML='<li>Sem dados para este exercício</li>'; prEx.textContent='—'; qtdSessEx.textContent='0'; return;
  }
  chart = new Chart(ctx,{
    type:'line',
    data:{ labels:dados.map(d=>d.data), datasets:[{label:`${nome} (kg)`, data:dados.map(d=>d.peso), borderWidth:2, fill:false}]},
    options:{ responsive:true, scales:{y:{beginAtZero:true}} }
  });
  listaUltimas.innerHTML='';
  dados.slice(-5).reverse().forEach(d=>{ const li=document.createElement('li'); li.textContent=`${d.data}: ${d.peso} kg`; listaUltimas.appendChild(li); });
  prEx.textContent = Math.max(...dados.map(d=>d.peso))+' kg'; qtdSessEx.textContent = String(dados.length);
}
function refreshGraficosSeAbaAberta(exs){
  const visivel = document.getElementById('graficos').style.display !== 'none';
  if(!visivel) return;
  popularListaExerciciosChart();
  const ultimo = [...(exs||[])].reverse().find(e=>e.peso && !isNaN(Number(e.peso)));
  if(ultimo && $("selectExercicio")) $("selectExercicio").value = ultimo.nome;
  desenharGrafico();
}

/* ===== Firestore: sessões ===== */
async function cloudUpsertSession(uid, sess){
  const ref = doc(db,'users',uid,'sessoes',sess.data); await setDoc(ref, sess, {merge:true});
}
async function cloudDeleteSessionByDate(uid, dateStr){
  const ref = doc(db,'users',uid,'sessoes',dateStr); await deleteDoc(ref);
}
async function cloudFetchAll(uid){
  const qy = query(collection(db,'users',uid,'sessoes'), orderBy('data'));
  const snap = await getDocs(qy); return snap.docs.map(d=>d.data());
}
async function cloudPullMerge(){
  const user = auth.currentUser; if(!user) return;
  const remoto = await cloudFetchAll(user.uid);
  if(remoto && remoto.length){
    const local = getSessoes();
    const byDate = new Map();
    [...local,...remoto].forEach(s=>{
      const k=s.data; const ex=byDate.get(k);
      if(!ex) byDate.set(k,s); else byDate.set(k,(s.duracao||0)>(ex.duracao||0)?s:ex);
    });
    setSessoes([...byDate.values()].sort((a,b)=>a.data.localeCompare(b.data)));
    montarCalendario();
  }
}

/* ===== Firestore: config de treino ===== */
async function loadUserTreinos(){
  const user = auth.currentUser; if(!user) return;
  try{
    const ref = doc(db,'users',user.uid,'config','treinos');
    const snap = await getDoc(ref);
    if(snap.exists()){
      const data = snap.data();
      if(data && data.treinos){ TREINOS = deepClone(data.treinos); editorTreinos = deepClone(data.treinos); }
    }else{
      await setDoc(ref,{treinos:deepClone(DEFAULT_TREINOS)},{merge:true});
      TREINOS = deepClone(DEFAULT_TREINOS); editorTreinos = deepClone(DEFAULT_TREINOS);
    }
    const active = document.querySelector('.tab-btn.active')?.dataset.dia || 'segunda';
    montarExercicios(active);
  }catch(e){ console.warn('loadUserTreinos', e); }
}
async function saveUserTreinos(treinos){
  const user = auth.currentUser; if(!user) return;
  const ref = doc(db,'users',user.uid,'config','treinos'); await setDoc(ref,{treinos},{merge:true});
}

/* ===== Editor ===== */
function bindEditorButtons(){
  $("btnAbrirEditor")?.addEventListener('click', openEditor);
  $("btnFecharEditor")?.addEventListener('click', closeEditor);
  $("btnAddEx")?.addEventListener('click', ()=> addEx(editorDia));
  $("btnResetTreino")?.addEventListener('click', resetEditor);
  $("btnSalvarTreinoEditor")?.addEventListener('click', saveEditor);
  document.querySelectorAll('[data-dia-edit]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('[data-dia-edit]').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      editorDia = btn.dataset.diaEdit; renderEditorLista();
    });
  });
}
function openEditor(){ editorTreinos=deepClone(TREINOS); editorDia='segunda'; document.querySelectorAll('[data-dia-edit]').forEach((b,i)=>b.classList.toggle('active',i===0)); renderEditorLista(); $("editorOverlay").style.display='block'; }
function closeEditor(){ $("editorOverlay").style.display='none'; }
function resetEditor(){ if(!confirm('Restaurar o treino padrão?')) return; editorTreinos=deepClone(DEFAULT_TREINOS); renderEditorLista(); }
function renderEditorLista(){
  const cont = $("editorLista");
  const arr = editorTreinos[editorDia] || []; cont.innerHTML='';
  if(arr.length===0){ cont.innerHTML='<div class="muted">Sem exercícios — clique em “+ Adicionar exercício”.</div>'; return; }
  arr.forEach((ex,i)=>{
    const row=document.createElement('div'); row.className='ex-row';
    row.innerHTML = `
      <input class="ex-nome" data-i="${i}" value="${ex.nome||''}" placeholder="Nome do exercício">
      <input class="ex-alvo" data-i="${i}" value="${ex.alvo||''}" placeholder="Alvo (ex.: 3x8-12)">
      <button class="ghost up" data-i="${i}" title="Subir">↑</button>
      <button class="ghost down" data-i="${i}" title="Descer">↓</button>
      <button class="ghost del" data-i="${i}" title="Remover">🗑</button>`;
    cont.appendChild(row);
  });
  cont.querySelectorAll('.ex-nome').forEach(inp=>inp.addEventListener('input',e=>{ editorTreinos[editorDia][Number(e.target.dataset.i)].nome=e.target.value; }));
  cont.querySelectorAll('.ex-alvo').forEach(inp=>inp.addEventListener('input',e=>{ editorTreinos[editorDia][Number(e.target.dataset.i)].alvo=e.target.value; }));
  cont.querySelectorAll('.up').forEach(btn=>btn.addEventListener('click',()=>{ const i=Number(btn.dataset.i); const a=editorTreinos[editorDia]; if(i>0){[a[i-1],a[i]]=[a[i],a[i-1]]; renderEditorLista();}}));
  cont.querySelectorAll('.down').forEach(btn=>btn.addEventListener('click',()=>{ const i=Number(btn.dataset.i); const a=editorTreinos[editorDia]; if(i<a.length-1){[a[i+1],a[i]]=[a[i],a[i+1]]; renderEditorLista();}}));
  cont.querySelectorAll('.del').forEach(btn=>btn.addEventListener('click',()=>{ const i=Number(btn.dataset.i); editorTreinos[editorDia].splice(i,1); renderEditorLista(); }));
}
function addEx(dia){ editorTreinos[dia]=editorTreinos[dia]||[]; editorTreinos[dia].push({nome:'Novo exercício',alvo:'3x8-12'}); renderEditorLista(); }
async function saveEditor(){
  TREINOS = deepClone(editorTreinos);
  if(auth.currentUser){ try{ await saveUserTreinos(TREINOS); setSyncInfo('Sincronizado'); alert('Treino salvo!'); } catch(e){ alert('Erro ao salvar treino: '+e.message);} }
  else alert('Mudanças salvas localmente (entre com sua conta para salvar na nuvem).');
  const active = document.querySelector('.tab-btn.active')?.dataset.dia || 'segunda'; montarExercicios(active); closeEditor();
}

/* ===== Backup manual ===== */
function bindBackupButtons(){
  $("btnExport")?.addEventListener('click', ()=>{
    const data = { sessoes:getSessoes(), treinos:TREINOS };
    const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `backup_meu_treino_${Date.now()}.json`; a.click();
  });
  $("btnImport")?.addEventListener('click', ()=>$("fileImport").click());
  $("fileImport")?.addEventListener('change', async (e)=>{
    const file = e.target.files[0]; if(!file) return;
    const text = await file.text(); const json = JSON.parse(text);
    if(json.sessoes) setSessoes(json.sessoes);
    if(json.treinos) { TREINOS=json.treinos; editorTreinos=deepClone(json.treinos); if(auth.currentUser) await saveUserTreinos(TREINOS); }
    montarCalendario(); const active=document.querySelector('.tab-btn.active')?.dataset.dia||'segunda'; montarExercicios(active);
    alert('Backup importado.');
  });
}
