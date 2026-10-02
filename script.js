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

const COLONNE_CSV = [
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

const SEPARATORE_CSV = ";";

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

function nomeMese(periodo) {
  const [anno, mese] = String(periodo).split("-").map(Number);
  if (!/^\d{4}-\d{2}$/.test(periodo) || mese < 1 || mese > 12) return periodo;

  const testoMese = new Date(anno, mese - 1, 1).toLocaleDateString("it-IT", {
    month: "long",
    year: "numeric",
  });
  return testoMese.charAt(0).toUpperCase() + testoMese.slice(1);
}

function popolaSelectMesi() {
  const selectMesi = document.querySelector(".select-mese");
  const meseSelezionato = selectMesi.value;

  const mesiUnici = [
    ...new Set(leggiCampagne().map((c) => String(c.periodo ?? "").trim()).filter(Boolean)),
  ].sort((a, b) => b.localeCompare(a));

  selectMesi.innerHTML = '<option value="tutti">Tutti i mesi</option>';

  mesiUnici.forEach((periodo) => {
    const opzioneMese = document.createElement("option");
    opzioneMese.value = periodo;
    opzioneMese.textContent = nomeMese(periodo);
    selectMesi.appendChild(opzioneMese);
  });

  selectMesi.value = mesiUnici.includes(meseSelezionato) ? meseSelezionato : "tutti";
}

function applicaFiltri() {
  const campagne = leggiCampagne();

  const ricerca = document.getElementById("cercaCampagna").value.trim().toLowerCase();
  const clienteScelto = document.querySelector(".select-clienti").value;
  const piattaformaScelta = document.querySelector(".select-piattaforme").value;
  const piattaformaCercata = piattaformaScelta.toLowerCase().replace("ads", "").trim();
  const meseScelto = document.querySelector(".select-mese").value;

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
    const matchMese =
      meseScelto === "tutti" || String(campagna.periodo ?? "").trim() === meseScelto;

    return matchRicerca && matchCliente && matchPiattaforma && matchMese;
  });

  mostraCampagne(campagneFiltrate, campagne.length > 0);
}

