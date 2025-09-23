/* ========= Navegação ========= */
function mostrarPagina(id){
  document.querySelectorAll('.pagina').forEach(p=>p.style.display='none');
  document.getElementById(id).style.display='block';
  if(id==='graficos'){ popularListaExerciciosChart(); desenharGrafico(); }
  if(id==='home'){ atualizarResumoHome(); }
}
document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('subheader').textContent = textoTreinoHoje();
});

/* ========= Dados de Treino ========= */
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

/* ========= Timer ========= */
let timerId=null, startEpoch=null;
const timerEl = document.getElementById('timer');
const btnTimer = document.getElementById('btnTimer');

if(btnTimer){
  btnTimer.addEventListener('click', ()=>{
    if(timerId){ // parar
      clearInterval(timerId); timerId=null;
      const duracao = Math.floor((Date.now()-startEpoch)/1000);
      btnTimer.textContent='Iniciar';
      salvarSessaoAtual(duracao); // salva com duração
    }else{ // iniciar
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

/* ========= Calendário ========= */
let viewAno, viewMes; // mês exibido
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
  const offset = first.getDay(); // 0=Dom
  for(let i=0;i<offset;i++){
    const d = document.createElement('div');
    d.className='dia fora'; calEl.appendChild(d);
  }
  const hoje = new Date();
  const sessoes = getSessoes();
  const setDatasTreino = new Set(sessoes.map(s=>s.data));

  for(let dia=1; dia<=lastDay; dia++){
    const d = document.createElement('div');
    d.className='dia';
    d.dataset.dia = String(dia).padStart(2,'0');
    d.textContent = dia;

    const dataStr = `${viewAno}-${String(viewMes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
    if(setDatasTreino.has(dataStr)) d.classList.add('treino'); else d.classList.add('nao-treino');

    if(dia===hoje.getDate() && viewMes===hoje.getMonth() && viewAno===hoje.getFullYear()){
      d.classList.add('hoje');
    }

    d.addEventListener('click', ()=>{
      // toggle manual (marcar/desmarcar)
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

/* ========= Sessões (LocalStorage) ========= */
function getSessoes(){
  return JSON.parse(localStorage.getItem('sessoes')||'[]');
}
function setSessoes(arr){
  localStorage.setItem('sessoes', JSON.stringify(arr));
}

/* ========= Salvar sessão (local + nuvem) ========= */
function salvarSessaoAtual(duracao){
  const hoje = new Date();
  const dataStr = hoje.toISOString().slice(0,10);
  const diaKey = document.querySelector('.tab-btn.active')?.dataset.dia || DIAS_MAP[hoje.getDay()];
  const exercicios = coletarInputsExercicios(); // {nome,peso,reps,obs}

  // garante 1 sessão por dia
  const sess = getSessoes().filter(s => s.data!==dataStr);
  const salva = {data:dataStr, duracao:duracao||0, dia:diaKey, exercicios};
  sess.push(salva);
  setSessoes(sess);

  marcarHojeNoCalendario();
  document.getElementById('statusSave').textContent = '✅ Sessão salva!';
  setTimeout(()=>document.getElementById('statusSave').textContent='',2000);

  // envia à nuvem se logado
  cloudUpsertSession(salva).then(()=>updateSyncInfo('Sincronizado')).catch(()=>updateSyncInfo('Offline'));
  refreshGraficosSeAbaAberta(exercicios);
}

function adicionarSessaoVazia(dataStr){
  const sess = getSessoes();
  if(!sess.find(s=>s.data===dataStr)){
    const nova = {data:dataStr, duracao:0, dia:null, exercicios:[]};
    sess.push(nova);
    setSessoes(sess);
    cloudUpsertSession(nova).catch(()=>{});
  }
}
function removerSessaoPorData(dataStr){
  const sess = getSessoes().filter(s=>s.data!==dataStr);
  setSessoes(sess);
  cloudDeleteSessionByDate(dataStr).catch(()=>{});
}
function marcarHojeNoCalendario(){
  const hoje = new Date();
  if(hoje.getFullYear()===viewAno && hoje.getMonth()===viewMes){
    const diaSel = String(hoje.getDate()).padStart(2,'0');
    const el = [...document.querySelectorAll('.dia')].find(d=>d.dataset.dia===diaSel);
    if(el){ el.classList.remove('nao-treino'); el.classList.add('treino'); }
  }
}

/* ========= UI do Treino (tabs + exercícios) ========= */
const tabs = document.querySelectorAll('.tab-btn');
const listaExEl = document.getElementById('listaExercicios');
const treinoDoDiaEl = document.getElementById('treinoDoDia');
const salvarBtn = document.getElementById('salvarTreino');

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
  // Prefill com última carga do exercício (do histórico local)
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
    const field = el.dataset.field; // 'peso' 'reps' 'obs'
    map[nome] = map[nome] || {nome};
    map[nome][field] = el.value;
  });
  return Object.values(map);
}

// iniciar com dia de hoje selecionado
(function initTreinoTabs(){
  const d = new Date().getDay(); // 1..5 úteis
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
if(salvarBtn){
  salvarBtn.addEventListener('click', ()=> salvarSessaoAtual(null));
}

/* ========= GRÁFICOS ========= */
let chart;
const selectEx = document.getElementById('selectExercicio');
const listaUltimas = document.getElementById('listaUltimas');
const prEx = document.getElementById('prExercicio');
const qtdSessEx = document.getElementById('qtdSessoesEx');

function popularListaExerciciosChart(){
  const nomes = new Set();
  // Prioriza exercícios com dados salvos
  getSessoes().forEach(s => (s.exercicios||[])
    .filter(e => e.peso && !isNaN(Number(e.peso)))
    .forEach(e=>nomes.add(e.nome)));
  // Completa com lista base
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

// Atualiza gráficos automaticamente ao salvar
function refreshGraficosSeAbaAberta(exerciciosDaSessao){
  const graficosVisivel = document.getElementById('graficos').style.display !== 'none';
  if(!graficosVisivel) return;
  popularListaExerciciosChart();
  const ultimoComPeso = [...(exerciciosDaSessao||[])].reverse()
    .find(e => e.peso && !isNaN(Number(e.peso)));
  if(ultimoComPeso && document.getElementById('selectExercicio')){
    document.getElementById('selectExercicio').value = ultimoComPeso.nome;
  }
  desenharGrafico();
}

/* ========= Login & Nuvem (Firebase) ========= */
const btnLoginGoogle = document.getElementById('btnLoginGoogle');
const btnLogout = document.getElementById('btnLogout');
const userStatus = document.getElementById('userStatus');
const syncInfo = document.getElementById('syncInfo');

function updateSyncInfo(msg){ if(syncInfo) syncInfo.textContent = `Sincronização: ${msg}`; }

let auth=null, db=null, user=null;
if (window.firebase && firebase.apps?.length){
  auth = firebase.auth();
  db = firebase.firestore();

  auth.onAuthStateChanged(async (u)=>{
    user = u || null;
    if(user){
      userStatus.textContent = `Conectado: ${user.displayName||user.email}`;
      btnLogout.disabled = false;
      btnLoginGoogle.disabled = true;
      updateSyncInfo('Conectado');
      // Sincroniza: baixa nuvem -> mescla -> salva local
      await cloudPullMerge();
    }else{
      userStatus.textContent = 'Desconectado';
      btnLogout.disabled = true;
      btnLoginGoogle.disabled = false;
      updateSyncInfo('Offline');
    }
  });

  if(btnLoginGoogle){
    btnLoginGoogle.addEventListener('click', async ()=>{
      try{
        const provider = new firebase.auth.GoogleAuthProvider();
        await auth.signInWithPopup(provider);
      }catch(e){ alert('Erro no login: ' + e.message); }
    });
  }
  if(btnLogout){
    btnLogout.addEventListener('click', async ()=>{
      await auth.signOut();
    });
  }
}else{
  // Firebase não configurado ainda
  if(userStatus) userStatus.textContent = 'Firebase não configurado';
}

/* ======= Firestore helpers ======= */
// Caminho: users/{uid}/sessoes/{data}
function sessionsColl(){
  if(!db || !user) return null;
  return db.collection('users').doc(user.uid).collection('sessoes');
}
async function cloudUpsertSession(sess){
  const col = sessionsColl(); if(!col) return;
  await col.doc(sess.data).set(sess, {merge:true});
}
async function cloudDeleteSessionByDate(dateStr){
  const col = sessionsColl(); if(!col) return;
  await col.doc(dateStr).delete();
}
async function cloudFetchAll(){
  const col = sessionsColl(); if(!col) return [];
  const snap = await col.orderBy('data').get();
  return snap.docs.map(d=>d.data());
}
async function cloudPullMerge(){
  try{
    const remoto = await cloudFetchAll(); // array
    const local = getSessoes();           // array
    const byDate = new Map();
    // junta: data única; desempate: maior duração
    [...local, ...remoto].forEach(s=>{
      const key = s.data;
      const existing = byDate.get(key);
      if(!existing) byDate.set(key, s);
      else{
        const a = existing.duracao||0, b = s.duracao||0;
        byDate.set(key, (b>a ? s : existing));
      }
    });
    const merged = [...byDate.values()].sort((a,b)=>a.data.localeCompare(b.data));
    setSessoes(merged);
    // garante que nuvem tenha tudo
    for(const s of merged){ await cloudUpsertSession(s); }
    montarCalendario(); // refaz marcações
    updateSyncInfo('Sincronizado');
  }catch(e){
    updateSyncInfo('Falha ao sincronizar');
  }
}

/* ======= Export/Import local ======= */
const btnExport = document.getElementById('btnExport');
const btnImport = document.getElementById('btnImport');
const fileImport = document.getElementById('fileImport');

if(btnExport){
  btnExport.addEventListener('click', ()=>{
    const blob = new Blob([JSON.stringify(getSessoes(), null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `sessoes_${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  });
}
if(btnImport && fileImport){
  btnImport.addEventListener('click', ()=> fileImport.click());
  fileImport.addEventListener('change', async ()=>{
    const file = fileImport.files[0]; if(!file) return;
    const text = await file.text();
    try{
      const json = JSON.parse(text);
      if(Array.isArray(json)){
        // Mescla com local
        const byDate = new Map();
        [...getSessoes(), ...json].forEach(s=>{
          const key = s.data;
          const ex = byDate.get(key);
          if(!ex) byDate.set(key, s);
          else{ byDate.set(key, (s.duracao||0) > (ex.duracao||0) ? s : ex); }
        });
        const merged = [...byDate.values()].sort((a,b)=>a.data.localeCompare(b.data));
        setSessoes(merged);
        montarCalendario();
        updateSyncInfo('Importado (local)');
        // sobe para nuvem se logado
        if(user){
          for(const s of merged){ await cloudUpsertSession(s); }
          updateSyncInfo('Importado e sincronizado');
        }
      }else{
        alert('Arquivo inválido.');
      }
    }catch(e){ alert('Erro ao ler JSON: ' + e.message); }
  });
}
