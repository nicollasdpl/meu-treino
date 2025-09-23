// Função para trocar páginas
function mostrarPagina(pagina) {
  document.querySelectorAll('.pagina').forEach(div => div.style.display = 'none');
  document.getElementById(pagina).style.display = 'block';
}

// Dados de treino da semana
const treinosSemana = {
  1: "Costas + Bíceps",
  2: "Peito + Tríceps",
  3: "Ombro",
  4: "Perna",
  5: "Bíceps + Tríceps",
  6: "Livre / Cardio",
  0: "Descanso"
};

// Mostra treino do dia
function atualizarTreinoDoDia() {
  const hoje = new Date().getDay(); // 0 = domingo
  document.getElementById("treinoDoDia").innerText = `Hoje: ${treinosSemana[hoje]}`;
}
atualizarTreinoDoDia();

// Iniciar treino
function iniciarTreino() {
  const status = document.getElementById("statusTreino");
  const hora = new Date().toLocaleTimeString();

  status.innerHTML = `<p>✅ Treino iniciado às ${hora}</p>`;

  // Marca o calendário
  const hoje = new Date().getDate();
  const dia = document.querySelector(`.dia[data-dia='${hoje}']`);
  if (dia) {
    dia.classList.remove("nao-treino");
    dia.classList.add("treino");

    // Salva no localStorage
    let diasTreino = JSON.parse(localStorage.getItem("diasTreino")) || [];
    if (!diasTreino.includes(hoje)) {
      diasTreino.push(hoje);
      localStorage.setItem("diasTreino", JSON.stringify(diasTreino));
    }
  }
}

// Gerar calendário
function gerarCalendario() {
  const calendario = document.getElementById("calendario");
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();

  const primeiroDia = new Date(ano, mes, 1).getDay();
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();

  calendario.innerHTML = "";

  // Preenche dias vazios
  for (let i = 0; i < primeiroDia; i++) {
    const div = document.createElement("div");
    div.classList.add("dia", "fora");
    calendario.appendChild(div);
  }

  // Recupera treinos salvos
  let diasTreino = JSON.parse(localStorage.getItem("diasTreino")) || [];

  // Preenche dias do mês
  for (let d = 1; d <= ultimoDia; d++) {
    const div = document.createElement("div");
    div.classList.add("dia");
    div.dataset.dia = d;
    div.innerText = d;

    if (diasTreino.includes(d)) {
      div.classList.add("treino");
    } else {
      div.classList.add("nao-treino");
    }

    calendario.appendChild(div);
  }
}

gerarCalendario();

// Gráfico de evolução
const ctx = document.getElementById('grafico');
if (ctx) {
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'],
      datasets: [{
        label: 'Carga total (kg)',
        data: [120, 150, 180, 200],
        borderColor: 'rgb(74, 45, 182)',
        backgroundColor: 'rgba(74, 45, 182, 0.2)',
        tension: 0.3
      }]
    }
  });
}
