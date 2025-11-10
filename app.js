/*
  Arquivo principal do aplicativo "Meu Treino".

  Este script coordena toda a interface, persistência local, lógica
  de progressão e comunicação com o módulo de gráficos e com o
  Firebase (quando habilitado). A intenção é que todo o fluxo
  continue funcionando 100% offline; a nuvem apenas sincroniza
  alterações quando o usuário opta por fazer login.
*/

import { enableFirebase, onAuthChange, loginWithGoogle, logout } from './firebase.js';
import { computeMaxLoadData, compute1RMData, computeWeeklyVolumeData, computePRs, drawLineChart, drawBarChart } from './charts.js';

/* === Utilitários de consulta de elementos === */
const qs = sel => document.querySelector(sel);
const qsa = sel => [...document.querySelectorAll(sel)];

/* === Configuração dos treinos (split do usuário) === */
// Cada entrada representa o plano de treino para um dia específico.
const TREINOS = {
  segunda: [
    { nome:'Puxada triângulo alta', alvo:'3×8–12' },
    { nome:'Puxada barra reta alta', alvo:'3×8–12' },
    { nome:'Remada máquina', alvo:'3×8–12' },
    { nome:'Rosca direta barra', alvo:'3×8–12' },
    { nome:'Martelo', alvo:'3×10–12' },
    { nome:'Banco Scott', alvo:'3×8–12' },
    { nome:'Lombar máquina', alvo:'3×15–20' }
  ],
  terca: [
    { nome:'Supino máquina vertical', alvo:'3×8–12' },
    { nome:'Supino reto com halteres', alvo:'3×8–12' },
    { nome:'Crucifixo reto com halteres', alvo:'3×10–12' },
    { nome:'Supino declinado convergente', alvo:'3×8–12' },
    { nome:'Tríceps francês', alvo:'3×10–12' },
    { nome:'Tríceps polia barra reta', alvo:'3×12–15' }
  ],
  quarta: [
    { nome:'Desenvolvimento máquina', alvo:'3×8–12' },
    { nome:'Elevação lateral', alvo:'3×12–15' },
    { nome:'Crucifixo inverso / Face pull', alvo:'3×12–15' },
    { nome:'Encolhimento trapézio', alvo:'3×12–15' }
  ],
  quinta: [
    { nome:'Hack squat', alvo:'3×8–12' },
    { nome:'Leg press', alvo:'3×10–12' },
    { nome:'Cadeira extensora', alvo:'3×12–15' },
    { nome:'Cadeira flexora', alvo:'3×12–15' },
    { nome:'Mesa flexora', alvo:'3×10–12' },
    { nome:'Panturrilha banco', alvo:'3×15–20' }
  ],
  sexta: [
    { nome:'Rosca direta barra', alvo:'3×8–12' },
    { nome:'Martelo', alvo:'3×10–12' },
    { nome:'Tríceps francês', alvo:'3×10–12' },
    { nome:'Tríceps polia barra reta', alvo:'3×12–15' },
    { nome:'Abdômen (prancha, infra, polia)', alvo:'3 séries' }
  ]
};
// Mapeamento de número do dia da semana (Date.getDay()) para chave da rotina
const DIAS_MAP = { 0:'domingo', 1:'segunda', 2:'terca', 3:'quarta', 4:'quinta', 5:'sexta', 6:'sabado' };

// Conjunto de exercícios de perna para progressão de carga diferenciada
const EXERCICIOS_PERNA = [
  'Hack squat','Leg press','Cadeira extensora','Cadeira flexora','Mesa flexora','Panturrilha banco','Agachamento','Stiff','Cadeira adutora','Cadeira abdutora'
];

/* === Persistência local de sessões === */
function getSessions(){
  const raw = JSON.parse(localStorage.getItem('sessoes') || '[]');
  // migra estrutura antiga: cria sets e campos faltantes
  raw.forEach(sess => {
    (sess.exercicios || []).forEach((e, idx) => {
      // garantir propriedade ordem
      e.ordem = e.ordem ?? (idx + 1);
      if(!Array.isArray(e.sets)){
        const peso = e.peso ?? '';
        const reps = e.reps ?? '';
        e.sets = [
          { n:1, peso, reps, rir:'', done:false, ts:null },
          { n:2, peso, reps, rir:'', done:false, ts:null },
          { n:3, peso, reps, rir:'', done:false, ts:null }
        ];
      } else {
        e.sets = e.sets.map((s,i) => {
          return {
            n: s.n ?? (i + 1),
            peso: s.peso ?? '',
            reps: s.reps ?? '',
            rir: s.rir ?? '',
            done: !!s.done,
            ts: s.ts ?? null
          };
        });
      }
      if(typeof e.obs !== 'string') e.obs = e.obs ?? '';
    });
    // propriedade volume pode não existir; será recalculada ao salvar
    sess.volume = sess.volume ?? 0;
    sess.prHits = sess.prHits ?? [];
  });
  return raw.sort((a,b) => a.data.localeCompare(b.data));
}
function setSessions(arr){
  localStorage.setItem('sessoes', JSON.stringify(arr));
}

