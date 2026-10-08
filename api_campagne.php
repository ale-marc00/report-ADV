<?php
require_once __DIR__ . '/auth.php';

richiediLogin(true);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('X-Content-Type-Options: nosniff');

const LIMITI_TESTO = ['cliente' => 100, 'campagna' => 255, 'piattaforma' => 50, 'periodo' => 7, 'obiettivo' => 50];
const COLONNE_DECIMALI = ['budget', 'spesa', 'conversioni', 'ricavi'];
const COLONNE_INTERE = ['impression', 'copertura', 'click', 'lead'];
const VALORE_MASSIMO = 99999999.99;
const CAMPAGNE_PER_RICHIESTA = 2000;
const DIMENSIONE_MASSIMA_EXTRA = 60000;

class ErroreRichiesta extends Exception
{
    public function __construct(string $messaggio, public int $stato = 400)
    {
        parent::__construct($messaggio);
    }
}

function rispondi(array $dati, int $stato = 200): never
{
    http_response_code($stato);
    echo json_encode($dati, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function numeroComeTesto(string $valore): string
{
    return str_contains($valore, '.') ? rtrim(rtrim($valore, '0'), '.') : $valore;
}

function campagnaDallaRiga(array $riga): array
{
    $extra = $riga['extra'] !== null ? json_decode($riga['extra'], true) : [];
    $campagna = is_array($extra) ? $extra : [];

    foreach (array_keys(LIMITI_TESTO) as $colonna) {
        $campagna[$colonna] = (string) $riga[$colonna];
    }
    foreach ([...COLONNE_DECIMALI, ...COLONNE_INTERE] as $colonna) {
        $campagna[$colonna] = numeroComeTesto((string) $riga[$colonna]);
    }
    $campagna['budget_mensile'] = $riga['budget_mensile'] !== null ? numeroComeTesto((string) $riga['budget_mensile']) : '';
    $campagna['residuo'] = $riga['residuo'] !== null ? numeroComeTesto((string) $riga['residuo']) : '';
    $campagna['id'] = (int) $riga['id'];

    return $campagna;
}

function valoreNumerico(mixed $valore, string $colonna): float
{
    if ($valore === null || $valore === '') {
        return 0.0;
    }
    if (is_string($valore)) {
        $valore = str_replace(',', '.', trim($valore));
    }
    if (!is_numeric($valore)) {
        return 0.0;
    }
    $numero = (float) $valore;
    if (abs($numero) > VALORE_MASSIMO) {
        throw new ErroreRichiesta("Il valore di «{$colonna}» è troppo grande.");
    }
    return $numero;
}

function preparaCampagna(mixed $campagna): array
{
    if (!is_array($campagna)) {
        throw new ErroreRichiesta('Campagna non valida.');
    }

    $colonne = [];
    foreach (LIMITI_TESTO as $colonna => $massimo) {
        $valore = $campagna[$colonna] ?? '';
        if (!is_scalar($valore)) {
            throw new ErroreRichiesta("Il campo «{$colonna}» non è valido.");
        }
        $valore = trim((string) $valore);
        if (mb_strlen($valore) > $massimo) {
            throw new ErroreRichiesta("Il campo «{$colonna}» può avere al massimo {$massimo} caratteri.");
        }
        $colonne[$colonna] = $valore;
    }

    if ($colonne['cliente'] === '' || $colonne['campagna'] === '') {
        throw new ErroreRichiesta('Cliente e nome campagna sono obbligatori.');
    }
    if ($colonne['periodo'] !== '' && !preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $colonne['periodo'])) {
        throw new ErroreRichiesta('Il mese deve avere il formato AAAA-MM.');
    }

    foreach (COLONNE_DECIMALI as $colonna) {
        $colonne[$colonna] = round(valoreNumerico($campagna[$colonna] ?? null, $colonna), 2);
    }
    foreach (COLONNE_INTERE as $colonna) {
        $colonne[$colonna] = (int) round(valoreNumerico($campagna[$colonna] ?? null, $colonna));
    }

    $budgetMensile = $campagna['budget_mensile'] ?? '';
    $colonne['budget_mensile'] = ($budgetMensile === '' || $budgetMensile === null)
        ? null
        : round(valoreNumerico($budgetMensile, 'budget_mensile'), 2);

    $colonne['fonte'] = (($campagna['fonte'] ?? '') === 'csv') ? 'csv' : 'manuale';

    $extra = array_diff_key(
        $campagna,
        $colonne,
        ['id' => 0, 'created_at' => 0, 'updated_at' => 0, 'extra' => 0, 'residuo' => 0]
    );
    $testoExtra = $extra ? json_encode($extra, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) : null;
    if ($testoExtra !== null && strlen($testoExtra) > DIMENSIONE_MASSIMA_EXTRA) {
        throw new ErroreRichiesta('I dati della campagna sono troppo grandi.');
    }
    $colonne['extra'] = $testoExtra;

    return $colonne;
}

function idCliente(PDO $db, string $nome): int
{
    $cerca = $db->prepare('SELECT id FROM clienti WHERE nome = ?');
    $cerca->execute([$nome]);
    $id = $cerca->fetchColumn();
    if ($id !== false) {
        return (int) $id;
    }

    try {
        $db->prepare('INSERT INTO clienti (nome) VALUES (?)')->execute([$nome]);
        return (int) $db->lastInsertId();
    } catch (PDOException $errore) {
        if ($errore->getCode() !== '23000') {
            throw $errore;
        }
        $cerca->execute([$nome]);
        return (int) $cerca->fetchColumn();
    }
}

function salvaFormati(PDO $db, mixed $formati): void
{
    if (!is_array($formati)) {
        throw new ErroreRichiesta('Formati non validi.');
    }

    $scrittura = $db->prepare(
        'INSERT INTO format_memory (piattaforma, format_config) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE format_config = VALUES(format_config)'
    );
    foreach ($formati as $chiave => $configurazione) {
        if (!preg_match('/^[A-Za-z0-9_]{1,50}$/', (string) $chiave) || !is_array($configurazione)) {
            throw new ErroreRichiesta('Formato non valido.');
        }
        $testo = json_encode($configurazione, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        if (strlen($testo) > DIMENSIONE_MASSIMA_EXTRA) {
            throw new ErroreRichiesta('Formato troppo grande.');
        }
        $scrittura->execute([(string) $chiave, $testo]);
    }
}

function ricalcolaMese(PDO $db, int $clienteId, string $periodo): void
{
    if ($periodo === '') {
        return;
    }

    // le righe senza budget ereditano quello gia' presente per cliente e mese
    $db->prepare(
        'UPDATE campaigns c
         JOIN (SELECT MAX(budget_mensile) AS b FROM campaigns WHERE cliente_id = ? AND periodo = ?) m
         SET c.budget_mensile = m.b
         WHERE c.cliente_id = ? AND c.periodo = ? AND c.budget_mensile IS NULL AND m.b IS NOT NULL'
    )->execute([$clienteId, $periodo, $clienteId, $periodo]);

    // residuo = budget mensile - somma delle spese di cliente e mese
    $db->prepare(
        'UPDATE campaigns c
         JOIN (SELECT SUM(spesa) AS tot FROM campaigns WHERE cliente_id = ? AND periodo = ?) t
         SET c.residuo = c.budget_mensile - t.tot
         WHERE c.cliente_id = ? AND c.periodo = ? AND c.budget_mensile IS NOT NULL'
    )->execute([$clienteId, $periodo, $clienteId, $periodo]);
}

function salva(PDO $db, array $corpo): array
{
    $campagne = $corpo['campagne'] ?? [];
    if (!is_array($campagne) || count($campagne) > CAMPAGNE_PER_RICHIESTA) {
        throw new ErroreRichiesta('Elenco di campagne non valido.');
    }

    $pronte = array_map('preparaCampagna', array_values($campagne));

    $db->beginTransaction();
    try {
        $inserimento = $db->prepare(
            'INSERT INTO campaigns (cliente_id, campagna, piattaforma, periodo, obiettivo, budget, budget_mensile, spesa,
                impression, copertura, click, lead, conversioni, ricavi, extra, fonte)
             VALUES (:cliente_id, :campagna, :piattaforma, :periodo, :obiettivo, :budget, :budget_mensile, :spesa,
                :impression, :copertura, :click, :lead, :conversioni, :ricavi, :extra, :fonte)
             ON DUPLICATE KEY UPDATE
                obiettivo = VALUES(obiettivo), budget = VALUES(budget),
                budget_mensile = COALESCE(VALUES(budget_mensile), budget_mensile),
                spesa = VALUES(spesa), impression = VALUES(impression), copertura = VALUES(copertura),
                click = VALUES(click), lead = VALUES(lead), conversioni = VALUES(conversioni),
                ricavi = VALUES(ricavi), extra = VALUES(extra), fonte = VALUES(fonte)'
        );
        $gruppi = [];
        foreach ($pronte as $colonne) {
            $colonne['cliente_id'] = idCliente($db, $colonne['cliente']);
            unset($colonne['cliente']);
            $inserimento->execute($colonne);
            $gruppi[$colonne['cliente_id'] . '|' . $colonne['periodo']] = [
                $colonne['cliente_id'], $colonne['periodo'], $colonne['budget_mensile'],
            ];
        }
        foreach ($gruppi as [$clienteId, $periodo, $budgetMensile]) {
            if ($budgetMensile !== null && $periodo !== '') {
                // il budget inserito vale per tutto il mese del cliente
                $db->prepare('UPDATE campaigns SET budget_mensile = ? WHERE cliente_id = ? AND periodo = ?')
                    ->execute([$budgetMensile, $clienteId, $periodo]);
            }
            ricalcolaMese($db, (int) $clienteId, (string) $periodo);
        }
        if (isset($corpo['formati'])) {
            salvaFormati($db, $corpo['formati']);
        }
        $db->commit();
    } catch (Throwable $errore) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $errore;
    }

    return ['ok' => true, 'salvate' => count($pronte)];
}

