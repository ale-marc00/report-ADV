// function calcolaKPICampagna(
//   speseAnnuncio,
//   impresioniAnnuncio,
//   clickAnnuncio,
//   leadAnnuncio,
//   conversioniAnnuncio,
//   ricaviAnnuncio,
// ) {
//   const ctrAnnuncio =
//     impresioniAnnuncio > 0
//       ? ((clickAnnuncio / impresioniAnnuncio) * 100).toFixed(2)
//       : "0.00";
//   const cpcAnnuncio =
//     clickAnnuncio > 0 ? (speseAnnuncio / clickAnnuncio).toFixed(2) : "0.00";
//   const cpmAnnuncio =
//     impresioniAnnuncio > 0
//       ? ((speseAnnuncio / impresioniAnnuncio) * 1000).toFixed(2)
//       : "0.00";
//   const cplAnnuncio =
//     leadAnnuncio > 0 ? (speseAnnuncio / leadAnnuncio).toFixed(2) : "0.00";
//   const cpaAnnuncio =
//     conversioniAnnuncio > 0
//       ? (speseAnnuncio / conversioniAnnuncio).toFixed(2)
//       : "0.00";
//   const roasAnnuncio =
//     speseAnnuncio > 0 ? (ricaviAnnuncio / speseAnnuncio).toFixed(2) : "0.00";

//   return {
//     ctr: ctrAnnuncio,
//     cpc: cpcAnnuncio,
//     cpm: cpmAnnuncio,
//     cpl: cplAnnuncio,
//     cpa: cpaAnnuncio,
//     roas: roasAnnuncio,
//   };
// }

// function aggiungiCampagna() {
//   const form = document.querySelector(".form-campagna");

//   const nuovaCampagna = {
//     cliente: document.getElementById("cliente").value,
//     campagna: document.getElementById("campagna").value,
//     piattaforma: document.getElementById("piattaforma").value,
//     periodo: document.getElementById("periodo").value,
//     obiettivo: document.getElementById("obiettivo").value,
//     budget: document.getElementById("budget").value,
//     spesa: document.getElementById("spesa").value,
//     impression: document.getElementById("impression").value,
//     copertura: document.getElementById("copertura").value,
//     click: document.getElementById("click").value,
//     lead: document.getElementById("lead").value,
//     conversioni: document.getElementById("conversioni").value,
//     ricavi: document.getElementById("ricavi").value,
//     id: Date.now(),
//   };

//   let campagne = localStorage.getItem("campaigns");
//   campagne = campagne ? JSON.parse(campagne) : [];
//   campagne.push(nuovaCampagna);
//   localStorage.setItem("campaigns", JSON.stringify(campagne));
//   alert("Campagna salvata!");
//   form.reset();
//   mostraCampagne();
// }

// function mostraCampagne() {
//   const corpotabella = document.getElementById("campagnatabella");
//   corpotabella.innerHTML = "";

//   let campagne = localStorage.getItem("campaigns");
//   campagne = campagne ? JSON.parse(campagne) : [];

//   if (campagne.length === 0) {
//     corpotabella.innerHTML = `
//       <tr>
//         <td colspan="17" class="rigavuota">
//           <i>Qui non c'è ancora niente.
//           <a href="#nuovacampagna">Inserisci la prima campagna</a>
//           e i totali si aggiornano da soli.</i>
//         </td>
//       </tr>
//     `;
//     aggiornaTotali();
//     return;
//   }

//   campagne.reverse().forEach((campagna) => {
//     const speseAnnuncio =
//       parseFloat(String(campagna.spesa).replace(/\./g, "")) || 0;
//     const impresioniAnnuncio =
//       parseFloat(String(campagna.impression).replace(/\./g, "")) || 0;
//     const clickAnnuncio =
//       parseFloat(String(campagna.click).replace(/\./g, "")) || 0;
//     const leadAnnuncio =
//       parseFloat(String(campagna.lead).replace(/\./g, "")) || 0;
//     const conversioniAnnuncio =
//       parseFloat(String(campagna.conversioni).replace(/\./g, "")) || 0;
//     const ricaviAnnuncio =
//       parseFloat(String(campagna.ricavi).replace(/\./g, "")) || 0;

//     const kpiAnnuncio = calcolaKPICampagna(
//       speseAnnuncio,
//       impresioniAnnuncio,
//       clickAnnuncio,
//       leadAnnuncio,
//       conversioniAnnuncio,
//       ricaviAnnuncio,
//     );

