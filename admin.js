document.addEventListener("click", (evento) => {
  const bottone = evento.target.closest("[data-conferma]");
  if (bottone && !confirm(bottone.dataset.conferma)) evento.preventDefault();
});

const campoRicerca = document.getElementById("cercaUtente");

if (campoRicerca) {
  campoRicerca.addEventListener("input", () => {
    const testo = campoRicerca.value.trim().toLowerCase();
    document.querySelectorAll("#corpoutenti tr").forEach((riga) => {
      riga.hidden = !riga.dataset.nome.includes(testo);
    });
  });
}
