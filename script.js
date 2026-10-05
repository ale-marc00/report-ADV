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

const CHIAVE_FORMATI_CSV = "formatiCSV";

const FORMATI_PIATTAFORMA = {
  google: {
    piattaforma: "Google Ads",
    prefissoFile: "google-ads",
    colonne: [
      { intestazione: "Campagna", nomi: ["campagna", "campaign"], campo: "campagna" },
      { intestazione: "Stato della campagna", nomi: ["statodellacampagna", "campaignstate", "campaignstatus"], campo: "stato" },
      { intestazione: "Budget", nomi: ["budget"], campo: "budget", numero: true, decimali: 2 },
      { intestazione: "Spesa", nomi: ["spesa", "costo", "cost"], campo: "spesa", numero: true, decimali: 2 },
      { intestazione: "Visualizzazioni", nomi: ["visualizzazioni", "impr", "impressions"], campo: "impression", numero: true },
      { intestazione: "Click", nomi: ["click", "clicks"], campo: "click", numero: true },
      { intestazione: "CTR", nomi: ["ctr"], kpi: "ctr", percentuale: true },
      { intestazione: "CPC medio", nomi: ["cpcmedio", "avgcpc"], kpi: "cpc" },
      { intestazione: "Conversioni", nomi: ["conversioni", "conversions"], campo: "conversioni", numero: true, decimali: 2 },
      { intestazione: "Costo / conv.", nomi: ["costoconv", "costconv"], kpi: "cpa" },
    ],
  },
  meta: {
    piattaforma: "Meta Ads",
    prefissoFile: "meta-ads",
    virgoletteSeSpazi: true,
    colonne: [
      { intestazione: "Inizio dei report", nomi: ["iniziodeireport"], campo: "inizioReport", periodo: "inizio" },
      { intestazione: "Fine dei report", nomi: ["finedeireport"], campo: "fineReport", periodo: "fine" },
      { intestazione: "Nome della campagna", nomi: ["nomedellacampagna"], campo: "campagna" },
      { intestazione: "Pubblicazione della campagna", nomi: ["pubblicazionedellacampagna"], campo: "stato" },
      { intestazione: "Impostazione di attribuzione", nomi: ["impostazionediattribuzione"], campo: "attribuzione" },
      { intestazione: "Risultati", nomi: ["risultati"], campo: "lead", numero: true },
      { intestazione: "Indicatore di risultato", nomi: ["indicatoredirisultato"], campo: "indicatoreRisultato" },
      { intestazione: "Costo per risultati", nomi: ["costoperrisultati"], kpi: "cpl" },
      { intestazione: "Budget del gruppo di inserzioni", nomi: ["budgetdelgruppodiinserzioni"], campo: "budgetGruppo" },
      { intestazione: "Tipo di budget del gruppo di inserzioni", nomi: ["tipodibudgetdelgruppodiinserzioni"], campo: "tipoBudgetGruppo" },
      { intestazione: "Importo speso (EUR)", nomi: ["importospesoeur", "importospeso"], campo: "spesa", numero: true, decimali: 2 },
      { intestazione: "Impression", nomi: ["impression"], campo: "impression", numero: true },
      { intestazione: "Copertura", nomi: ["copertura"], campo: "copertura", numero: true },
      { intestazione: "Fine", nomi: ["fine"], campo: "fineCampagna" },
      { intestazione: "Risultati (iniziali)", nomi: ["risultatiiniziali"], campo: "risultatiIniziali" },
      { intestazione: "Indicatore (iniziale) dei risultati", nomi: ["indicatoreinizialedeirisultati"], campo: "indicatoreIniziale" },
    ],
  },
  googlePanoramica: {
    piattaforma: "Google Ads",
    soloImport: true,
    richiede: ["statocampagna"],
    colonne: [
      { intestazione: "Nome campagna", nomi: ["nomecampagna"], campo: "campagna" },
      { intestazione: "Stato campagna", nomi: ["statocampagna"], campo: "stato" },
      { intestazione: "Costo", nomi: ["costo"], campo: "spesa", numero: true },
      { intestazione: "Impressioni", nomi: ["impressioni"], campo: "impression", numero: true },
      { intestazione: "Clic", nomi: ["clic"], campo: "click", numero: true },
      { intestazione: "CTR", nomi: ["ctr"], kpi: "ctr" },
    ],
  },
};

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