/* === Persistência local de hábitos === */
function getHabits(){
  return JSON.parse(localStorage.getItem('habitos') || '{}');
}
function setHabits(obj){
  localStorage.setItem('habitos', JSON.stringify(obj));
}
function updateHabit(dateStr, key, val){
  const habits = getHabits();
  if(!habits[dateStr]) habits[dateStr] = {};
  habits[dateStr][key] = val;
  setHabits(habits);
}
function computeHabitStreak(key){
  const habits = getHabits();
  let count = 0;
  const date = new Date();
  while(true){
    const iso = date.toISOString().slice(0,10);
    if(habits[iso] && habits[iso][key]){
      count++;
      date.setDate(date.getDate() - 1);
    }else{
      break;
    }
  }
  return count;
}

/* === Tema Claro/Escuro === */
(function initTheme(){
  const saved = localStorage.getItem('theme') || 'dark';
  if(saved === 'dark'){ document.documentElement.classList.add('dark'); }
  qs('#btnTheme').textContent = document.documentElement.classList.contains('dark') ? '☀️' : '🌙';
})();

qs('#btnTheme').addEventListener('click', () => {
  document.documentElement.classList.toggle('dark');
  const dark = document.documentElement.classList.contains('dark');
  localStorage.setItem('theme', dark ? 'dark' : 'light');
  qs('#btnTheme').textContent = dark ? '☀️' : '🌙';
});

/* === Notificações === */
let notifReady = false;
async function ensureNotifyPermission(){
  if(!('Notification' in window)) return false;
  if(Notification.permission === 'granted'){ notifReady = true; return true; }
  if(Notification.permission !== 'denied'){
    const p = await Notification.requestPermission();
    notifReady = (p === 'granted');
    return notifReady;
  }
  return false;
}
function notify(title, body){
  if(notifReady){
    try{ new Notification(title, { body }); }catch(_){}
  }
}
qs('#btnNotify').addEventListener('click', async () => {
  const ok = await ensureNotifyPermission();
  qs('#btnNotify').textContent = ok ? '🔔' : '🔕';
});

/* === Audio/Vibração para descanso === */
let audioCtx = null;
function ensureAudioCtx(){
  if(!audioCtx){
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = AC ? new AC() : null;
  }
  if(audioCtx?.state === 'suspended'){ audioCtx.resume?.(); }
}
function beep(times = 3, freq = 880, dur = 200){
  if(!audioCtx) return;
  let t = 0;
  for(let i=0;i<times;i++){
    setTimeout(() => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.frequency.value = freq; o.type = 'sine';
      o.connect(g); g.connect(audioCtx.destination);
      g.gain.setValueAtTime(0.001, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.4, audioCtx.currentTime + 0.01);
      o.start(); setTimeout(() => { o.stop(); }, dur);
    }, t);
    t += dur + 120;
  }
}

/* === Timer principal de treino === */
let timerId = null;
let startEpoch = Number(localStorage.getItem('sessionStart') || 0);
const timerEl = qs('#timer');
function tick(){
  if(!startEpoch) return;
  const sec = Math.floor((Date.now() - startEpoch) / 1000);
  if(timerEl) timerEl.textContent = fmtDuracao(sec);
}
function startSessionIfNeeded(){
  if(!startEpoch){
    startEpoch = Date.now();
    localStorage.setItem('sessionStart', String(startEpoch));
  }
  if(!timerId){ timerId = setInterval(tick, 1000); }
  qs('#btnTimer').textContent = 'Finalizar';
}
function stopSession(){
  if(timerId){ clearInterval(timerId); timerId = null; }
  startEpoch = 0;
  localStorage.removeItem('sessionStart');
  qs('#btnTimer').textContent = 'Iniciar';
  if(timerEl) timerEl.textContent = '00:00:00';
}
tick();
if(startEpoch) timerId = setInterval(tick, 1000);
qs('#btnTimer').addEventListener('click', () => {
  if(timerId){
    // finalizar sessão e salvar duração
    clearInterval(timerId); timerId = null;
    const duracao = Math.floor((Date.now() - startEpoch) / 1000);
    stopSession();
    salvarSessaoAtual(duracao);
  }else{
    startSessionIfNeeded();
  }
});

