// ===============================
// Firebase (opcional)
// ===============================
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

    document.getElementById('userStatus').textContent = 'Firebase carregado';

    fb._.onAuthStateChanged(fb.auth, async (user)=>{
      fb.user = user || null;
      if(user){
        document.getElementById('userStatus').textContent = `Logado: ${user.displayName || user.email}`;
        document.getElementById('btnLogin').style.display = 'none';
        document.getElementById('btnLogout').style.display = '';
        document.getElementById('syncInfo').textContent = 'Sincronização: Conectado';
        await puxarDoFirestoreMesclarLocal();
      }else{
        document.getElementById('userStatus').textContent = 'Não logado';
        document.getElementById('btnLogin').style.display = '';
        document.getElementById('btnLogout').style.display = 'none';
        document.getElementById('syncInfo').textContent = 'Sincronização: Offline';
      }
      atualizarResumoHome();
    });

    document.getElementById('btnLogin').addEventListener('click', async ()=>{
      try{ await fb._.signInWithPopup(fb.auth, fb.provider); }catch(e){ alert('Falha no login'); }
    });
    document.getElementById('btnLogout').addEventListener('click', async ()=>{
      try{ await fb._.signOut(fb.auth); }catch(_){}
    });
  }catch(e){
    document.getElementById('userStatus').textContent = 'Firebase indisponível (modo local)';
    document.getElementById('syncInfo').textContent = 'Sincronização: —';
    document.getElementById('btnLogin').style.display = 'none';
    document.getElementById('btnLogout').style.display = 'none';
  }
})();

// ===============================
// Dados e util
// ===============================
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
document.getElementById('subheader').textContent = textoTreinoHoje();

// Tema
(function themeInit(){
  const saved = localStorage.getItem('theme') || 'dark';
  if(saved==='dark') document.documentElement.classList.add('dark');
  document.getElementById('btnTheme').textContent = document.documentElement.classList.contains('dark')?'☀️':'🌙';
})();
document.getElementById('btnTheme').addEventListener('click', ()=>{
  document.documentElement.classList.toggle('dark');
  const dark = document.documentElement.classList.contains('dark');
  localStorage.setItem('theme', dark?'dark':'light');
  document.getElementById('btnTheme').textContent = dark?'☀️':'🌙';
});

// Navegação
window.mostrarPagina = function(id){
  document.querySelectorAll('.pagina').forEach(p=>p.style.display='none');
  document.getElementById(id).style.display='block';
  if(id==='graficos'){ popularListaExerciciosChart(); atualizarEvolucaoUI(); }
  if(id==='home'){ atualizarResumoHome(); }
};

// Local storage
function getSessoes(){ return JSON.parse(localStorage.getItem('sessoes')||'[]'); }
function setSessoes(a){ localStorage.setItem('sessoes', JSON.stringify(a)); }

// Firestore merge
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
  document.getElementById('syncInfo').textContent = 'Sincronização: Sincronizado';
  montarCalendario(); atualizarResumoHome();
}
async function salvarNoFirestore(sessao){
  if(!firebaseOk || !fb.user) return;
  const { doc, setDoc } = fb._;
  const ref = doc(fb.db, 'users', fb.user.uid, 'sessoes', sessao.data);
  await setDoc(ref, sessao, { merge:true });
  document.getElementById('syncInfo').textContent = 'Sincronização: Sincronizado';
}

// ===============================
// Calendário
// ===============================
let viewAno, viewMes;
const mesLabel = document.getElementById('mesAno');
const calEl = document.getElementById('calendario');
const prevMesBtn = document.getElementById('prevMes');
const proxMesBtn = document.getElementById('proxMes');

(function initCalendar(){
  const hoje = new Date();
  viewAno = hoje.getFullYear();
  viewMes = hoje.getMonth();
  montarCalendario();
  prevMesBtn.addEventListener('click', ()=>{ viewMes--; if(viewMes<0){viewMes=11; viewAno--; } montarCalendario(); });
  proxMesBtn.addEventListener('click', ()=>{ viewMes++; if(viewMes>11){viewMes=0; viewAno++; } montarCalendario(); });
})();

