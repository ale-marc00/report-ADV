<?php
require_once __DIR__ . '/auth.php';

$utente = richiediRuolo('admin');
$db = connettiDatabase();

header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header("Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; form-action 'self'; frame-ancestors 'none'");

const RUOLI = ['admin', 'operatore'];
const ALFABETO_PASSWORD = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function e(string $testo): string
{
    return htmlspecialchars($testo, ENT_QUOTES, 'UTF-8');
}

function avviso(string $tipo, string $testo, ?string $passwordTemporanea = null): void
{
    $_SESSION['avviso'] = ['tipo' => $tipo, 'testo' => $testo, 'password' => $passwordTemporanea];
}

function errorePassword(string $password): ?string
{
    if (strlen($password) < 8) {
        return 'La password deve avere almeno 8 caratteri.';
    }
    if (strlen($password) > 72) {
        return 'La password può avere al massimo 72 caratteri.';
    }
    return null;
}

function erroreNome(string $nome): ?string
{
    if (mb_strlen($nome) < 3 || mb_strlen($nome) > 100) {
        return 'Il nome deve avere tra 3 e 100 caratteri.';
    }
    if (preg_match('/[\x00-\x1F\x7F]/', $nome)) {
        return 'Il nome contiene caratteri non validi.';
    }
    return null;
}

function generaPasswordTemporanea(int $lunghezza = 12): string
{
    $password = '';
    for ($i = 0; $i < $lunghezza; $i++) {
        $password .= ALFABETO_PASSWORD[random_int(0, strlen(ALFABETO_PASSWORD) - 1)];
    }
    return $password;
}

function altriAdminAttivi(PDO $db, int $escludiId): int
{
    $consulta = $db->prepare(
        "SELECT COUNT(*) FROM users WHERE ruolo = 'admin' AND attivo = 1 AND id <> ? FOR UPDATE"
    );
    $consulta->execute([$escludiId]);
    return (int) $consulta->fetchColumn();
}

function proteggeCSV(string $valore): string
{
    return preg_match('/^[=+\-@\t\r]/', $valore) ? "'" . $valore : $valore;
}

function esportaUtenti(PDO $db): never
{
    $utenti = $db->query(
        'SELECT id, nome, ruolo, attivo, created_at, updated_at FROM users ORDER BY id'
    )->fetchAll();

    header('Content-Type: text/csv; charset=UTF-8');
    header('Content-Disposition: attachment; filename="utenti-' . date('Y-m-d') . '.csv"');
    header('Cache-Control: no-store');

    $uscita = fopen('php://output', 'w');
    fwrite($uscita, "\xEF\xBB\xBF");
    fputcsv($uscita, ['id', 'nome', 'ruolo', 'attivo', 'creato', 'aggiornato'], ';');
    foreach ($utenti as $riga) {
        fputcsv($uscita, [
            $riga['id'],
            proteggeCSV($riga['nome']),
            $riga['ruolo'],
            $riga['attivo'] ? 'si' : 'no',
            $riga['created_at'],
            $riga['updated_at'],
        ], ';');
    }
    fclose($uscita);
    exit;
}