/* === Descanso automático === */
let restId = null;
let restLeft = 0;
let beepLoop = null;
const restSeg = qs('#restSeg');
const restDisplay = qs('#restDisplay');
const overlay = qs('#restOverlay');
function iniciarDescansoAuto(segundos){
  if(restId){ clearInterval(restId); restId = null; }
  ensureAudioCtx();
  ensureNotifyPermission();
  restLeft = Math.max(10, Number(segundos || restSeg.value || 60));
  restDisplay.textContent = `${restLeft}s`;
  restId = setInterval(() => {
    restLeft--; restDisplay.textContent = `${restLeft}s`;
    if(restLeft <= 0){
      clearInterval(restId); restId = null;
      restDisplay.textContent = '⏰ Descanso finalizado!';
      try{ navigator.vibrate && navigator.vibrate([250,120,250,120,400]); }catch(_){}
      beep(3, 1100, 220);
      overlay.classList.remove('hidden');
      notify('Descanso finalizado!', 'Vamos para a próxima série.');
      beepLoop = setInterval(() => { ensureAudioCtx(); beep(1, 1200, 180); }, 1200);
      const baseTitle = document.title; let f = 0;
      const blink = setInterval(() => { document.title = (++f % 2) ? '⏰ Descanso!' : baseTitle; if(f > 10){ clearInterval(blink); document.title = baseTitle; } }, 500);
    }
  }, 1000);
}
qs('#btnRest').addEventListener('click', () => {
  if(restId){
    clearInterval(restId); restId = null; restDisplay.textContent = '—';
    clearInterval(beepLoop); beepLoop = null; overlay.classList.add('hidden');
    return;
  }
  iniciarDescansoAuto(Number(restSeg.value || 60));
});
qs('#btnOverlayOk').addEventListener('click', () => {
  overlay.classList.add('hidden'); clearInterval(beepLoop); beepLoop = null;
});
qs('#btnOverlayBuzz').addEventListener('click', () => {
  try{ navigator.vibrate && navigator.vibrate([200,100,300]); }catch(_){}
  ensureAudioCtx(); beep(2, 1250, 200);
});

