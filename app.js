/* ===========================
   Meu Treino – App principal
   =========================== */

// Ponte para Charts/Firebase injetados pelo index.html
const Bridge = () => window.AppBridge || { Charts:{}, FB:{} };

/* ---------- UTIL ---------- */
const qs = s => document.querySelector(s);
const qsa = s => [...document.querySelectorAll(s)];
const todayStr = () => new Date().toISOString().slice(0,10);
const fmtDuracao = (sec) => {
  const h=String(Math.floor(sec/3600)).padStart(2,'0');
  const m=String(Math.floor((sec%3600)/60)).padStart(2,'0');
  const s=String(sec%60).padStart(2,'0');
  return `${h}:${m}:${s}`;
};
const round1 = x => Math.round(x*10)/10;
const epley1RM = (kg,reps) => kg>0 && reps>0 ? round1(kg*(1+reps/30)) : 0;

function loadJSON(k, d){ try{ return JSON.parse(localStorage.getItem(k)) ?? d; }catch{ return d; } }
function saveJSON(k, v){ localStorage.setItem(k, JSON.stringify(v)); }

/* ---------- CONSTANTES ---------- */
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

/* ---------- ESTADO LOCAL ---------- */
function getSessoes(){ return loadJSON('sessoes', []); }
function setSessoes(v){ saveJSON('sessoes', v); }
function getMarks(){ return new Set(loadJSON('diasTreino', [])); }
function setMarks(set){ saveJSON('diasTreino', [...set]); }

/* Migração de schema antigo (peso/reps diretos no exercício) -> sets */
(function migrateOld(){
  const sess = getSessoes();
  let changed = false;
  sess.forEach(s=>{
    (s.exercicios||[]).forEach(e=>{
      if(!e.sets){
        e.sets = [{peso:Number(e.peso||0), reps:Number(e.reps||0), rir:0, done:(e.peso>0&&e.reps>0), ts:Date.now()}];
        delete e.peso; delete e.reps;
        changed = true;
      }
    });
  });
  if(changed) setSessoes(sess);
})();

/* ---------- CABEÇALHO / TEMA ---------- */
function textoTreinoHoje(){
  const d = new Date().getDay();
  let nome = 'Descanso';
  if(d===1) nome='Costas + Bíceps';
  if(d===2) nome='Peito + Tríceps';
  if(d===3) nome='Ombro';
  if(d===4) nome='Perna';
  if(d===5) nome='Braços + Abdômen';
  return `Hoje é ${new Date().toLocaleDateString('pt-BR')} · Treino do dia: ${nome}`;
}
qs('#subheader').textContent = textoTreinoHoje();

(function themeInit(){
  const pref = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
  if(pref==='dark') document.documentElement.classList.add('dark');
  qs('#btnTheme').textContent = document.documentElement.classList.contains('dark')?'☀️':'🌙';
})();
qs('#btnTheme').addEventListener('click', ()=>{
  document.documentElement.classList.toggle('dark');
  const dark = document.documentElement.classList.contains('dark');
  localStorage.setItem('theme', dark?'dark':'light');
  qs('#btnTheme').textContent = dark?'☀️':'🌙';
});

/* ---------- NAVEGAÇÃO ---------- */
qsa('nav button').forEach(b=>{
  b.addEventListener('click', ()=>{
    const id=b.dataset.go;
    qsa('.pagina').forEach(p=>p.classList.add('hidden'));
    qs('#'+id).classList.remove('hidden');
    if(id==='graficos') Bridge().Charts.renderAll();
    if(id==='home') atualizarResumoHome();
  });
});

/* ---------- CALENDÁRIO (sem criar treinos vazios) ---------- */
let viewAno, viewMes;
const mesLabel = qs('#mesAno');
const calEl = qs('#calendario');
qs('#prevMes').addEventListener('click', ()=>{ viewMes--; if(viewMes<0){viewMes=11; viewAno--; } montarCalendario(); });
qs('#proxMes').addEventListener('click', ()=>{ viewMes++; if(viewMes>11){viewMes=0; viewAno++; } montarCalendario(); });

