<?php
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/db.php';

richiediLogin();
$pdo = connettiDatabase();

// Il select della pagina campagne manda il NOME del cliente (script.js lo
// ricostruisce dalle campagne); accetto anche l'id numerico.
$cliente_param = isset($_GET['cliente']) ? trim((string)$_GET['cliente']) : '';
$periodo       = isset($_GET['periodo']) ? trim((string)$_GET['periodo']) : '';

if ($cliente_param === '' || $cliente_param === 'tutti') {
    http_response_code(400);
    exit('Seleziona un cliente specifico per generare il report.');
}

if ($periodo === 'tutti') {
    http_response_code(400);
    exit('Seleziona un mese specifico per generare il report.');
}

if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $periodo)) {
    http_response_code(400);
    exit('Parametro periodo mancante o non valido. Formato richiesto: AAAA-MM.');
}

if (ctype_digit($cliente_param)) {
    $stmt = $pdo->prepare("SELECT id, nome, referente FROM clienti WHERE id = ? OR nome = ? ORDER BY id = ? DESC LIMIT 1");
    $stmt->execute([(int)$cliente_param, $cliente_param, (int)$cliente_param]);
} else {
    $stmt = $pdo->prepare("SELECT id, nome, referente FROM clienti WHERE nome = ?");
    $stmt->execute([$cliente_param]);
}
$cliente = $stmt->fetch();

if (!$cliente) {
    http_response_code(404);
    exit('Cliente non trovato nel database.');
}
$cliente_id = (int)$cliente['id'];

$data_corrente = DateTime::createFromFormat('!Y-m', $periodo);
if (!$data_corrente) {
    http_response_code(400);
    exit("Impossibile interpretare il periodo '$periodo'.");
}
$data_corrente->modify('-1 month');
$periodo_prec = $data_corrente->format('Y-m');

