<?php
?>
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>Report mensile ADV</title>
    <link rel="stylesheet" href="style.css">
</head>

<body>
    <main class="wrapped">


        <!-- TITOLO -->

        <header class="titolo">
            <div>
                <h1>Report mensile ADV</h1>
                <p class="sottotitolo">Campagne ADV — spesa, risultati e costi per cliente</p>
            </div>
            <p class="data">Aggiornato al 30 settembre</p>
        </header>

        <hr>
        <!-- FILTRO -->

        <div class="barrastrumenti">
            <div class="filtri">
                <input type="search" id="cercaCampagna" class="cerca" placeholder="Cerca campagna...">
        
                <label for="filtro clienti">Mostra</label>
                <select class="select-clienti">
                    <option value="tutti">Tutti i clienti</option>
                </select>
                <select class="select-piattaforme">
                    <option value="tutti">Tutte le piattaforme</option>
                    <option value="metaads">Meta ADS</option>
                    <option value="googleads">Google ADS</option>
                    <option value="tiktokads">TikTok ADS</option>
                    <option value="linkedinads">LinkedIn ADS</option>
                </select>
            </div>
            <div class="azioni">
                <button  onclick="" class="bot-azioni" title="Riapri un report salvato in precedenza">Importa CSV</button>
                <input type="file" onchange="" accept=".csv, text/csv" hidden></input>
                <button  onclick="" class="bot-azioni">Scarica CSV</button>
                <button  onclick="" class="bot-svuota">Svuota tutto</button>
            </div>
        </div>
        <!-- DATI -->
        <div class="dati">
            <div class="dato">
                <div class="cont-dati">
                    <div class="internotitolo">Spesa</div>
                    <div class="valore" id="totalespesa">€0</div>
                </div>
            </div>
            <div class="dato">
                <div class="cont-dati">
                    <div class="internotitolo">Impression</div>
                    <div class="valore" id="totaleimpression">0</div>
                </div>
            </div>
            <div class="dato">
                <div class="cont-dati">
                    <div class="internotitolo">Click</div>
                    <div class="valore" id="totaleclick">0</div>
                </div>
            </div>
            <div class="dato">
                <div class="cont-dati">
                    <div class="internotitolo">CTR</div>
                    <div class="valore" id="totalectr">0%</div>
                </div>
            </div>
            <div class="dato">
                <div class="cont-dati">
                    <div class="internotitolo">Lead</div>
                    <div class="valore" id="totalelead">0</div>
                </div>
            </div>
            <div class="dato">
                <div class="cont-dati">
                    <div class="internotitolo">Costo per lead</div>
                    <div class="valore" id="totalecpl">€0</div>
                </div>
            </div>
        </div>


        <!-- TABELLA -->

        <section class="tabella">
        <div class="tabella-head">
            <h2>Campagne</h2>
            <span class="sugg">Scorri a destra per vedere tutte le colonne</span>
        <!-- </div> -->
        <div class="tabella-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>Cliente</th>
                        <th>Campagna</th>
                        <th>Piattaforma</th>
                        <th>Periodo</th>
                        <th class="num">Spesa</th>
                        <th class="num">Impression</th>
                        <th class="num">Click</th>
                        <th class="num">CTR</th>
                        <th class="num">CPC</th>
                        <th class="num">CPM</th>
                        <th class="num">Lead</th>
                        <th class="num">CPL</th>
                        <th class="num">Conv.</th>
                        <th class="num">CPA</th>
                        <th class="num">Ricavi</th>
                        <th class="num">ROAS</th>
                        <th>
                            <span class="sr-only">Azioni</span>
                        </th>
                    </tr>
                </thead>
                <tbody id="campagnatabella"></tbody>
                    <tr>
                        <td colspan="17" class="rigavuota">
                        </td>
                    </tr>
            </table>
        </div>
    </section>
    <!-- <div class="grafici">
        <section class="grafico">
            <div class="grafic-head">
                <h2>Dove vanno i soldi</h2>
                <span class="suggerimento">spesa, ultime 8 campagne</span>
            </div>
            <div id="graficospese" class="graficobarre">
                <p class="vuoto">Il grafico compare appena c'è almeno una campagna.</p>
            </div>
        </section>
        
        <section class="grafico">
            <div class="grafico-head">
                <h2>Cosa portano a casa</h2>
                <span class="suggerimento">lead, ultime 8 campagne</span>
            </div>
            <div id="graficospese" class="graficobarre">
                <p class="vuoto">Il grafico compare appena c'è almeno una campagna.</p>
            </div>
        </section>
    </div> -->


    <!-- INSERIMENTO CAMPAGNA -->
    <section class="modulo" id="nuovacampagna">

    <div class="modulo-testata">
        <h2 id="titolomodulo">Nuova campagna</h2>
        <span class="nota" id="notamodulo">Cliente e nome campagna sono obbligatori, il resto puoi lasciarlo a zero</span>
    </div>

    <form class="form-campagna">
        
        <fieldset>
            <legend>Di cosa si tratta</legend>

            <div class="griglia-campi">
                <div class="campo">
                    <label for="cliente">Cliente</label>
                    <input id="cliente" type="text" placeholder="Azienda Rossi">
                </div>

                <div class="campo">
                    <label for="campagna">Campagna</label>
                    <input id="campagna" type="text" placeholder="Lead gen settembre">
                </div>

                <div class="campo">
                    <label for="piattaforma">Piattaforma</label>
                    <select id="piattaforma">
                        <option>Meta Ads</option>
                        <option>Google Ads</option>
                        <option>TikTok Ads</option>
                        <option>LinkedIn Ads</option>
                    </select>
                </div>

                <div class="campo">
                    <label for="periodo">Mese</label>
                    <input id="periodo" type="month">
                </div>

                <div class="campo">
                    <label for="obiettivo">Obiettivo</label>
                    <select id="obiettivo">
                        <option>Lead</option>
                        <option>Traffico</option>
                        <option>Vendite</option>
                        <option>Awareness</option>
                        <option>Engagement</option>
                    </select>
                </div>

                <div class="campo">
                    <label for="budget">Budget previsto (€)</label>
                    <input id="budget" type="number" step="0.01" value="0">
                </div>
            </div>
        </fieldset>

        <fieldset>
            <legend>I numeri del mese</legend>

            <div class="griglia-campi">
                <div class="campo">
                    <label for="spesa">Spesa (€)</label>
                    <input id="spesa" type="number" step="0.01" value="0">
                </div>

                <div class="campo">
                    <label for="impression">Impression</label>
                    <input id="impression" type="number" value="0">
                </div>

                <div class="campo">
                    <label for="copertura">Reach</label>
                    <input id="copertura" type="number" value="0">
                </div>

                <div class="campo">
                    <label for="click">Click</label>
                    <input id="click" type="number" value="0">
                </div>

                <div class="campo">
                    <label for="lead">Lead</label>
                    <input id="lead" type="number" value="0">
                </div>

                <div class="campo">
                    <label for="conversioni">Conversioni</label>
                    <input id="conversioni" type="number" value="0">
                </div>

                <div class="campo">
                    <label for="ricavi">Ricavi (€)</label>
                    <input id="ricavi" type="number" step="0.01" value="0">
                </div>
            </div>
        </fieldset>

    </form>

    <div class="azioni-modulo">
        <button onclick="aggiungiCampagna()" class="bot-azioni" id="bottonesalva">
            Salva campagna
        </button>

        <button onclick="pulisciForm()" class="bot-svuota" id="bottonepulisci">
            Pulisci campi
        </button>

        <button onclick="cancelEdit()" class="bottone-link" id="bottoneannulla" hidden>
            Annulla modifica
        </button>
    </div>

</section>

    <footer class="foot">
        I dati restano salvati solo in questo browser. Per conservare un mese scarica il CSV,
        e quando ti serve di nuovo riaprilo con &laquo;Importa CSV&raquo;.
    </footer>
    </main>
    <script src="script.js"></script>
</body>
</html>
