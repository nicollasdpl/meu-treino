// app.js – lógica principal do Meu Treino 2.0

// Import firebase.js with version query to bust the cache. Without the query
// the service worker may serve a stale version of firebase.js which can
// cause ENABLE_FIREBASE flag to be out of sync. The version number should
// match the one used in index.html and sw.js.
import { ENABLE_FIREBASE, loginWithGoogle, logout, onAuthChange, getCurrentUser, pullSessions, pushSession, pullHabits, pushHabits, uploadPhoto } from './firebase.js?v=2025110416';
import { computeMaxLoadData, compute1RMData, computeWeeklyVolumeData, computeTopExercises, drawLineChart, drawBarChart } from './charts.js';

// Dexie DB initialization
const db = new Dexie('meuTreinoDB');
db.version(1).stores({
  sessoes: 'data',      // chave primária: data YYYY-MM-DD
  habitos: 'data',      // chave primária: data
  fotos: '++id,data'    // fotos salvas localmente (metadados)
});

// Exercícios por dia de treino (split fixo). Você pode ajustar os nomes conforme sua planilha.
const SPLIT = {
  segunda: [
    'Puxada triângulo alta',
    'Puxada barra reta alta',
    'Remada baixa',
    'Rosca direta',
    'Rosca martelo'
  ],
  terca: [
    'Supino máquina',
    'Peck deck',
    'Tríceps corda',
    'Tríceps pulley'
  ],
  quarta: [
    'Desenvolvimento ombro',
    'Elevação lateral',
    'Elevação frontal',
    'Face pull'
  ],
  quinta: [
    'Agachamento',
    'Leg press',
    'Cadeira extensora',
    'Cadeira flexora'
  ],
  sexta: [
    'Rosca alternada',
    'Tríceps francês',
    'Abdominal infra',
    'Prancha'
  ]
};

// Global state
let state = {
  sessions: [],
  habits: {},
  selectedDate: null,
  dark: false
};