/* === Calendário e resumo === */
let viewAno, viewMes;
const mesLabel = qs('#mesAno');
const calEl = qs('#calendario');
qs('#prevMes').addEventListener('click', () => {
  viewMes--; if(viewMes < 0){ viewMes = 11; viewAno--; }
  montarCalendario();
});
qs('#proxMes').addEventListener('click', () => {
  viewMes++; if(viewMes > 11){ viewMes = 0; viewAno++; }
  montarCalendario();
});
(function initCalendar(){
  const hoje = new Date();
  viewAno = hoje.getFullYear();
  viewMes = hoje.getMonth();
  montarCalendario();
})();
function montarCalendario(){
  mesLabel.textContent = new Date(viewAno, viewMes).toLocaleString('pt-BR', { month:'long', year:'numeric' });
  calEl.innerHTML = '';
  const first = new Date(viewAno, viewMes, 1);
  const lastDay = new Date(viewAno, viewMes + 1, 0).getDate();
  const offset = first.getDay();
  for(let i=0;i<offset;i++){
    const d = document.createElement('div'); d.className = 'dia fora'; calEl.appendChild(d);
  }
  const hoje = new Date();
  const setDatas = new Set(getSessions().map(s => s.data));
  for(let dia=1; dia<=lastDay; dia++){
    const d = document.createElement('div');
    d.className = 'dia'; d.dataset.dia = String(dia).padStart(2, '0');
    d.textContent = dia;
    const dataStr = `${viewAno}-${String(viewMes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
    if(setDatas.has(dataStr)) d.classList.add('treino'); else d.classList.add('nao-treino');
    if(dia === hoje.getDate() && viewMes === hoje.getMonth() && viewAno === hoje.getFullYear()) d.classList.add('hoje');
    // clique para alternar marcação manual
    d.addEventListener('click', () => {
      const sess = getSessions();
      if(d.classList.contains('treino')){
        d.classList.remove('treino'); d.classList.add('nao-treino');
        setSessions(sess.filter(s => s.data !== dataStr));
      }else{
        d.classList.remove('nao-treino'); d.classList.add('treino');
        // cria sessão vazia (sem exercícios) apenas para marcar no calendário
        if(!sess.find(s => s.data === dataStr)){
          sess.push({ data:dataStr, duracao:0, splitDia:null, exercicios:[], volume:0, prHits:[] });
          setSessions(sess);
        }
      }
      atualizarResumoHome();
    });
    calEl.appendChild(d);
  }
  atualizarResumoHome();
}

function atualizarResumoHome(){
  const sess = getSessions().filter(s => {
    const dt = new Date(s.data);
    return dt.getFullYear() === viewAno && dt.getMonth() === viewMes;
  });
  qs('#diasTreinadosMes').textContent = new Set(sess.map(s => s.data)).size;
  const ult = getSessions().slice(-1)[0];
  qs('#ultimoTreino').textContent = ult ? `${ult.data} (${fmtDuracao(ult.duracao||0)})` : '—';
  const dur = getSessions().map(s => s.duracao || 0);
  const media = dur.length ? Math.round(dur.reduce((a,b) => a+b, 0) / dur.length) : 0;
  qs('#duracaoMedia').textContent = dur.length ? fmtDuracao(media) : '—';
  // calcular streak de treinos (dias consecutivos com sessões)
  const today = new Date();
  let streak = 0;
  while(true){
    const str = today.toISOString().slice(0,10);
    if(getSessions().find(s => s.data === str)){
      streak++;
      today.setDate(today.getDate() - 1);
    }else{
      break;
    }
  }
  qs('#treinoStreak').textContent = streak;
}

/* === Navegação entre páginas === */
window.mostrarPagina = function(id){
  qsa('.pagina').forEach(p => p.style.display = 'none');
  const el = qs('#'+id);
  if(el) el.style.display = 'block';
  if(id === 'graficos'){ atualizarEvolucaoUI(); }
  if(id === 'home'){ atualizarResumoHome(); }
  if(id === 'perfil'){ atualizarPerfilUI(); }
  // persistir escolha de página? não necessário
};

/* === Inicio rápido do treino a partir da home === */
qs('#btnStartTreino').addEventListener('click', () => {
  // Seleciona automaticamente o tab do dia atual
  const hoje = new Date();
  const diaKey = DIAS_MAP[hoje.getDay()] || 'segunda';
  const tab = [...qsa('#diasTabs .tab-btn')].find(b => b.dataset.dia === diaKey);
  if(tab){
    qsa('#diasTabs .tab-btn').forEach(b => b.classList.remove('active'));
    tab.classList.add('active');
    montarExercicios(diaKey);
  }
  mostrarPagina('treino');
});

/* === Construção da interface de treino (exercícios e séries) === */
const listaExEl = qs('#listaExercicios');
const treinoDoDiaEl = qs('#treinoDoDia');
const salvarBtn = qs('#salvarTreino');
const copyBtn = qs('#btnCopyLast');

// Tabs para seleção de dia da divisão
qsa('#diasTabs .tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    qsa('#diasTabs .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    montarExercicios(btn.dataset.dia);
  });
});
copyBtn.addEventListener('click', () => {
  const key = qs('#diasTabs .tab-btn.active')?.dataset.dia || 'segunda';
  preencherComUltima(key);
});

/** Cria/acha contêiner do resumo de tonelagem (kg×reps do dia). */
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

function escapeAttr(val){
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderSetRow(nome, index, data = {}){
  const peso = data?.peso ?? '';
  const reps = data?.reps ?? '';
  const rir = data?.rir ?? '';
  return `
    <div class="set" data-ex="${escapeAttr(nome)}" data-set="${index}">
      <span class="tag">S${index + 1}</span>
      <input type="number" step="0.5" placeholder="kg" class="inp peso" data-ex="${escapeAttr(nome)}" data-set="${index}" value="${escapeAttr(peso)}" />
      <input type="number" placeholder="reps" class="inp reps" data-ex="${escapeAttr(nome)}" data-set="${index}" value="${escapeAttr(reps)}" />
      <input type="number" placeholder="RIR" class="inp rir" data-ex="${escapeAttr(nome)}" data-set="${index}" value="${escapeAttr(rir)}" />
      <button class="tick" type="button" data-ex="${escapeAttr(nome)}" data-set="${index}" aria-label="Marcar série">✓</button>
    </div>
  `;
}

function createSetRow(nome, index, data = {}){
  const tpl = document.createElement('template');
  tpl.innerHTML = renderSetRow(nome, index, data).trim();
  return tpl.content.firstElementChild;
}

function wireSetRow(row){
  if(!row || row.dataset.wired) return;
  row.dataset.wired = '1';
  const nome = row.dataset.ex;
  const tick = row.querySelector('.tick');
  tick?.addEventListener('click', () => {
    startSessionIfNeeded();
    row.classList.toggle('done');
    if(row.classList.contains('done')){
      row.dataset.ts = new Date().toISOString();
    }else{
      delete row.dataset.ts;
    }
    iniciarDescansoAuto();
    atualizarTonelagemDoDia();
    if(nome) atualizarPrBadges(nome);
  });
  row.querySelectorAll('.inp').forEach(inp => {
    const nomeEx = inp.dataset.ex;
    inp.addEventListener('input', () => {
      atualizarTonelagemDoDia();
      if(nomeEx) atualizarPrBadges(nomeEx);
    });
    if(row.dataset.set === '0'){
      inp.addEventListener('change', () => {
        const field = inp.classList.contains('peso') ? '.peso' : inp.classList.contains('reps') ? '.reps' : '.rir';
        const val = inp.value;
        qsa(`.sets[data-ex="${CSS.escape(nomeEx)}"] .set`).forEach(other => {
          if(other === row) return;
          const target = other.querySelector(field);
          if(target && !target.value) target.value = val;
        });
        atualizarTonelagemDoDia();
        if(nomeEx) atualizarPrBadges(nomeEx);
      });
    }
  });
}

function ensureSetRows(nomeEx, count){
  const setsContainer = qs(`.sets[data-ex="${CSS.escape(nomeEx)}"]`);
  if(!setsContainer) return;
  while(setsContainer.querySelectorAll('.set').length < count){
    const i = setsContainer.querySelectorAll('.set').length;
    const row = createSetRow(nomeEx, i);
    setsContainer.appendChild(row);
    wireSetRow(row);
  }
}

/** Monta os cartões de exercícios para o dia selecionado. */
function montarExercicios(diaKey){
  const arr = TREINOS[diaKey] || [];
  treinoDoDiaEl.textContent = `Dia selecionado: ${labelDia(diaKey)} · Registre as cargas, reps e RIR.`;
  listaExEl.innerHTML = '';
  // pré-computar PRs para cada exercício
  const historico = getSessions();
  const prsMap = {};
  arr.forEach(ex => {
    prsMap[ex.nome] = computePRs(historico, ex.nome, 180); // últimos 6 meses para referência
  });
  arr.forEach(ex => {
    // última entrada para prefill
    const last = ultimaEntrada(ex.nome);
    // base sets: clone das últimas sets ou padrão vazio
    const baseSets = last?.sets?.length ? last.sets.map(s => ({ peso: s.peso ?? '', reps: s.reps ?? '', rir: s.rir ?? '' })) : [
      { peso:'', reps:'', rir:'' },
      { peso:'', reps:'', rir:'' },
      { peso:'', reps:'', rir:'' }
    ];
    const totalSets = Math.max(3, baseSets.length);
    const card = document.createElement('div');
    card.className = 'ex-card';
    // sugestão de próximo peso
    const sug = sugerirProximoPeso(ex.nome);
    card.innerHTML = `
      <div class="ex-head">
        <div><b>${ex.nome}</b><br><small>${ex.alvo}</small></div>
        <div class="muted next-peso">Próximo: ${sug ? sug : '-'} kg</div>
      </div>
      <div class="sets" data-ex="${ex.nome}">
        ${Array.from({ length: totalSets }, (_, i) => renderSetRow(ex.nome, i, baseSets[i] || {})).join('')}
      </div>
      <button class="add-set small ghost" type="button" data-ex="${ex.nome}">+ Série</button>
      <div class="obs-wrap"><textarea rows="1" placeholder="obs" data-field="obs" data-ex="${ex.nome}">${last?.obs ?? ''}</textarea></div>
    `;
    listaExEl.appendChild(card);
    const setsContainer = card.querySelector('.sets');
    setsContainer?.querySelectorAll('.set').forEach(row => wireSetRow(row));
    const addBtn = card.querySelector('.add-set');
    addBtn?.addEventListener('click', () => {
      const nome = addBtn.dataset.ex;
      const current = setsContainer?.querySelectorAll('.set').length ?? 0;
      const row = createSetRow(nome, current);
      setsContainer?.appendChild(row);
      wireSetRow(row);
    });
  });
  ensureTonelagemBox();
  atualizarTonelagemDoDia();
  // adicionar PR badges iniciais
  arr.forEach(ex => atualizarPrBadges(ex.nome));
}

function labelDia(key){
  return { segunda:'Segunda (Costas+Bíceps)', terca:'Terça (Peito+Tríceps)', quarta:'Quarta (Ombro)', quinta:'Quinta (Perna)', sexta:'Sexta (Braços+Abs)' }[key] || key;
}

/** Recupera a última entrada registrada para um exercício. */
function ultimaEntrada(nomeEx){
  const hist = getSessions();
  for(let i = hist.length - 1; i >= 0; i--){
    const e = hist[i].exercicios?.find(x => x.nome === nomeEx);
    if(e) return e;
  }
  return null;
}

/** Preenche o treino atual com os valores da última sessão do mesmo dia. */
function preencherComUltima(diaKey){
  const arr = TREINOS[diaKey] || [];
  const hist = getSessions();
  arr.forEach(ex => {
    const last = hist.slice().reverse().map(s => s.exercicios || []).flat().find(e => e.nome === ex.nome);
    if(last){
      const totalSets = Array.isArray(last.sets) ? last.sets.length : 0;
      if(totalSets > 0) ensureSetRows(ex.nome, totalSets);
      last.sets?.forEach((s,i) => {
        const rowSel = `.sets[data-ex="${CSS.escape(ex.nome)}"] .set[data-set="${i}"]`;
        const p = qs(`${rowSel} .peso`);
        const r = qs(`${rowSel} .reps`);
        const rir = qs(`${rowSel} .rir`);
        if(p) p.value = s.peso ?? '';
        if(r) r.value = s.reps ?? '';
        if(rir) rir.value = s.rir ?? '';
        const row = qs(rowSel);
        if(row){
          row.classList.remove('done');
          delete row.dataset.ts;
        }
      });
      const obs = qs(`textarea[data-field="obs"][data-ex="${CSS.escape(ex.nome)}"]`);
      if(obs) obs.value = last.obs ?? '';
    }
  });
  atualizarTonelagemDoDia();
  arr.forEach(ex => atualizarPrBadges(ex.nome));
}

/** Calcula a tonelagem (kg×reps) de um exercício a partir da UI. */
function tonelagemExercicioFromUI(nome){
  let total = 0;
  qsa(`.sets[data-ex="${CSS.escape(nome)}"] .set`).forEach(row => {
    if(row.classList.contains('done')){
      const kg = Number(row.querySelector('.peso')?.value || 0);
      const reps = Number(row.querySelector('.reps')?.value || 0);
      if(kg > 0 && reps > 0) total += kg * reps;
    }
  });
  return total;
}
function atualizarTonelagemDoDia(){
  const exs = [...new Set([...qsa('.sets')].map(s => s.dataset.ex))];
  let html = '';
  let totalDia = 0;
  exs.forEach(n => {
    const t = tonelagemExercicioFromUI(n);
    if(t > 0){ html += `<div>${n}: <b>${t}</b> kg·reps</div>`; totalDia += t; }
  });
  if(!html) html = '—';
  ensureTonelagemBox();
  qs('#tonelagemLista').innerHTML = html + (totalDia ? `<div style="margin-top:6px"><b>Total do dia:</b> ${totalDia} kg·reps</div>` : '');
}

/** Sugere o próximo peso com base na sessão mais recente. */
function sugerirProximoPeso(nomeEx){
  const hist = getSessions().slice().reverse();
  for(const s of hist){
    const e = s.exercicios?.find(x => x.nome === nomeEx);
    if(e){
      // soma reps totais e verifica se todas as 3 séries têm 12 reps ou total ≥34 dentro do range 8-12
      const repsArr = e.sets?.map(z => Number(z.reps || 0)) || [];
      const pesoArr = e.sets?.map(z => Number(z.peso || 0)) || [];
      const lastKg = Math.max(...pesoArr, 0);
      const totalReps = repsArr.reduce((a,b) => a + b, 0);
      const all12 = repsArr.length >= 3 && repsArr.every(r => r >= 12);
      if(lastKg && (all12 || totalReps >= 34)){
        const incremento = EXERCICIOS_PERNA.some(n => n.toLowerCase() === nomeEx.toLowerCase()) ? 5 : 2;
        return lastKg + incremento;
      }else{
        return '';
      }
    }
  }
  return '';
}

/** Atualiza o badge de PR na interface para um exercício específico. */
function atualizarPrBadges(nomeEx){
  // calcula recordes a partir do histórico
  const hist = getSessions();
  const prs = computePRs(hist, nomeEx, 180);
  const bestKg = prs.bestKg.val || 0;
  const bestReps = prs.bestReps.val || 0;
  const bestRm = prs.bestRm.val || 0;
  // percorre sets atuais
  qsa(`.sets[data-ex="${CSS.escape(nomeEx)}"] .set`).forEach(row => {
    // remove badge existente
    row.querySelectorAll('.pr-badge').forEach(b => b.remove());
    const kg = Number(row.querySelector('.peso')?.value || 0);
    const reps = Number(row.querySelector('.reps')?.value || 0);
    if(kg > 0 && reps > 0){
      let isPr = false;
      // novo recorde de carga
      if(kg > bestKg){ isPr = true; }
      // novo recorde de reps na mesma carga
      if(kg === bestKg && reps > bestReps){ isPr = true; }
      // novo recorde de 1RM
      const rm = kg * (1 + reps / 30);
      if(rm > bestRm){ isPr = true; }
      if(isPr){
        const badge = document.createElement('span');
        badge.className = 'pr-badge';
        badge.textContent = '🏆';
        row.querySelector('.tick')?.insertAdjacentElement('afterend', badge);
      }
    }
  });
}

/* === Salvar sessão atual === */
salvarBtn.addEventListener('click', () => salvarSessaoAtual(null));

function coletarInputsExercicios(){
  const map = {}; // nome -> objeto com sets, obs
  qsa('.sets').forEach(box => {
    const nome = box.dataset.ex;
    map[nome] = map[nome] || { nome, ordem: Array.from(box.parentElement.parentElement.children).indexOf(box.parentElement), sets: [], obs:'' };
    box.querySelectorAll('.set').forEach(setEl => {
      const i = Number(setEl.dataset.set);
      const peso = setEl.querySelector('.peso')?.value || '';
      const reps = setEl.querySelector('.reps')?.value || '';
      const rir = setEl.querySelector('.rir')?.value || '';
      const done = setEl.classList.contains('done');
      const ts = setEl.dataset.ts || null;
      map[nome].sets[i] = { n: i+1, peso, reps, rir, done, ts };
    });
  });
  // obs
  qsa('textarea[data-field="obs"]').forEach(t => {
    const nome = t.dataset.ex;
    if(map[nome]) map[nome].obs = t.value;
  });
  return Object.values(map);
}

function salvarSessaoAtual(duracaoParam){
  // calcula duração final
  let duracaoFinal = 0;
  if(duracaoParam != null){ duracaoFinal = duracaoParam; }
  else if(startEpoch){ duracaoFinal = Math.floor((Date.now() - startEpoch) / 1000); }
  const hoje = new Date();
  const dataStr = hoje.toISOString().slice(0,10);
  const diaKey = qs('#diasTabs .tab-btn.active')?.dataset.dia || DIAS_MAP[hoje.getDay()];
  const exercicios = coletarInputsExercicios();
  // calcula volume total (kg×reps de sets marcadas) e PRs
  let volume = 0;
  const prHits = [];
  exercicios.forEach(ex => {
    ex.sets.forEach(z => {
      const kg = Number(z.peso || 0);
      const reps = Number(z.reps || 0);
      if(kg > 0 && reps > 0 && z.done){ volume += kg * reps; }
    });
    // detectar PRs
    const hist = getSessions();
    const prs = computePRs(hist, ex.nome, 9999);
    ex.sets.forEach(z => {
      const kg = Number(z.peso || 0);
      const reps = Number(z.reps || 0);
      if(kg > 0 && reps > 0){
        const rm = kg * (1 + reps / 30);
        let tipo = null;
        if(kg > prs.bestKg.val) tipo = 'carga';
        else if(kg === prs.bestKg.val && reps > prs.bestReps.val) tipo = 'reps';
        else if(rm > prs.bestRm.val) tipo = '1rm';
        if(tipo){ prHits.push({ ex: ex.nome, tipo, valor: tipo === '1rm' ? Number(rm.toFixed(2)) : (tipo === 'carga' ? kg : reps), data: hoje.toISOString() }); }
      }
    });
  });
  const nova = { data: dataStr, duracao: duracaoFinal || 0, splitDia: diaKey, exercicios, volume, prHits };
  const sess = getSessions().filter(s => s.data !== dataStr);
  sess.push(nova);
  sess.sort((a,b) => a.data.localeCompare(b.data));
  setSessions(sess);
  // marca o dia no calendário
  marcarHojeNoCalendario();
  qs('#statusSave').textContent = '✅ Sessão salva!';
  setTimeout(() => qs('#statusSave').textContent = '', 2000);
  desenharGraficos();
  preencherSessoesDetalhe();
  // encerra timer principal
  stopSession();
}

function marcarHojeNoCalendario(){
  const hoje = new Date();
  const y = hoje.getFullYear();
  const m = hoje.getMonth();
  if(y === viewAno && m === viewMes){
    const diaSel = String(hoje.getDate()).padStart(2, '0');
    const el = [...document.querySelectorAll('.dia')].find(d => d.dataset.dia === diaSel);
    if(el){ el.classList.remove('nao-treino'); el.classList.add('treino'); }
  }
  atualizarResumoHome();
}

/* === Evolução === */
const selectEx = qs('#selectExercicio');
const periodoSel = qs('#periodo');
const chartArea = qs('#chartArea');
const prListEl = qs('#prList');
let filtroDia = 'all';
// criar lista de exercícios para seleção
function popularListaExerciciosChart(){
  const nomes = new Set();
  getSessions().forEach(s => (s.exercicios || []).forEach(e => nomes.add(e.nome)));
  Object.values(TREINOS).flat().forEach(e => nomes.add(e.nome));
  selectEx.innerHTML = '';
  [...nomes].sort().forEach(n => {
    const op = document.createElement('option'); op.value = n; op.textContent = n; selectEx.appendChild(op);
  });
}
selectEx.addEventListener('change', () => { desenharGraficos(); preencherSessoesDetalhe(); });
periodoSel.addEventListener('change', () => { desenharGraficos(); preencherSessoesDetalhe(); });
// trocar tipo de gráfico
qsa('.chart-type').forEach(btn => {
  btn.addEventListener('click', () => {
    qsa('.chart-type').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    desenharGraficos();
  });
});

function getFiltroDia(){ return filtroDia; }

function desenharGraficos(){
  const tipo = qs('.chart-type.active')?.dataset.type || 'max';
  const ex = selectEx.value;
  const period = periodoSel.value;
  const sessions = getSessions();
  const ctx = qs('#mainChart').getContext('2d');
  prListEl.style.display = 'none';
  qs('#mainChart').style.display = 'block';
  if(!ex) return;
  if(tipo === 'max'){
    const { labels, values } = computeMaxLoadData(sessions, ex, period, getFiltroDia());
    drawLineChart(ctx, labels, values, `${ex} (kg)`);
  }else if(tipo === '1rm'){
    const { labels, values } = compute1RMData(sessions, ex, period, getFiltroDia());
    drawLineChart(ctx, labels, values, `${ex} 1RM Est.`);
  }else if(tipo === 'volume'){
    const { labels, values } = computeWeeklyVolumeData(sessions, period, getFiltroDia());
    drawBarChart(ctx, labels, values, 'Volume semanal (kg·reps)');
  }else if(tipo === 'prs'){
    // exibir lista de recordes pessoais
    qs('#mainChart').style.display = 'none';
    prListEl.style.display = 'block';
    const prs = computePRs(sessions, ex, period);
    prListEl.innerHTML = '<ul>' + [
      prs.bestKg.val ? `<li><b>Carga:</b> ${prs.bestKg.val} kg (${prs.bestKg.data})</li>` : '',
      prs.bestReps.val ? `<li><b>Reps:</b> ${prs.bestReps.val} reps @ ${prs.bestReps.kg} kg (${prs.bestReps.data})</li>` : '',
      prs.bestRm.val ? `<li><b>1RM:</b> ${prs.bestRm.val} kg (${prs.bestRm.data})</li>` : ''
    ].filter(Boolean).join('') + '</ul>';
  }
}

function preencherSessoesDetalhe(){
  const listaSessoesDetalhe = qs('#listaSessoesDetalhe');
  if(!listaSessoesDetalhe) return;
  const days = Number(periodoSel.value || 90);
  const desde = new Date(); desde.setDate(desde.getDate() - days);
  const arr = getSessions().filter(s => new Date(s.data) >= desde).slice(-12).reverse();
  listaSessoesDetalhe.innerHTML = '';
  arr.forEach(s => {
    const box = document.createElement('div');
    box.className = 'card-mini';
    const title = `${s.data} · ${labelDia(s.splitDia || '')} · ${fmtDuracao(s.duracao || 0)} · Vol: ${s.volume || 0} kg·reps`;
    const lista = (s.exercicios || []).map(e => {
      if(e.sets && e.sets.length){
        const setsStr = e.sets.map((z,i) => `${i+1}:${z.peso||'-'}kg×${z.reps||'-'}${z.done?'✓':''}`).join(' | ');
        return `<li>${e.nome}: ${setsStr}${e.obs ? ` <span class="muted">(${e.obs})</span>` : ''}</li>`;
      }else{
        return `<li>${e.nome}: <b>${e.peso||'-'}</b> kg × <b>${e.reps||'-'}</b>${e.obs ? ` <span class="muted">(${e.obs})</span>` : ''}</li>`;
      }
    }).join('');
    box.innerHTML = `<div><strong>${title}</strong><ul>${lista || '<li class="muted">sem exercícios</li>'}</ul></div>`;
    listaSessoesDetalhe.appendChild(box);
  });
}

function atualizarEvolucaoUI(){
  popularListaExerciciosChart();
  desenharGraficos();
  preencherSessoesDetalhe();
}

/* === Perfil e hábitos === */
const habits = [
  { key:'acordar', label:'Acordar no horário' },
  { key:'cafe', label:'Café da manhã' },
  { key:'creatina', label:'Creatina' },
  { key:'almoco', label:'Almoço' },
  { key:'pre', label:'Pré-treino' },
  { key:'agua', label:'Beber ≥ 2,5 L' },
  { key:'sono7', label:'Dormir > 7h' }
];
function atualizarPerfilUI(){
  const listEl = qs('#habitsList');
  if(!listEl) return;
  listEl.innerHTML = '';
  const todayStr = new Date().toISOString().slice(0,10);
  habits.forEach(h => {
    const item = document.createElement('div');
    item.className = 'habit-item';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!getHabits()[todayStr]?.[h.key];
    input.addEventListener('change', () => {
      updateHabit(todayStr, h.key, input.checked);
      atualizarPerfilUI();
    });
    const label = document.createElement('label'); label.textContent = h.label;
    const streak = document.createElement('span'); streak.className = 'habit-streak'; streak.textContent = `${computeHabitStreak(h.key)}🔥`;
    item.appendChild(input);
    item.appendChild(label);
    item.appendChild(streak);
    listEl.appendChild(item);
  });
}
qs('#btnExport').addEventListener('click', () => {
  const blob = new Blob([localStorage.getItem('sessoes') || '[]'], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sessoes_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
});

/* === Utilitários === */
function fmtDuracao(sec){
  const h = String(Math.floor(sec/3600)).padStart(2,'0');
  const m = String(Math.floor((sec % 3600)/60)).padStart(2,'0');
  const s = String(sec % 60).padStart(2,'0');
  return `${h}:${m}:${s}`;
}

/* === Inicialização da aplicação === */
(async function init(){
  // texto no cabeçalho com treino do dia
  function textoTreinoHoje(){
    const d = new Date().getDay();
    let nome = 'Descanso';
    if(d === 1) nome = 'Costas + Bíceps';
    if(d === 2) nome = 'Peito + Tríceps';
    if(d === 3) nome = 'Ombro';
    if(d === 4) nome = 'Perna';
    if(d === 5) nome = 'Braços + Abs';
    return `Hoje é ${new Date().toLocaleDateString()} · Treino do dia: ${nome}`;
  }
  qs('#subheader').textContent = textoTreinoHoje();
  // popule listas iniciais
  montarExercicios('segunda');
  popularListaExerciciosChart();
  preencherSessoesDetalhe();
  atualizarPerfilUI();
  atualizarResumoHome();
  desenharGraficos();
  // registrar service worker para PWA
  if('serviceWorker' in navigator){
    try{ await navigator.serviceWorker.register('sw.js'); }catch(_){}
  }
})();

// === Auth UI wiring (login opcional via Firebase) ===
(function wireAuthUI(){
  const btnLogin  = document.getElementById('btnLogin');
  const btnLogout = document.getElementById('btnLogout');
  const foto      = document.getElementById('fotoPerfil');
  const nome      = document.getElementById('nomePerfil');
  const email     = document.getElementById('emailPerfil');

  // estado inicial
  btnLogout?.classList.add('hidden');
  if (btnLogin) btnLogin.disabled = !enableFirebase;

  onAuthChange((u)=>{
    if (u) {
      // logado
      nome && (nome.textContent  = u.displayName || 'Logado');
      email && (email.textContent = u.email || '');
      foto &&  (foto.src = u.photoURL || 'icons/apple-touch-icon.png');
      btnLogin?.classList.add('hidden');
      btnLogout?.classList.remove('hidden');
    } else {
      // offline
      nome && (nome.textContent  = 'Modo offline');
      email && (email.textContent = '—');
      foto &&  (foto.src = 'icons/apple-touch-icon.png');
      if (enableFirebase) btnLogin?.classList.remove('hidden');
      btnLogout?.classList.add('hidden');
    }
  });

  btnLogin?.addEventListener('click', async ()=>{
    if (!enableFirebase) {
      alert('Sincronização desativada. Abra firebase.js e ligue enableFirebase = true.');
      return;
    }
    try { await loginWithGoogle(); }
    catch (e) { console.error(e); alert('Falha no login. Tente novamente.'); }
  });

  btnLogout?.addEventListener('click', async ()=>{
    try { await logout(); } catch {}
  });
})();
