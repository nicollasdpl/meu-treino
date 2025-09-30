/* ============ Config Firebase (híbrido) ============ */
const FIREBASE_CFG = {
  apiKey: "AIzaSyAEewjrcLxpXSZMoOPo4nkuTg3lTZI-J78",
  authDomain: "meu-treino-e4592.firebaseapp.com",
  projectId: "meu-treino-e4592",
  storageBucket: "meu-treino-e4592.firebasestorage.app",
  messagingSenderId: "245894818340",
  appId: "1:245894818340:web:dd6ba010356c05b9d846b1",
  measurementId: "G-QW4TNPPE3X"
};

let fb = { app:null, auth:null, provider:null, db:null, user:null, _:{}, ok:false };

(async function tryInitFirebase(){
  try{
    const [{ initializeApp }, { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut },
           { getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc }] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js')
    ]);

    fb.app = initializeApp(FIREBASE_CFG);
    fb.auth = getAuth(fb.app);
    fb.provider = new GoogleAuthProvider();
    fb.db = getFirestore(fb.app);
    fb._ = { doc, setDoc, getDoc, collection, getDocs, deleteDoc, onAuthStateChanged, signInWithPopup, signOut };
    fb.ok = true;

    qs('#firebaseStatus').textContent = 'Firebase pronto (opcional)';
    qs('#btnLogin').classList.remove('hidden');

    fb._.onAuthStateChanged(fb.auth, async (user)=>{
      fb.user = user || null;
      if(user){
        qs('#firebaseStatus').textContent = `Sincronizado: ${user.displayName || user.email}`;
        qs('#btnLogin').classList.add('hidden');
        qs('#btnLogout').classList.remove('hidden');
        await pullMergeFromFirestore();
      }else{
        qs('#firebaseStatus').textContent = 'Modo local';
        qs('#btnLogin').classList.remove('hidden');
        qs('#btnLogout').classList.add('hidden');
      }
      montarCalendario(); atualizarResumoHome(); popularEvolucao();
    });

    qs('#btnLogin').addEventListener('click', async ()=>{
      try{ await fb._.signInWithPopup(fb.auth, fb.provider); }catch(e){ alert('Falha no login'); }
    });
    qs('#btnLogout').addEventListener('click', async ()=>{
      try{ await fb._.signOut(fb.auth); }catch(_){}
    });
  }catch(e){
    // segue local-only, sem travar nada
    qs('#firebaseStatus').textContent = 'Modo local';
  }
})();

/* ============ Helpers e estado local ============ */
const qs  = (s,r=document)=>r.querySelector(s);
const qsa = (s,r=document)=>[...r.querySelectorAll(s)];
const todayKey = ()=> new Date().toISOString().slice(0,10);

const STORAGE_KEYS = {
  sessoes: 'sessoes',
  perfilNome: 'perfilNome',
  perfilFoto: 'perfilFoto',
  habitos: (d)=>`habitos:${d}`
};

function getSessoes(){ return JSON.parse(localStorage.getItem(STORAGE_KEYS.sessoes)||'[]'); }
function setSessoes(arr){ localStorage.setItem(STORAGE_KEYS.sessoes, JSON.stringify(arr)); }

function getHabitos(dataStr){ return JSON.parse(localStorage.getItem(STORAGE_KEYS.habitos(dataStr))||'{}'); }
function setHabitos(dataStr, obj){ localStorage.setItem(STORAGE_KEYS.habitos(dataStr), JSON.stringify(obj)); }

/* ============ Modelo de treino ============ */
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

/* ============ Navegação ============ */
qsa('nav button').forEach(b=>{
  b.addEventListener('click', ()=>{
    qsa('.pagina').forEach(p=>p.classList.add('hidden'));
    qs('#'+b.dataset.go).classList.remove('hidden');
    if(b.dataset.go==='evolucao') popularEvolucao();
  });
});