//     const rigaTabella = document.createElement("tr");
//     rigaTabella.innerHTML = `
//       <td>${campagna.cliente}</td>
//       <td>${campagna.campagna}</td>
//       <td><span class="platform">${campagna.piattaforma}</span></td>
//       <td>${campagna.periodo}</td>
//       <td class="num">€ ${speseAnnuncio.toFixed(2)}</td>
//       <td class="num">${impresioniAnnuncio.toLocaleString("it-IT")}</td>
//       <td class="num">${clickAnnuncio.toLocaleString("it-IT")}</td>
//       <td class="num">${kpiAnnuncio.ctr}%</td>
//       <td class="num">€ ${kpiAnnuncio.cpc}</td>
//       <td class="num">€ ${kpiAnnuncio.cpm}</td>
//       <td class="num">${leadAnnuncio.toLocaleString("it-IT")}</td>
//       <td class="num">€ ${kpiAnnuncio.cpl}</td>
//       <td class="num">${conversioniAnnuncio.toLocaleString("it-IT")}</td>
//       <td class="num">€ ${kpiAnnuncio.cpa}</td>
//       <td class="num">€ ${ricaviAnnuncio.toFixed(2)}</td>
//       <td class="num ${kpiAnnuncio.roas > 1 ? "roas-good" : ""}">${kpiAnnuncio.roas}x</td>
//       <td class="row-actions">
//         <button class="bot-svuota" onclick="eliminaCampagna(${campagna.id})">Elimina</button>
//       </td>
//     `;

//     corpotabella.appendChild(rigaTabella);
//   });

//   aggiornaTotali();
// }

// window.addEventListener("load", mostraCampagne);

// // ELIMINA CAMPAGNA

// function eliminaCampagna(id) {
//   let campagne = localStorage.getItem("campaigns");
//   campagne = campagne ? JSON.parse(campagne) : [];

//   campagne = campagne.filter((c) => c.id !== id);
//   localStorage.setItem("campaigns", JSON.stringify(campagne));
//   mostraCampagne();
// }

// // AGGIORNA TOTALI

// function aggiornaTotali() {
//   let campagne = localStorage.getItem("campaigns");
//   campagne = campagne ? JSON.parse(campagne) : [];

//   let totaleSpeseAnnunci = 0;
//   let totaleImpressioniAnnunci = 0;
//   let totaleClickAnnunci = 0;
//   let totaleLead = 0;

//   campagne.forEach((campagna) => {
//     totaleSpeseAnnunci +=
//       parseFloat(String(campagna.spesa).replace(/\./g, "")) || 0;
//     totaleImpressioniAnnunci +=
//       parseFloat(String(campagna.impression).replace(/\./g, "")) || 0;
//     totaleClickAnnunci +=
//       parseFloat(String(campagna.click).replace(/\./g, "")) || 0;
//     totaleLead += parseFloat(String(campagna.lead).replace(/\./g, "")) || 0;
//   });

//   const totaleCTRCalcolato =
//     totaleImpressioniAnnunci > 0
//       ? ((totaleClickAnnunci / totaleImpressioniAnnunci) * 100).toFixed(2)
//       : "0.00";
//   const totaleCPLCalcolato =
//     totaleLead > 0 ? (totaleSpeseAnnunci / totaleLead).toFixed(2) : "0.00";

//   document.getElementById("totalespesa").textContent =
//     "€" + totaleSpeseAnnunci.toFixed(2);
//   document.getElementById("totaleimpression").textContent =
//     totaleImpressioniAnnunci.toLocaleString("it-IT");
//   document.getElementById("totaleclick").textContent =
//     totaleClickAnnunci.toLocaleString("it-IT");
//   document.getElementById("totalectr").textContent = totaleCTRCalcolato + "%";
//   document.getElementById("totalelead").textContent =
//     totaleLead.toLocaleString("it-IT");
//   document.getElementById("totalecpl").textContent = "€" + totaleCPLCalcolato;
// }

// function pulisciForm() {
//   const formularioNuovaCampagna = document.querySelector(".form-campagna");
//   formularioNuovaCampagna.reset();
// }

// function popolaSelectClienti() {
//   let campagne = localStorage.getItem("campaigns");
//   campagne = campagne ? JSON.parse(campagne) : [];

//   const clientiUnici = [...new Set(campagne.map((c) => c.cliente))];
//   const selectClienti = document.querySelector(".select-clienti");

//   selectClienti.innerHTML = '<option value="tutti">Tutti i clienti</option>';

//   clientiUnici.forEach((cliente) => {
//     const option = document.createElement("option");
//     option.value = cliente;
//     option.textContent = cliente;
//     selectClienti.appendChild(option);
//   });
// }