function montarCalendario(){
  mesLabel.textContent = new Date(viewAno, viewMes).toLocaleString('pt-BR', {month:'long', year:'numeric'});
  calEl.innerHTML='';
  const first = new Date(viewAno, viewMes, 1);
  const lastDay = new Date(viewAno, viewMes+1, 0).getDate();
  const offset = first.getDay();
  for(let i=0;i<offset;i++){
    const d = document.createElement('div');
    d.className='dia fora'; calEl.appendChild(d);
  }
  const hoje = new Date();
  const setDatas = new Set(getSessoes().map(s=>s.data));
  for(let dia=1; dia<=lastDay; dia++){
    const d = document.createElement('div');
    d.className='dia';
    d.dataset.dia = String(dia).padStart(2,'0');
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
  document.getElementById('diasTreinadosMes').textContent = new Set(sess.map(s=>s.data)).size;
  const ult = getSessoes().slice(-1)[0];
  document.getElementById('ultimoTreino').textContent = ult ? `${ult.data} (${fmtDuracao(ult.duracao||0)})` : '—';
  const dur = getSessoes().map(s=>s.duracao||0);
  const media = dur.length? Math.round(dur.reduce((a,b)=>a+b,0)/dur.length):0;
  document.getElementById('duracaoMedia').textContent = dur.length? fmtDuracao(media) : '—';
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

// ===============================
// Timer de treino + descanso com vibração/áudio/overlay
// ===============================
let timerId=null, startEpoch=null;
const timerEl = document.getElementById('timer');
document.getElementById('btnTimer').addEventListener('click', ()=>{
  if(timerId){
    clearInterval(timerId); timerId=null;
    const duracao = Math.floor((Date.now()-startEpoch)/1000);
    document.getElementById('btnTimer').textContent='Iniciar';
    salvarSessaoAtual(duracao);
  }else{
    startEpoch = Date.now();
    timerId = setInterval(()=>{ timerEl.textContent = fmtDuracao(Math.floor((Date.now()-startEpoch)/1000)); }, 1000);
    document.getElementById('btnTimer').textContent='Finalizar';
  }
});
function fmtDuracao(sec){
  const h=String(Math.floor(sec/3600)).padStart(2,'0');
  const m=String(Math.floor((sec%3600)/60)).padStart(2,'0');
  const s=String(sec%60).padStart(2,'0');
  return `${h}:${m}:${s}`;
}

// WebAudio (bip) preparado no gesto do usuário
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

let restId=null, restLeft=0;
const restSeg = document.getElementById('restSeg');
const restDisplay = document.getElementById('restDisplay');
const overlay = document.getElementById('restOverlay');
document.getElementById('btnRest').addEventListener('click', ()=>{
  if(restId){ clearInterval(restId); restId=null; restDisplay.textContent='—'; overlay.classList.add('hidden'); return; }
  ensureAudioCtx(); // inicia contexto de áudio dentro do gesto
  restLeft = Math.max(10, Number(restSeg.value||60));
  restDisplay.textContent = `${restLeft}s`;
  restId = setInterval(()=>{
    restLeft--;
    restDisplay.textContent = `${restLeft}s`;
    if(restLeft<=0){
      clearInterval(restId); restId=null;
      restDisplay.textContent='⏰ Descanso finalizado!';
      // Notificação
      try{ navigator.vibrate && navigator.vibrate([250,120,250,120,400]); }catch(_){}
      beep(4, 1000, 220);
      overlay.classList.remove('hidden');
      // título piscando
      const baseTitle=document.title; let f=0;
      const blink=setInterval(()=>{ document.title = (++f%2)?'⏰ Descanso!' : baseTitle; if(f>8){clearInterval(blink); document.title=baseTitle;} },500);
    }
  },1000);
});
document.getElementById('btnOverlayOk').addEventListener('click', ()=> overlay.classList.add('hidden'));
document.getElementById('btnOverlayBuzz').addEventListener('click', ()=>{
  try{ navigator.vibrate && navigator.vibrate([200,100,300]); }catch(_){}
  ensureAudioCtx(); beep(2, 1200, 200);
});

// ===============================
// UI Treino
// ===============================
const tabs = document.querySelectorAll('.tab-btn');
const listaExEl = document.getElementById('listaExercicios');
const treinoDoDiaEl = document.getElementById('treinoDoDia');
const salvarBtn = document.getElementById('salvarTreino');
const copyBtn = document.getElementById('btnCopyLast');

tabs.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    tabs.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    montarExercicios(btn.dataset.dia, true);
  });
});
copyBtn.addEventListener('click', ()=>{
  const key = document.querySelector('.tab-btn.active')?.dataset.dia || 'segunda';
  preencherComUltima(key);
});

