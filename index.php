<?php
require_once __DIR__ . '/auth.php';

avviaSessione();
nonMemorizzareInCache();
header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header("Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'");

if (isset($_SESSION['id'])) {
    vaiA('campagne.php');
}

const HASH_FITTIZIO = '$2y$10$usesomesillystringfore7hnbRJHxXVLeakoG8K30oukPsA.ztMG';
const TENTATIVI_MASSIMI = 5;
const ATTESA_BLOCCO = 300;

$errore = '';
$nomeInserito = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $nomeInserito = trim((string) ($_POST['nome'] ?? ''));
    $password = (string) ($_POST['password'] ?? '');
    $bloccatoFino = $_SESSION['bloccato_fino'] ?? 0;

    if (!verificaCsrf($_POST['csrf'] ?? null)) {
        $errore = 'Sessione scaduta, riprova.';
    } elseif ($bloccatoFino > time()) {
        $errore = 'Troppi tentativi. Riprova tra qualche minuto.';
    } else {
        $consulta = connettiDatabase()->prepare(
            'SELECT id, nome, password, ruolo, attivo FROM users WHERE nome = ?'
        );
        $consulta->execute([mb_substr($nomeInserito, 0, 100)]);
        $utente = $consulta->fetch();

        $salvata = $utente['password'] ?? HASH_FITTIZIO;
        $inChiaro = password_get_info($salvata)['algo'] === null;
        $corretta = $inChiaro
            ? hash_equals($salvata, $password)
            : password_verify($password, $salvata);

        if ($utente && $utente['attivo'] && $corretta) {
            if ($inChiaro || password_needs_rehash($salvata, PASSWORD_DEFAULT)) {
                connettiDatabase()
                    ->prepare('UPDATE users SET password = ? WHERE id = ?')
                    ->execute([password_hash($password, PASSWORD_DEFAULT), $utente['id']]);
            }
            accediComeUtente($utente);
            vaiA('campagne.php');
        }

        $_SESSION['tentativi'] = ($_SESSION['tentativi'] ?? 0) + 1;
        if ($_SESSION['tentativi'] >= TENTATIVI_MASSIMI) {
            $_SESSION['bloccato_fino'] = time() + ATTESA_BLOCCO;
            $_SESSION['tentativi'] = 0;
        }
        usleep(500000);
        $errore = 'Nome o password non corretti.';
    }
}

$csrf = tokenCsrf();
?>
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex">

    <title>Accesso — Report mensile ADV</title>
    <link rel="stylesheet" href="style.css">
</head>

<body>
    <main class="wrapped">

        <header class="titolo">
            <div>
                <h1>Report mensile ADV</h1>
                <p class="sottotitolo">Campagne ADV — spesa, risultati e costi per cliente</p>
            </div>
        </header>

        <hr>

        <section class="modulo accesso">
            <div class="modulo-testata">
                <h2>Accedi</h2>
                <span class="nota">Inserisci nome e password</span>
            </div>

            <?php if ($errore !== ''): ?>
                <p class="errore" role="alert"><?= htmlspecialchars($errore, ENT_QUOTES, 'UTF-8') ?></p>
            <?php endif; ?>

            <form method="post" action="index.php">
                <input type="hidden" name="csrf" value="<?= htmlspecialchars($csrf, ENT_QUOTES, 'UTF-8') ?>">

                <div class="griglia-accesso">
                    <div class="campo">
                        <label for="nome">Nome</label>
                        <input id="nome" name="nome" type="text" maxlength="100" required autofocus
                            autocomplete="username" value="<?= htmlspecialchars($nomeInserito, ENT_QUOTES, 'UTF-8') ?>">
                    </div>

                    <div class="campo">
                        <label for="password">Password</label>
                        <input id="password" name="password" type="password" maxlength="255" required
                            autocomplete="current-password">
                    </div>
                </div>

                <div class="azioni-modulo">
                    <button type="submit" class="bot-azioni">Accedi</button>
                </div>
            </form>
        </section>

    </main>
</body>
</html>