// Helpers
function formatDate(date) {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

function getDayName(date) {
  const dias = ['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
  return dias[new Date(date).getDay()];
}

// Migration from localStorage (antigo) to Dexie
async function migrateOldData() {
  const old = localStorage.getItem('sessoes');
  if (!old) return;
  try {
    const parsed = JSON.parse(old);
    for (const sess of parsed) {
      const dataKey = sess.data || sess.date;
      const exercicios = sess.exercicios || [];
      // Convert planos antigos {nome, peso, reps} para sets
      const newExs = exercicios.map(ex => {
        if (ex.sets) return ex;
        const sets = [];
        if (ex.peso || ex.reps) {
          sets.push({ peso: ex.peso || 0, reps: ex.reps || 0, rir: null, done: true });
          // adicionar séries vazias
          sets.push({ peso: 0, reps: 0, rir: null, done: false });
          sets.push({ peso: 0, reps: 0, rir: null, done: false });
        }
        return { nome: ex.nome, sets: sets, obs: ex.obs || '' };
      });
      await db.sessoes.put({ data: dataKey, duracao: sess.duracao || 0, dia: sess.dia, exercicios: newExs });
    }
    localStorage.removeItem('sessoes');
  } catch (e) {
    console.error('Falha ao migrar dados antigos', e);
  }
}

// Initialize app
async function init() {
  // Theme preference
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.classList.add('dark');
    state.dark = true;
  }
  // Toggle theme
  document.getElementById('btnTheme').addEventListener('click', () => {
    state.dark = !state.dark;
    document.documentElement.classList.toggle('dark', state.dark);
  });
  // Notification permission
  document.getElementById('btnNotif').addEventListener('click', () => {
    if (Notification && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  });
  // Migrate old data if exists
  await migrateOldData();
  // Load sessions and habits from IndexedDB
  state.sessions = await db.sessoes.toArray();
  const habArray = await db.habitos.toArray();
  state.habits = {};
  habArray.forEach(h => { state.habits[h.data] = h; });
  // Auth handling
  if (ENABLE_FIREBASE) {
    // When Firebase sync is enabled we still listen for auth changes to merge remote data,
    // but we no longer block the UI behind a login screen. Users can log in from the Perfil
    // page to sync their data; until then the app operates fully offline.
    onAuthChange(async (u) => {
      if (u) {
        // Pull remote sessions and merge
        const remoteSessions = await pullSessions(u.uid);
        for (const [date, sess] of Object.entries(remoteSessions)) {
          const local = await db.sessoes.get(date);
          const remoteCount = sess.exercicios.flatMap(e => e.sets.filter(s => s.done)).length;
          const localCount = local ? local.exercicios.flatMap(e => e.sets.filter(s => s.done)).length : 0;
          if (!local || remoteCount > localCount) {
            await db.sessoes.put({ data: date, ...sess });
          } else {
            await pushSession(u.uid, date, local);
          }
        }
        state.sessions = await db.sessoes.toArray();
        // Pull remote habits and merge
        const remoteHab = await pullHabits(u.uid);
        for (const [date, h] of Object.entries(remoteHab)) {
          const local = state.habits[date];
          if (!local) {
            await db.habitos.put({ data: date, ...h });
          } else {
            await pushHabits(u.uid, date, local);
          }
        }
        const habArray2 = await db.habitos.toArray();
        state.habits = {};
        habArray2.forEach(h => { state.habits[h.data] = h; });
        renderHome();
      }
    });
  }
  // Always show the main app (login overlay has been removed)
  document.getElementById('app').classList.remove('hidden');
  // Navigation
  setupNavigation();
  // Render home by default
  renderHome();
}

/**
 * Setup bottom navigation handlers
 */
function setupNavigation() {
  document.getElementById('navHome').addEventListener('click', () => showPage('home'));
  document.getElementById('navTreino').addEventListener('click', () => showPage('treino'));
  document.getElementById('navEvolucao').addEventListener('click', () => showPage('evolucao'));
  document.getElementById('navPerfil').addEventListener('click', () => showPage('perfil'));
  // Start today training from home
  document.getElementById('btnStartToday').addEventListener('click', () => {
    const today = formatDate(new Date());
    state.selectedDate = today;
    showPage('treino');
    renderTreino(today);
  });
}

function showPage(pageId) {
  document.querySelectorAll('.pagina').forEach(p => p.classList.remove('active'));
  const el = document.getElementById(pageId);
  if (el) el.classList.add('active');
  if (pageId === 'home') renderHome();
  if (pageId === 'treino') {
    if (!state.selectedDate) {
      state.selectedDate = formatDate(new Date());
    }
    renderTreino(state.selectedDate);
  }
  if (pageId === 'evolucao') renderEvolucao();
  if (pageId === 'perfil') renderPerfil();
}

/**
 * Render the calendar and monthly summary.
 */
function renderHome() {
  showPage('home');
  const calTitle = document.getElementById('calTitle');
  const calContainer = document.getElementById('calendario');
  const now = state.selectedDate ? new Date(state.selectedDate) : new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  calTitle.textContent = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  // compute first day
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Build grid
  calContainer.innerHTML = '';
  // Add blank days
  for (let i = 0; i < firstDay; i++) {
    const btn = document.createElement('button');
    btn.disabled = true;
    calContainer.appendChild(btn);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = formatDate(new Date(year, month, d));
    const btn = document.createElement('button');
    btn.textContent = d;
    // mark if session exists
    if (state.sessions.some(s => s.data === dateStr)) {
      btn.classList.add('marked');
    }
    btn.addEventListener('click', () => {
      state.selectedDate = dateStr;
      renderTreino(dateStr);
      showPage('treino');
    });
    calContainer.appendChild(btn);
  }
  // Summary of month
  const monthStr = `${year}-${String(month+1).padStart(2,'0')}`;
  const sessionsThisMonth = state.sessions.filter(s => s.data.startsWith(monthStr));
  document.getElementById('diasTreinados').textContent = sessionsThisMonth.length;
  if (sessionsThisMonth.length > 0) {
    const last = sessionsThisMonth[sessionsThisMonth.length - 1];
    document.getElementById('ultimoTreino').textContent = last.data;
    const avgDur = (sessionsThisMonth.reduce((acc, s) => acc + (s.duracao || 0), 0) / sessionsThisMonth.length).toFixed(0);
    document.getElementById('duracaoMedia').textContent = avgDur + ' min';
  } else {
    document.getElementById('ultimoTreino').textContent = '—';
    document.getElementById('duracaoMedia').textContent = '—';
  }
  // Streak: consecutive days with sessions from last date backward
  let streak = 0;
  let current = new Date();
  while (true) {
    const dateKey = formatDate(current);
    if (state.sessions.some(s => s.data === dateKey)) {
      streak++;
      current.setDate(current.getDate() - 1);
    } else {
      break;
    }
  }
  document.getElementById('streakCount').textContent = streak;
  // navigation for month
  document.getElementById('calPrev').onclick = () => {
    const prev = new Date(year, month - 1, 1);
    state.selectedDate = formatDate(prev);
    renderHome();
  };
  document.getElementById('calNext').onclick = () => {
    const next = new Date(year, month + 1, 1);
    state.selectedDate = formatDate(next);
    renderHome();
  };
}

/**
 * Render treino page for a specific date.
 */
async function renderTreino(dateStr) {
  const el = document.getElementById('treino');
  el.innerHTML = '';
  const dayName = getDayName(dateStr);
  const splitKey = dayName.toLowerCase();
  const exercises = SPLIT[splitKey] || [];
  // Title and top controls
  const title = document.createElement('h2');
  title.textContent = `Treino do dia (${dateStr})`;
  el.appendChild(title);
  // Button copy last session
  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn';
  copyBtn.textContent = 'Copiar última sessão';
  el.appendChild(copyBtn);
  // Listener to copy previous session of same exercise
  copyBtn.onclick = () => {
    exercises.forEach(exName => {
      const lastSess = findLastSessionForExercise(exName, dateStr);
      if (lastSess) {
        const card = document.querySelector(`.card[data-name="${exName}"]`);
        if (card) {
          lastSess.sets.forEach((set, idx) => {
            const pesoInput = card.querySelector(`input[data-field="peso"][data-set="${idx}"]`);
            const repsInput = card.querySelector(`input[data-field="reps"][data-set="${idx}"]`);
            if (pesoInput) pesoInput.value = set.peso || '';
            if (repsInput) repsInput.value = set.reps || '';
          });
        }
      }
    });
    updateTonnage();
  };
  // Generate cards for each exercise
  exercises.forEach(exName => {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.name = exName;
    const h3 = document.createElement('h3');
    h3.textContent = exName;
    card.appendChild(h3);
    // sets container
    const setsDiv = document.createElement('div');
    setsDiv.className = 'sets';
    for (let i = 0; i < 3; i++) {
      const peso = document.createElement('input');
      peso.type = 'number';
      peso.placeholder = 'kg';
      peso.dataset.field = 'peso';
      peso.dataset.set = i;
      const reps = document.createElement('input');
      reps.type = 'number';
      reps.placeholder = 'reps';
      reps.dataset.field = 'reps';
      reps.dataset.set = i;
      const rir = document.createElement('input');
      rir.type = 'number';
      rir.placeholder = 'RIR';
      rir.dataset.field = 'rir';
      rir.dataset.set = i;
      const doneBtn = document.createElement('button');
      doneBtn.className = 'done';
      doneBtn.textContent = '✅';
      doneBtn.dataset.set = i;
      // When done, mark set as completed and start rest
      doneBtn.onclick = () => {
        doneBtn.disabled = true;
        // beep/vibrate
        triggerBeep();
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        // overlay alert
        alert('Descanso concluído!');
      };
      setsDiv.appendChild(peso);
      setsDiv.appendChild(reps);
      setsDiv.appendChild(rir);
      setsDiv.appendChild(doneBtn);
    }
    card.appendChild(setsDiv);
    el.appendChild(card);
  });
  // Tonelagem display
  const tonDiv = document.createElement('div');
  tonDiv.id = 'tonelagem';
  tonDiv.style.marginTop = '16px';
  el.appendChild(tonDiv);
  // Save button
  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn';
  saveBtn.textContent = 'Salvar sessão';
  saveBtn.onclick = async () => {
    const session = buildSessionFromUI(dateStr);
    await db.sessoes.put(session);
    // update state
    const idx = state.sessions.findIndex(s => s.data === dateStr);
    if (idx >= 0) state.sessions[idx] = session; else state.sessions.push(session);
    // push to Firebase if logged in
    const u = getCurrentUser();
    if (ENABLE_FIREBASE && u) {
      await pushSession(u.uid, dateStr, session);
    }
    alert('Sessão salva!');
    renderHome();
  };
  el.appendChild(saveBtn);
  // update tonnage on input changes
  el.querySelectorAll('input[type="number"]').forEach(inp => {
    inp.addEventListener('input', updateTonnage);
  });
  updateTonnage();
}

// Find last session before date for exercise
function findLastSessionForExercise(exName, dateStr) {
  // sort sessions by date ascending
  const sorted = [...state.sessions].sort((a,b) => a.data.localeCompare(b.data));
  let last = null;
  sorted.forEach(sess => {
    if (sess.data < dateStr) {
      const ex = sess.exercicios.find(e => e.nome === exName);
      if (ex) last = ex;
    }
  });
  return last;
}

// Build session object from treino UI
function buildSessionFromUI(dateStr) {
  const exercicios = [];
  document.querySelectorAll('#treino .card').forEach(card => {
    const nome = card.dataset.name;
    const sets = [];
    const pesoInputs = card.querySelectorAll('input[data-field="peso"]');
    const repsInputs = card.querySelectorAll('input[data-field="reps"]');
    const rirInputs = card.querySelectorAll('input[data-field="rir"]');
    pesoInputs.forEach((inp, idx) => {
      sets[idx] = {
        peso: parseFloat(inp.value) || 0,
        reps: parseInt(repsInputs[idx].value) || 0,
        rir: rirInputs[idx].value ? parseInt(rirInputs[idx].value) : null,
        done: card.querySelectorAll('button.done')[idx].disabled || false
      };
    });
    exercicios.push({ nome, sets, obs: '' });
  });
  // compute duration (use start/stop if you implement timer)
  const duration = 0;
  const dia = getDayName(dateStr);
  // compute volume
  let volume = 0;
  exercicios.forEach(ex => {
    ex.sets.forEach(s => { volume += (s.peso || 0) * (s.reps || 0); });
  });
  return { data: dateStr, duracao: duration, dia, exercicios, volume };
}

// Compute and update tonnage display
function updateTonnage() {
  let total = 0;
  document.querySelectorAll('#treino .card').forEach(card => {
    let exTotal = 0;
    const pesoInputs = card.querySelectorAll('input[data-field="peso"]');
    const repsInputs = card.querySelectorAll('input[data-field="reps"]');
    pesoInputs.forEach((inp, idx) => {
      const kg = parseFloat(inp.value) || 0;
      const reps = parseInt(repsInputs[idx].value) || 0;
      exTotal += kg * reps;
    });
    total += exTotal;
  });
  const tonDiv = document.getElementById('tonelagem');
  if (tonDiv) tonDiv.textContent = `Tonelagem total: ${total} kg`;
}

// Beep using WebAudio or fallback beep.mp3
function triggerBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {
    // fallback to audio file
    const audio = new Audio('assets/beep.mp3');
    audio.play();
  }
}

/**
 * Render Evolução tab
 */
function renderEvolucao() {
  const el = document.getElementById('evolucao');
  el.innerHTML = '';
  // Tabs
  const tabs = document.createElement('div');
  tabs.className = 'tabs';
  const tabResumo = document.createElement('button'); tabResumo.textContent = 'Resumo';
  const tabGraficos = document.createElement('button'); tabGraficos.textContent = 'Gráficos';
  const tabPRs = document.createElement('button'); tabPRs.textContent = 'PRs';
  const tabVolume = document.createElement('button'); tabVolume.textContent = 'Tonelagem';
  tabs.append(tabResumo, tabGraficos, tabPRs, tabVolume);
  el.appendChild(tabs);
  const container = document.createElement('div');
  el.appendChild(container);
  function clearActive() {
    tabs.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
    container.innerHTML = '';
  }
  tabResumo.onclick = () => {
    clearActive(); tabResumo.classList.add('active');
    drawResumo(container);
  };
  tabGraficos.onclick = () => {
    clearActive(); tabGraficos.classList.add('active');
    drawGraficos(container);
  };
  tabPRs.onclick = () => {
    clearActive(); tabPRs.classList.add('active');
    drawPRs(container);
  };
  tabVolume.onclick = () => {
    clearActive(); tabVolume.classList.add('active');
    drawVolume(container);
  };
  // Default tab
  tabResumo.click();
}

function drawResumo(container) {
  const totalTreinos = state.sessions.length;
  const volumeTotal = state.sessions.reduce((acc, s) => acc + (s.volume || 0), 0);
  const tempoTotal = state.sessions.reduce((acc, s) => acc + (s.duracao || 0), 0);
  const top3 = computeTopExercises(state.sessions, 30);
  const div = document.createElement('div');
  div.innerHTML = `<p>Total de treinos: <strong>${totalTreinos}</strong></p>
  <p>Volume total: <strong>${volumeTotal}</strong> kg·reps</p>
  <p>Tempo total: <strong>${tempoTotal}</strong> min</p>`;
  if (top3.length) {
    div.innerHTML += '<p>Top 3 exercícios:</p><ol>' + top3.map(item => `<li>${item.nome} – ${item.total} kg·reps</li>`).join('') + '</ol>';
  }
  container.appendChild(div);
}

function drawGraficos(container) {
  // create form to select exercise and period
  const selEx = document.createElement('select');
  const exNames = Array.from(new Set(state.sessions.flatMap(s => s.exercicios.map(e => e.nome))));
  exNames.forEach(name => {
    const opt = document.createElement('option'); opt.value = name; opt.textContent = name; selEx.appendChild(opt);
  });
  const selPeriod = document.createElement('select');
  [{ label:'30 dias', value:30 }, {label:'60 dias', value:60}, {label:'90 dias', value:90}, {label:'180 dias', value:180}].forEach(optData => {
    const opt = document.createElement('option'); opt.value = optData.value; opt.textContent = optData.label; selPeriod.appendChild(opt);
  });
  container.appendChild(selEx);
  container.appendChild(selPeriod);
  const canvas1 = document.createElement('canvas');
  const canvas2 = document.createElement('canvas');
  container.appendChild(canvas1);
  container.appendChild(canvas2);
  function updateCharts() {
    const exercise = selEx.value;
    const days = parseInt(selPeriod.value);
    const cutoff = Date.now() - days * 86400000;
    const { labels: labelsMax, data: dataMax } = computeMaxLoadData(state.sessions, exercise, cutoff);
    const { labels: labelsRm, data: dataRm } = compute1RMData(state.sessions, exercise, cutoff);
    // destroy previous charts if present
    if (canvas1._chart) { canvas1._chart.destroy(); }
    if (canvas2._chart) { canvas2._chart.destroy(); }
    canvas1._chart = drawLineChart(canvas1.getContext('2d'), labelsMax, dataMax, 'Carga Máx. (kg)');
    canvas2._chart = drawLineChart(canvas2.getContext('2d'), labelsRm, dataRm, '1RM Est. (kg)');
  }
  selEx.onchange = updateCharts;
  selPeriod.onchange = updateCharts;
  updateCharts();
}

function drawPRs(container) {
  const list = document.createElement('ul');
  // find all PRs in sessions
  const prs = [];
  const bestByEx = {};
  state.sessions.forEach(sess => {
    sess.exercicios.forEach(ex => {
      ex.sets.forEach(set => {
        if (!set.done) return;
        const key = ex.nome;
        if (!bestByEx[key]) bestByEx[key] = { peso: 0, reps: 0, rm: 0, vol: 0 };
        // Peso PR
        if (set.peso > bestByEx[key].peso) {
          bestByEx[key].peso = set.peso;
          prs.push({ data: sess.data, ex: key, tipo: 'Peso', valor: set.peso });
        }
        // Reps PR na mesma carga
        if (set.peso === bestByEx[key].peso && set.reps > bestByEx[key].reps) {
          bestByEx[key].reps = set.reps;
          prs.push({ data: sess.data, ex: key, tipo: 'Reps', valor: set.reps });
        }
        // 1RM PR
        const rm = set.peso * (1 + set.reps / 30);
        if (rm > bestByEx[key].rm) {
          bestByEx[key].rm = rm;
          prs.push({ data: sess.data, ex: key, tipo: '1RM', valor: rm.toFixed(1) });
        }
      });
      // Volume PR por dia
      const vol = ex.sets.reduce((acc, s) => acc + (s.peso || 0)*(s.reps || 0), 0);
      if (vol > (bestByEx[ex.nome].vol || 0)) {
        bestByEx[ex.nome].vol = vol;
        prs.push({ data: sess.data, ex: ex.nome, tipo: 'Volume', valor: vol });
      }
    });
  });
  prs.sort((a,b) => b.data.localeCompare(a.data));
  prs.forEach(pr => {
    const li = document.createElement('li');
    li.textContent = `${pr.data}: ${pr.ex} – ${pr.tipo} PR (${pr.valor})`;
    list.appendChild(li);
  });
  container.appendChild(list);
}

function drawVolume(container) {
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);
  const { labels, data } = computeWeeklyVolumeData(state.sessions);
  drawBarChart(canvas.getContext('2d'), labels, data, 'Volume semanal');
}

