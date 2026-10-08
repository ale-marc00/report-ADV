<?php
require_once __DIR__ . '/auth.php';
$utente = richiediLogin();
?>
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <meta name="csrf-token" content="<?= htmlspecialchars(tokenCsrf(), ENT_QUOTES, 'UTF-8') ?>">

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
            <div>
                <p class="data"></p>
                <div class="sessione">
                    <span><?= htmlspecialchars($utente['nome'], ENT_QUOTES, 'UTF-8') ?> (<?= htmlspecialchars($utente['ruolo'], ENT_QUOTES, 'UTF-8') ?>)</span>
                    <?php if ($utente['ruolo'] === 'admin'): ?>
                        <a class="link-azione" href="admin.php">Area admin</a>
                    <?php endif; ?>
                    <form method="post" action="logout.php">
                        <input type="hidden" name="csrf" value="<?= htmlspecialchars(tokenCsrf(), ENT_QUOTES, 'UTF-8') ?>">
                        <button class="bot-svuota">Esci</button>
                    </form>
                </div>
            </div>
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
                    <option value="spotifyads">Spotify ADS</option>
                    <option value="tiktokads">TikTok ADS</option>
                </select>
                <select class="select-mese">
                    <option value="tutti">Tutti i mesi</option>
                </select>
            </div>
            <div class="azioni">
                <button  onclick="scegliFileCSV()" class="bot-azioni" title="Importa un CSV di Google Ads o Meta Ads, oppure riapri un report salvato in precedenza">Importa CSV</button>
                <input type="file" id="fileimporta" onchange="importaCSV(this)" accept=".csv, text/csv" multiple hidden></input>
                <button  onclick="scaricaCSV()" class="bot-azioni">Scarica CSV</button>
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
        <div class="riga-budget" id="rigabudget" hidden>
            Budget mensile: <strong id="rbbudget">€0</strong>
            &middot; Speso: <strong id="rbspeso">€0</strong>
            &middot; Residuo: <strong id="rbresiduo">€0</strong>
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


    <dialog class="dialogo" id="dialogoimporta">
        <form method="dialog">
            <h2 id="importatitolo">Importa campagne</h2>
            <p class="nota">Il file non indica il cliente: cliente e mese scelti qui verranno assegnati a tutte le campagne del file.</p>

            <div class="griglia-campi">
                <div class="campo">
                    <label for="importacliente">Cliente</label>
                    <input id="importacliente" type="text" list="elencoclienti" placeholder="Azienda Rossi"
                        required pattern=".*\S.*" title="Scrivi il nome del cliente">
                    <datalist id="elencoclienti"></datalist>
                </div>

                <div class="campo">
                    <label for="importamese">Mese</label>
                    <input id="importamese" type="month" required pattern="\d{4}-\d{2}" placeholder="AAAA-MM">
                </div>

                <div class="campo">
                    <label for="importabudget">Budget mensile cliente (&euro;)</label>
                    <input id="importabudget" type="number" min="0" step="0.01" placeholder="Es. 1500">
                </div>
            </div>

            <div class="anteprima-budget" id="anteprimabudget" hidden>
                <div>Già speso nel mese: <strong id="abspesaesistente">€0</strong></div>
                <div>Questa importazione: <strong id="abspesaimport">€0</strong></div>
                <div>Residuo dopo l'import: <strong id="abresiduo">€0</strong></div>
            </div>

            <div class="azioni-modulo">
                <button value="importa" class="bot-azioni">Importa</button>
                <button value="annulla" class="bot-svuota" formnovalidate>Annulla</button>
            </div>
        </form>
    </dialog>


    <dialog class="dialogo" id="dialogoesporta">
        <h2>Scarica CSV</h2>
        <p class="nota">Ogni piattaforma ha il suo formato, quindi le campagne si scaricano in file separati.</p>
        <div class="elenco-file" id="elencofilecsv"></div>
        <form method="dialog" class="azioni-modulo">
            <button class="bot-svuota">Chiudi</button>
        </form>
    </dialog>

    <footer class="foot">
        I dati restano salvati solo in questo browser. Per conservare un mese scarica il CSV,
        e quando ti serve di nuovo riaprilo con &laquo;Importa CSV&raquo;.
    </footer>
    </main>
    <script src="script.js"></script>
</body>
</html>