(function initCalendar(){
  const hoje = new Date();
  viewAno = hoje.getFullYear(); viewMes = hoje.getMonth();
  montarCalendario();
})();
function montarCalendario(){
  mesLabel.textContent = new Date(viewAno, viewMes).toLocaleString('pt-BR', {month:'long', year:'numeric'});
  calEl.innerHTML='';
  const first = new Date(viewAno, viewMes, 1);
  const lastDay = new Date(viewAno, viewMes+1, 0).getDate();
  const offset = first.getDay();
  for(let i=0;i<offset;i++){ const d = document.createElement('div'); d.className='dia fora'; calEl.appendChild(d); }
  const hoje = new Date();
  const marks = getMarks();
  const sessSet = new Set(getSessoes().map(s=>s.data));
  for(let dia=1; dia<=lastDay; dia++){
    const el = document.createElement('div');
    el.className='dia'; el.dataset.dia = String(dia).padStart(2,'0'); el.textContent = dia;
    const dataStr = `${viewAno}-${String(viewMes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
    if(sessSet.has(dataStr)) el.classList.add('treino');
    if(marks.has(dataStr)) el.classList.add('marcado');
    if(dia===hoje.getDate() && viewMes===hoje.getMonth() && viewAno===hoje.getFullYear()) el.classList.add('hoje');
    el.addEventListener('click', ()=>{
      const m = getMarks();
      if(m.has(dataStr)) m.delete(dataStr); else m.add(dataStr);
      setMarks(m);
      montarCalendario();
    });
    calEl.appendChild(el);
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

/* ---------- TIMER ---------- */
let timerId=null, startEpoch=null;
const timerEl = qs('#timer');
qs('#btnTimer').addEventListener('click', ()=>{
  if(timerId){
    clearInterval(timerId); timerId=null;
    const duracao = Math.floor((Date.now()-startEpoch)/1000);
    qs('#btnTimer').textContent='Iniciar';
    salvarSessaoAtual(duracao);
  }else{
    startEpoch = Date.now();
    timerId = setInterval(()=>{ timerEl.textContent = fmtDuracao(Math.floor((Date.now()-startEpoch)/1000)); }, 1000);
    qs('#btnTimer').textContent='Finalizar';
  }
});

/* ---------- AUDIO / NOTIFICAÇÃO ---------- */
let audioCtx=null;
function ensureAudioCtx(){
  if(!audioCtx){
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = AC ? new AC() : null;
  }
  if(audioCtx?.state==='suspended'){ audioCtx.resume?.(); }
}
function beep(times=3, freq=880, dur=200){
  if(audioCtx){
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
  }else{
    const a = new Audio('assets/beep.mp3'); a.play().catch(()=>{});
  }
}
let notifReady = false;
async function ensureNotifyPermission(){
  if(!("Notification" in window)) return false;
  if(Notification.permission === "granted"){ notifReady = true; return true; }
  if(Notification.permission !== "denied"){
    const p = await Notification.requestPermission();
    notifReady = (p === "granted"); return notifReady;
  }
  return false;
}
qs('#btnNotify').addEventListener('click', async ()=>{
  ensureAudioCtx();
  const ok = await ensureNotifyPermission();
  qs('#btnNotify').textContent = ok ? '🔔' : '🔕';
});
function notify(title, body){ if(notifReady){ try{ new Notification(title, { body }); }catch(_){ } } }

/* ---------- DESCANSO ---------- */
let restId=null, restLeft=0, beepLoop=null;
const restSeg = qs('#restSeg');
const restDisplay = qs('#restDisplay');
const overlay = qs('#restOverlay');
qs('#btnRest').addEventListener('click', ()=>{
  if(restId){ clearInterval(restId); restId=null; restDisplay.textContent='—'; clearInterval(beepLoop); beepLoop=null; overlay.classList.add('hidden'); return; }
  ensureAudioCtx(); ensureNotifyPermission(); startRest();
});
qs('#btnOverlayOk').addEventListener('click', ()=>{ overlay.classList.add('hidden'); clearInterval(beepLoop); beepLoop=null; });
qs('#btnOverlayBuzz').addEventListener('click', ()=>{ try{ navigator.vibrate && navigator.vibrate([200,100,300]); }catch(_){} ensureAudioCtx(); beep(2,1250,200); });

function startRest(sec){
  ensureAudioCtx();
  restLeft = Math.max(10, Number(sec||restSeg.value||60));
  restDisplay.textContent = `${restLeft}s`;
  clearInterval(restId);
  restId = setInterval(()=>{
    restLeft--; restDisplay.textContent = `${restLeft}s`;
    if(restLeft<=0){
      clearInterval(restId); restId=null;
      restDisplay.textContent='⏰ Descanso finalizado!';
      try{ navigator.vibrate && navigator.vibrate([250,120,250,120,400]); }catch(_){}
      beep(3,1100,220);
      overlay.classList.remove('hidden');
      notify('Descanso finalizado!', 'Bora pra próxima série.');
      beepLoop = setInterval(()=>{ ensureAudioCtx(); beep(1,1200,180); }, 1200);
    }
  },1000);
}

/* ---------- UI TREINO ---------- */
const listaExEl = qs('#listaExercicios');
const treinoDoDiaEl = qs('#treinoDoDia');

const tabs = qsa('.tab-btn');
tabs.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    tabs.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    montarExercicios(btn.dataset.dia, true);
  });
});
qs('#btnAddSetAll').addEventListener('click', ()=>{
  listaExEl.querySelectorAll('.sets').forEach(sets=>{
    const id = sets.dataset.ex;
    const n = sets.children.length+1;
    if(n>5) return;
    sets.insertAdjacentHTML('beforeend', renderSetHTML(id, n));
    bindSetEvents(sets.lastElementChild);
  });
});
qs('#btnCopyLast').addEventListener('click', ()=>{ const key = qs('.tab-btn.active')?.dataset.dia || 'segunda'; preencherComUltima(key); });

function labelDia(key){
  return {segunda:'Segunda (Costas+Bíceps)', terca:'Terça (Peito+Tríceps)', quarta:'Quarta (Ombro)', quinta:'Quinta (Perna)', sexta:'Sexta (Braços+Abs)'}[key] || key;
}
function ultimaSessaoExercicio(nomeEx){
  const hist = getSessoes();
  for(let i=hist.length-1;i>=0;i--){
    const e = hist[i].exercicios?.find(x=>x.nome===nomeEx);
    if(e) return e;
  }
  return null;
}
function renderSetHTML(exId, idx){
  return `
    <div class="set" data-ex="${exId}" data-set="${idx}">
      <div class="top">
        <input type="number" step="0.5" placeholder="kg" data-field="peso">
        <input type="number" placeholder="reps" data-field="reps">
        <label title="Concluir"><input type="checkbox" class="done"> ✅</label>
      </div>
      <div class="muted small">RIR: <input type="number" step="0.5" min="-2" max="5" style="width:70px" data-field="rir"></div>
    </div>`;
}
function bindSetEvents(setEl){
  setEl.querySelector('.done').addEventListener('change', (ev)=>{
    if(ev.target.checked){ ensureAudioCtx(); ensureNotifyPermission(); startRest(); }
    atualizarTonelagemResumo();
    const exCard = ev.target.closest('.ex-card');
    if(exCard) avaliarPRs(exCard);
  });
  setEl.querySelectorAll('[data-field]').forEach(inp=>{
    inp.addEventListener('input', atualizarTonelagemResumo);
  });
}
function montarExercicios(diaKey, prefill=true){
  const arr = TREINOS[diaKey] || [];
  treinoDoDiaEl.textContent = `Dia selecionado: ${labelDia(diaKey)} · 3 séries visíveis (adicione mais se quiser).`;
  listaExEl.innerHTML='';
  arr.forEach(ex=>{
    const exId = ex.nome;
    const last = prefill ? ultimaSessaoExercicio(exId) : null;

    const card = document.createElement('div');
    card.className = 'ex-card';
    card.dataset.ex = exId;

    card.innerHTML = `
      <div class="ex-head">
        <div><b>${ex.nome}</b><br><small>${ex.alvo}</small></div>
        <div class="badge" title="Sugestão de próxima carga" data-next="${exId}">Próximo: —</div>
      </div>
      <div class="sets" data-ex="${exId}">
        ${renderSetHTML(exId,1)}
        ${renderSetHTML(exId,2)}
        ${renderSetHTML(exId,3)}
      </div>
      <div class="ex-obs"><textarea rows="1" placeholder="obs" data-obs="${exId}">${last?.obs??''}</textarea></div>
      <div class="muted small" data-pr="${exId}">🏆 PR: —</div>
    `;

    listaExEl.appendChild(card);

    // bind nos 3 sets
    card.querySelectorAll('.set').forEach(bindSetEvents);

    // prefill set1 com último best
    if(last?.sets?.length){
      const best = last.sets.reduce((a,b)=> b.peso>a.peso ? b : a, {peso:0,reps:0});
      const s1p = card.querySelector(`[data-ex="${CSS.escape(exId)}"][data-set="1"] [data-field="peso"]`);
      const s1r = card.querySelector(`[data-ex="${CSS.escape(exId)}"][data-set="1"] [data-field="reps"]`);
      if(s1p) s1p.value = best.peso || '';
      if(s1r) s1r.value = best.reps || '';
    }

    // espelho: quando focar set2/3 vazio, copia set1
    const s1 = card.querySelector(`[data-ex="${CSS.escape(exId)}"][data-set="1"]`);
    const s1p = s1.querySelector('[data-field="peso"]');
    const s1r = s1.querySelector('[data-field="reps"]');
    card.querySelectorAll(`[data-ex="${CSS.escape(exId)}"][data-set] [data-field]`).forEach(inp=>{
      inp.addEventListener('focus', ()=>{
        if(!inp.value && inp.closest('[data-set]').dataset.set!=="1"){
          if(inp.dataset.field==='peso') inp.value = s1p.value || '';
          if(inp.dataset.field==='reps') inp.value = s1r.value || '';
        }
      });
    });

    // sugestão de progressão (com base nas últimas 3 sessões)
    sugestaoProximaCarga(exId, card);
  });

  atualizarTonelagemResumo();
}
(function initTabs(){
  const d = new Date().getDay();
  let key='segunda'; if(d===2) key='terca'; if(d===3) key='quarta'; if(d===4) key='quinta'; if(d===5) key='sexta';
  tabs.forEach(b=>b.classList.remove('active'));
  const chosen = [...tabs].find(b=>b.dataset.dia===key) || tabs[0];
  chosen.classList.add('active');
  montarExercicios(chosen.dataset.dia);
})();
function preencherComUltima(diaKey){
  const arr = TREINOS[diaKey] || [];
  arr.forEach(ex=>{
    const last = ultimaSessaoExercicio(ex.nome);
    if(last?.sets?.length){
      const best = last.sets.reduce((a,b)=> b.peso>a.peso ? b : a, {peso:0,reps:0});
      const p = listaExEl.querySelector(`[data-ex="${CSS.escape(ex.nome)}"][data-set="1"] [data-field="peso"]`);
      const r = listaExEl.querySelector(`[data-ex="${CSS.escape(ex.nome)}"][data-set="1"] [data-field="reps"]`);
      if(p) p.value = best.peso || '';
      if(r) r.value = best.reps || '';
    }
  });
  atualizarTonelagemResumo();
}

/* ---------- TONELAGEM + PRs ---------- */
function coletarSetsUI(){
  const out = {};
  listaExEl.querySelectorAll('.ex-card').forEach(card=>{
    const id = card.dataset.ex;
    const obs = card.querySelector(`[data-obs="${CSS.escape(id)}"]`)?.value || '';
    const sets = [...card.querySelectorAll(`[data-ex="${CSS.escape(id)}"][data-set]`)].map(box=>({
      peso:Number(box.querySelector('[data-field="peso"]')?.value||0),
      reps:Number(box.querySelector('[data-field="reps"]')?.value||0),
      rir:Number(box.querySelector('[data-field="rir"]')?.value||0),
      done:box.querySelector('.done')?.checked||false,
      ts:Date.now()
    }));
    out[id] = {obs, sets};
  });
  return out;
}
function tonelagemSessao(exObjs){
  let total=0;
  Object.values(exObjs).forEach(e=> (e.sets||[]).forEach(s=>{ if(s.done && s.peso>0 && s.reps>0) total+=s.peso*s.reps; }));
  return total;
}
function atualizarTonelagemResumo(){
  const data = coletarSetsUI();
  const tot = tonelagemSessao(data);
  qs('#resumoTonelagem').textContent = `Tonelagem concluída hoje: ${tot} kg·reps`;
}
function avaliarPRs(exCard){
  const nome = exCard.dataset.ex;
  const sets = [...exCard.querySelectorAll(`[data-ex="${CSS.escape(nome)}"][data-set]`)].map(b=>({
    peso:Number(b.querySelector('[data-field="peso"]').value||0),
    reps:Number(b.querySelector('[data-field="reps"]').value||0),
    done:b.querySelector('.done').checked
  })).filter(s=>s.done && s.peso>0 && s.reps>0);

  if(!sets.length) return;

  // PRs históricos
  const hist = getSessoes();
  let prPeso=0, prReps=0, pr1RM=0, prVol=0, volHoje=0;
  sets.forEach(s=>{ volHoje += s.peso*s.reps; pr1RM = Math.max(pr1RM, epley1RM(s.peso,s.reps)); prPeso=Math.max(prPeso,s.peso); prReps=Math.max(prReps,s.reps);});
  // históricos
  hist.forEach(s=>{
    (s.exercicios||[]).forEach(e=>{
      if(e.nome===nome){
        (e.sets||[]).forEach(st=>{
          prPeso=Math.max(prPeso, st.peso);
          prReps=Math.max(prReps, st.reps);
          pr1RM=Math.max(pr1RM, epley1RM(st.peso, st.reps));
        });
      }
    });
  });
  // Se bateu algo agora (comparar com histórico sem sessão atual)
  let msgs = [];
  sets.forEach(s=>{
    const m1 = epley1RM(s.peso,s.reps);
    if(s.peso>prPeso) msgs.push('Peso');
    if(s.reps>=prReps && s.peso>=prPeso*0.98) msgs.push('Reps');
    if(m1>pr1RM) msgs.push('1RM');
  });

  // Tonelagem da sessão vs melhor histórico do exercício (aproximado)
  const volHist = hist.reduce((acc,ss)=>{
    const e = (ss.exercicios||[]).find(x=>x.nome===nome);
    if(!e) return acc;
    const v = (e.sets||[]).reduce((t,u)=>t+(u.peso>0&&u.reps>0?u.peso*u.reps:0),0);
    return Math.max(acc,v);
  },0);
  if(volHoje>volHist) msgs.push('Volume');

  const prEl = exCard.querySelector(`[data-pr="${CSS.escape(nome)}"]`);
  if(msgs.length){ prEl.innerHTML = '🏆 PR: ' + msgs.join(' / '); confeteLeve(); }
  else prEl.textContent = '🏆 PR: —';
}
function confeteLeve(){
  // animação leve com emoji (sem lib)
  const s = document.createElement('div');
  s.textContent = '🎉'; s.style.position='fixed'; s.style.left='50%'; s.style.top='-20px';
  s.style.fontSize='28px'; s.style.transform='translateX(-50%)'; s.style.transition='all .9s ease-out'; s.style.zIndex=9999;
  document.body.appendChild(s);
  requestAnimationFrame(()=>{ s.style.top='40px'; s.style.opacity='0'; });
  setTimeout(()=>s.remove(), 1000);
}

/* ---------- PROGRESSÃO AUTOMÁTICA ---------- */
function sugestaoProximaCarga(exName, card){
  // pega últimas 3 sessões
  const hist = getSessoes().filter(s => (s.exercicios||[]).some(e=>e.nome===exName)).slice(-3);
  if(!hist.length){ card.querySelector(`[data-next="${CSS.escape(exName)}"]`).textContent = 'Próximo: —'; return; }
  // dados da última sessão
  const last = hist[hist.length-1].exercicios.find(e=>e.nome===exName);
  const principais = (last.sets||[]).slice(0,3);
  const repsTot = principais.reduce((a,b)=>a+(b.reps||0),0);
  const rirMed = round1(principais.reduce((a,b)=>a+(Number.isFinite(b.rir)?b.rir:0),0) / (principais.length||1));
  const bestPeso = Math.max(...principais.map(s=>s.peso||0));
  const isPerna = ['Hack squat','Leg press','Cadeira extensora','Cadeira flexora','Mesa flexora','Panturrilha banco'].some(n => exName.includes(n) || exName===n);

  let sug = bestPeso;
  if(repsTot >= 30 && rirMed >= 1) sug += isPerna ? 5 : 2;
  else if(repsTot < 18) sug -= 2;

  const badge = card.querySelector(`[data-next="${CSS.escape(exName)}"]`);
  badge.textContent = `Próximo: ${Math.max(0, round1(sug))} kg`;
  badge.title = `Baseado em ${repsTot} reps (3 séries) e RIR médio ${rirMed}`;
}

/* ---------- SALVAR SESSÃO ---------- */
qs('#salvarTreino').addEventListener('click', ()=> salvarSessaoAtual(null));

function salvarSessaoAtual(duracao){
  const hoje = new Date();
  const dataStr = hoje.toISOString().slice(0,10);
  const diaKey = qs('.tab-btn.active')?.dataset.dia || DIAS_MAP[hoje.getDay()];
  const mapa = coletarSetsUI();

  const exercicios = Object.keys(mapa).map(nome=>({ nome, obs: mapa[nome].obs, sets: mapa[nome].sets }));
  const nova = { data:dataStr, duracao:duracao||0, dia:diaKey, exercicios };

  const arr = getSessoes().filter(s=>s.data!==dataStr);
  arr.push(nova); arr.sort((a,b)=>a.data.localeCompare(b.data)); setSessoes(arr);

  // marcar no calendário (sem criar sessão vazia)
  const marks = getMarks(); marks.add(dataStr); setMarks(marks); montarCalendario();

  qs('#statusSave').textContent = '✅ Sessão salva!'; setTimeout(()=>qs('#statusSave').textContent='',1800);

  // atualizar gráficos
  Bridge().Charts.renderAll();

  // sync opcional
  Bridge().FB.pushSession?.(nova).catch?.(()=>{});
}

/* ---------- PERFIL / FIREBASE OPCIONAL ---------- */
const HABITOS = [
  {key:'acordar', label:'Acordar no horário'},
  {key:'cafe', label:'Café da manhã'},
  {key:'creatina', label:'Creatina'},
  {key:'almoco', label:'Almoço'},
  {key:'pre', label:'Pré-treino'},
  {key:'agua', label:'Beber 2,5 L'},
  {key:'sono', label:'Dormir > 7h'}
];

(function montarHabitos(){
  const wrap = qs('#habitos'); wrap.innerHTML='';
  HABITOS.forEach(h=>{
    const row = document.createElement('label');
    row.className='item';
    row.innerHTML = `<input type="checkbox" data-habit="${h.key}"> ${h.label} <span class="muted small" data-streak="${h.key}"></span>`;
    wrap.appendChild(row);
  });
  // carregar do dia
  const key = 'habitos:'+todayStr();
  const saved = loadJSON(key,{});
  wrap.querySelectorAll('[data-habit]').forEach(inp=>{
    inp.checked = !!saved[inp.dataset.habit];
    inp.addEventListener('change', ()=>{
      const obj = loadJSON(key,{});
      obj[inp.dataset.habit] = inp.checked;
      saveJSON(key,obj);
      Bridge().FB.pushHabits?.(todayStr(), obj).catch?.(()=>{});
      atualizarStreaks();
    });
  });
  atualizarStreaks();
})();
function atualizarStreaks(){
  // streak simples: últimos dias consecutivos com > metade dos hábitos marcados
  let streak=0; let d = new Date();
  while(true){
    const key='habitos:'+d.toISOString().slice(0,10);
    const obj = loadJSON(key,null);
    if(!obj) break;
    const marcados = Object.values(obj).filter(Boolean).length;
    if(marcados >= Math.ceil(HABITOS.length/2)){ streak++; d.setDate(d.getDate()-1); } else break;
  }
  // total semana
  const start = new Date(); start.setDate(start.getDate()-6);
  let totSemana=0;
  for(let i=0;i<7;i++){
    const dt = new Date(start); dt.setDate(start.getDate()+i);
    const obj = loadJSON('habitos:'+dt.toISOString().slice(0,10),{});
    totSemana += Object.values(obj).filter(Boolean).length;
  }
  qs('#kpiTop3').textContent = `Streak hábitos: ${streak} • Marcados na semana: ${totSemana}`;
}

/* Firebase opcional – login/logout + perfil */
(async function initFirebaseUI(){
  const FB = Bridge().FB;
  if(!FB?.onAuthChange) return; // módulo pode estar desligado
  FB.onAuthChange(user=>{
    if(user){
      qs('#userStatus').textContent = `Logado: ${user.displayName||user.email}`;
      qs('#btnLogin').style.display='none'; qs('#btnLogout').style.display='';
      qs('#syncInfo').textContent = 'Sincronização: Conectado';
      qs('#nomePerfil').textContent = user.displayName || '—';
      qs('#emailPerfil').textContent = user.email || '—';
      qs('#fotoPerfil').src = user.photoURL || 'icons/icon-192.png';
      FB.pullAndMerge?.().then(()=>{ montarCalendario(); Bridge().Charts.renderAll(); });
    }else{
      qs('#userStatus').textContent = 'Modo local';
      qs('#btnLogin').style.display=''; qs('#btnLogout').style.display='none';
      qs('#syncInfo').textContent = 'Sincronização: —';
      qs('#nomePerfil').textContent = 'Modo offline'; qs('#emailPerfil').textContent='—';
      qs('#fotoPerfil').src = 'icons/icon-192.png';
    }
  });
  qs('#btnLogin').addEventListener('click', ()=> FB.loginWithGoogle?.());
  qs('#btnLogout').addEventListener('click', ()=> FB.logout?.());
})();

/* ---------- FOTOS (local; envia se logado) ---------- */
const fotoInput = qs('#fotoInput');
qs('#btnEnviarFoto').addEventListener('click', async ()=>{
  const f = fotoInput.files?.[0]; if(!f) return;
  const blob = await redimensionarImagem(f, 1200);
  const ym = new Date().toISOString().slice(0,7);
  // salva local
  const key = 'fotos:'+ym;
  const arr = loadJSON(key,[]);
  const id = Date.now().toString(36);
  const url = await blobToDataURL(blob);
  arr.push({id, url, ts:Date.now()}); saveJSON(key,arr);
  renderGridFotos();
  // envia se logado
  Bridge().FB.uploadPhoto?.(blob, ym).catch?.(()=>{});
});
function renderGridFotos(){
  const ym = new Date().toISOString().slice(0,7);
  const arr = loadJSON('fotos:'+ym,[]);
  const g = qs('#gridFotos'); g.innerHTML='';
  arr.slice().reverse().forEach(f=>{ const img = document.createElement('img'); img.src=f.url; g.appendChild(img); });
}
renderGridFotos();

function blobToDataURL(blob){ return new Promise(res=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.readAsDataURL(blob); }); }
function redimensionarImagem(file, maxW){
  return new Promise((resolve)=>{
    const img = new Image();
    img.onload = ()=>{
      const scale = Math.min(1, maxW/img.width);
      const w = Math.round(img.width*scale), h = Math.round(img.height*scale);
      const c = document.createElement('canvas'); c.width=w; c.height=h;
      const ctx = c.getContext('2d'); ctx.drawImage(img,0,0,w,h);
      c.toBlob(b=>resolve(b), 'image/jpeg', .82);
    };
    img.src = URL.createObjectURL(file);
  });
}

/* ---------- CHARTS BRIDGE ---------- */
Bridge().Charts.init?.({ getSessoes, epley1RM });
Bridge().Charts.renderAll?.();

/* ---------- EXPORT RÁPIDO ---------- */
window.addEventListener('keydown', (e)=>{
  if(e.ctrlKey && e.key.toLowerCase()==='e'){
    const blob = new Blob([JSON.stringify(getSessoes(),null,2)], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `sessoes_${todayStr()}.json`; a.click();
  }
});
