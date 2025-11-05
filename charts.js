/* =========
   Charts.js
   ========= */
let ChartLib = null;
let getSessoes = ()=>[];
let epley1RM = ()=>0;

export function init(ctx){
  ChartLib = window.Chart;
  getSessoes = ctx.getSessoes;
  epley1RM = ctx.epley1RM;
}
export function renderAll(){
  renderResumo();
  renderGraficos();
  renderPRs();
  renderTonelagem();
}

/* Helpers */
const isoWeek = (date)=>{
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate()+4-dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const week = Math.ceil((((d - yearStart)/86400000)+1)/7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2,'0')}`;
};
function rangeDays(n){ const d=new Date(); d.setDate(d.getDate()-n); return d; }
function volSessao(s){
  return (s.exercicios||[]).reduce((acc,e)=>{
    const v = (e.sets||[]).reduce((t,u)=>t+(u.peso>0&&u.reps>0?u.peso*u.reps:0),0);
    return acc+v;
  },0);
}

/* --------- RESUMO --------- */
let chartResumoVolume;
export function renderResumo(){
  const sess = getSessoes();
  const now = new Date();
  const month = now.getMonth(), year = now.getFullYear();
  const mes = sess.filter(s=>{ const d=new Date(s.data); return d.getMonth()===month && d.getFullYear()===year; });

  const totalTreinos = mes.length;
  const volumeMes = mes.reduce((a,b)=>a+volSessao(b),0);
  const tempoMes = mes.reduce((a,b)=>a+(b.duracao||0),0);
  document.getElementById('kpiTreinosMes').textContent = totalTreinos;
  document.getElementById('kpiVolumeMes').textContent = `${volumeMes} kg`;
  document.getElementById('kpiTempoMes').textContent = `${Math.round(tempoMes/3600)} h`;

  // top3 progresso: exercícios com maior 1RM recente vs início do mês
  const inicioMes = new Date(year,month,1).toISOString().slice(0,10);
  const porEx = {};
  sess.forEach(s=>{
    (s.exercicios||[]).forEach(e=>{
      const max1rm = (e.sets||[]).reduce((m,u)=>Math.max(m,epley1RM(u.peso,u.reps)),0);
      porEx[e.nome]=porEx[e.nome]||{ini:0,fim:0};
      if(s.data<=inicioMes && max1rm>porEx[e.nome].ini) porEx[e.nome].ini=max1rm;
      if(s.data>=inicioMes && max1rm>porEx[e.nome].fim) porEx[e.nome].fim=Math.max(porEx[e.nome].fim,max1rm);
    });
  });
  const rank = Object.entries(porEx).map(([n,v])=>({n, delta:(v.fim - v.ini)})).sort((a,b)=>b.delta-a.delta).slice(0,3);
  document.getElementById('kpiTop3').textContent = rank.length? rank.map(r=>`${r.n} (+${Math.round(r.delta)} 1RM)`).join(', ') : '—';

  // linha: volume por dia no mês
  const byDay = {};
  mes.forEach(s=>{ byDay[s.data]=(byDay[s.data]||0)+volSessao(s); });
  const labels = Object.keys(byDay).sort();
  const data = labels.map(k=>byDay[k]);
  const ctx = document.getElementById('chartResumoVolume').getContext('2d');
  if(chartResumoVolume) chartResumoVolume.destroy();
  chartResumoVolume = new ChartLib(ctx,{type:'line',data:{labels,datasets:[{label:'Volume (kg·reps)',data,borderWidth:2,fill:false}]},options:{responsive:true,scales:{y:{beginAtZero:true}}}});
}

/* --------- GRÁFICOS --------- */
let cCarga, c1RM, cVol;
export function renderGraficos(){
  const select = document.getElementById('selectExercicio');
  const periodo = document.getElementById('periodo');
  // popular lista
  const nomes = new Set();
  getSessoes().forEach(s=> (s.exercicios||[]).forEach(e=>nomes.add(e.nome)));
  if(!select.dataset.ready){
    select.innerHTML=''; [...nomes].sort().forEach(n=>{ const op=document.createElement('option'); op.value=n; op.textContent=n; select.appendChild(op); });
    select.dataset.ready = '1';
    select.addEventListener('change', renderGraficos);
    periodo.addEventListener('change', renderGraficos);
  }
  const nome = select.value || [...nomes][0]; if(!nome) return;
  const dias = Number(periodo.value||90);
  const desde = rangeDays(dias);

  const dados = getSessoes().filter(s=> new Date(s.data)>=desde).map(s=>{
    const e = (s.exercicios||[]).find(x=>x.nome===nome);
    const carga = e ? Math.max(...(e.sets||[]).map(st=>st.peso||0),0) : 0;
    const rm1 = e ? Math.max(...(e.sets||[]).map(st=>epley1RM(st.peso,st.reps)),0) : 0;
    return {data:s.data, carga, rm1, vol:volSessao(s)};
  }).sort((a,b)=>a.data.localeCompare(b.data));

  const lab = dados.map(d=>d.data);
  const ctx1 = document.getElementById('chartCarga').getContext('2d');
  const ctx2 = document.getElementById('chart1RM').getContext('2d');
  const ctx3 = document.getElementById('chartVolumeSem').getContext('2d');
  if(cCarga) cCarga.destroy(); if(c1RM) c1RM.destroy(); if(cVol) cVol.destroy();

  cCarga = new ChartLib(ctx1,{type:'line',data:{labels:lab,datasets:[{label:`${nome} – Carga máx. (kg)`,data:dados.map(d=>d.carga),borderWidth:2,fill:false}]},options:{responsive:true,scales:{y:{beginAtZero:true}}}});
  c1RM   = new ChartLib(ctx2,{type:'line',data:{labels:lab,datasets:[{label:`${nome} – 1RM estimado`,data:dados.map(d=>d.rm1),borderWidth:2,fill:false}]},options:{responsive:true,scales:{y:{beginAtZero:true}}}});

  const byW = {};
  getSessoes().filter(s=> new Date(s.data)>=desde).forEach(s=>{
    const w = isoWeek(new Date(s.data)); byW[w]=(byW[w]||0)+volSessao(s);
  });
  const lw = Object.keys(byW).sort(); const vw = lw.map(k=>byW[k]);
  cVol = new ChartLib(ctx3,{type:'bar',data:{labels:lw,datasets:[{label:'Volume semanal (kg·reps)',data:vw}]},options:{responsive:true,scales:{y:{beginAtZero:true}}}});

  // comparativo mês atual x anterior
  const now = new Date(); const m0 = now.getMonth(), y0 = now.getFullYear();
  const mesAtual = getSessoes().filter(s=>{ const d=new Date(s.data); return d.getMonth()===m0 && d.getFullYear()===y0; });
  const prev = new Date(y0,m0-1,1); const m1 = prev.getMonth(), y1 = prev.getFullYear();
  const mesAnt = getSessoes().filter(s=>{ const d=new Date(s.data); return d.getMonth()===m1 && d.getFullYear()===y1; });
  const volA = mesAtual.reduce((a,b)=>a+volSessao(b),0);
  const volB = mesAnt.reduce((a,b)=>a+volSessao(b),0);
  const diff = volB? Math.round(((volA-volB)/volB)*100) : 0;
  document.getElementById('comparativo').textContent = `Comparativo: mês atual ${volA} kg vs mês anterior ${volB} kg (${diff>=0?'+':''}${diff}%).`;
}

/* --------- PRs --------- */
export function renderPRs(){
  const targ = document.getElementById('listaPRs'); if(!targ) return;
  const hist = getSessoes();
  const prs = [];
  hist.forEach(s=>{
    (s.exercicios||[]).forEach(e=>{
      (e.sets||[]).forEach(st=>{
        prs.push({data:s.data, ex:e.nome, peso:st.peso, reps:st.reps, rm:epley1RM(st.peso,st.reps), vol:st.peso*st.reps});
      });
    });
  });
  // pega os recordes por tipo e exercício
  const byEx = {};
  prs.forEach(p=>{
    const k=p.ex; byEx[k]=byEx[k]||{peso:null,reps:null,rm:null,vol:null};
    if(!byEx[k].peso || p.peso>byEx[k].peso.peso) byEx[k].peso=p;
    if(!byEx[k].reps || p.reps>byEx[k].reps.reps) byEx[k].reps=p;
    if(!byEx[k].rm   || p.rm>byEx[k].rm.rm)       byEx[k].rm=p;
    if(!byEx[k].vol  || p.vol>byEx[k].vol.vol)    byEx[k].vol=p;
  });
  const flat = [];
  Object.entries(byEx).forEach(([ex,vals])=>{
    Object.entries(vals).forEach(([tipo,v])=>{ if(v) flat.push({tipo:tipo.toUpperCase(),ex,data:v.data, peso:v.peso, reps:v.reps, rm:v.rm, vol:v.vol}); });
  });
  flat.sort((a,b)=>a.ex.localeCompare(b.ex));
  targ.innerHTML = flat.length ? flat.map(p=>`<div class="card-mini"><b>${p.ex}</b> · ${p.data} · ${p.tipo} — ${p.tipo==='RM'?p.rm+' 1RM': p.tipo==='PESO'?p.peso+' kg': p.tipo==='REPS'?p.reps+' reps': p.vol+' kg·reps'}</div>`).join('') : '<div class="muted">Sem PRs ainda.</div>';
}

/* --------- TONELAGEM --------- */
let cTon;
export function renderTonelagem(){
  const ctx = document.getElementById('chartTonelagem').getContext('2d');
  const byW = {};
  getSessoes().forEach(s=>{ const w=isoWeek(new Date(s.data)); byW[w]=(byW[w]||0)+volSessao(s); });
  const labs = Object.keys(byW).sort(), vals = labs.map(k=>byW[k]);
  if(cTon) cTon.destroy();
  cTon = new ChartLib(ctx,{type:'bar',data:{labels:labs,datasets:[{label:'Tonelagem semanal',data:vals}]},options:{responsive:true,scales:{y:{beginAtZero:true}}}});
  const media = vals.length? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : 0;
  document.getElementById('tonelagemResumo').textContent = `Semanas: ${vals.length} · Média: ${media} kg·reps/semana.`;
}

/* Tabs internas da aba Evolução */
(function setupAnaTabs(){
  const Tabs = [['resumo','ana-resumo'],['graficos','ana-graficos'],['prs','ana-prs'],['tonelagem','ana-tonelagem']];
  document.querySelectorAll('.tab-ana').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.tab-ana').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      Tabs.forEach(([k,id])=> document.getElementById(id).classList.toggle('hidden', btn.dataset.tab!==k));
      if(btn.dataset.tab==='graficos') renderGraficos();
      if(btn.dataset.tab==='prs') renderPRs();
      if(btn.dataset.tab==='tonelagem') renderTonelagem();
      if(btn.dataset.tab==='resumo') renderResumo();
    });
  });
})();