function eseguiAzione(PDO $db, array $utente, array $dati): void
{
    $azione = (string) ($dati['azione'] ?? '');
    $id = (int) ($dati['id'] ?? 0);

    if ($azione === 'crea') {
        $nome = trim((string) ($dati['nome'] ?? ''));
        $password = (string) ($dati['password'] ?? '');
        $ruolo = (string) ($dati['ruolo'] ?? '');

        $errore = erroreNome($nome) ?? errorePassword($password);
        if ($errore === null && !in_array($ruolo, RUOLI, true)) {
            $errore = 'Ruolo non valido.';
        }
        if ($errore !== null) {
            avviso('errore', $errore);
            return;
        }

        $db->prepare('INSERT INTO users (nome, password, ruolo, attivo) VALUES (?, ?, ?, 1)')
            ->execute([$nome, password_hash($password, PASSWORD_DEFAULT), $ruolo]);
        avviso('ok', "Utente «{$nome}» creato.");
        return;
    }

    if ($azione === 'svuota_periodo') {
        $periodo = (string) ($dati['periodo'] ?? '');
        if (!preg_match('/^\d{4}-\d{2}$/', $periodo)) {
            avviso('errore', 'Mese non valido.');
            return;
        }
        $consulta = $db->prepare('DELETE FROM campaigns WHERE periodo = ?');
        $consulta->execute([$periodo]);
        avviso('ok', $consulta->rowCount() . " campagne di {$periodo} eliminate dal database.");
        return;
    }

    $db->beginTransaction();
    $consulta = $db->prepare('SELECT id, nome, ruolo, attivo FROM users WHERE id = ? FOR UPDATE');
    $consulta->execute([$id]);
    $bersaglio = $consulta->fetch();

    if (!$bersaglio) {
        $db->rollBack();
        avviso('errore', 'Utente non trovato.');
        return;
    }

    $siStessi = $id === $utente['id'];
    $eAdminAttivo = $bersaglio['ruolo'] === 'admin' && $bersaglio['attivo'];
    $perdeAdmin = fn(): bool => $eAdminAttivo && altriAdminAttivi($db, $id) === 0;

    switch ($azione) {
        case 'salva':
            $nome = trim((string) ($dati['nome'] ?? ''));
            $ruolo = $siStessi ? $bersaglio['ruolo'] : (string) ($dati['ruolo'] ?? '');
            $errore = erroreNome($nome);
            if ($errore === null && !in_array($ruolo, RUOLI, true)) {
                $errore = 'Ruolo non valido.';
            }
            if ($errore === null && $ruolo !== 'admin' && $perdeAdmin()) {
                $errore = 'Deve restare almeno un admin attivo.';
            }
            if ($errore !== null) {
                $db->rollBack();
                avviso('errore', $errore);
                return;
            }
            $db->prepare('UPDATE users SET nome = ?, ruolo = ? WHERE id = ?')->execute([$nome, $ruolo, $id]);
            $messaggio = "Utente «{$nome}» aggiornato.";
            break;

        case 'disattiva':
            if ($siStessi || $perdeAdmin()) {
                $db->rollBack();
                avviso('errore', $siStessi
                    ? 'Non puoi disattivare il tuo stesso account.'
                    : 'Deve restare almeno un admin attivo.');
                return;
            }
            $db->prepare('UPDATE users SET attivo = 0 WHERE id = ?')->execute([$id]);
            $messaggio = "Utente «{$bersaglio['nome']}» disattivato: non può più accedere.";
            break;

        case 'attiva':
            $db->prepare('UPDATE users SET attivo = 1 WHERE id = ?')->execute([$id]);
            $messaggio = "Utente «{$bersaglio['nome']}» riattivato.";
            break;

        case 'elimina':
            if ($siStessi || $perdeAdmin()) {
                $db->rollBack();
                avviso('errore', $siStessi
                    ? 'Non puoi eliminare il tuo stesso account.'
                    : 'Deve restare almeno un admin attivo.');
                return;
            }
            $db->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
            $messaggio = "Utente «{$bersaglio['nome']}» eliminato.";
            break;

        case 'reset':
            $temporanea = generaPasswordTemporanea();
            $db->prepare('UPDATE users SET password = ? WHERE id = ?')
                ->execute([password_hash($temporanea, PASSWORD_DEFAULT), $id]);
            $db->commit();
            avviso('ok', "Nuova password per «{$bersaglio['nome']}». Mostrata una sola volta:", $temporanea);
            return;

        default:
            $db->rollBack();
            avviso('errore', 'Azione non valida.');
            return;
    }

    $db->commit();
    avviso('ok', $messaggio);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!verificaCsrf($_POST['csrf'] ?? null)) {
        avviso('errore', 'Sessione scaduta, riprova.');
    } elseif (($_POST['azione'] ?? '') === 'esporta') {
        esportaUtenti($db);
    } else {
        try {
            eseguiAzione($db, $utente, $_POST);
        } catch (PDOException $errore) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            if ($errore->getCode() === '23000') {
                avviso('errore', 'Esiste già un utente con questo nome.');
            } else {
                error_log('Errore gestione utenti: ' . $errore->getMessage());
                avviso('errore', 'Operazione non riuscita.');
            }
        }
    }
    vaiA('admin.php');
}

