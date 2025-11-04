/*
  Módulo responsável por calcular e desenhar gráficos de evolução.

  Todas as funções recebem como entrada o array de sessões (já
  migradas), o nome do exercício, o período em dias e um filtro de dia
  da semana ("all" ou a chave da divisão). Os dados são retornados
  prontos para alimentar o Chart.js. As funções de desenho retornam
  instâncias de Chart e destróem automaticamente gráficos anteriores
  quando necessário.
*/

let currentChart = null;

/** Calcula a maior carga registrada por sessão para um exercício. */
export function computeMaxLoadData(sessions, exercise, period, filterDay){
  const desde = new Date(); desde.setDate(desde.getDate() - Number(period));
  const labels = [];
  const values = [];
  sessions.forEach(s => {
    if(new Date(s.data) < desde) return;
    // quando filtrando por dia (split), utilize splitDia em vez de propriedade inexistente `dia`
    if(filterDay && filterDay !== 'all' && s.splitDia && s.splitDia !== filterDay) return;
    const ex = (s.exercicios || []).find(e => e.nome === exercise);
    if(!ex) return;
    let maxKg = 0;
    if(ex.sets && ex.sets.length){
      ex.sets.forEach(z => {
        const kg = Number(z.peso || 0);
        if(kg > maxKg) maxKg = kg;
      });
    }
    // compat: se não houver sets, usa campo peso
    if(maxKg === 0 && ex.peso){ maxKg = Number(ex.peso); }
    if(maxKg > 0){ labels.push(s.data); values.push(maxKg); }
  });
  return { labels, values };
}

/** Calcula a 1RM estimada (Epley) por sessão para um exercício. */
export function compute1RMData(sessions, exercise, period, filterDay){
  const desde = new Date(); desde.setDate(desde.getDate() - Number(period));
  const labels = [];
  const values = [];
  sessions.forEach(s => {
    if(new Date(s.data) < desde) return;
    if(filterDay && filterDay !== 'all' && s.splitDia && s.splitDia !== filterDay) return;
    const ex = (s.exercicios || []).find(e => e.nome === exercise);
    if(!ex) return;
    let maxRm = 0;
    if(ex.sets && ex.sets.length){
      ex.sets.forEach(z => {
        const kg = Number(z.peso || 0);
        const reps = Number(z.reps || 0);
        if(kg > 0 && reps > 0){
          const rm = kg * (1 + reps / 30);
          if(rm > maxRm) maxRm = rm;
        }
      });
    }
    // compat: se não houver sets, usa peso/reps
    if(maxRm === 0 && ex.peso && ex.reps){
      const kg = Number(ex.peso);
      const reps = Number(ex.reps);
      if(kg > 0 && reps > 0){ maxRm = kg * (1 + reps / 30); }
    }
    if(maxRm > 0){ labels.push(s.data); values.push(Number(maxRm.toFixed(2))); }
  });
  return { labels, values };
}

/** Soma o volume por semana ISO no período para todas as sessões filtradas. */
export function computeWeeklyVolumeData(sessions, period, filterDay){
  const desde = new Date(); desde.setDate(desde.getDate() - Number(period));
  const map = new Map();
  sessions.forEach(s => {
    const d = new Date(s.data);
    if(d < desde) return;
    // filtrar pela divisão do dia usando splitDia
    if(filterDay && filterDay !== 'all' && s.splitDia && s.splitDia !== filterDay) return;
    const w = isoWeek(d);
    const vol = volumeSessao(s);
    map.set(w, (map.get(w) || 0) + vol);
  });
  const labels = Array.from(map.keys()).sort();
  const values = labels.map(l => map.get(l));
  return { labels, values };
}

/**
 * Determina os recordes pessoais (PRs) dentro do período para um
 * exercício. Retorna um objeto com as melhores marcas de carga, reps
 * e 1RM, incluindo a data de ocorrência.
 */
export function computePRs(sessions, exercise, period){
  const desde = new Date(); desde.setDate(desde.getDate() - Number(period));
  let bestKg = { val:0, data:null };
  let bestReps = { val:0, data:null, kg:0 };
  let bestRm = { val:0, data:null };
  sessions.forEach(s => {
    if(new Date(s.data) < desde) return;
    const ex = (s.exercicios || []).find(e => e.nome === exercise);
    if(!ex) return;
    if(ex.sets && ex.sets.length){
      ex.sets.forEach(z => {
        const kg = Number(z.peso || 0);
        const reps = Number(z.reps || 0);
        if(kg > bestKg.val){ bestKg = { val:kg, data:s.data }; }
        if(kg > 0 && reps > 0){
          // melhor reps na mesma carga
          if(kg === bestReps.kg && reps > bestReps.val){ bestReps = { val:reps, data:s.data, kg }; }
          // se este kg ainda não registrado
          if(kg > 0 && (bestReps.kg === 0 || kg !== bestReps.kg)){
            if(reps > bestReps.val){ bestReps = { val:reps, data:s.data, kg }; }
          }
          const rm = kg * (1 + reps / 30);
          if(rm > bestRm.val){ bestRm = { val:Number(rm.toFixed(2)), data:s.data }; }
        }
      });
    }else{
      const kg = Number(ex.peso || 0);
      const reps = Number(ex.reps || 0);
      if(kg > bestKg.val){ bestKg = { val:kg, data:s.data }; }
      if(kg > 0 && reps > 0){
        if(kg === bestReps.kg && reps > bestReps.val){ bestReps = { val:reps, data:s.data, kg }; }
        const rm = kg * (1 + reps / 30);
        if(rm > bestRm.val){ bestRm = { val:Number(rm.toFixed(2)), data:s.data }; }
      }
    }
  });
  return { bestKg, bestReps, bestRm };
}

// === Funções auxiliares reutilizadas (copiadas do app) ===
function volumeSessao(s){
  let vol = 0, usouSets = false;
  (s.exercicios || []).forEach(e => {
    if(e.sets && e.sets.length){
      e.sets.forEach(z => {
        if(z.done){
          const kg = Number(z.peso || 0);
          const reps = Number(z.reps || 0);
          if(kg > 0 && reps > 0){ vol += kg * reps; usouSets = true; }
        }
      });
    }
    if(!usouSets){
      const kg = Number(e.peso || 0);
      const reps = Number(e.reps || 0);
      if(kg > 0 && reps > 0) vol += kg * reps;
    }
    usouSets = false;
  });
  return vol;
}
function isoWeek(date){
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1)/7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2,'0')}`;
}

/**
 * Desenha um gráfico de linha. Destrói gráficos existentes para evitar
 * vazamentos de memória. Retorna a nova instância.
 */
export function drawLineChart(ctx, labels, values, label){
  if(currentChart) currentChart.destroy();
  currentChart = new Chart(ctx, {
    type:'line',
    data:{ labels, datasets:[{ label, data:values, borderWidth:2, fill:false }]},
    options:{ responsive:true, plugins:{ legend:{ display:true } }, scales:{ y:{ beginAtZero:true } } }
  });
  return currentChart;
}

/**
 * Desenha um gráfico de barras. Semelhante ao de linha.
 */
export function drawBarChart(ctx, labels, values, label){
  if(currentChart) currentChart.destroy();
  currentChart = new Chart(ctx, {
    type:'bar',
    data:{ labels, datasets:[{ label, data:values }] },
    options:{ responsive:true, scales:{ y:{ beginAtZero:true } } }
  });
  return currentChart;
}