/* ============ Timer principal ============ */
let timerId=null, startEpoch=null;
qs('#btnTimer').addEventListener('click', ()=>{
  if(timerId){
    clearInterval(timerId); timerId=null;
    qs('#btnTimer').textContent='Iniciar';
  }else{
    startEpoch = Date.now();
    timerId = setInterval(()=>{
      const sec = Math.floor((Date.now()-startEpoch)/1000);
      qs('#timer').textContent = fmtDuracao(sec);
    },1000);
    qs('#btnTimer').textContent='Parar';
  }
});
function fmtDuracao(sec){
  const h=String(Math.floor(sec/3600)).padStart(2,'0');
  const m=String(Math.floor((sec%3600)/60)).padStart(2,'0');
  const s=String(sec%60).padStart(2,'0');
  return `${h}:${m}:${s}`;
}

/* ============ Calendário ============ */
let viewAno, viewMes;
qs('#prevMes').addEventListener('click', ()=>{ viewMes--; if(viewMes<0){viewMes=11;viewAno--;} montarCalendario(); });
qs('#proxMes').addEventListener('click', ()=>{ viewMes++; if(viewMes>11){viewMes=0;viewAno++;} montarCalendario(); });

(function initCalendar(){
  const d = new Date();
  viewAno = d.getFullYear();
  viewMes = d.getMonth();
  montarCalendario();
})();