try {
    $db = connettiDatabase();
    $metodo = $_SERVER['REQUEST_METHOD'];

    if ($metodo === 'GET') {
        $risorsa = $_GET['risorsa'] ?? '';

        if ($risorsa === 'campagne') {
            $righe = $db->query(
                'SELECT campaigns.*, clienti.nome AS cliente
                 FROM campaigns JOIN clienti ON clienti.id = campaigns.cliente_id
                 ORDER BY campaigns.id'
            )->fetchAll();
            rispondi(['campagne' => array_map('campagnaDallaRiga', $righe)]);
        }

        if ($risorsa === 'formati') {
            $formati = [];
            foreach ($db->query('SELECT piattaforma, format_config FROM format_memory') as $riga) {
                $configurazione = json_decode($riga['format_config'], true);
                if (is_array($configurazione)) {
                    $formati[$riga['piattaforma']] = $configurazione;
                }
            }
            rispondi(['formati' => (object) $formati]);
        }

        throw new ErroreRichiesta('Risorsa non valida.', 404);
    }

    if ($metodo !== 'POST') {
        throw new ErroreRichiesta('Metodo non consentito.', 405);
    }

    if (!verificaCsrf($_SERVER['HTTP_X_CSRF_TOKEN'] ?? null)) {
        throw new ErroreRichiesta('Sessione scaduta, ricarica la pagina.', 403);
    }

    $corpo = json_decode((string) file_get_contents('php://input'), true);
    if (!is_array($corpo)) {
        throw new ErroreRichiesta('Richiesta non valida.');
    }

    switch ($corpo['azione'] ?? '') {
        case 'salva':
            rispondi(salva($db, $corpo));

        case 'elimina':
            $id = filter_var($corpo['id'] ?? null, FILTER_VALIDATE_INT);
            if ($id === false) {
                throw new ErroreRichiesta('Campagna non valida.');
            }
            $db->beginTransaction();
            try {
                $trova = $db->prepare('SELECT cliente_id, periodo FROM campaigns WHERE id = ?');
                $trova->execute([$id]);
                $riga = $trova->fetch();
                $db->prepare('DELETE FROM campaigns WHERE id = ?')->execute([$id]);
                if ($riga) {
                    ricalcolaMese($db, (int) $riga['cliente_id'], (string) $riga['periodo']);
                }
                $db->commit();
            } catch (Throwable $errore) {
                if ($db->inTransaction()) {
                    $db->rollBack();
                }
                throw $errore;
            }
            rispondi(['ok' => true]);

        default:
            throw new ErroreRichiesta('Azione non valida.');
    }
} catch (ErroreRichiesta $errore) {
    rispondi(['errore' => $errore->getMessage()], $errore->stato);
} catch (Throwable $errore) {
    error_log('Errore API campagne: ' . $errore->getMessage());
    rispondi(['errore' => 'Operazione non riuscita.'], 500);
}
