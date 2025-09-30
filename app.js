/* ========= Tema / util ========= */
const qs=(s,r=document)=>r.querySelector(s);
const qsa=(s,r=document)=>[...r.querySelectorAll(s)];
function fmtDuracao(sec){const h=String(Math.floor(sec/3600)).padStart(2,'0');const m=String(Math.floor((sec%3600)/60)).padStart(2,'0');const s=String(sec%60).padStart(2,'0');return `${h}:${m}:${s}`;}
(function themeInit(){const saved=localStorage.getItem('theme')||'dark'; if(saved==='dark') document.documentElement.classList.add('dark'); qs('#btnTheme').textContent=document.documentElement.classList.contains('dark')?'☀️':'🌙';})();
qs('#btnTheme').addEventListener('click',()=>{document.documentElement.classList.toggle('dark');const dark=document.documentElement.classList.contains('dark');localStorage.setItem('theme',dark?'dark':'light');qs('#btnTheme').textContent=dark?'☀️':'🌙';});
qs('#headerToday').textContent=(function(){const d=new Date().getDay();let nome='Descanso'; if(d===1)nome='Costas + Bíceps'; if(d===2)nome='Peito + Tríceps'; if(d===3)nome='Ombro'; if(d===4)nome='Perna'; if(d===5)nome='Bíceps + Tríceps + Abdômen'; return `Hoje é ${new Date().toLocaleDateString()} · Treino do dia: ${nome}`;})();

/* ========= Dados locais ========= */
function getSessoes(){return JSON.parse(localStorage.getItem('sessoes')||'[]');}
function setSessoes(a){localStorage.setItem('sessoes',JSON.stringify(a));}
function getHabitosDia(dataStr){const all=JSON.parse(localStorage.getItem('habitos')||'{}');return all[dataStr]||{};}
function setHabitoDia(dataStr,key,val){const all=JSON.parse(localStorage.getItem('habitos')||'{}'); all[dataStr]=all[dataStr]||{}; all[dataStr][key]=val; localStorage.setItem('habitos',JSON.stringify(all));}

/* ========= Firebase OPCIONAL (não trava app) ========= */
let fb=null, user=null;
(async function initFirebase(){
  try{
    const [{initializeApp},{getAuth,GoogleAuthProvider,onAuthStateChanged,signInWithPopup,signOut},{getFirestore,doc,setDoc,getDoc,collection,getDocs}] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js'),
    ]);
    const cfg={apiKey:"AIzaSyAEewjrcLxpXSZMoOPo4nkuTg3lTZI-J78",authDomain:"meu-treino-e4592.firebaseapp.com",projectId:"meu-treino-e4592",storageBucket:"meu-treino-e4592.firebasestorage.app",messagingSenderId:"245894818340",appId:"1:245894818340:web:dd6ba010356c05b9d846b1",measurementId:"G-QW4TNPPE3X"};
    const app=initializeApp(cfg); const auth=getAuth(app); const provider=new GoogleAuthProvider(); const db=getFirestore(app);
    fb={app,auth,provider,db,_:{doc,setDoc,getDoc,collection,getDocs,signInWithPopup,signOut,onAuthStateChanged}};
    qs('#firebaseStatus').textContent='Local + Firebase (opcional)';
    // Perfil: login/logout
    qs('#btnLoginGoogle').classList.remove('hidden');
    qs('#btnLoginGoogle').onclick=async ()=>{try{await fb._.signInWithPopup(fb.auth,fb.provider);}catch(_){alert('Falha no login');}};
    qs('#btnLogout').onclick=async ()=>{try{await fb._.signOut(fb.auth);}catch(_){}};
    fb._.onAuthStateChanged(fb.auth, async (u)=>{
      user=u||null;
      if(user){
        qs('#btnLoginGoogle').classList.add('hidden'); qs('#btnLogout').classList.remove('hidden');
        qs('#nomePerfil').textContent=user.displayName||user.email; qs('#emailPerfil').textContent=user.email||''; if(user.photoURL) qs('#fotoPerfil').src=user.photoURL;
        // puxar habitos de hoje (merge simples)
        await carregarHabitosCloudHojeMerge();
        qs('#syncInfo').textContent='Conectado';
      }else{
        qs('#btnLoginGoogle').classList.remove('hidden'); qs('#btnLogout').classList.add('hidden');
        qs('#nomePerfil').textContent='Convidado'; qs('#emailPerfil').textContent='—'; qs('#fotoPerfil').removeAttribute('src');
        qs('#syncInfo').textContent='Offline';
      }
    });
  }catch(_){ qs('#firebaseStatus').textContent='Modo local (Firebase off)'; }
})();
async function carregarHabitosCloudHojeMerge(){
  if(!fb||!user) return;
  const {doc,getDoc,setDoc}=fb._; const dataStr=new Date().toISOString().slice(0,10); const ref=doc(fb.db,'users',user.uid,'habitos',dataStr); const s=await getDoc(ref);
  const local=getHabitosDia(dataStr); const cloud=s.exists()?s.data():{};
  const merged={...cloud,...local}; await setDoc(ref,merged,{merge:true}); // prioriza local
}