function montarCalendario(){
  const mesLabel = qs('#mesAno');
  const cal      = qs('#calendario');
  mesLabel.textContent = new Date(viewAno, viewMes).toLocaleString('pt-BR',{month:'long',year:'numeric'});
  cal.innerHTML='';

  const first = new Date(viewAno, viewMes, 1);
  const lastDay = new Date(viewAno, viewMes+1, 0).getDate();
  const offset = first.getDay(); // 0=Dom

  for(let i=0;i<offset;i++){
    const d = document.createElement('div'); d.className='dia fora'; cal.appendChild(d);
  }

  const setDatas = new Set(getSessoes().map(s=>s.data));
  const hoje = new Date();
  for(let dia=1; dia<=lastDay; dia++){
    const d = document.createElement('div');
    d.className='dia'; d.textContent=dia;
    const dataStr = `${viewAno}-${String(viewMes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
    if(setDatas.has(dataStr)) d.classList.add('treino');
    if(dia===hoje.getDate() && viewMes===hoje.getMonth() && viewAno===hoje.getFullYear()){
      d.classList.add('hoje');
    }
    // clique manual: alterna marcar/desmarcar criando/removendo sessão vazia
    d.addEventListener('click', ()=>{
      if(d.classList.contains('treino')){
        d.classList.remove('treino');
        removerSessaoPorDataLocal(dataStr);
        if(fb.ok && fb.user) removerSessaoFirestore(dataStr);
      }else{
        d.classList.add('treino');
        adicionarSessaoVaziaLocal(dataStr);
        if(fb.ok && fb.user) salvarNoFirestore({data:dataStr, duracao:0, dia:null, exercicios:[]});
      }
      atualizarResumoHome(); popularEvolucao();
    });
    cal.appendChild(d);
  }
  atualizarResumoHome();
}

function atualizarResumoHome(){
  const diasTreinadosMes = qs('#diasTreinadosMes');
  const ultimoTreino     = qs('#ultimoTreino');
  const duracaoMedia     = qs('#duracaoMedia');

  const sess = getSessoes().filter(s=>{
    const dt = new Date(s.data);
    return dt.getFullYear()===viewAno && dt.getMonth()===viewMes;
  });
  diasTreinadosMes.textContent = new Set(sess.map(s=>s.data)).size;

  const ult = getSessoes().slice(-1)[0];
  ultimoTreino.textContent = ult ? `${ult.data} (${fmtDuracao(ult.duracao||0)})` : '—';

  const dur = getSessoes().map(s=>s.duracao||0);
  const media = dur.length ? Math.round(dur.reduce((a,b)=>a+b,0)/dur.length) : 0;
  duracaoMedia.textContent = dur.length ? fmtDuracao(media) : '—';
}

/* auxiliares calendário/local */
function adicionarSessaoVaziaLocal(dataStr){
  const arr = getSessoes();
  if(!arr.find(s=>s.data===dataStr)){
    arr.push({data:dataStr, duracao:0, dia:null, exercicios:[]});
    arr.sort((a,b)=>a.data.localeCompare(b.data));
    setSessoes(arr);
  }
}
function removerSessaoPorDataLocal(dataStr){
  setSessoes(getSessoes().filter(s=>s.data!==dataStr));
}
async function removerSessaoFirestore(dataStr){
  try{
    const { doc, deleteDoc } = fb._;
    await deleteDoc( fb._.doc(fb.db, 'users', fb.user.uid, 'sessoes', dataStr) );
  }catch(_){}
}

/* ============ UI Treino (3 séries por exercício) ============ */
const tabs = qsa('.tab-btn');
const listaExEl = qs('#listaExercicios');
const treinoDoDiaEl = qs('#treinoDoDia');

tabs.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    tabs.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    montarExercicios(btn.dataset.dia, true);
  });
});
// seleciona a aba do dia
(function initTabs(){
  const d = new Date().getDay();
  let key='segunda'; if(d===2) key='terca'; if(d===3) key='quarta'; if(d===4) key='quinta'; if(d===5) key='sexta';
  (tabs.find?.(b=>b.dataset.dia===key) || tabs[0])?.click();
})();

qs('#btnCopyLast').addEventListener('click', ()=> {
  const key = qs('.tab-btn.active')?.dataset.dia || 'segunda';
  preencherComUltima(key);
});

function montarExercicios(diaKey, prefill=true){
  const arr = TREINOS[diaKey] || [];
  treinoDoDiaEl.textContent = `Dia selecionado: ${labelDia(diaKey)} · meta 8–12 reps.`;
  listaExEl.innerHTML='';

  const historico = getSessoes();

  arr.forEach(ex=>{
    const last = prefill ? ultimaEntrada(ex.nome, historico) : null;
    const card = document.createElement('div');
    card.className='ex-card';
    card.innerHTML = `
      <b>${ex.nome} <small class="muted">(${ex.alvo})</small></b>
      <div class="sets">
        ${[0,1,2].map(i => `
          <div class="set">
            <div class="row">
              <input type="number" inputmode="decimal" placeholder="kg"   data-ex="${ex.nome}" data-set="${i}" data-field="peso" value="${last?.sets?.[i]?.peso ?? ''}">
              <input type="number" inputmode="numeric" placeholder="reps" data-ex="${ex.nome}" data-set="${i}" data-field="reps" value="${last?.sets?.[i]?.reps ?? ''}">
              <label><input type="checkbox" data-ex="${ex.nome}" data-set="${i}" data-field="done" ${last?.sets?.[i]?.done?'checked':''}> ✓</label>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    listaExEl.appendChild(card);
  });

  atualizarTonelagemPreview();
  listaExEl.addEventListener('input', atualizarTonelagemPreview, { once:true });
}

function labelDia(key){
  return {segunda:'Segunda (Costas+Bíceps)', terca:'Terça (Peito+Tríceps)', quarta:'Quarta (Ombro)', quinta:'Quinta (Perna)', sexta:'Sexta (Braços+Abs)'}[key] || key;
}

function ultimaEntrada(nomeEx, historico){
  // compat: se achar formato antigo {peso,reps}, converte p/ sets[0]
  for(let i=historico.length-1;i>=0;i--){
    const sess = historico[i];
    const e = (sess.exercicios||[]).find(x=>x.nome===nomeEx);
    if(e){
      if(e.sets) return e;
      return { nome: e.nome, sets: [ {peso:e.peso||'', reps:e.reps||'', done:false}, {}, {} ] };
    }
  }
  return null;
}

function coletarInputsExercicios(){
  const map = {};
  qsa('[data-ex]').forEach(el=>{
    const nome = el.dataset.ex, idx = Number(el.dataset.set), field = el.dataset.field;
    map[nome] = map[nome] || { nome, sets:[{},{},{}] };
    if(field==='done') map[nome].sets[idx][field] = el.checked;
    else map[nome].sets[idx][field] = el.value;
  });
  // remove sets vazios (sem peso e reps)
  Object.values(map).forEach(ex=>{
    ex.sets = ex.sets.map(s => ({peso:s.peso||'', reps:s.reps||'', done:!!s.done}));
    // mantém 3 posições, mas é ok se vazio
  });
  return Object.values(map);
}

function preencherComUltima(diaKey){
  const arr = TREINOS[diaKey] || [];
  const hist = getSessoes();
  arr.forEach(ex=>{
    const last = ultimaEntrada(ex.nome, hist);
    if(last){
      last.sets?.forEach((s,i)=>{
        const peso = qs(`[data-ex="${CSS.escape(ex.nome)}"][data-set="${i}"][data-field="peso"]`);
        const reps = qs(`[data-ex="${CSS.escape(ex.nome)}"][data-set="${i}"][data-field="reps"]`);
        const done = qs(`[data-ex="${CSS.escape(ex.nome)}"][data-set="${i}"][data-field="done"]`);
        if(peso) peso.value = s?.peso ?? '';
        if(reps) reps.value = s?.reps ?? '';
        if(done) done.checked = !!s?.done;
      });
    }
  });
  atualizarTonelagemPreview();
}

function atualizarTonelagemPreview(){
  let total=0;
  const exer = coletarInputsExercicios();
  exer.forEach(e=>{
    e.sets.forEach(s=>{
      const kg=Number(s.peso||0), r=Number(s.reps||0);
      if(kg>0 && r>0) total += kg*r;
    });
  });
  qs('#resumoTonelagem').textContent = total>0 ? `Volume estimado do dia: ${total} kg·reps` : '';
}

/* Salvar sessão (local + sync se logado) */
qs('#salvarTreino').addEventListener('click', async ()=>{
  const hoje = new Date();
  const dataStr = hoje.toISOString().slice(0,10);
  const diaKey  = qs('.tab-btn.active')?.dataset.dia || DIAS_MAP[hoje.getDay()];
  const exercicios = coletarInputsExercicios();
  const duracao = getDuracaoAtualReset(false); // não reseta o timer, só lê

  const nova = { data:dataStr, duracao:duracao||0, dia:diaKey, exercicios };

  // local: substitui a sessão do dia
  let arr = getSessoes().filter(s=>s.data!==dataStr);
  arr.push(nova); arr.sort((a,b)=>a.data.localeCompare(b.data));
  setSessoes(arr);

  // marca hoje no calendário
  marcarHojeNoCalendario();
  qs('#statusSave').textContent='✅ Sessão salva';
  setTimeout(()=>qs('#statusSave').textContent='',1600);

  // sync Firestore se logado
  if(fb.ok && fb.user){
    try{ await salvarNoFirestore(nova); qs('#firebaseStatus').textContent = `Sincronizado: ${fb.user.displayName || fb.user.email}`; }catch(_){}
  }

  popularEvolucao(); atualizarResumoHome();
});

function getDuracaoAtualReset(shouldReset=true){
  if(!startEpoch) return 0;
  const sec = Math.floor((Date.now()-startEpoch)/1000);
  if(shouldReset){ clearInterval(timerId); timerId=null; qs('#btnTimer').textContent='Iniciar'; }
  return sec;
}
function marcarHojeNoCalendario(){
  const h=new Date();
  if(h.getFullYear()===viewAno && h.getMonth()===viewMes){
    const dias=[...qsa('.grid-cal .dia')];
    const idx = h.getDate()-1 + new Date(viewAno, viewMes,1).getDay();
    const el = dias[idx]; if(el){ el.classList.add('treino'); }
  }
}

/* ============ Evolução (30 dias) ============ */
function volumeSessao(s){
  let v=0;
  (s.exercicios||[]).forEach(e=>{
    (e.sets||[]).forEach(set=>{
      const kg=Number(set.peso||0), r=Number(set.reps||0);
      if(kg>0 && r>0) v+=kg*r;
    });
    // compat fallback antigo
    if(!e.sets && e.peso && e.reps){
      v += Number(e.peso)*Number(e.reps);
    }
  });
  return v;
}

function popularEvolucao(){
  const arrAll = getSessoes();
  const desde = new Date(); desde.setDate(desde.getDate()-30);
  const ult30 = arrAll.filter(s=> new Date(s.data) >= desde).sort((a,b)=>a.data.localeCompare(b.data));

  const qtd = new Set(ult30.map(s=>s.data)).size;
  const vols = ult30.map(volumeSessao);
  const total = vols.reduce((a,b)=>a+b,0);
  const best = vols.length? Math.max(...vols) : 0;

  qs('#evQtd').textContent = String(qtd);
  qs('#evVol').textContent = String(total);
  qs('#evBest').textContent= String(best);

  const lista = qs('#listaSessoesDetalhe');
  lista.innerHTML='';
  ult30.slice(-12).reverse().forEach(s=>{
    const box = document.createElement('div');
    box.className='card-mini';
    const v = volumeSessao(s);
    const li = (s.exercicios||[]).map(e=>{
      // mostra sets em linha
      const setsTxt = (e.sets||[]).map((z,i)=> (z.peso||z.reps)?`S${i+1}:${z.peso||'-'}kg×${z.reps||'-'}`:null).filter(Boolean).join(' · ');
      return `<li>${e.nome} — ${setsTxt || '—'}</li>`;
    }).join('');
    box.innerHTML = `<div><b>${s.data}</b> · <span class="muted">${labelDia(s.dia||'')}</span> · ${fmtDuracao(s.duracao||0)} · <b>${v} kg·reps</b><ul>${li||'<li class="muted">sem exercícios</li>'}</ul></div>`;
    lista.appendChild(box);
  });
}

/* ============ Perfil (nome, foto, hábitos) ============ */
(function initPerfil(){
  // nome
  const nome = localStorage.getItem(STORAGE_KEYS.perfilNome)||'';
  const nomeEl = qs('#nomePerfil'); nomeEl.value = nome;
  nomeEl.addEventListener('input', ()=> localStorage.setItem(STORAGE_KEYS.perfilNome, nomeEl.value));

  // foto (DataURL)
  const fotoEl = qs('#fotoPerfil');
  const savedFoto = localStorage.getItem(STORAGE_KEYS.perfilFoto);
  if(savedFoto){ fotoEl.src = savedFoto; }
  qs('#fileFoto').addEventListener('change', (e)=>{
    const f=e.target.files?.[0]; if(!f) return;
    const rd=new FileReader(); rd.onload=()=>{ localStorage.setItem(STORAGE_KEYS.perfilFoto, rd.result); fotoEl.src=rd.result; };
    rd.readAsDataURL(f);
  });

  // hábitos (por dia)
  const HABITOS = [
    'Acordar no horário','Café da manhã','Creatina','Almoço','Pré-treino','Beber 2,5L água','Dormir +7h'
  ];
  const wrap = qs('#habitos'); wrap.innerHTML='';
  const dataStr = todayKey();
  const saved = getHabitos(dataStr);
  HABITOS.forEach(h=>{
    const id = 'h-'+h.replace(/\s+/g,'-').toLowerCase();
    const row = document.createElement('label');
    row.className='item';
    row.innerHTML = `<input id="${id}" type="checkbox" ${saved[h]?'checked':''}> ${h}`;
    wrap.appendChild(row);
    row.querySelector('input').addEventListener('change', (ev)=>{
      const cur = getHabitos(dataStr); cur[h] = ev.target.checked; setHabitos(dataStr, cur);
    });
  });
})();

/* ============ Firestore sync (merge) ============ */
async function pullMergeFromFirestore(){
  if(!fb.ok || !fb.user) return;
  const { collection, getDocs } = fb._;
  const ref = collection(fb.db, 'users', fb.user.uid, 'sessoes');
  const snap = await getDocs(ref);
  const cloud = []; snap.forEach(d => cloud.push(d.data()));

  const local = getSessoes();
  const byDate = new Map();
  [...local, ...cloud].forEach(s=>{
    const cur = byDate.get(s.data);
    if(!cur){ byDate.set(s.data, s); return; }
    // critério: mais sets preenchidos vence; desempate por maior duração
    const filled = (x)=> (x.exercicios||[]).reduce((acc,e)=> acc + (e.sets? e.sets.filter(z=>z?.peso||z?.reps).length : ((e.peso||e.reps)?1:0)), 0);
    const a = filled(cur), b = filled(s);
    if(b>a || (b===a && (s.duracao||0)>(cur.duracao||0))) byDate.set(s.data, s);
  });
  const merged = [...byDate.values()].sort((a,b)=>a.data.localeCompare(b.data));
  setSessoes(merged);
}

/* salva uma sessão específica no Firestore */
async function salvarNoFirestore(sessao){
  if(!fb.ok || !fb.user) return;
  const { doc, setDoc } = fb._;
  const ref = doc(fb.db, 'users', fb.user.uid, 'sessoes', sessao.data);
  await setDoc(ref, sessao, { merge:true });
}
