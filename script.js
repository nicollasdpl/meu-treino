let timerInterval;
let startTime;

// Função para timer
function startTimer() {
  startTime = Date.now();
  timerInterval = setInterval(() => {
    let elapsed = Date.now() - startTime;
    let hours = Math.floor(elapsed / 3600000);
    let minutes = Math.floor((elapsed % 3600000) / 60000);
    let seconds = Math.floor((elapsed % 60000) / 1000);
    document.getElementById("timer").textContent =
      `⏱️ ${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  alert("⏹️ Treino finalizado! Duração: " + document.getElementById("timer").textContent);
}

// Exibir treino do dia
function showDay(dia) {
  const treinos = {
    segunda: ["Puxada triângulo alta", "Remada máquina", "Rosca direta barra"],
    terca: ["Supino máquina vertical", "Supino reto com halteres", "Tríceps francês"],
    quarta: ["Desenvolvimento máquina", "Elevação lateral", "Face pull"],
    quinta: ["Hack squat", "Cadeira extensora", "Panturrilha banco"],
    sexta: ["Rosca direta barra", "Martelo", "Tríceps polia barra reta", "Abdômen"]
  };

  let html = `<h2>Treino de ${dia}</h2><table><tr><th>Exercício</th><th>Peso</th><th>Reps</th></tr>`;
  treinos[dia].forEach(ex => {
    html += `<tr><td>${ex}</td><td><input type="number" placeholder="kg"></td><td><input type="number" placeholder="reps"></td></tr>`;
  });
  html += `</table>`;
  document.getElementById("content").innerHTML = html;
}

// Gráfico de evolução (simulado)
const ctx = document.getElementById("chartSupino").getContext("2d");
new Chart(ctx, {
  type: "line",
  data: {
    labels: ["Semana 1", "Semana 2", "Semana 3", "Semana 4"],
    datasets: [{
      label: "Supino Reto (kg)",
      data: [8, 10, 12, 14],
      borderColor: "blue",
      borderWidth: 2,
      fill: false
    }]
  },
  options: { responsive: true }
});