// function applicaFiltri() {
//   let campagne = localStorage.getItem("campaigns");
//   campagne = campagne ? JSON.parse(campagne) : [];

//   const inputRicerca = document
//     .getElementById("cercaCampagna")
//     .value.toLowerCase();
//   const selectClienti = document.querySelector(".select-clienti").value;
//   const selectPiattaforme = document.querySelector(".select-piattaforme").value;

//   const campagneFiltrate = campagne.filter((campagna) => {
//     const matchRicerca =
//       campagna.cliente.toLowerCase().includes(inputRicerca) ||
//       campagna.campagna.toLowerCase().includes(inputRicerca);
//     const matchCliente =
//       selectClienti === "tutti" || campagna.cliente === selectClienti;
//     const matchPiattaforma =
//       selectPiattaforme === "tutti" ||
//       campagna.piattaforma
//         .toLowerCase()
//         .includes(selectPiattaforme.replace("ads", "").toLowerCase());

//     return matchRicerca && matchCliente && matchPiattaforma;
//   });

//   mostraCampagneFiltrate(campagneFiltrate);
// }

// function mostraCampagneFiltrate(campagneFiltrate) {
//   const corpotabella = document.getElementById("campagnatabella");
//   corpotabella.innerHTML = "";

//   if (campagneFiltrate.length === 0) {
//     corpotabella.innerHTML = `
//       <tr>
//         <td colspan="17" class="rigavuota">
//           <i>Nessuna campagna corrisponde ai filtri selezionati.</i>
//         </td>
//       </tr>
//     `;
//     return;
//   }

//   campagneFiltrate.reverse().forEach((campagna) => {
//     const speseAnnuncio =
//       parseFloat(String(campagna.spesa).replace(/\./g, "")) || 0;
//     const impresioniAnnuncio =
//       parseFloat(String(campagna.impression).replace(/\./g, "")) || 0;
//     const clickAnnuncio =
//       parseFloat(String(campagna.click).replace(/\./g, "")) || 0;
//     const leadAnnuncio =
//       parseFloat(String(campagna.lead).replace(/\./g, "")) || 0;
//     const conversioniAnnuncio =
//       parseFloat(String(campagna.conversioni).replace(/\./g, "")) || 0;
//     const ricaviAnnuncio =
//       parseFloat(String(campagna.ricavi).replace(/\./g, "")) || 0;

//     const kpiAnnuncio = calcolaKPICampagna(
//       speseAnnuncio,
//       impresioniAnnuncio,
//       clickAnnuncio,
//       leadAnnuncio,
//       conversioniAnnuncio,
//       ricaviAnnuncio,
//     );

//     const rigaTabella = document.createElement("tr");
//     rigaTabella.innerHTML = `
//       <td>${campagna.cliente}</td>
//       <td>${campagna.campagna}</td>
//       <td><span class="platform">${campagna.piattaforma}</span></td>
//       <td>${campagna.periodo}</td>
//       <td class="num">€ ${speseAnnuncio.toFixed(2)}</td>
//       <td class="num">${impresioniAnnuncio.toLocaleString("it-IT")}</td>
//       <td class="num">${clickAnnuncio.toLocaleString("it-IT")}</td>
//       <td class="num">${kpiAnnuncio.ctr}%</td>
//       <td class="num">€ ${kpiAnnuncio.cpc}</td>
//       <td class="num">€ ${kpiAnnuncio.cpm}</td>
//       <td class="num">${leadAnnuncio.toLocaleString("it-IT")}</td>
//       <td class="num">€ ${kpiAnnuncio.cpl}</td>
//       <td class="num">${conversioniAnnuncio.toLocaleString("it-IT")}</td>
//       <td class="num">€ ${kpiAnnuncio.cpa}</td>
//       <td class="num">€ ${ricaviAnnuncio.toFixed(2)}</td>
//       <td class="num ${kpiAnnuncio.roas > 1 ? "roas-good" : ""}">${kpiAnnuncio.roas}x</td>
//       <td class="row-actions">
//         <button class="bot-svuota" onclick="eliminaCampagna(${campagna.id})">Elimina</button>
//       </td>
//     `;

//     corpotabella.appendChild(rigaTabella);
//   });
// }

// window.addEventListener("load", () => {
//   mostraCampagne();
//   popolaSelectClienti();

//   document
//     .getElementById("cercaCampagna")
//     .addEventListener("input", applicaFiltri);
//   document
//     .querySelector(".select-clienti")
//     .addEventListener("change", applicaFiltri);
//   document
//     .querySelector(".select-piattaforme")
//     .addEventListener("change", applicaFiltri);
// });