function montarExercicios(diaKey, prefill=true){
  const arr = TREINOS[diaKey] || [];
  treinoDoDiaEl.textContent = `Dia selecionado: ${labelDia(diaKey)} · Registre as cargas e reps (meta: 8–12 reps).`;
  listaExEl.innerHTML = '';
  const historico = getSessoes();
  arr.forEach(ex=>{
    const last = prefill ? ultimaCarga(ex.nome, historico) : null;
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
function preencherComUltima(diaKey){
  const arr = TREINOS[diaKey] || [];
  const hist = getSessoes();
  arr.forEach(ex=>{
    const last = ultimaCarga(ex.nome, hist);
    if(last){
      const peso = document.querySelector(`[data-ex="${CSS.escape(ex.nome)}"][data-field="peso"]`);
      const reps = document.querySelector(`[data-ex="${CSS.escape(ex.nome)}"][data-field="reps"]`);
      const obs  = document.querySelector(`[data-ex="${CSS.escape(ex.nome)}"][data-field="obs"]`);
      if(peso) peso.value = last.peso ?? '';
      if(reps) reps.value = last.reps ?? '';
      if(obs)  obs.value  = last.obs  ?? '';
    }
  });
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

function salvarSessaoAtual(duracao){
  const hoje = new Date();
  const dataStr = hoje.toISOString().slice(0,10);
  const diaKey = document.querySelector('.tab-btn.active')?.dataset.dia || DIAS_MAP[hoje.getDay()];
  const exercicios = coletarInputsExercicios();
  const nova = {data:dataStr, duracao:duracao||0, dia:diaKey, exercicios};
  const sess = getSessoes().filter(s => s.data!==dataStr);
  sess.push(nova); sess.sort((a,b)=>a.data.localeCompare(b.data));
  setSessoes(sess);
  marcarHojeNoCalendario();
  document.getElementById('statusSave').textContent = '✅ Sessão salva!';
  setTimeout(()=>document.getElementById('statusSave').textContent='',2000);
  desenharGrafico(); atualizarEvolucaoUI();
  salvarNoFirestore(nova).catch(()=>{});
}

// Backup
document.getElementById('btnExport').addEventListener('click', ()=>{
  const blob = new Blob([localStorage.getItem('sessoes')||'[]'], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sessoes_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
});
document.getElementById('btnImport').addEventListener('click', ()=>document.getElementById('fileImport').click());
document.getElementById('fileImport').addEventListener('change', (e)=>{
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const arr = JSON.parse(reader.result);
      if(Array.isArray(arr)){ setSessoes(arr); montarCalendario(); desenharGrafico(); atualizarEvolucaoUI(); atualizarResumoHome(); alert('Importado!'); }
    }catch(_){ alert('Arquivo inválido'); }
  };
  reader.readAsText(file);
});

// ===============================
// EVOLUÇÃO – filtros + gráficos extra
// ===============================
let chart, volumeChart;
const selectEx = document.getElementById('selectExercicio');
const listaUltimas = document.getElementById('listaUltimas');
const prEx = document.getElementById('prExercicio');
const qtdSessEx = document.getElementById('qtdSessoesEx');
const filtroDiaWrap = document.getElementById('filtroDia');
const periodoSel = document.getElementById('periodo');
const listaSessoesDetalhe = document.getElementById('listaSessoesDetalhe');

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
function getFiltroDia(){
  return filtroDiaWrap.querySelector('.chip.active')?.dataset.dia || 'all';
}
function filtrarSessoes(){
  const days = Number(periodoSel.value||90);
  const desde = new Date(); desde.setDate(desde.getDate()-days);
  const diaFiltro = getFiltroDia();
  return getSessoes()
    .filter(s => new Date(s.data) >= desde && (diaFiltro==='all' || s.dia===diaFiltro))
    .sort((a,b)=>a.data.localeCompare(b.data));
}

function desenharGrafico(){
  const nome = selectEx.value;
  if(!nome){ popularListaExerciciosChart(); return; }
  const dados = [];
  filtrarSessoes().forEach(s=>{
    const e = (s.exercicios||[]).find(x=>x.nome===nome);
    if(e && e.peso) dados.push({data:s.data, peso:Number(e.peso)});
  });
  dados.sort((a,b)=> a.data.localeCompare(b.data));
  const ctx = document.getElementById('chartCanvas').getContext('2d');
  if(chart) chart.destroy();
  chart = new Chart(ctx, {
    type:'line',
    data:{ labels:dados.map(d=>d.data), datasets:[{ label:`${nome} (kg)`, data:dados.map(d=>d.peso), borderWidth:2, fill:false }]},
    options:{ responsive:true, plugins:{ legend:{display:true} }, scales:{ y:{ beginAtZero:true } } }
  });
  listaUltimas.innerHTML='';
  dados.slice(-5).reverse().forEach(d=>{
    const li=document.createElement('li'); li.textContent=`${d.data}: ${d.peso} kg`; listaUltimas.appendChild(li);
  });
  const pr = dados.length? Math.max(...dados.map(d=>d.peso)) : null;
  prEx.textContent = pr? `${pr} kg` : '—';
  qtdSessEx.textContent = String(dados.length);
}

// Volume semanal
function isoWeek(date){
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1)/7);
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
  const dados = new Map(); // week -> volume
  filtrarSessoes().forEach(s=>{
    const w = isoWeek(new Date(s.data));
    dados.set(w, (dados.get(w)||0) + volumeSessao(s));
  });
  const labels = [...dados.keys()].sort();
  const values = labels.map(k => dados.get(k));
  const ctx = document.getElementById('volumeCanvas').getContext('2d');
  if(volumeChart) volumeChart.destroy();
  volumeChart = new Chart(ctx, {
    type:'bar',
    data:{ labels, datasets:[{ label:'Volume (kg·reps) por semana', data:values }] },
    options:{ responsive:true, scales:{ y:{ beginAtZero:true } } }
  });
}

// Sessões detalhadas
function preencherSessoesDetalhe(){
  const arr = filtrarSessoes().slice(-12).reverse(); // últimas 12
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
function atualizarEvolucaoUI(){
  popularListaExerciciosChart();
  desenharGrafico();
  desenharVolume();
  preencherSessoesDetalhe();
}