function recuperaFinanze(PDO $pdo, int $cliente_id, string $periodo): array
{
    $stmt = $pdo->prepare("
        SELECT
            COALESCE(SUM(spesa), 0)   AS tot_spesa,
            COALESCE(SUM(budget), 0)  AS budget
        FROM campaigns
        WHERE cliente_id = ? AND periodo = ?
    ");
    $stmt->execute([$cliente_id, $periodo]);
    $r = $stmt->fetch();
    return $r ?: ['tot_spesa' => 0, 'budget' => 0];
}

function recuperaKpi(PDO $pdo, int $cliente_id, string $periodo): array
{
    $stmt = $pdo->prepare("
        SELECT
            COALESCE(SUM(impression), 0) AS tot_impression,
            COALESCE(SUM(click), 0)      AS tot_click,
            COALESCE(SUM(lead), 0)       AS tot_lead,
            CASE WHEN SUM(impression) > 0
                 THEN (SUM(click) / SUM(impression)) * 100
                 ELSE 0 END              AS ctr,
            CASE WHEN SUM(click) > 0
                 THEN SUM(spesa) / SUM(click)
                 ELSE 0 END              AS cpc,
            CASE WHEN SUM(lead) > 0
                 THEN SUM(spesa) / SUM(lead)
                 ELSE 0 END              AS cpl
        FROM campaigns
        WHERE cliente_id = ? AND periodo = ?
    ");
    $stmt->execute([$cliente_id, $periodo]);
    $r = $stmt->fetch();
    return $r ?: [
        'tot_impression' => 0, 'tot_click' => 0, 'tot_lead' => 0,
        'ctr' => 0, 'cpc' => 0, 'cpl' => 0,
    ];
}

$finanze_correnti = recuperaFinanze($pdo, $cliente_id, $periodo);
$finanze_prec     = recuperaFinanze($pdo, $cliente_id, $periodo_prec);
$kpi              = recuperaKpi($pdo, $cliente_id, $periodo);
$kpi_prec         = recuperaKpi($pdo, $cliente_id, $periodo_prec);

$stmt = $pdo->prepare("SELECT COUNT(*) FROM campaigns WHERE cliente_id = ? AND periodo = ?");
$stmt->execute([$cliente_id, $periodo_prec]);
$ha_prec = (int)$stmt->fetchColumn() > 0;
$periodo_prec_label = DateTime::createFromFormat('!Y-m', $periodo_prec)->format('m/Y');

/**
 * Variazione rispetto al mese precedente: differenza assoluta e percentuale.
 * Restituisce '' se il mese precedente non esiste.
 * $tipo: 'su_bene' (piu' alto = meglio), 'su_male' (piu' alto = peggio), 'neutro'.
 * $fmt: 'euro' | 'int' | 'pt' (punti percentuali, per il CTR).
 */
function variazioneKpi($corrente, $precedente, bool $ha_prec, string $fmt, string $tipo, string $label_prec): string
{
    if (!$ha_prec) return '';

    $corrente   = (float)$corrente;
    $precedente = (float)$precedente;
    $diff = $corrente - $precedente;

    $segno = $diff > 0 ? '+' : ($diff < 0 ? '-' : '');
    $abs   = abs($diff);
    if ($fmt === 'euro')      $diff_txt = $segno . '€' . number_format($abs, 2, ',', '.');
    elseif ($fmt === 'pt')    $diff_txt = $segno . number_format($abs, 2, ',', '.') . ' pt';
    else                      $diff_txt = $segno . number_format($abs, 0, ',', '.');

    if ($precedente == 0.0) {
        $perc_txt = 'n/d';
    } else {
        $perc = ($diff / $precedente) * 100;
        $perc_txt = ($perc > 0 ? '+' : '') . number_format($perc, 1, ',', '.') . '%';
    }

    if (round($diff, 4) == 0.0 || $tipo === 'neutro') $classe = 'neutra';
    elseif (($diff > 0) === ($tipo === 'su_bene'))     $classe = 'buona';
    else                                               $classe = 'cattiva';

    $freccia = $diff > 0 ? '▲' : ($diff < 0 ? '▼' : '=');

    return '<div class="variazione ' . $classe . '">' . $freccia . ' ' . $diff_txt
         . ' (' . $perc_txt . ') <span>vs ' . htmlspecialchars($label_prec, ENT_QUOTES, 'UTF-8') . '</span></div>';
}

function calcolaVariazione($corrente, $precedente): string
{
    $corrente   = (float) $corrente;
    $precedente = (float) $precedente;
    if ($precedente == 0.0) return '';
    $diff  = $corrente - $precedente;
    $perc  = ($diff / $precedente) * 100;
    $segno = $diff > 0 ? '+' : '';
    return ' (' . $segno . round($perc, 2) . '% vs mese prec.)';
}

$stmt = $pdo->prepare("
    SELECT campagna, piattaforma, spesa, impression, click, lead
    FROM campaigns
    WHERE cliente_id = ? AND periodo = ? AND attivo = 1
    ORDER BY spesa DESC
");
$stmt->execute([$cliente_id, $periodo]);
$campagne = $stmt->fetchAll();

$dataPeriodo = DateTime::createFromFormat('!Y-m', $periodo);
$periodoLabel = $dataPeriodo ? $dataPeriodo->format('m/Y') : $periodo;
?>
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <title>Report <?= htmlspecialchars($cliente['nome'], ENT_QUOTES, 'UTF-8') ?> <?= htmlspecialchars($periodo, ENT_QUOTES, 'UTF-8') ?></title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <main class="wrapped">

        <header class="titolo">
            <div>
                <h1>Report mensile: <?= htmlspecialchars($cliente['nome'], ENT_QUOTES, 'UTF-8') ?></h1>
                <p class="sottotitolo">
                    Referente: <?= htmlspecialchars($cliente['referente'] ?? '-', ENT_QUOTES, 'UTF-8') ?>
                    &middot; Periodo: <?= htmlspecialchars($periodoLabel, ENT_QUOTES, 'UTF-8') ?>
                </p>
            </div>
            <div class="azioni">
                <a href="campagne.php" class="bot-azioni no-print">Torna alle campagne</a>
                <button type="button" onclick="window.print()" class="bot-azioni no-print">Scarica PDF</button>
            </div>
        </header>

        <hr>

        <div class="dati">
            <div class="dato">
                <div class="cont-dati">
                    <div class="internotitolo">Spesa</div>
                    <div class="valore">€<?= number_format($finanze_correnti['tot_spesa'], 2, ',', '.') ?></div>
                    <?= variazioneKpi($finanze_correnti['tot_spesa'], $finanze_prec['tot_spesa'], $ha_prec, 'euro', 'neutro', $periodo_prec_label) ?>
                </div>
            </div>
            <div class="dato">
                <div class="cont-dati">
                    <div class="internotitolo">Impression</div>
                    <div class="valore"><?= number_format($kpi['tot_impression'], 0, ',', '.') ?></div>
                    <?= variazioneKpi($kpi['tot_impression'], $kpi_prec['tot_impression'], $ha_prec, 'int', 'su_bene', $periodo_prec_label) ?>
                </div>
            </div>
            <div class="dato">
                <div class="cont-dati">
                    <div class="internotitolo">Click</div>
                    <div class="valore"><?= number_format($kpi['tot_click'], 0, ',', '.') ?></div>
                    <?= variazioneKpi($kpi['tot_click'], $kpi_prec['tot_click'], $ha_prec, 'int', 'su_bene', $periodo_prec_label) ?>
                </div>
            </div>
            <div class="dato">
                <div class="cont-dati">
                    <div class="internotitolo">CTR</div>
                    <div class="valore"><?= number_format($kpi['ctr'], 2, ',', '.') ?>%</div>
                    <?= variazioneKpi($kpi['ctr'], $kpi_prec['ctr'], $ha_prec, 'pt', 'su_bene', $periodo_prec_label) ?>
                </div>
            </div>
            <div class="dato">
                <div class="cont-dati">
                    <div class="internotitolo">Lead</div>
                    <div class="valore"><?= number_format($kpi['tot_lead'], 0, ',', '.') ?></div>
                    <?= variazioneKpi($kpi['tot_lead'], $kpi_prec['tot_lead'], $ha_prec, 'int', 'su_bene', $periodo_prec_label) ?>
                </div>
            </div>
            <div class="dato">
                <div class="cont-dati">
                    <div class="internotitolo">Costo per lead</div>
                    <div class="valore">€<?= number_format($kpi['cpl'], 2, ',', '.') ?></div>
                    <?= variazioneKpi($kpi['cpl'], $kpi_prec['cpl'], $ha_prec, 'euro', 'su_male', $periodo_prec_label) ?>
                </div>
            </div>
        </div>

        <div class="riga-budget">
            Budget: <strong>€<?= number_format($finanze_correnti['budget'], 2, ',', '.') ?></strong>
            &middot; Speso: <strong>€<?= number_format($finanze_correnti['tot_spesa'], 2, ',', '.') ?></strong>
            &middot; CPC: <strong>€<?= number_format($kpi['cpc'], 2, ',', '.') ?></strong>
            <?= calcolaVariazione($kpi['cpc'], $kpi_prec['cpc']) ?>
            &middot; CPL: <strong>€<?= number_format($kpi['cpl'], 2, ',', '.') ?></strong>
        </div>

        <section class="tabella">
            <div class="tabella-head">
                <h2>Dettaglio campagne</h2>
                <span class="sugg">Scorri a destra per vedere tutte le colonne</span>
            </div>
            <div class="tabella-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Campagna</th>
                            <th>Piattaforma</th>
                            <th class="num">Spesa</th>
                            <th class="num">Impression</th>
                            <th class="num">Click</th>
                            <th class="num">Lead</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php if (empty($campagne)): ?>
                            <tr>
                                <td colspan="6" class="rigavuota">Nessuna campagna attiva per il periodo selezionato.</td>
                            </tr>
                        <?php else: ?>
                            <?php foreach ($campagne as $c): ?>
                                <tr>
                                    <td><?= htmlspecialchars($c['campagna'], ENT_QUOTES, 'UTF-8') ?></td>
                                    <td><span class="platform"><?= htmlspecialchars($c['piattaforma'], ENT_QUOTES, 'UTF-8') ?></span></td>
                                    <td class="num">€<?= number_format((float)$c['spesa'], 2, ',', '.') ?></td>
                                    <td class="num"><?= number_format((int)$c['impression'], 0, ',', '.') ?></td>
                                    <td class="num"><?= number_format((int)$c['click'], 0, ',', '.') ?></td>
                                    <td class="num"><?= number_format((int)$c['lead'], 0, ',', '.') ?></td>
                                </tr>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>
        </section>

        <footer class="foot">
            Report generato per <?= htmlspecialchars($cliente['nome'], ENT_QUOTES, 'UTF-8') ?>
            &middot; periodo <?= htmlspecialchars($periodoLabel, ENT_QUOTES, 'UTF-8') ?>
        </footer>

    </main>
</body>
</html>