/* ========= Treinos ========= */
const TREINOS={
  segunda:[
    {nome:'Puxada triângulo alta',alvo:'3x8–12'},
    {nome:'Puxada barra reta alta',alvo:'3x8–12'},
    {nome:'Remada máquina',alvo:'3x8–12'},
    {nome:'Rosca direta barra',alvo:'3x8–12'},
    {nome:'Martelo',alvo:'3x10–12'},
    {nome:'Banco Scott',alvo:'3x8–12'},
    {nome:'Lombar máquina',alvo:'3x15–20'},
  ],
  terca:[
    {nome:'Supino máquina vertical',alvo:'3x8–12'},
    {nome:'Supino reto com halteres',alvo:'3x8–12'},
    {nome:'Crucifixo reto com halteres',alvo:'3x10–12'},
    {nome:'Supino declinado convergente',alvo:'3x8–12'},
    {nome:'Tríceps francês',alvo:'3x10–12'},
    {nome:'Tríceps polia barra reta',alvo:'3x12–15'},
  ],
  quarta:[
    {nome:'Desenvolvimento máquina',alvo:'3x8–12'},
    {nome:'Elevação lateral',alvo:'3x12–15'},
    {nome:'Crucifixo inverso / Face pull',alvo:'3x12–15'},
    {nome:'Encolhimento trapézio',alvo:'3x12–15'},
  ],
  quinta:[
    {nome:'Hack squat',alvo:'3x8–12'},
    {nome:'Leg press',alvo:'3x10–15'}, /* pedido */
    {nome:'Cadeira extensora',alvo:'3x12–15'},
    {nome:'Cadeira flexora',alvo:'3x12–15'},
    {nome:'Mesa flexora',alvo:'3x10–12'},
    {nome:'Panturrilha banco',alvo:'3x15–20'},
  ],
  sexta:[
    {nome:'Rosca direta barra',alvo:'3x8–12'},
    {nome:'Martelo',alvo:'3x10–12'},
    {nome:'Tríceps francês',alvo:'3x10–12'},
    {nome:'Tríceps polia barra reta',alvo:'3x12–15'},
    {nome:'Abdômen (prancha, infra, polia)',alvo:'3 séries'},
  ]
};
const DIAS_MAP={0:'domingo',1:'segunda',2:'terca',3:'quarta',4:'quinta',5:'sexta',6:'sabado'};

