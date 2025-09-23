let timer;
let segundos = 0;

document.getElementById("start-treino").addEventListener("click", () => {
  if (timer) {
    clearInterval(timer);
    salvarTreino();
    document.getElementById("start-treino").innerText = "Iniciar treino";
    timer = null;
  } else {
    segundos = 0;
    timer = setInterval(atualizarTimer, 1000);
    document.getElementById("start-treino").innerText = "Finalizar treino";
  }
});

function atualizarTimer() {
  segundos++;
  const h = String(Math.floor(segundos / 3600)).padStart(2, "0");
  const m = String(Math.floor((segundos % 3600) / 60)).padStart(2, "0");
  const s = String(segundos % 60).padStart(2, "0");
  document.getElementById("timer").innerText = `${h}:${m}:${s}`;
}

function salvarTreino() {
  const hoje = new Date().toISOString().split("T")[0];
  let treinos = JSON.parse(localStorage.getItem("treinos")) || [];
  treinos.push({ data: hoje, duracao: segundos });
  localStorage.setItem("treinos", JSON.stringify(treinos));
  montarCalendario();
}

function montarCalendario() {
  const grid = document.getElementById("calendar-grid");
  grid.innerHTML = "";
  const hoje = new Date();
  const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0).getDate();
  const treinos = JSON.parse(localStorage.getItem("treinos")) || [];

  for (let d = 1; d <= diasNoMes; d++) {
    const diaDiv = document.createElement("div");
    diaDiv.classList.add("dia");
    diaDiv.innerText = d;

    const dataStr = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    if (treinos.find(t => t.data === dataStr)) {
      diaDiv.classList.add("treino");
    }

    grid.appendChild(diaDiv);
  }
}

montarCalendario();
