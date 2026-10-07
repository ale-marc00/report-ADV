<?php
if (realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) {
    http_response_code(403);
    exit;
}

require_once __DIR__ . '/db.php';

const DURATA_INATTIVITA = 7200;

function percorsoApp(): string
{
    return rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'])), '/') . '/';
}

function avviaSessione(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_name('report_adv');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => percorsoApp(),
        'secure' => !empty($_SERVER['HTTPS']),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();
}

function nonMemorizzareInCache(): void
{
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
}

function vaiA(string $pagina): never
{
    header('Location: ' . percorsoApp() . $pagina);
    exit;
}

function chiudiSessione(): void
{
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $cookie = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires' => time() - 3600,
            'path' => $cookie['path'],
            'secure' => $cookie['secure'],
            'httponly' => true,
            'samesite' => 'Strict',
        ]);
    }
    session_destroy();
}

function accediComeUtente(array $utente): void
{
    session_regenerate_id(true);
    $_SESSION = [
        'id' => (int) $utente['id'],
        'nome' => $utente['nome'],
        'ruolo' => $utente['ruolo'],
        'ultima_attivita' => time(),
        'csrf' => bin2hex(random_bytes(32)),
    ];
}

function negaAccesso(bool $api): never
{
    chiudiSessione();
    if ($api) {
        http_response_code(401);
        header('Content-Type: application/json; charset=utf-8');
        exit(json_encode(['errore' => 'Sessione scaduta']));
    }
    vaiA('index.php');
}

function richiediLogin(bool $api = false): array
{
    avviaSessione();
    nonMemorizzareInCache();

    $scaduta = isset($_SESSION['ultima_attivita'])
        && time() - $_SESSION['ultima_attivita'] > DURATA_INATTIVITA;

    if (!isset($_SESSION['id']) || $scaduta) {
        negaAccesso($api);
    }

    $consulta = connettiDatabase()->prepare('SELECT id, nome, ruolo, attivo FROM users WHERE id = ?');
    $consulta->execute([$_SESSION['id']]);
    $utente = $consulta->fetch();

    if (!$utente || !$utente['attivo']) {
        negaAccesso($api);
    }

    $_SESSION['nome'] = $utente['nome'];
    $_SESSION['ruolo'] = $utente['ruolo'];
    $_SESSION['ultima_attivita'] = time();

    return ['id' => (int) $utente['id'], 'nome' => $utente['nome'], 'ruolo' => $utente['ruolo']];
}

function richiediRuolo(string $ruolo): array
{
    $utente = richiediLogin();
    if ($utente['ruolo'] !== $ruolo) {
        http_response_code(403);
        exit('Accesso negato.');
    }
    return $utente;
}

function tokenCsrf(): string
{
    avviaSessione();
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function verificaCsrf(?string $token): bool
{
    avviaSessione();
    return is_string($token) && !empty($_SESSION['csrf']) && hash_equals($_SESSION['csrf'], $token);
}
