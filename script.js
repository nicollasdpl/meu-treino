/* ===== Firebase SDK v12 ===== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDocs, deleteDoc,
  collection, orderBy, query
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  getRedirectResult, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

/* ==== SUA CONFIG ==== */
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

/* ===== UI helpers ===== */
function $(id){ return document.getElementById(id); }
function setUserStatus(txt){ const el=$("userStatus"); if(el) el.textContent = txt; }
function setSyncInfo(txt){ const el=$("syncInfo"); if(el) el.textContent = `Sincronização: ${txt}`; }

/* ===== Navegação ===== */
window.mostrarPagina = function(id){
  document.querySelectorAll('.pagina').forEach(p=>p.style.display='none');
  document.getElementById(id).style.display='block';
  if(id==='graficos'){ popularListaExerciciosChart(); desenharGrafico(); }
  if(id==='home'){ atualizarResumoHome(); }
};
document.addEventListener('DOMContentLoaded', ()=>{
  $("subheader").textContent = textoTreinoHoje();
  mostrarPagina('home');
  bindAuthButtons();
});

/* ===== Auth ===== */
function bindAuthButtons(){
  $("btnLogin")?.addEventListener('click', async ()=>{
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      // iOS/Safari às vezes bloqueia popup → tenta redirect
      if (e.code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, provider);
      } else {
        alert('Erro no login: ' + e.message);
      }
    }
  });
  $("btnLogout")?.addEventListener('click', ()=> signOut(auth));
}

onAuthStateChanged(auth, async (user)=>{
  if(user){
    $("btnLogin").style.display = 'none';
    $("btnLogout").style.display = 'inline-block';
    setUserStatus(`Conectado como ${user.email}`);
    await cloudPullMerge();  // baixa sessões do usuário e mescla
    setSyncInfo('Sincronizado');
  }else{
    $("btnLogin").style.display = 'inline-block';
    $("btnLogout").style.display = 'none';
    setUserStatus('Não logado');
    setSyncInfo('Somente local');
  }
});