function aggiornaVista() {
  popolaSelectClienti();
  popolaSelectMesi();
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

function normalizzaTesto(testo) {
  return String(testo ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function proteggiCampoCSV(valore) {
  const testo = String(valore ?? "");
  const servonoVirgolette = testo.includes(SEPARATORE_CSV) || /["\r\n]/.test(testo);
  return servonoVirgolette ? `"${testo.replace(/"/g, '""')}"` : testo;
}

function valorePerCSV(campagna, campo) {
  if (document.getElementById(campo).type === "number") {
    return String(parseNumero(campagna[campo])).replace(".", ",");
  }
  return String(campagna[campo] ?? "");
}

function valoreComeDalModulo(campo, valore) {
  const campoModulo = document.getElementById(campo);

  if (campoModulo.type === "number") {
    return String(parseNumero(valore));
  }

  if (campoModulo.tagName === "SELECT") {
    const opzioneCorrispondente = [...campoModulo.options].find(
      (opzione) => normalizzaTesto(opzione.value) === normalizzaTesto(valore),
    );
    return opzioneCorrispondente ? opzioneCorrispondente.value : valore;
  }

  return valore;
}

function scomponiCSV(testo) {
  const primaRiga = testo.split(/\r\n|\n|\r/).find((riga) => riga.trim() !== "") ?? "";
  const separatore = primaRiga.split(";").length >= primaRiga.split(",").length ? ";" : ",";
  const righe = [];
  let rigaCorrente = [];
  let cellaCorrente = "";
  let traVirgolette = false;

  for (let posizione = 0; posizione < testo.length; posizione++) {
    const carattere = testo[posizione];

    if (traVirgolette) {
      if (carattere !== '"') {
        cellaCorrente += carattere;
      } else if (testo[posizione + 1] === '"') {
        cellaCorrente += '"';
        posizione++;
      } else {
        traVirgolette = false;
      }
    } else if (carattere === '"' && cellaCorrente === "") {
      traVirgolette = true;
    } else if (carattere === separatore) {
      rigaCorrente.push(cellaCorrente);
      cellaCorrente = "";
    } else if (carattere === "\r" || carattere === "\n") {
      if (carattere === "\r" && testo[posizione + 1] === "\n") posizione++;
      rigaCorrente.push(cellaCorrente);
      righe.push(rigaCorrente);
      rigaCorrente = [];
      cellaCorrente = "";
    } else {
      cellaCorrente += carattere;
    }
  }

  rigaCorrente.push(cellaCorrente);
  righe.push(rigaCorrente);

  return righe.filter((riga) => riga.some((cella) => cella.trim() !== ""));
}

async function leggiTestoFile(file) {
  const contenuto = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(contenuto);
  } catch {
    return new TextDecoder("windows-1252").decode(contenuto);
  }
}

function scegliFileCSV() {
  document.getElementById("fileimporta").click();
}

async function importaCSV(selettoreFile) {
  const fileScelto = selettoreFile.files[0];
  selettoreFile.value = "";
  if (!fileScelto) return;

  const testoFile = await leggiTestoFile(fileScelto);
  const [intestazione = [], ...righeDati] = scomponiCSV(testoFile);
  const colonne = intestazione.map(normalizzaTesto);

  if (!colonne.includes("cliente") || !colonne.includes("campagna")) {
    alert("Il file non contiene le colonne Cliente e Campagna, quindi non può essere importato.");
    return;
  }

  if (righeDati.length === 0) {
    alert("Nel file non ci sono campagne da importare.");
    return;
  }

  const campagne = leggiCampagne();
  const idUsati = new Set(campagne.map((campagna) => Number(campagna.id)));
  let nuovoId = Date.now();

  righeDati.forEach((riga) => {
    while (idUsati.has(nuovoId)) nuovoId--;
    idUsati.add(nuovoId);

    const nuovaCampagna = { id: nuovoId };
    COLONNE_CSV.forEach((campo) => {
      const indiceColonna = colonne.indexOf(campo);
      const valore = indiceColonna >= 0 ? String(riga[indiceColonna] ?? "").trim() : "";
      nuovaCampagna[campo] = valoreComeDalModulo(campo, valore);
    });

    campagne.push(nuovaCampagna);
  });

  salvaCampagne(campagne);

  alert(righeDati.length === 1 ? "Campagna importata!" : `${righeDati.length} campagne importate!`);
  aggiornaVista();
}

async function scaricaCSV() {
  const campagne = leggiCampagne();

  if (campagne.length === 0) {
    alert("Non ci sono campagne da scaricare.");
    return;
  }

  const intestazione = COLONNE_CSV.map((campo) => campo.charAt(0).toUpperCase() + campo.slice(1));
  const righeCampagne = campagne.map((campagna) =>
    COLONNE_CSV.map((campo) => valorePerCSV(campagna, campo)),
  );
  const testoCSV = [intestazione, ...righeCampagne]
    .map((riga) => riga.map(proteggiCampoCSV).join(SEPARATORE_CSV))
    .join("\r\n");

  const oggi = new Date();
  const dataFile = [
    oggi.getFullYear(),
    String(oggi.getMonth() + 1).padStart(2, "0"),
    String(oggi.getDate()).padStart(2, "0"),
  ].join("-");

  const nomeProposto = `report-mensile-adv-${dataFile}.csv`;
  const fileCSV = new Blob(["﻿" + testoCSV], { type: "text/csv;charset=utf-8" });

  if (window.showSaveFilePicker) {
    try {
      const destinazione = await window.showSaveFilePicker({
        suggestedName: nomeProposto,
        types: [{ description: "File CSV", accept: { "text/csv": [".csv"] } }],
      });
      const scrittura = await destinazione.createWritable();
      await scrittura.write(fileCSV);
      await scrittura.close();
    } catch (errore) {
      if (errore.name !== "AbortError") {
        alert("Non è stato possibile salvare il file.");
      }
    }
    return;
  }

  const nomeScelto = (prompt("Come vuoi chiamare il file?", nomeProposto) ?? "").trim();
  if (nomeScelto === "") return;

  const indirizzoFile = URL.createObjectURL(fileCSV);
  const collegamento = document.createElement("a");

  collegamento.href = indirizzoFile;
  collegamento.download = nomeScelto.toLowerCase().endsWith(".csv")
    ? nomeScelto
    : `${nomeScelto}.csv`;
  document.body.appendChild(collegamento);
  collegamento.click();
  collegamento.remove();
  setTimeout(() => URL.revokeObjectURL(indirizzoFile), 0);
}

function svuotaTutto() {
  const messaggioConferma =
    "Vuoi cancellare tutte le campagne salvate? L'operazione non si può annullare.";
  if (leggiCampagne().length > 0 && !confirm(messaggioConferma)) return;

  localStorage.removeItem(CHIAVE_STORAGE);
  document.getElementById("cercaCampagna").value = "";
  document.querySelector(".select-piattaforme").value = "tutti";
  pulisciForm();
  aggiornaVista();
}

window.addEventListener("load", () => {
  document.getElementById("cercaCampagna").addEventListener("input", applicaFiltri);
  document.querySelector(".select-clienti").addEventListener("change", applicaFiltri);
  document.querySelector(".select-piattaforme").addEventListener("change", applicaFiltri);
  document.querySelector(".select-mese").addEventListener("change", applicaFiltri);

  document.getElementById("campagnatabella").addEventListener("click", (evento) => {
    const bottone = evento.target.closest("button[data-id]");
    if (bottone) {
      eliminaCampagna(bottone.dataset.id);
    }
  });

  aggiornaVista();
});

  // AGGIORNA DATA 

function aggiornaDataReport() {
  const elementoData = document.querySelector(".data");
  if (!elementoData) return;

  const oggi = new Date();
  const giorno = oggi.getDate();
  const mese = oggi.toLocaleDateString("it-IT", { month: "long" });
  const giornoTesto = giorno === 1 ? "1°" : giorno;

  elementoData.textContent = `Aggiornato al ${giornoTesto} ${mese}`;
}

window.addEventListener("load", () => {
  aggiornaDataReport();
  setInterval(aggiornaDataReport, 60000);
});