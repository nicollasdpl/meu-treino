// Função para trocar páginas
function mostrarPagina(pagina) {
  document.querySelectorAll('.pagina').forEach(div => div.style.display = 'none');
  document.getElementById(pagina).style.display = 'block';
}

// Simular treino ativo
function iniciarTreino() {
  const treinoAtivo = document.getElementById("treinoAtivo");
  const hora = new Date().toLocaleTimeString();
  treinoAtivo.innerHTML = `<p>✅ Treino iniciado às ${hora}</p>`;
}

// Gráfico básico de exemplo
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