function leggiFormatiCSV() {
  try {
    const formati = JSON.parse(localStorage.getItem(CHIAVE_FORMATI_CSV));
    return formati && typeof formati === "object" ? formati : {};
  } catch {
    return {};
  }
}

function ricordaFormatoCSV(chiaveFormato, formatoFile) {
  const formati = leggiFormatiCSV();
  formati[chiaveFormato] = formatoFile;
  localStorage.setItem(CHIAVE_FORMATI_CSV, JSON.stringify(formati));
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

  const clientiPerNome = new Map();

  leggiCampagne()
    .map((c) => String(c.cliente ?? "").trim())
    .filter(Boolean)
    .forEach((cliente) => {
      const chiaveCliente = cliente.toLowerCase();
      if (!clientiPerNome.has(chiaveCliente)) clientiPerNome.set(chiaveCliente, cliente);
    });

  const clientiUnici = [...clientiPerNome.values()].sort((a, b) => a.localeCompare(b, "it"));

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
    const matchCliente =
      clienteScelto === "tutti" ||
      cliente.trim().toLowerCase() === clienteScelto.toLowerCase();
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

function proteggiCampoCSV(valore, separatore, virgoletteSeSpazi) {
  const testo = String(valore ?? "");
  const servonoVirgolette =
    testo.includes(separatore) || /["\r\n]/.test(testo) || (virgoletteSeSpazi && testo.includes(" "));
  return servonoVirgolette ? `"${testo.replace(/"/g, '""')}"` : testo;
}

function unisciRigheCSV(righe, separatore, virgoletteSeSpazi = false) {
  return righe
    .map((riga) =>
      riga.map((valore) => proteggiCampoCSV(valore, separatore, virgoletteSeSpazi)).join(separatore),
    )
    .join("\r\n");
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

function arrotonda(numero) {
  return Math.round(numero * 100) / 100;
}

function numeroPerCSV(numero, decimali, separatoreDecimale) {
  const cifre = decimali ?? (Number.isInteger(numero) ? 0 : 2);
  return numero.toFixed(cifre).replace(".", separatoreDecimale);
}

function leggiNumeroCSV(valore, separatoreDecimale) {
  const separatoreMigliaia = separatoreDecimale === "," ? "." : ",";
  const testo = String(valore ?? "")
    .replace(/[^\d.,-]/g, "")
    .split(separatoreMigliaia)
    .join("")
    .replace(separatoreDecimale, ".");

  const numero = parseFloat(testo);
  return Number.isFinite(numero) ? numero : 0;
}

function rilevaSeparatoreDecimale(valori, separatoreCampi) {
  let virgole = 0;
  let punti = 0;

  valori.forEach((valore) => {
    const testo = String(valore ?? "").replace(/[^\d.,]/g, "");
    const ultimaVirgola = testo.lastIndexOf(",");
    const ultimoPunto = testo.lastIndexOf(".");

    if (ultimaVirgola >= 0 && ultimoPunto >= 0) {
      if (ultimaVirgola > ultimoPunto) virgole++;
      else punti++;
    } else if (ultimaVirgola >= 0 && !/^\d{1,3}(,\d{3})+$/.test(testo)) {
      virgole++;
    } else if (ultimoPunto >= 0 && !/^\d{1,3}(\.\d{3})+$/.test(testo)) {
      punti++;
    }
  });

  if (virgole !== punti) return virgole > punti ? "," : ".";
  return separatoreCampi === ";" ? "," : ".";
}

function firmaNumerica(campagna) {
  return ["budget", "spesa", "impression", "copertura", "click", "lead", "conversioni", "ricavi"]
    .map((campo) => parseNumero(campagna[campo]))
    .join("|");
}

function meseDaData(testo) {
  const dataISO = /^(\d{4})-(\d{2})-\d{2}/.exec(String(testo ?? ""));
  if (dataISO) return `${dataISO[1]}-${dataISO[2]}`;

  const dataItaliana = /^\d{1,2}\/(\d{1,2})\/(\d{4})/.exec(String(testo ?? ""));
  return dataItaliana ? `${dataItaliana[2]}-${dataItaliana[1].padStart(2, "0")}` : "";
}

function meseDaNomeFile(nome) {
  const intervallo = /(\d{4})\.(\d{2})\.\d{2}-\d{4}\.\d{2}\.\d{2}/.exec(String(nome ?? ""));
  return intervallo ? `${intervallo[1]}-${intervallo[2]}` : "";
}

function dataDelPeriodo(periodo, estremo) {
  if (!/^\d{4}-\d{2}$/.test(String(periodo ?? ""))) return "";

  const [anno, mese] = periodo.split("-").map(Number);
  const giorno = estremo === "inizio" ? 1 : new Date(anno, mese, 0).getDate();
  return `${periodo}-${String(giorno).padStart(2, "0")}`;
}

function scomponiCSV(testo, separatore) {
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

function trovaColonna(colonne, nomi) {
  return colonne.findIndex((colonna) => nomi.includes(colonna));
}

function riconosciFormato(colonne) {
  if (colonne.includes("cliente") && colonne.includes("campagna")) return "interno";
  if (colonne.includes("nomeaccount") && colonne.includes("impressioni")) return "account";

  const chiave = Object.keys(FORMATI_PIATTAFORMA).find((chiaveFormato) => {
    const formato = FORMATI_PIATTAFORMA[chiaveFormato];
    const colonnaCampagna = formato.colonne.find((colonna) => colonna.campo === "campagna");
    return (
      trovaColonna(colonne, colonnaCampagna.nomi) >= 0 &&
      (formato.richiede ?? []).every((nome) => colonne.includes(nome)) &&
      formato.colonne.some(
        (colonna) => colonna !== colonnaCampagna && trovaColonna(colonne, colonna.nomi) >= 0,
      )
    );
  });
  return chiave ?? null;
}

function virgoletteSugliSpazi(rigaGrezza, separatore) {
  return (rigaGrezza.match(/"(?:[^"]|"")*"/g) ?? []).some((campo) => {
    const contenuto = campo.slice(1, -1);
    return contenuto.includes(" ") && !contenuto.includes(separatore) && !contenuto.includes('"');
  });
}

function leggiTabellaCSV(testo) {
  for (const separatore of [";", ",", "\t"]) {
    const righe = scomponiCSV(testo, separatore);

    for (let indice = 0; indice < Math.min(righe.length, 10); indice++) {
      const formato = riconosciFormato(righe[indice].map(normalizzaTesto));
      if (formato) {
        const rigaGrezza =
          testo.split(/\r\n|\n|\r/).filter((linea) => scomponiCSV(linea, separatore).length > 0)[
            indice
          ] ?? "";

        return {
          formato,
          separatore,
          virgoletteSeSpazi: virgoletteSugliSpazi(rigaGrezza, separatore),
          intestazione: righe[indice],
          righeDati: righe.slice(indice + 1),
        };
      }
    }
  }

  return null;
}

function campagneDaFileInterno({ intestazione, righeDati }) {
  const colonne = intestazione.map(normalizzaTesto);

  return righeDati.map((riga) => {
    const nuovaCampagna = {};
    COLONNE_CSV.forEach((campo) => {
      const indiceColonna = colonne.indexOf(campo);
      const valore = indiceColonna >= 0 ? String(riga[indiceColonna] ?? "").trim() : "";
      nuovaCampagna[campo] = valoreComeDalModulo(campo, valore);
    });
    return nuovaCampagna;
  });
}

function campagneDaFilePiattaforma({
  formato: chiaveFormato,
  separatore,
  virgoletteSeSpazi,
  intestazione,
  righeDati,
}) {
  const formato = FORMATI_PIATTAFORMA[chiaveFormato];
  const colonne = intestazione.map(normalizzaTesto);
  const indici = formato.colonne.map((colonna) => trovaColonna(colonne, colonna.nomi));
  const indiceDi = (condizione) => indici[formato.colonne.findIndex(condizione)] ?? -1;
  const indiceCampagna = indiceDi((colonna) => colonna.campo === "campagna");
  const indiceImpression = indiceDi((colonna) => colonna.campo === "impression");
  const indiceCTR = indiceDi((colonna) => colonna.kpi === "ctr");

  const righe = righeDati.filter((riga) => {
    const nomeCampagna = String(riga[indiceCampagna] ?? "").trim();
    return nomeCampagna !== "" && !/^totale?\s*:/i.test(nomeCampagna);
  });

  const indiciNumerici = indici.filter(
    (indice, i) => indice >= 0 && (formato.colonne[i].numero || formato.colonne[i].kpi),
  );
  const decimale = rilevaSeparatoreDecimale(
    righe.flatMap((riga) => indiciNumerici.map((indice) => riga[indice])),
    separatore,
  );

  const campagne = righe.map((riga) => {
    const nuovaCampagna = {};
    COLONNE_CSV.forEach((campo) => {
      nuovaCampagna[campo] = valoreComeDalModulo(campo, "");
    });
    nuovaCampagna.piattaforma = formato.piattaforma;
    const testiNumerici = {};

    formato.colonne.forEach((colonna, i) => {
      if (indici[i] < 0) return;
      const valore = String(riga[indici[i]] ?? "").trim();
      if (colonna.numero || colonna.kpi) testiNumerici[colonna.intestazione] = valore;
      if (!colonna.campo) return;

      nuovaCampagna[colonna.campo] = colonna.numero
        ? String(arrotonda(leggiNumeroCSV(valore, decimale)))
        : valore;
    });

    const ctr = indiceCTR >= 0 ? leggiNumeroCSV(riga[indiceCTR], decimale) : 0;
    if (indiceImpression < 0 && ctr > 0) {
      nuovaCampagna.impression = String(Math.round(parseNumero(nuovaCampagna.click) / (ctr / 100)));
    }

    if (!formato.soloImport) {
      nuovaCampagna.originaleCSV = { testi: testiNumerici, firma: firmaNumerica(nuovaCampagna) };
    }
    return nuovaCampagna;
  });

  const intestazioni = {};
  formato.colonne.forEach((colonna, i) => {
    if (indici[i] >= 0) intestazioni[colonna.intestazione] = intestazione[indici[i]].trim();
  });

  const colonnaInizio = formato.colonne.find((colonna) => colonna.periodo === "inizio");
  const meseDelFile =
    colonnaInizio && campagne.length > 0 ? meseDaData(campagne[0][colonnaInizio.campo]) : "";

  return {
    campagne,
    meseDelFile,
    impressioniStimate: indiceImpression < 0,
    formatoFile: { separatore, decimale, virgoletteSeSpazi, intestazioni },
  };
}

function totaliDaFileAccount({ separatore, intestazione, righeDati }) {
  const colonne = intestazione.map(normalizzaTesto);
  const indici = ["costo", "clic", "impressioni"].map((nome) => colonne.indexOf(nome));
  const decimale = rilevaSeparatoreDecimale(
    righeDati.flatMap((riga) => indici.map((indice) => riga[indice])),
    separatore,
  );

  return righeDati.map((riga) => {
    const [spesa, click, impression] = indici.map((indice) => leggiNumeroCSV(riga[indice], decimale));
    return { spesa: arrotonda(spesa), click, impression };
  });
}

function correggiImpressioniConAccount(campagne, totaliAccount) {
  const chiave = (spesa, click) => `${arrotonda(spesa)}|${click}`;
  const contaPerChiave = (chiavi) =>
    chiavi.reduce((conteggi, k) => conteggi.set(k, (conteggi.get(k) ?? 0) + 1), new Map());

  const chiaviCampagne = campagne.map((campagna) =>
    chiave(parseNumero(campagna.spesa), parseNumero(campagna.click)),
  );
  const chiaviAccount = totaliAccount.map((account) => chiave(account.spesa, account.click));
  const campagnePerChiave = contaPerChiave(chiaviCampagne);
  const accountPerChiave = contaPerChiave(chiaviAccount);

  campagne.forEach((campagna, i) => {
    const k = chiaviCampagne[i];
    if (campagnePerChiave.get(k) !== 1 || accountPerChiave.get(k) !== 1) return;
    campagna.impression = String(totaliAccount[chiaviAccount.indexOf(k)].impression);
  });
}

async function leggiTestoFile(file) {
  const contenuto = await file.arrayBuffer();
  const inizio = new Uint8Array(contenuto.slice(0, 2));
  if (inizio[0] === 0xff && inizio[1] === 0xfe) return new TextDecoder("utf-16le").decode(contenuto);
  if (inizio[0] === 0xfe && inizio[1] === 0xff) return new TextDecoder("utf-16be").decode(contenuto);

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(contenuto);
  } catch {
    return new TextDecoder("windows-1252").decode(contenuto);
  }
}

function scegliFileCSV() {
  document.getElementById("fileimporta").click();
}

function dataDiOggi() {
  const oggi = new Date();
  return [
    oggi.getFullYear(),
    String(oggi.getMonth() + 1).padStart(2, "0"),
    String(oggi.getDate()).padStart(2, "0"),
  ].join("-");
}

function chiediClienteEMese(piattaforma, quante, meseProposto) {
  const dialogo = document.getElementById("dialogoimporta");
  const campoCliente = document.getElementById("importacliente");
  const campoMese = document.getElementById("importamese");
  const suggerimenti = document.getElementById("elencoclienti");

  document.getElementById("importatitolo").textContent =
    quante === 1 ? `Importa 1 campagna ${piattaforma}` : `Importa ${quante} campagne ${piattaforma}`;

  suggerimenti.innerHTML = "";
  [...document.querySelector(".select-clienti").options]
    .filter((opzione) => opzione.value !== "tutti")
    .forEach((opzione) => {
      const suggerimento = document.createElement("option");
      suggerimento.value = opzione.value;
      suggerimenti.appendChild(suggerimento);
    });

  campoCliente.value = "";
  campoMese.value = meseProposto || dataDiOggi().slice(0, 7);
  dialogo.returnValue = "";
  dialogo.showModal();

  return new Promise((risolvi) => {
    dialogo.addEventListener(
      "close",
      () => {
        risolvi(
          dialogo.returnValue === "importa"
            ? { cliente: campoCliente.value.trim(), periodo: campoMese.value }
            : null,
        );
      },
      { once: true },
    );
  });
}

async function importaCSV(selettoreFile) {
  const fileScelti = [...selettoreFile.files];
  selettoreFile.value = "";
  if (fileScelti.length === 0) return;

  const letti = await Promise.all(
    fileScelti.map(async (file) => ({
      nome: file.name,
      tabella: leggiTabellaCSV(await leggiTestoFile(file)),
    })),
  );

  const conCampagne = letti.filter(({ tabella }) => tabella && tabella.formato !== "account");
  const nonUsati = letti.filter(({ tabella }) => !tabella).map(({ nome }) => nome);
  const totaliAccount = letti
    .filter(({ tabella }) => tabella && tabella.formato === "account")
    .flatMap(({ tabella }) => totaliDaFileAccount(tabella));

  if (conCampagne.length === 0) {
    alert(
      fileScelti.length === 1
        ? "Il file non è un CSV di Google Ads, di Meta Ads o di questo sito (con le colonne Cliente e Campagna), quindi non può essere importato."
        : "Nessuno dei file contiene campagne di Google Ads, di Meta Ads o di questo sito, quindi non c'è niente da importare.",
    );
    return;
  }

  const campagneInterne = [];
  const campagnePiattaforma = [];
  const formatiDaRicordare = [];
  let meseProposto = "";

  conCampagne.forEach(({ nome, tabella }) => {
    if (tabella.formato === "interno") {
      campagneInterne.push(...campagneDaFileInterno(tabella));
      return;
    }

    const formato = FORMATI_PIATTAFORMA[tabella.formato];
    const lettura = campagneDaFilePiattaforma(tabella);
    if (lettura.impressioniStimate && formato.piattaforma === "Google Ads") {
      correggiImpressioniConAccount(lettura.campagne, totaliAccount);
    }

    campagnePiattaforma.push(...lettura.campagne);
    meseProposto = meseProposto || lettura.meseDelFile || meseDaNomeFile(nome);
    if (!formato.soloImport) formatiDaRicordare.push([tabella.formato, lettura.formatoFile]);
  });

  const campagneDaSalvare = [...campagneInterne, ...campagnePiattaforma];

  if (campagneDaSalvare.length === 0) {
    alert("Nel file non ci sono campagne da importare.");
    return;
  }

  if (campagnePiattaforma.length > 0) {
    const piattaforme = [...new Set(campagnePiattaforma.map((campagna) => campagna.piattaforma))];
    const scelta = await chiediClienteEMese(
      piattaforme.join(" e "),
      campagnePiattaforma.length,
      meseProposto,
    );
    if (!scelta) return;

    campagnePiattaforma.forEach((campagna) => Object.assign(campagna, scelta));
    formatiDaRicordare.forEach(([chiave, formatoFile]) => ricordaFormatoCSV(chiave, formatoFile));
  }

  const campagne = leggiCampagne();
  const idUsati = new Set(campagne.map((campagna) => Number(campagna.id)));
  let nuovoId = Date.now();

  campagneDaSalvare.forEach((nuovaCampagna) => {
    while (idUsati.has(nuovoId)) nuovoId--;
    idUsati.add(nuovoId);
    campagne.push({ id: nuovoId, ...nuovaCampagna });
  });

  salvaCampagne(campagne);

  const importate = campagneDaSalvare.length;
  const messaggio = importate === 1 ? "Campagna importata!" : `${importate} campagne importate!`;
  alert(nonUsati.length > 0 ? `${messaggio}\n\nFile non usati: ${nonUsati.join(", ")}` : messaggio);
  aggiornaVista();
}

function formatoDellaCampagna(campagna) {
  const piattaforma = normalizzaTesto(campagna.piattaforma);
  return Object.keys(FORMATI_PIATTAFORMA).find(
    (chiave) =>
      !FORMATI_PIATTAFORMA[chiave].soloImport &&
      normalizzaTesto(FORMATI_PIATTAFORMA[chiave].piattaforma) === piattaforma,
  );
}

function testoCSVInterno(campagne) {
  const intestazione = COLONNE_CSV.map((campo) => campo.charAt(0).toUpperCase() + campo.slice(1));
  const righeCampagne = campagne.map((campagna) =>
    COLONNE_CSV.map((campo) => valorePerCSV(campagna, campo)),
  );
  return unisciRigheCSV([intestazione, ...righeCampagne], SEPARATORE_CSV);
}

function testoCSVPiattaforma(chiaveFormato, campagne) {
  const formato = FORMATI_PIATTAFORMA[chiaveFormato];
  const ricordato = leggiFormatiCSV()[chiaveFormato] ?? {};
  const separatore = ricordato.separatore ?? ",";
  const decimale = ricordato.decimale ?? ".";
  const virgoletteSeSpazi = ricordato.virgoletteSeSpazi ?? formato.virgoletteSeSpazi ?? false;
  const intestazioni = ricordato.intestazioni ?? {};

  const intestazione = formato.colonne.map(
    (colonna) => intestazioni[colonna.intestazione] || colonna.intestazione,
  );

  const righeCampagne = campagne.map((campagna) => {
    const n = estraiNumeri(campagna);
    const kpi = calcolaKPICampagna(n.spesa, n.impression, n.click, n.lead, n.conversioni, n.ricavi);
    const originale = campagna.originaleCSV;
    const testiOriginali =
      originale && originale.firma === firmaNumerica(campagna) ? originale.testi : {};

    return formato.colonne.map((colonna) => {
      if (Object.hasOwn(testiOriginali, colonna.intestazione)) {
        return testiOriginali[colonna.intestazione];
      }
      if (colonna.kpi) {
        return numeroPerCSV(kpi[colonna.kpi], 2, decimale) + (colonna.percentuale ? "%" : "");
      }
      if (colonna.numero) {
        return numeroPerCSV(parseNumero(campagna[colonna.campo]), colonna.decimali, decimale);
      }

      const testo = String(campagna[colonna.campo] ?? "");
      if (testo === "" && colonna.periodo) return dataDelPeriodo(campagna.periodo, colonna.periodo);
      return testo;
    });
  });

  return unisciRigheCSV([intestazione, ...righeCampagne], separatore, virgoletteSeSpazi);
}

function preparaFileCSV(campagne) {
  const dataFile = dataDiOggi();
  const fileCSV = [];

  Object.entries(FORMATI_PIATTAFORMA).forEach(([chiave, formato]) => {
    const campagneFormato = campagne.filter((campagna) => formatoDellaCampagna(campagna) === chiave);
    if (campagneFormato.length === 0) return;

    fileCSV.push({
      etichetta: formato.piattaforma,
      nome: `${formato.prefissoFile}-${dataFile}.csv`,
      quante: campagneFormato.length,
      testo: testoCSVPiattaforma(chiave, campagneFormato),
    });
  });

  const altreCampagne = campagne.filter((campagna) => !formatoDellaCampagna(campagna));
  if (altreCampagne.length > 0) {
    fileCSV.push({
      etichetta: "Altre piattaforme",
      nome: `report-mensile-adv-${dataFile}.csv`,
      quante: altreCampagne.length,
      testo: testoCSVInterno(altreCampagne),
    });
  }

  return fileCSV;
}

async function salvaFileCSV({ nome: nomeProposto, testo: testoCSV }) {
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
      return true;
    } catch (errore) {
      if (errore.name !== "AbortError") {
        alert("Non è stato possibile salvare il file.");
      }
      return false;
    }
  }

  const nomeScelto = (prompt("Come vuoi chiamare il file?", nomeProposto) ?? "").trim();
  if (nomeScelto === "") return false;

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
  return true;
}

function mostraSceltaFileCSV(fileCSV) {
  const elenco = document.getElementById("elencofilecsv");
  elenco.innerHTML = "";

  fileCSV.forEach((file) => {
    const bottone = document.createElement("button");
    bottone.type = "button";
    bottone.className = "bot-azioni";
    bottone.textContent = `${file.etichetta} · ${file.quante === 1 ? "1 campagna" : `${file.quante} campagne`}`;
    bottone.addEventListener("click", async () => {
      if (await salvaFileCSV(file)) bottone.classList.add("scaricato");
    });
    elenco.appendChild(bottone);
  });

  document.getElementById("dialogoesporta").showModal();
}

async function scaricaCSV() {
  const campagne = leggiCampagne();

  if (campagne.length === 0) {
    alert("Non ci sono campagne da scaricare.");
    return;
  }

  const fileCSV = preparaFileCSV(campagne);

  if (fileCSV.length === 1) {
    await salvaFileCSV(fileCSV[0]);
  } else {
    mostraSceltaFileCSV(fileCSV);
  }
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