/* ========= Calendário ========= */
let viewAno,viewMes; const mesLabel=qs('#mesAno'); const calEl=qs('#calendario');
qs('#prevMes').onclick=()=>{viewMes--; if(viewMes<0){viewMes=11;viewAno--;} montarCalendario();};
qs('#proxMes').onclick=()=>{viewMes++; if(viewMes>11){viewMes=0;viewAno++;} montarCalendario();};
(function initCalendar(){const hoje=new Date();viewAno=hoje.getFullYear();viewMes=hoje.getMonth(); montarCalendario();})();
function montarCalendario(){
  mesLabel.textContent=new Date(viewAno,viewMes).toLocaleString('pt-BR',{month:'long',year:'numeric'});
  calEl.innerHTML='';
  const first=new Date(viewAno,viewMes,1); const last=new Date(viewAno,viewMes+1,0).getDate(); const off=first.getDay();
  for(let i=0;i<off;i++){const d=document.createElement('div'); d.className='dia fora'; calEl.appendChild(d);}
  const setDatas=new Set(getSessoes().map(s=>s.data)); const hoje=new Date();
  for(let dia=1; dia<=last; dia++){
    const d=document.createElement('div'); d.className='dia'; d.dataset.dia=String(dia).padStart(2,'0'); d.textContent=dia;
    const dataStr=`${viewAno}-${String(viewMes+1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
    if(setDatas.has(dataStr)) d.classList.add('treino'); else d.classList.add('nao-treino');
    if(dia===hoje.getDate() && viewMes===hoje.getMonth() && viewAno===hoje.getFullYear()) d.classList.add('hoje');
    d.addEventListener('click',()=>{ // toggle manual
      if(d.classList.contains('treino')){ d.classList.remove('treino'); d.classList.add('nao-treino'); removerSessaoPorData(dataStr); }
      else { d.classList.remove('nao-treino'); d.classList.add('treino'); adicionarSessaoVazia(dataStr); }
      atualizarResumoHome();
    });
    calEl.appendChild(d);
  }
  atualizarResumoHome();
}
function adicionarSessaoVazia(dataStr){const sess=getSessoes(); if(!sess.find(s=>s.data===dataStr)){sess.push({data:dataStr,duracao:0,dia:null,exercicios:[]}); setSessoes(sess);}}
function removerSessaoPorData(dataStr){setSessoes(getSessoes().filter(s=>s.data!==dataStr));}
function marcarHojeNoCalendario(){const h=new Date(); if(h.getFullYear()===viewAno && h.getMonth()===viewMes){const ds=String(h.getDate()).padStart(2,'0'); const el=[...qsa('.dia')].find(x=>x.dataset.dia===ds); if(el){el.classList.remove('nao-treino'); el.classList.add('treino');}} atualizarResumoHome();}
function atualizarResumoHome(){
  const sess=getSessoes().filter(s=>{const dt=new Date(s.data); return dt.getFullYear()===viewAno && dt.getMonth()===viewMes;});
  qs('#diasTreinadosMes').textContent=new Set(sess.map(s=>s.data)).size;
  const ult=getSessoes().slice(-1)[0]; qs('#ultimoTreino').textContent=ult?`${ult.data} (${fmtDuracao(ult.duracao||0)})`:'—';
  const dur=getSessoes().map(s=>s.duracao||0); const media=dur.length?Math.round(dur.reduce((a,b)=>a+b,0)/dur.length):0;
  qs('#duracaoMedia').textContent=dur.length?fmtDuracao(media):'—';
}

/* ========= Timer principal ========= */
let timerId=null,startEpoch=null; const timerEl=qs('#timer');
qs('#btnTimer').onclick=()=>{
  if(timerId){ clearInterval(timerId); timerId=null; const dur=Math.floor((Date.now()-startEpoch)/1000); qs('#btnTimer').textContent='Iniciar'; salvarSessaoAtual(dur); }
  else { startEpoch=Date.now(); timerId=setInterval(()=>{timerEl.textContent=fmtDuracao(Math.floor((Date.now()-startEpoch)/1000));},1000); qs('#btnTimer').textContent='Finalizar'; }
};

/* ========= Descanso ========= */
let audioCtx=null; function ensureAudioCtx(){ if(!audioCtx){const AC=window.AudioContext||window.webkitAudioContext; audioCtx=AC?new AC():null;} if(audioCtx?.state==='suspended'){audioCtx.resume?.();}}
function beep(times=3,freq=880,dur=200){ if(!audioCtx) return; let t=0; for(let i=0;i<times;i++){ setTimeout(()=>{ const o=audioCtx.createOscillator(),g=audioCtx.createGain(); o.frequency.value=freq;o.type='sine'; o.connect(g); g.connect(audioCtx.destination); g.gain.setValueAtTime(0.001,audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.4,audioCtx.currentTime+0.01); o.start(); setTimeout(()=>o.stop(),dur); },t); t+=dur+120; } }
let notifReady=false; async function ensureNotifyPermission(){ if(!("Notification" in window)) return false; if(Notification.permission==="granted") return true; if(Notification.permission!=="denied"){const p=await Notification.requestPermission(); return p==="granted";} return false;}
qs('#btnNotify').onclick=async ()=>{ ensureAudioCtx(); notifReady=await ensureNotifyPermission(); qs('#btnNotify').textContent=notifReady?'🔔':'🔕'; };
let restId=null,restLeft=0,beepLoop=null; const restSeg=qs('#restSeg'),restDisplay=qs('#restDisplay'),overlay=qs('#restOverlay');
qs('#btnOverlayOk').onclick=()=>{overlay.classList.add('hidden'); clearInterval(beepLoop); beepLoop=null;};
qs('#btnOverlayBuzz').onclick=()=>{ try{navigator.vibrate&&navigator.vibrate([200,100,300]);}catch(_){} ensureAudioCtx(); beep(2,1250,200); };
qs('#btnRest').onclick=()=>startDescanso();
function startDescanso(){
  if(restId){ clearInterval(restId); restId=null; restDisplay.textContent='—'; clearInterval(beepLoop); beepLoop=null; overlay.classList.add('hidden'); return; }
  ensureAudioCtx(); restLeft=Math.max(10,Number(restSeg.value||60)); restDisplay.textContent=`${restLeft}s`;
  restId=setInterval(()=>{
    restLeft--; restDisplay.textContent=`${restLeft}s`;
    if(restLeft<=0){ clearInterval(restId); restId=null; restDisplay.textContent='⏰ Descanso finalizado!'; try{navigator.vibrate&&navigator.vibrate([250,120,250,120,400]);}catch(_){} beep(3,1100,220); overlay.classList.remove('hidden'); if(notifReady){try{new Notification('Descanso finalizado!',{body:'Bora pra próxima série.'});}catch(_){}} beepLoop=setInterval(()=>{ensureAudioCtx(); beep(1,1200,180);},1200); const base=document.title; let f=0; const blink=setInterval(()=>{document.title=(++f%2)?'⏰ Descanso!':base; if(f>10){clearInterval(blink); document.title=base;}},500);}
  },1000);
}

/* ========= UI Treino (3 séries) ========= */
const tabs=qsa('.tab-btn'); const listaExEl=qs('#listaExercicios'); const treinoDoDiaEl=qs('#treinoDoDia'); const salvarBtn=qs('#salvarTreino'); const copyBtn=qs('#btnCopyLast');
tabs.forEach(btn=>btn.addEventListener('click',()=>{tabs.forEach(b=>b.classList.remove('active')); btn.classList.add('active'); montarExercicios(btn.dataset.dia,true);}));
copyBtn.onclick=()=>{const key=qs('.tab-btn.active')?.dataset.dia||'segunda'; preencherComUltima(key);};
(function initTabs(){const d=new Date().getDay(); let key='segunda'; if(d===2)key='terca'; if(d===3)key='quarta'; if(d===4)key='quinta'; if(d===5)key='sexta'; tabs.forEach(b=>b.classList.remove('active')); const chosen=[...tabs].find(b=>b.dataset.dia===key)||tabs[0]; chosen.classList.add('active'); montarExercicios(chosen.dataset.dia,true);})();

function labelDia(key){return {segunda:'Segunda (Costas+Bíceps)',terca:'Terça (Peito+Tríceps)',quarta:'Quarta (Ombro)',quinta:'Quinta (Perna)',sexta:'Sexta (Braços+Abs)'}[key]||key;}
function ultimaEntrada(nomeEx){const hist=getSessoes(); for(let i=hist.length-1;i>=0;i--){const e=hist[i].exercicios?.find(x=>x.nome===nomeEx); if(e){ if(e.sets?.length){const filled=[...e.sets].reverse().find(s=>s.peso||s.reps); return filled||e.sets[0];} return {peso:e.peso,reps:e.reps,obs:e.obs}; }} return null;}

function montarExercicios(diaKey,prefill=true){
  const arr=TREINOS[diaKey]||[]; treinoDoDiaEl.textContent=`Dia selecionado: ${labelDia(diaKey)} · Registre 3 séries (peso + reps).`; listaExEl.innerHTML='';
  arr.forEach(ex=>{
    const last=prefill?ultimaEntrada(ex.nome):null;
    const card=document.createElement('div'); card.className='ex-card';
    card.innerHTML=`
      <div class="ex-title"><b>${ex.nome}</b><small>${ex.alvo}</small>
        <div class="obs"><textarea rows="1" placeholder="obs" data-field="obs" data-ex="${ex.nome}">${last?.obs??''}</textarea></div>
      </div>
      <div class="sets" data-ex="${ex.nome}">
        ${[1,2,3].map(i=>`
          <div class="set">
            <div class="top">
              <input type="number" inputmode="decimal" step="0.5" placeholder="kg" data-field="peso${i}">
              <input type="number" inputmode="numeric" placeholder="reps" data-field="reps${i}">
              <input type="checkbox" class="done" title="Concluir série" data-field="done${i}">
            </div>
            <div class="small muted">Série ${i}</div>
          </div>`).join('')}
      </div>`;
    listaExEl.appendChild(card);
    if(last){ for(let i=1;i<=3;i++){ const p=qs(`[data-ex="${CSS.escape(ex.nome)}"] [data-field="peso${i}"]`); const r=qs(`[data-ex="${CSS.escape(ex.nome)}"] [data-field="reps${i}"]`); if(p&&last.peso) p.value=last.peso; if(r&&last.reps) r.value=last.reps; } }
  });
  listaExEl.addEventListener('change', e=>{
    if(e.target.closest('.done') && e.target.checked){ ensureAudioCtx(); if(!restId){startDescanso();} }
    if(e.target.matches('input,textarea')) recalcularTonelagem();
  }, {once:true});
  recalcularTonelagem();
}

function coletarSessaoDoForm(){
  const mapa={};
  qsa('.sets').forEach(box=>{
    const nome=box.dataset.ex; const sets=[];
    for(let i=1;i<=3;i++){
      const peso=Number(qs(`[data-ex="${CSS.escape(nome)}"] [data-field="peso${i}"]`)?.value||0);
      const reps=Number(qs(`[data-ex="${CSS.escape(nome)}"] [data-field="reps${i}"]`)?.value||0);
      const done=!!qs(`[data-ex="${CSS.escape(nome)}"] [data-field="done${i}"]`)?.checked;
      sets.push({peso,reps,done});
    }
    const obs=qs(`[data-field="obs"][data-ex="${CSS.escape(nome)}"]`)?.value||'';
    mapa[nome]={nome,obs,sets};
  });
  return Object.values(mapa);
}
function tonelagemExercicio(ex){const marcado=ex.sets?.some(s=>s.done); const base=(ex.sets||[]).filter(s=>marcado?s.done:true); return base.reduce((a,s)=>a+(Number(s.peso||0)*Number(s.reps||0)),0);}
function recalcularTonelagem(){const exs=coletarSessaoDoForm(); const linhas=exs.map(e=>`${e.nome}: ${tonelagemExercicio(e)} kg·reps`); const total=exs.reduce((a,e)=>a+tonelagemExercicio(e),0); qs('#resumoTonelagem').innerHTML=linhas.join(' · ')+(linhas.length?` <b>| Total:</b> ${total} kg·reps`: '');}

async function salvarSessaoAtual(dur){
  const hoje=new Date(); const dataStr=hoje.toISOString().slice(0,10); const diaKey=qs('.tab-btn.active')?.dataset.dia||DIAS_MAP[hoje.getDay()];
  const exercicios=coletarSessaoDoForm();
  const sess=getSessoes().filter(s=>s.data!==dataStr);
  sess.push({data:dataStr,duracao:dur||0,dia:diaKey,exercicios}); sess.sort((a,b)=>a.data.localeCompare(b.data));
  setSessoes(sess); marcarHojeNoCalendario(); qs('#statusSave').textContent='✅ Sessão salva!'; setTimeout(()=>qs('#statusSave').textContent='',1600);
  popularListaExerciciosChart(); desenharGrafico(); desenharVolume(); preencherSessoesDetalhe();
}
salvarBtn.onclick=()=>salvarSessaoAtual(null);

/* ========= Evolução ========= */
let chart,volumeChart; const selectEx=qs('#selectExercicio'); const periodoSel=qs('#periodo'); const listaSessoesDetalhe=qs('#listaSessoesDetalhe');
function popularListaExerciciosChart(){const nomes=new Set(); getSessoes().forEach(s=>(s.exercicios||[]).forEach(e=>nomes.add(e.nome))); Object.values(TREINOS).flat().forEach(e=>nomes.add(e.nome)); selectEx.innerHTML=''; [...nomes].sort().forEach(n=>{const op=document.createElement('option'); op.value=n; op.textContent=n; selectEx.appendChild(op);});}
function dadoExercicioPorSessao(nome){const arr=[]; getSessoes().forEach(s=>{const e=(s.exercicios||[]).find(x=>x.nome===nome); if(!e) return; let maxKg=0,vol=0; if(e.sets?.length){e.sets.forEach(st=>{const kg=Number(st.peso||0), r=Number(st.reps||0); if(kg>maxKg) maxKg=kg; if(kg>0&&r>0) vol+=kg*r;});} else {const kg=Number(e.peso||0),r=Number(e.reps||0); maxKg=kg; vol=(kg>0&&r>0)?kg*r:0;} arr.push({data:s.data,maxKg: maxKg, volume: vol});}); arr.sort((a,b)=>a.data.localeCompare(b.data)); return arr;}
function desenharGrafico(){const nome=selectEx.value; if(!nome) return; const dados=dadoExercicioPorSessao(nome); const ctx=qs('#chartCanvas').getContext('2d'); if(chart) chart.destroy(); chart=new Chart(ctx,{type:'line',data:{labels:dados.map(d=>d.data),datasets:[{label:`${nome} · Máx. (kg)`,data:dados.map(d=>d.maxKg),borderWidth:2,fill:false}]},options:{responsive:true,plugins:{legend:{display:true}},scales:{y:{beginAtZero:true}}}});}
function isoWeek(date){const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())); const dayNum=d.getUTCDay()||7; d.setUTCDate(d.getUTCDate()+4-dayNum); const yStart=new Date(Date.UTC(d.getUTCFullYear(),0,1)); return `${d.getUTCFullYear()}-W${String(Math.ceil((((d-yStart)/86400000)+1)/7)).padStart(2,'0')}`;}
function desenharVolume(){const nome=selectEx.value; if(!nome) return; const arr=dadoExercicioPorSessao(nome); const byW=new Map(); arr.forEach(d=>{const w=isoWeek(new Date(d.data)); byW.set(w,(byW.get(w)||0)+d.volume);}); const labels=[...byW.keys()].sort(); const values=labels.map(k=>byW.get(k)); const ctx=qs('#volumeCanvas').getContext('2d'); if(volumeChart) volumeChart.destroy(); volumeChart=new Chart(ctx,{type:'bar',data:{labels,datasets:[{label:'Volume semanal (kg·reps)',data:values}]},options:{responsive:true,scales:{y:{beginAtZero:true}}}});}
function preencherSessoesDetalhe(){const nome=selectEx.value; if(!nome) return; const arr=getSessoes().filter(s=>(s.exercicios||[]).some(e=>e.nome===nome)).slice(-12).reverse(); listaSessoesDetalhe.innerHTML=''; arr.forEach(s=>{const e=s.exercicios.find(x=>x.nome===nome); let linhas=''; if(e.sets?.length){e.sets.forEach((st,i)=>linhas += `<li>S${i+1}: ${st.peso||'-'} kg × ${st.reps||'-'} ${st.done?'✔':''}</li>`);} else {linhas=`<li>${e.peso||'-'} kg × ${e.reps||'-'}</li>`;} const vol=(e.sets||[]).reduce((a,st)=>a+(Number(st.peso||0)*Number(st.reps||0)),0); const titulo=`${s.data} · ${s.dia||''} · ${fmtDuracao(s.duracao||0)} · Vol: ${vol} kg·reps`; const box=document.createElement('div'); box.className='card-mini'; box.innerHTML=`<div><strong>${titulo}</strong><ul>${linhas}</ul>${e.obs?`<div class="muted small">obs: ${e.obs}</div>`:''}</div>`; listaSessoesDetalhe.appendChild(box);});}
selectEx.addEventListener('change',()=>{desenharGrafico(); desenharVolume(); preencherSessoesDetalhe();}); periodoSel.addEventListener('change',()=>{desenharGrafico(); desenharVolume(); preencherSessoesDetalhe();});
popularListaExerciciosChart(); desenharGrafico(); desenharVolume(); preencherSessoesDetalhe();

/* ========= Navegação ========= */
qsa('nav button').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.go; qsa('.pagina').forEach(p=>p.classList.add('hidden')); qs('#'+id).classList.remove('hidden'); if(id==='graficos'){popularListaExerciciosChart(); desenharGrafico(); desenharVolume(); preencherSessoesDetalhe();} if(id==='home'){atualizarResumoHome();}}));

/* ========= Hábitos (perfil) ========= */
const HABITOS_LIST=[{key:'acordar',label:'Acordar no horário'},{key:'cafe',label:'Café da manhã'},{key:'creatina',label:'Creatina'},{key:'almoco',label:'Almoço'},{key:'pre',label:'Pré-treino'},{key:'agua',label:'Beber 2,5L'},{key:'sono',label:'Dormir >7h'}];
(function renderHabitos(){const wrap=qs('#habitos'); wrap.innerHTML=''; const dataStr=new Date().toISOString().slice(0,10); const saved=getHabitosDia(dataStr); HABITOS_LIST.forEach(h=>{const row=document.createElement('label'); row.className='item'; row.innerHTML=`<input type="checkbox" ${saved[h.key]?'checked':''}/> <span>${h.label}</span>`; row.querySelector('input').addEventListener('change',async (e)=>{setHabitoDia(dataStr,h.key,e.target.checked); if(fb&&user){const {doc,setDoc}=fb._; const ref=fb._.doc(fb.db,'users',user.uid,'habitos',dataStr); await setDoc(ref,{[h.key]:e.target.checked},{merge:true});}}); wrap.appendChild(row);});})();