const CHIAVE_STORAGE = "campaigns";

const MESSAGGIO_VUOTO = `
  <tr>
    <td colspan="17" class="rigavuota">
      <i>Qui non c'è ancora niente.
      <a href="#nuovacampagna">Inserisci la prima campagna</a>
      e i totali si aggiornano da soli.</i>
    </td>
  </tr>
`;

const MESSAGGIO_NESSUN_RISULTATO = `
  <tr>
    <td colspan="17" class="rigavuota">
      <i>Nessuna campagna corrisponde ai filtri selezionati.</i>
    </td>
  </tr>
`;

function leggiCampagne() {
  try {
    const dati = localStorage.getItem(CHIAVE_STORAGE);
    const campagne = dati ? JSON.parse(dati) : [];
    return Array.isArray(campagne) ? campagne : [];
  } catch {
    return [];
  }
}

function salvaCampagne(campagne) {
  localStorage.setItem(CHIAVE_STORAGE, JSON.stringify(campagne));
}

function parseNumero(valore) {
  let testo = String(valore ?? "").trim().replace(/[€\s]/g, "");
  if (testo === "") return 0;

  if (testo.includes(",")) {
    testo = testo.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(testo)) {
    testo = testo.replace(/\./g, "");
  }

  const numero = parseFloat(testo);
  return Number.isFinite(numero) ? numero : 0;
}