/**
 * Render perfil page with habits and profile
 */
function renderPerfil() {
  const el = document.getElementById('perfil');
  el.innerHTML = '';
  const u = getCurrentUser();
  const heading = document.createElement('h2');
  heading.textContent = 'Perfil';
  el.appendChild(heading);
  if (u) {
    const info = document.createElement('div');
    info.innerHTML = `<p><img src="${u.photoURL}" alt="avatar" style="width:64px;border-radius:50%" /><br/>${u.displayName}<br/>${u.email}</p>`;
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'btn'; logoutBtn.textContent = 'Sair';
    logoutBtn.onclick = async () => { await logout(); };
    info.appendChild(logoutBtn);
    el.appendChild(info);
  } else if (ENABLE_FIREBASE) {
    const loginBtn = document.createElement('button'); loginBtn.className = 'btn'; loginBtn.textContent = 'Entrar com Google';
    loginBtn.onclick = async () => { await loginWithGoogle(); };
    el.appendChild(loginBtn);
  }
  // Habits checklist
  const habitsTitle = document.createElement('h3'); habitsTitle.textContent = 'Hábitos diários';
  el.appendChild(habitsTitle);
  const list = document.createElement('ul'); list.className = 'habitos-list';
  const labels = ['Acordar no horário','Café da manhã','Creatina','Almoço','Pré-treino','Beber 2.5L água','Dormir >7h'];
  const today = formatDate(new Date());
  const todayHab = state.habits[today] || { data: today };
  labels.forEach(key => {
    const li = document.createElement('li');
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = !!todayHab[key];
    checkbox.onchange = async () => {
      todayHab[key] = checkbox.checked;
      state.habits[today] = todayHab;
      await db.habitos.put({ data: today, ...todayHab });
      const u = getCurrentUser();
      if (ENABLE_FIREBASE && u) {
        await pushHabits(u.uid, today, todayHab);
      }
      renderPerfil();
    };
    const lbl = document.createElement('span'); lbl.textContent = key;
    li.appendChild(checkbox);
    li.appendChild(lbl);
    list.appendChild(li);
  });
  el.appendChild(list);
  // Medals (simple counters)
  const medals = document.createElement('div'); medals.style.marginTop = '16px';
  medals.innerHTML = '<h3>Medalhas</h3>';
  const daysInARow = parseInt(document.getElementById('streakCount').textContent);
  const totalTrainings = state.sessions.length;
  const totalPRs = document.querySelectorAll('#evolucao li').length;
  if (daysInARow >= 3) medals.innerHTML += '<p>🏅 3 dias seguidos</p>';
  if (totalTrainings >= 30) medals.innerHTML += '<p>🥈 30 treinos concluídos</p>';
  if (totalPRs >= 100) medals.innerHTML += '<p>🥇 100 PRs conquistados</p>';
  el.appendChild(medals);
}

// Kickoff
window.addEventListener('DOMContentLoaded', init);