/* ===== Dados de Treino ===== */
const TREINOS = {
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

/* ===== Timer ===== */
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

/* ===== Calendário ===== */
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
  for(let i=0;i<offset;i++){
    const d=document.createElement('div'); d.className='dia fora'; calEl.appendChild(d);
  }
  const hoje = new Date();
  const sess = getSessoes();
  const setDatas = new Set(sess.map(s=>s.data));

  for(let dia=1; dia<=lastDay; dia++){
    const d = document.createElement('div');
    d.className='dia'; d.dataset.dia = String(dia).padStart(2,'0'); d.textContent = dia;

    const dataStr = `${viewAno}-${String(viewMes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
    d.classList.add(setDatas.has(dataStr) ? 'treino' : 'nao-treino');

    if(dia===hoje.getDate() && viewMes===hoje.getMonth() && viewAno===hoje.getFullYear()){
      d.classList.add('hoje');
    }

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
  $("diasTreinadosMes").textContent = new Set(sess.map(s=>s.data)).size;
  const ult = getSessoes().slice(-1)[0];
  $("ultimoTreino").textContent = ult ? `${ult.data} (${fmtDuracao(ult.duracao||0)})` : '—';
  const dur = getSessoes().map(s=>s.duracao||0);
  const media = dur.length? Math.round(dur.reduce((a,b)=>a+b,0)/dur.length):0;
  $("duracaoMedia").textContent = dur.length? fmtDuracao(media) : '—';
}

/* ===== Local storage ===== */
function getSessoes(){ return JSON.parse(localStorage.getItem('sessoes')||'[]'); }
function setSessoes(arr){ localStorage.setItem('sessoes', JSON.stringify(arr)); }

/* ===== Salvar sessão (local + nuvem se logado) ===== */
async function salvarSessaoAtual(duracao){
  const hoje = new Date();
  const dataStr = hoje.toISOString().slice(0,10);
  const diaKey = document.querySelector('.tab-btn.active')?.dataset.dia || DIAS_MAP[hoje.getDay()];
  const exercicios = coletarInputsExercicios();

  const sess = getSessoes().filter(s => s.data!==dataStr);
  const salva = {data:dataStr, duracao:duracao||0, dia:diaKey, exercicios};
  sess.push(salva);
  setSessoes(sess);

  marcarHojeNoCalendario();
  $("statusSave").textContent = '✅ Sessão salva!';
  setTimeout(()=>$("statusSave").textContent='',2000);

  // nuvem (se logado)
  const user = auth.currentUser;
  if(user){
    try{
      await cloudUpsertSession(user.uid, salva);
      setSyncInfo('Sincronizado');
    }catch(e){
      setSyncInfo('Erro ao sincronizar');
    }
  }else{
    setSyncInfo('Não logado (somente local)');
  }

  refreshGraficosSeAbaAberta(exercicios);
}

function adicionarSessaoVazia(dataStr){
  const sess = getSessoes();
  if(!sess.find(s=>s.data===dataStr)){
    const nova = {data:dataStr, duracao:0, dia:null, exercicios:[]};
    sess.push(nova); setSessoes(sess);
    const user = auth.currentUser;
    if(user) cloudUpsertSession(user.uid, nova).catch(()=>{});
  }
}
function removerSessaoPorData(dataStr){
  const sess = getSessoes().filter(s=>s.data!==dataStr);
  setSessoes(sess);
  const user = auth.currentUser;
  if(user) cloudDeleteSessionByDate(user.uid, dataStr).catch(()=>{});
}
function marcarHojeNoCalendario(){
  const hoje = new Date();
  if(hoje.getFullYear()===viewAno && hoje.getMonth()===viewMes){
    const diaSel = String(hoje.getDate()).padStart(2,'0');
    const el = [...document.querySelectorAll('.dia')].find(d=>d.dataset.dia===diaSel);
    if(el){ el.classList.remove('nao-treino'); el.classList.add('treino'); }
  }
}

/* ===== UI do Treino ===== */
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
  const historico = getSessoes();
  arr.forEach(ex=>{
    const last = ultimaCarga(ex.nome, historico);
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
  return {
    segunda:'Segunda (Costas+Bíceps)',
    terca:'Terça (Peito+Tríceps)',
    quarta:'Quarta (Ombro)',
    quinta:'Quinta (Perna)',
    sexta:'Sexta (Braços+Abs)'
  }[key] || key;
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
    const nome = el.dataset.ex;
    const field = el.dataset.field;
    map[nome] = map[nome] || {nome};
    map[nome][field] = el.value;
  });
  return Object.values(map);
}
(function initTreinoTabs(){
  const d = new Date().getDay();
  let key = 'segunda';
  if(d===2) key='terca';
  if(d===3) key='quarta';
  if(d===4) key='quinta';
  if(d===5) key='sexta';
  tabs.forEach(b=>b.classList.remove('active'));
  const chosen = [...tabs].find(b=>b.dataset.dia===key) || tabs[0];
  chosen.classList.add('active');
  montarExercicios(chosen.dataset.dia);
})();
if(salvarBtn){ salvarBtn.addEventListener('click', ()=> salvarSessaoAtual(null)); }

/* ===== GRÁFICOS ===== */
let chart;
const selectEx = $("selectExercicio");
const listaUltimas = $("listaUltimas");
const prEx = $("prExercicio");
const qtdSessEx = $("qtdSessoesEx");

function popularListaExerciciosChart(){
  const nomes = new Set();
  getSessoes().forEach(s => (s.exercicios||[])
    .filter(e => e.peso && !isNaN(Number(e.peso)))
    .forEach(e=>nomes.add(e.nome)));
  Object.values(TREINOS).flat().forEach(e=>nomes.add(e.nome));
  if(!selectEx) return;
  const atual = selectEx.value;
  selectEx.innerHTML = '';
  [...nomes].sort().forEach(n=>{
    const op = document.createElement('option');
    op.value=n; op.textContent=n;
    selectEx.appendChild(op);
  });
  if(atual && [...nomes].has(atual)) selectEx.value = atual;
  else if(selectEx.options.length) selectEx.selectedIndex = 0;
}
if(selectEx){ selectEx.addEventListener('change', desenharGrafico); }

function desenharGrafico(){
  if(!selectEx || !selectEx.value) return;
  const nome = selectEx.value;
  const dados = [];
  getSessoes().forEach(s=>{
    const e = (s.exercicios||[]).find(x=>x.nome===nome);
    if(e && e.peso && !isNaN(Number(e.peso))){
      dados.push({data:s.data, peso: Number(e.peso)});
    }
  });
  dados.sort((a,b)=> a.data.localeCompare(b.data));
  const ctx = document.getElementById('chartCanvas')?.getContext('2d');
  if(!ctx) return;
  if(chart) chart.destroy();

  if(dados.length===0){
    chart = new Chart(ctx, {
      type:'line',
      data:{ labels:[], datasets:[{label:`${nome} (kg)`, data:[]}] },
      options:{ plugins:{legend:{display:true}}, scales:{y:{beginAtZero:true}} }
    });
    listaUltimas.innerHTML = '<li>Sem dados para este exercício</li>';
    prEx.textContent = '—';
    qtdSessEx.textContent = '0';
    return;
  }
  chart = new Chart(ctx, {
    type:'line',
    data:{
      labels: dados.map(d=>d.data),
      datasets: [{ label:`${nome} (kg)`, data:dados.map(d=>d.peso), borderWidth:2, fill:false }]
    },
    options:{ responsive:true, scales:{ y:{ beginAtZero:true } } }
  });
  listaUltimas.innerHTML = '';
  dados.slice(-5).reverse().forEach(d=>{
    const li = document.createElement('li');
    li.textContent = `${d.data}: ${d.peso} kg`;
    listaUltimas.appendChild(li);
  });
  prEx.textContent = Math.max(...dados.map(d=>d.peso)) + ' kg';
  qtdSessEx.textContent = String(dados.length);
}
function refreshGraficosSeAbaAberta(exs){
  const visivel = document.getElementById('graficos').style.display !== 'none';
  if(!visivel) return;
  popularListaExerciciosChart();
  const ultimo = [...(exs||[])].reverse().find(e => e.peso && !isNaN(Number(e.peso)));
  if(ultimo && $("selectExercicio")) $("selectExercicio").value = ultimo.nome;
  desenharGrafico();
}

/* ===== Firestore helpers (por usuário) ===== */
async function cloudUpsertSession(uid, sess){
  const ref = doc(db, 'users', uid, 'sessoes', sess.data);
  await setDoc(ref, sess, {merge:true});
}
async function cloudDeleteSessionByDate(uid, dateStr){
  const ref = doc(db, 'users', uid, 'sessoes', dateStr);
  await deleteDoc(ref);
}
async function cloudFetchAll(uid){
  const qy = query(collection(db, 'users', uid, 'sessoes'), orderBy('data'));
  const snap = await getDocs(qy);
  return snap.docs.map(d=>d.data());
}

/* Puxa da nuvem e mescla com local */
async function cloudPullMerge(){
  const user = auth.currentUser;
  if(!user) return;
  const remoto = await cloudFetchAll(user.uid);
  if(remoto && remoto.length){
    const local = getSessoes();
    const byDate = new Map();
    [...local, ...remoto].forEach(s=>{
      const k=s.data, ex=byDate.get(k);
      if(!ex) byDate.set(k,s); else byDate.set(k,(s.duracao||0)>(ex.duracao||0)?s:ex);
    });
    const merged = [...byDate.values()].sort((a,b)=>a.data.localeCompare(b.data));
    setSessoes(merged);
    montarCalendario();
  }
}

/* ===== Export/Import ===== */
$("btnExport")?.addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(getSessoes(), null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `sessoes_${new Date().toISOString().slice(0,10)}.json`;
  a.click(); URL.revokeObjectURL(url);
});
$("btnImport")?.addEventListener('click', ()=> $("fileImport").click());
$("fileImport")?.addEventListener('change', async ()=>{
  const file = $("fileImport").files[0]; if(!file) return;
  const text = await file.text();
  try{
    const json = JSON.parse(text);
    if(Array.isArray(json)){
      const byDate = new Map();
      [...getSessoes(), ...json].forEach(s=>{
        const key = s.data, ex = byDate.get(key);
        if(!ex) byDate.set(key, s);
        else byDate.set(key, (s.duracao||0) > (ex.duracao||0) ? s : ex);
      });
      const merged = [...byDate.values()].sort((a,b)=>a.data.localeCompare(b.data));
      setSessoes(merged); montarCalendario();
      const user = auth.currentUser;
      if(user){ try{ await cloudUpsertSession(user.uid, merged[merged.length-1]); setSyncInfo('Sincronizado'); }catch(_){} }
    }else{
      alert('Arquivo inválido.');
    }
  }catch(e){ alert('Erro ao ler JSON: ' + e.message); }
});