function escapeHTML(testo) {
  return String(testo ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDecimale(numero) {
  return numero.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatEuro(numero) {
  return "€ " + formatDecimale(numero);
}

function formatIntero(numero) {
  return numero.toLocaleString("it-IT");
}

function dividi(numeratore, denominatore) {
  return denominatore > 0 ? numeratore / denominatore : 0;
}

function calcolaKPICampagna(spesa, impression, click, lead, conversioni, ricavi) {
  return {
    ctr: dividi(click, impression) * 100,
    cpc: dividi(spesa, click),
    cpm: dividi(spesa, impression) * 1000,
    cpl: dividi(spesa, lead),
    cpa: dividi(spesa, conversioni),
    roas: dividi(ricavi, spesa),
  };
}

function estraiNumeri(campagna) {
  return {
    spesa: parseNumero(campagna.spesa),
    impression: parseNumero(campagna.impression),
    click: parseNumero(campagna.click),
    lead: parseNumero(campagna.lead),
    conversioni: parseNumero(campagna.conversioni),
    ricavi: parseNumero(campagna.ricavi),
  };
}

function creaRiga(campagna) {
  const n = estraiNumeri(campagna);
  const kpi = calcolaKPICampagna(
    n.spesa,
    n.impression,
    n.click,
    n.lead,
    n.conversioni,
    n.ricavi,
  );

  const riga = document.createElement("tr");
  riga.innerHTML = `
    <td>${escapeHTML(campagna.cliente)}</td>
    <td>${escapeHTML(campagna.campagna)}</td>
    <td><span class="platform">${escapeHTML(campagna.piattaforma)}</span></td>
    <td>${escapeHTML(campagna.periodo)}</td>
    <td class="num">${formatEuro(n.spesa)}</td>
    <td class="num">${formatIntero(n.impression)}</td>
    <td class="num">${formatIntero(n.click)}</td>
    <td class="num">${formatDecimale(kpi.ctr)}%</td>
    <td class="num">${formatEuro(kpi.cpc)}</td>
    <td class="num">${formatEuro(kpi.cpm)}</td>
    <td class="num">${formatIntero(n.lead)}</td>
    <td class="num">${formatEuro(kpi.cpl)}</td>
    <td class="num">${formatIntero(n.conversioni)}</td>
    <td class="num">${formatEuro(kpi.cpa)}</td>
    <td class="num">${formatEuro(n.ricavi)}</td>
    <td class="num ${kpi.roas > 1 ? "roas-good" : ""}">${formatDecimale(kpi.roas)}x</td>
    <td class="row-actions">
      <button type="button" class="bot-svuota" data-id="${Number(campagna.id)}">Elimina</button>
    </td>
  `;

  return riga;
}

function mostraCampagne(campagne, ciSonoCampagneSalvate) {
  const corpoTabella = document.getElementById("campagnatabella");
  corpoTabella.innerHTML = "";

  if (campagne.length === 0) {
    corpoTabella.innerHTML = ciSonoCampagneSalvate
      ? MESSAGGIO_NESSUN_RISULTATO
      : MESSAGGIO_VUOTO;
  } else {
    [...campagne]
      .reverse()
      .forEach((campagna) => corpoTabella.appendChild(creaRiga(campagna)));
  }

  aggiornaTotali(campagne);
}

function aggiornaTotali(campagne) {
  let totaleSpesa = 0;
  let totaleImpression = 0;
  let totaleClick = 0;
  let totaleLead = 0;

  campagne.forEach((campagna) => {
    const n = estraiNumeri(campagna);
    totaleSpesa += n.spesa;
    totaleImpression += n.impression;
    totaleClick += n.click;
    totaleLead += n.lead;
  });

  const totaleCTR = dividi(totaleClick, totaleImpression) * 100;
  const totaleCPL = dividi(totaleSpesa, totaleLead);

  document.getElementById("totalespesa").textContent = formatEuro(totaleSpesa);
  document.getElementById("totaleimpression").textContent = formatIntero(totaleImpression);
  document.getElementById("totaleclick").textContent = formatIntero(totaleClick);
  document.getElementById("totalectr").textContent = formatDecimale(totaleCTR) + "%";
  document.getElementById("totalelead").textContent = formatIntero(totaleLead);
  document.getElementById("totalecpl").textContent = formatEuro(totaleCPL);
}

function popolaSelectClienti() {
  const selectClienti = document.querySelector(".select-clienti");
  const selezionato = selectClienti.value;

  const clientiUnici = [
    ...new Set(leggiCampagne().map((c) => c.cliente).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "it"));

  selectClienti.innerHTML = '<option value="tutti">Tutti i clienti</option>';

  clientiUnici.forEach((cliente) => {
    const option = document.createElement("option");
    option.value = cliente;
    option.textContent = cliente;
    selectClienti.appendChild(option);
  });

  selectClienti.value = clientiUnici.includes(selezionato) ? selezionato : "tutti";
}

function applicaFiltri() {
  const campagne = leggiCampagne();

  const ricerca = document.getElementById("cercaCampagna").value.trim().toLowerCase();
  const clienteScelto = document.querySelector(".select-clienti").value;
  const piattaformaScelta = document.querySelector(".select-piattaforme").value;
  const piattaformaCercata = piattaformaScelta.toLowerCase().replace("ads", "").trim();

  const campagneFiltrate = campagne.filter((campagna) => {
    const cliente = String(campagna.cliente ?? "");
    const nomeCampagna = String(campagna.campagna ?? "");
    const piattaforma = String(campagna.piattaforma ?? "").toLowerCase();

    const matchRicerca =
      cliente.toLowerCase().includes(ricerca) ||
      nomeCampagna.toLowerCase().includes(ricerca);
    const matchCliente = clienteScelto === "tutti" || cliente === clienteScelto;
    const matchPiattaforma =
      piattaformaScelta === "tutti" || piattaforma.includes(piattaformaCercata);

    return matchRicerca && matchCliente && matchPiattaforma;
  });

  mostraCampagne(campagneFiltrate, campagne.length > 0);
}

function aggiornaVista() {
  popolaSelectClienti();
  applicaFiltri();
}

function aggiungiCampagna(evento) {
  if (evento && typeof evento.preventDefault === "function") {
    evento.preventDefault();
  }

  const form = document.querySelector(".form-campagna");
  const campi = [
    "cliente",
    "campagna",
    "piattaforma",
    "periodo",
    "obiettivo",
    "budget",
    "spesa",
    "impression",
    "copertura",
    "click",
    "lead",
    "conversioni",
    "ricavi",
  ];

  const nuovaCampagna = { id: Date.now() };
  campi.forEach((campo) => {
    nuovaCampagna[campo] = document.getElementById(campo).value.trim();
  });

  const campagne = leggiCampagne();
  campagne.push(nuovaCampagna);
  salvaCampagne(campagne);

  alert("Campagna salvata!");
  form.reset();
  aggiornaVista();
}

function eliminaCampagna(id) {
  const campagne = leggiCampagne().filter((c) => c.id !== Number(id));
  salvaCampagne(campagne);
  aggiornaVista();
}

function pulisciForm() {
  document.querySelector(".form-campagna").reset();
}

window.addEventListener("load", () => {
  document.getElementById("cercaCampagna").addEventListener("input", applicaFiltri);
  document.querySelector(".select-clienti").addEventListener("change", applicaFiltri);
  document.querySelector(".select-piattaforme").addEventListener("change", applicaFiltri);

  document.getElementById("campagnatabella").addEventListener("click", (evento) => {
    const bottone = evento.target.closest("button[data-id]");
    if (bottone) {
      eliminaCampagna(bottone.dataset.id);
    }
  });

  aggiornaVista();
});