$avviso = $_SESSION['avviso'] ?? null;
unset($_SESSION['avviso']);

$utenti = $db->query(
    'SELECT id, nome, ruolo, attivo, created_at FROM users ORDER BY ruolo, nome'
)->fetchAll();
$totali = $db->query(
    "SELECT COUNT(*) AS totale, SUM(attivo = 1) AS attivi, SUM(ruolo = 'admin') AS admin FROM users"
)->fetch();
$numeroCampagne = (int) $db->query('SELECT COUNT(*) FROM campaigns')->fetchColumn();
$periodi = $db->query(
    'SELECT periodo, COUNT(*) AS campagne FROM campaigns GROUP BY periodo ORDER BY periodo DESC'
)->fetchAll();
$csrf = tokenCsrf();
?>
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex">

    <title>Area admin — Report mensile ADV</title>
    <link rel="stylesheet" href="style.css">
</head>

<body>
    <main class="wrapped">

        <header class="titolo">
            <div>
                <h1>Area admin</h1>
                <p class="sottotitolo">Gestione utenti e manutenzione del database</p>
            </div>
            <div>
                <div class="sessione">
                    <span><?= e($utente['nome']) ?> (<?= e($utente['ruolo']) ?>)</span>
                    <a class="link-azione" href="campagne.php">Torna alle campagne</a>
                    <form method="post" action="logout.php">
                        <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
                        <button class="bot-svuota">Esci</button>
                    </form>
                </div>
            </div>
        </header>

        <hr>

        <?php if ($avviso): ?>
            <div class="<?= $avviso['tipo'] === 'ok' ? 'esito' : 'errore' ?> messaggio-pagina" role="alert">
                <?= e($avviso['testo']) ?>
                <?php if ($avviso['password']): ?>
                    <code class="password-temporanea"><?= e($avviso['password']) ?></code>
                <?php endif; ?>
            </div>
        <?php endif; ?>

        <div class="riepilogo">
            <div class="dato-admin">
                <div class="internotitolo">Utenti</div>
                <div class="valore"><?= (int) $totali['totale'] ?></div>
            </div>
            <div class="dato-admin">
                <div class="internotitolo">Attivi</div>
                <div class="valore"><?= (int) $totali['attivi'] ?></div>
            </div>
            <div class="dato-admin">
                <div class="internotitolo">Admin</div>
                <div class="valore"><?= (int) $totali['admin'] ?></div>
            </div>
            <div class="dato-admin">
                <div class="internotitolo">Campagne nel database</div>
                <div class="valore"><?= $numeroCampagne ?></div>
            </div>
        </div>

        <section class="tabella tabella-utenti">
            <div class="tabella-head">
                <h2>Utenti</h2>
                <div class="filtri">
                    <input type="search" id="cercaUtente" class="cerca" placeholder="Cerca utente...">
                    <form method="post" action="admin.php">
                        <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
                        <button class="bot-azioni" name="azione" value="esporta">Esporta elenco CSV</button>
                    </form>
                </div>
            </div>

            <div class="tabella-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>Ruolo</th>
                            <th>Stato</th>
                            <th>Creato il</th>
                            <th><span class="sr-only">Azioni</span></th>
                        </tr>
                    </thead>
                    <tbody id="corpoutenti">
                        <?php foreach ($utenti as $riga):
                            $idRiga = (int) $riga['id'];
                            $tu = $idRiga === $utente['id'];
                            $formRiga = 'utente-' . $idRiga;
                        ?>
                            <tr data-nome="<?= e(mb_strtolower($riga['nome'])) ?>">
                                <td>
                                    <form id="<?= $formRiga ?>" method="post" action="admin.php" class="form-riga">
                                        <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
                                        <input type="hidden" name="id" value="<?= $idRiga ?>">
                                    </form>
                                    <input form="<?= $formRiga ?>" name="nome" type="text" maxlength="100" required
                                        value="<?= e($riga['nome']) ?>" aria-label="Nome">
                                    <?php if ($tu): ?><span class="nota">(tu)</span><?php endif; ?>
                                </td>
                                <td>
                                    <select form="<?= $formRiga ?>" name="ruolo" aria-label="Ruolo" <?= $tu ? 'disabled' : '' ?>>
                                        <?php foreach (RUOLI as $ruolo): ?>
                                            <option value="<?= $ruolo ?>" <?= $riga['ruolo'] === $ruolo ? 'selected' : '' ?>><?= $ruolo ?></option>
                                        <?php endforeach; ?>
                                    </select>
                                </td>
                                <td>
                                    <span class="stato <?= $riga['attivo'] ? 'stato-attivo' : 'stato-spento' ?>">
                                        <?= $riga['attivo'] ? 'Attivo' : 'Disattivato' ?>
                                    </span>
                                </td>
                                <td><?= e(date('d/m/Y', strtotime($riga['created_at']))) ?></td>
                                <td class="row-actions">
                                    <button form="<?= $formRiga ?>" class="bot-azioni" name="azione" value="salva">Salva</button>
                                    <?php if (!$tu): ?>
                                        <?php if ($riga['attivo']): ?>
                                            <button form="<?= $formRiga ?>" class="bot-svuota" name="azione" value="disattiva"
                                                data-conferma="Disattivare l'utente? Non potrà più accedere.">Disattiva</button>
                                        <?php else: ?>
                                            <button form="<?= $formRiga ?>" class="bot-svuota" name="azione" value="attiva">Riattiva</button>
                                        <?php endif; ?>
                                    <?php endif; ?>
                                    <button form="<?= $formRiga ?>" class="bot-svuota" name="azione" value="reset"
                                        data-conferma="Generare una nuova password temporanea? Quella attuale smetterà di funzionare.">Reimposta password</button>
                                    <?php if (!$tu): ?>
                                        <button form="<?= $formRiga ?>" class="bot-svuota" name="azione" value="elimina"
                                            data-conferma="Eliminare definitivamente l'utente?">Elimina</button>
                                    <?php endif; ?>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </section>

        <section class="modulo">
            <div class="modulo-testata">
                <h2>Nuovo utente</h2>
                <span class="nota">Password di almeno 8 caratteri</span>
            </div>

            <form method="post" action="admin.php">
                <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
                <input type="hidden" name="azione" value="crea">

                <div class="griglia-campi">
                    <div class="campo">
                        <label for="nuovonome">Nome</label>
                        <input id="nuovonome" name="nome" type="text" maxlength="100" required autocomplete="off">
                    </div>

                    <div class="campo">
                        <label for="nuovapassword">Password</label>
                        <input id="nuovapassword" name="password" type="password" minlength="8" maxlength="72" required
                            autocomplete="new-password">
                    </div>

                    <div class="campo">
                        <label for="nuovoruolo">Ruolo</label>
                        <select id="nuovoruolo" name="ruolo">
                            <option value="operatore">operatore</option>
                            <option value="admin">admin</option>
                        </select>
                    </div>
                </div>

                <div class="azioni-modulo">
                    <button class="bot-azioni">Crea utente</button>
                </div>
            </form>
        </section>

        <section class="modulo">
            <div class="modulo-testata">
                <h2>Manutenzione campagne</h2>
                <span class="nota">Elimina dal database tutte le campagne di un mese</span>
            </div>

            <?php if ($periodi): ?>
                <form method="post" action="admin.php">
                    <input type="hidden" name="csrf" value="<?= e($csrf) ?>">
                    <input type="hidden" name="azione" value="svuota_periodo">

                    <div class="griglia-campi">
                        <div class="campo">
                            <label for="periodoeliminare">Mese</label>
                            <select id="periodoeliminare" name="periodo">
                                <?php foreach ($periodi as $periodo): ?>
                                    <option value="<?= e($periodo['periodo']) ?>">
                                        <?= e($periodo['periodo']) ?> (<?= (int) $periodo['campagne'] ?> campagne)
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                    </div>

                    <div class="azioni-modulo">
                        <button class="bot-azioni" data-conferma="Eliminare definitivamente tutte le campagne del mese scelto?">
                            Elimina campagne del mese
                        </button>
                    </div>
                </form>
            <?php else: ?>
                <p class="nota">Non ci sono ancora campagne salvate nel database.</p>
            <?php endif; ?>
        </section>

    </main>
    <script src="admin.js"></script>
</body>
</html>
