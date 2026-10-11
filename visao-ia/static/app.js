const statusPill = document.getElementById("status-pill");
const fonteAtual = document.getElementById("fonte-atual");
const videoOverlay = document.getElementById("video-overlay");

const elVisitantes = document.getElementById("stat-visitantes");
const elOcupacao = document.getElementById("stat-ocupacao");
const elHomens = document.getElementById("stat-homens");
const elMulheres = document.getElementById("stat-mulheres");
const elIdade = document.getElementById("stat-idade");
const elIndeterminados = document.getElementById("stat-indeterminados");
const elFaixas = document.getElementById("faixas");

const FAIXA_ORDEM = ["0-17", "18-24", "25-34", "35-44", "45-59", "60+"];

async function atualizarStats() {
  try {
    const res = await fetch("/api/stats");
    const s = await res.json();

    elVisitantes.textContent = s.visitantes_unicos_estimado;
    elOcupacao.textContent = s.ocupacao_atual;
    elHomens.textContent = s.homens;
    elMulheres.textContent = s.mulheres;
    elIdade.textContent = s.idade_mediana !== null ? `${s.idade_mediana} anos` : "--";
    elIndeterminados.textContent = s.indeterminados > 0 ? `${s.indeterminados} indeterminado(s) (rosto pequeno/de lado)` : "";

    const maxFaixa = Math.max(1, ...Object.values(s.faixas_etarias));
    elFaixas.innerHTML = FAIXA_ORDEM.map((faixa) => {
      const count = s.faixas_etarias[faixa] || 0;
      const pct = Math.round((count / maxFaixa) * 100);
      return `
        <div class="faixa-row">
          <span class="faixa-label">${faixa}</span>
          <span class="faixa-bar-track"><span class="faixa-bar-fill" style="width:${pct}%"></span></span>
          <span class="faixa-count">${count}</span>
        </div>`;
    }).join("");

    if (s.erro) {
      statusPill.textContent = "Erro";
      statusPill.className = "pill pill-erro";
      videoOverlay.classList.add("hidden");
      fonteAtual.textContent = s.erro;
    } else if (s.ativo) {
      statusPill.textContent = "Ativo";
      statusPill.className = "pill pill-ativo";
      videoOverlay.classList.add("hidden");
      fonteAtual.textContent = s.fonte ? `Fonte: ${s.fonte} · ${s.fps_real} fps · ${s.tracker_tipo}` : "";
    } else {
      statusPill.textContent = "Parado";
      statusPill.className = "pill pill-parado";
      videoOverlay.classList.remove("hidden");
      fonteAtual.textContent = "";
    }
  } catch (e) {
    // painel ainda subindo, ignora silenciosamente
  }
}

document.getElementById("btn-webcam").addEventListener("click", async () => {
  await fetch("/api/fonte/webcam", { method: "POST" });
});

document.getElementById("btn-parar").addEventListener("click", async () => {
  await fetch("/api/parar", { method: "POST" });
});

document.getElementById("btn-reset").addEventListener("click", async () => {
  await fetch("/api/reset", { method: "POST" });
  atualizarStats();
});

document.getElementById("input-video").addEventListener("change", async (ev) => {
  const arquivo = ev.target.files[0];
  if (!arquivo) return;
  const formData = new FormData();
  formData.append("arquivo", arquivo);
  fonteAtual.textContent = "Enviando vídeo...";
  await fetch("/api/fonte/upload", { method: "POST", body: formData });
  ev.target.value = "";
});

setInterval(atualizarStats, 1000);
atualizarStats();
