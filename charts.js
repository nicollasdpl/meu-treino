// charts.js - functions for computing and drawing workout progress graphs

/**
 * Compute maximum load per session for an exercise.
 * sessions: array of session objects
 * exerciseName: string
 * periodStart: timestamp in ms
 */
export function computeMaxLoadData(sessions, exerciseName, periodStart) {
  const labels = [];
  const data = [];
  sessions.forEach(session => {
    const ts = new Date(session.data).getTime();
    if (ts < periodStart) return;
    let maxLoad = 0;
    session.exercicios.forEach(ex => {
      if (ex.nome === exerciseName) {
        ex.sets.forEach(set => {
          const load = (set.peso || 0) * (set.reps || 0);
          if (load > maxLoad) maxLoad = load;
        });
      }
    });
    labels.push(session.data);
    data.push(maxLoad);
  });
  return { labels, data };
}

/**
 * Compute estimated 1RM per session for an exercise (Epley formula).
 */
export function compute1RMData(sessions, exerciseName, periodStart) {
  const labels = [];
  const data = [];
  sessions.forEach(session => {
    const ts = new Date(session.data).getTime();
    if (ts < periodStart) return;
    let max1RM = 0;
    session.exercicios.forEach(ex => {
      if (ex.nome === exerciseName) {
        ex.sets.forEach(set => {
          const { peso=0, reps=0 } = set;
          if (peso && reps) {
            const rm = peso * (1 + reps / 30);
            if (rm > max1RM) max1RM = rm;
          }
        });
      }
    });
    labels.push(session.data);
    data.push(parseFloat(max1RM.toFixed(1)));
  });
  return { labels, data };
}

/**
 * Compute weekly volume (sum kg*reps) for an exercise or total.
 */
export function computeWeeklyVolumeData(sessions, exerciseName, periodWeeks=12) {
  // Determine ISO week number
  function getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }
  const now = new Date();
  const currentWeek = getISOWeek(now);
  const year = now.getFullYear();
  const map = {};
  sessions.forEach(session => {
    const d = new Date(session.data);
    const week = getISOWeek(d);
    const volKey = `${d.getFullYear()}-W${week}`;
    let total = 0;
    session.exercicios.forEach(ex => {
      if (!exerciseName || ex.nome === exerciseName) {
        ex.sets.forEach(set => {
          total += (set.peso || 0) * (set.reps || 0);
        });
      }
    });
    map[volKey] = (map[volKey] || 0) + total;
  });
  // Build arrays for the last n weeks
  const labels = [];
  const data = [];
  for (let i = periodWeeks - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const wk = getISOWeek(d);
    const key = `${d.getFullYear()}-W${wk}`;
    labels.push(key);
    data.push(map[key] || 0);
  }
  return { labels, data };
}

/**
 * Compute top exercises by volume change (progress) in the last month.
 */
export function computeTopExercises(sessions, periodDays=30) {
  const cutoff = Date.now() - periodDays * 86400000;
  const map = {};
  sessions.forEach(session => {
    const ts = new Date(session.data).getTime();
    if (ts < cutoff) return;
    session.exercicios.forEach(ex => {
      let total = 0;
      ex.sets.forEach(set => {
        total += (set.peso || 0) * (set.reps || 0);
      });
      map[ex.nome] = (map[ex.nome] || 0) + total;
    });
  });
  // sort by total desc
  const sorted = Object.entries(map).sort((a,b) => b[1] - a[1]).slice(0,3);
  return sorted.map(([nome, total]) => ({ nome, total }));
}

/**
 * Create a line chart using Chart.js. Returns the created chart instance.
 */
export function drawLineChart(ctx, labels, data, labelName) {
  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: labelName,
        data: data,
        fill: false,
        tension: 0.1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: {} }
      },
      scales: {
        x: { display: true },
        y: { display: true }
      }
    }
  });
}

/**
 * Create a bar chart using Chart.js.
 */
export function drawBarChart(ctx, labels, data, labelName) {
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: labelName,
        data: data,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { display: true },
        y: { display: true }
      }
    }
  });
}