# Spiegazione del codice PHP — Report mensile ADV

Questo documento spiega, file per file e riga per riga, tutto il PHP scritto per il sito: accesso, sessioni, area admin, database e API delle campagne.
I numeri tra parentesi (es. «righe 2-5») sono i numeri di riga dei file attuali.

> Il file `.htaccess` blocca l'accesso web ai file `.md`, quindi questo documento si legge solo dal computer, non da browser.

---

## 0. Il quadro generale (da usare per presentare il sito)

### Cosa fa il sito in una frase
Tre persone (1 admin, 2 operatori) accedono con nome e password e gestiscono insieme le stesse campagne pubblicitarie, salvate in un database MySQL.

### I file e il loro ruolo

| File | Ruolo |
|---|---|
| `.env` | Contiene le credenziali del database. Non va su GitHub (è nel `.gitignore`). |
| `.htaccess` | Regole di Apache: nasconde i file interni e blocca l'elenco delle cartelle. |
| `db.php` | Si collega al database. |
| `auth.php` | «Cassetta degli attrezzi» di sicurezza: sessioni, controllo accesso, token CSRF. |
| `index.php` | Pagina di accesso (login). |
| `logout.php` | Chiude la sessione. |
| `campagne.php` | Pagina principale con il report (accessibile solo dopo il login). |
| `api_campagne.php` | L'«interfaccia dati»: `script.js` le chiede di leggere, salvare ed eliminare campagne. |
| `admin.php` | Area riservata all'admin: gestione utenti e manutenzione. |
| `schema.sql` | Crea le tabelle del database. |

### Le tabelle del database

- **`users`**: chi può accedere (`nome`, `password` salvata come hash, `ruolo` admin/operatore, `attivo`).
- **`clienti`**: elenco dei clienti, ognuno con un `id` e un `nome` unico.
- **`campaigns`**: una riga per campagna. Non contiene il nome del cliente ma `cliente_id`, che punta a `clienti.id` (chiave esterna: il database non permette di eliminare un cliente che ha campagne).
  La colonna `extra` conserva in formato JSON i campi che non hanno una colonna propria (stato, ID della piattaforma, testi originali del CSV).
- **`format_memory`**: ricorda il formato dei CSV (separatore, decimali, intestazioni) per riscaricarli identici.

### Cosa succede quando un utente apre il sito (percorso di una richiesta)

1. Il browser chiede `campagne.php`.
2. `campagne.php` chiama `richiediLogin()` (in `auth.php`): se non c'è una sessione valida, rimanda a `index.php`.
3. Se l'accesso è valido, la pagina viene mostrata e contiene un token segreto (CSRF).
4. `script.js` (nel browser) chiede le campagne a `api_campagne.php`; l'API ricontrolla l'accesso, legge il database e risponde in JSON.
5. Quando l'utente salva, importa o elimina, `script.js` manda una richiesta all'API con il token; l'API valida i dati e scrive nel database.

### Le protezioni, in breve (utile per l'esposizione)

| Minaccia | Come ci si difende |
|---|---|
| Entrare scrivendo l'URL di una pagina | Ogni pagina controlla la sessione prima di mostrare qualcosa. |
| Rubare le password dal database | Le password sono salvate come hash (`password_hash`), mai in chiaro. |
| SQL injection | Tutte le query usano i «prepared statements» (`?` e `:nome`). |
| XSS (codice malevolo nei testi) | Ogni testo mostrato in pagina passa da `htmlspecialchars`. |
| CSRF (azioni fatte da un altro sito a nome tuo) | Token segreto in ogni form/richiesta, più cookie `SameSite=Strict`. |
| Furto/fissazione della sessione | ID rigenerato al login, cookie `HttpOnly`, modalità sessione «strict». |
| Indovinare le password | Pausa di mezzo secondo a ogni errore e blocco di 5 minuti dopo 5 errori. |
| Utente licenziato ma ancora loggato | A ogni richiesta si ricontrolla nel database che sia ancora attivo. |
| Operatore che apre l'area admin | `richiediRuolo('admin')` risponde 403. |
| Segreti pubblicati su GitHub | Credenziali in `.env`, escluso dal repository. |

---

## 1. `.env` — le credenziali

```
DB_HOST=...
DB_NOME=...
DB_UTENTE=...
DB_PASSWORD=...
```

- Quattro coppie `CHIAVE=valore`, una per riga.
- `DB_HOST`: dove gira MySQL (in locale `127.0.0.1`).
- `DB_NOME`: nome del database (`report_adv`).
- `DB_UTENTE` e `DB_PASSWORD`: utente MySQL e sua password (può restare vuota in XAMPP, ma la chiave deve esistere).
- Per passare al database aziendale basta cambiare questo file, senza toccare il codice.

---

## 2. `.htaccess` — regole di Apache

```apache
Options -Indexes
```
- Se qualcuno apre una cartella senza pagina, Apache non mostra l'elenco dei file.

```apache
<FilesMatch "^(db|auth)\.php$">
    Require all denied
</FilesMatch>
```
- `FilesMatch` applica una regola ai file il cui nome corrisponde all'espressione regolare.
- `^(db|auth)\.php$` significa «nome che inizia con db o auth e finisce con .php».
- `Require all denied` = accesso vietato a tutti (403). Questi due file servono solo al codice interno.

```apache
<FilesMatch "(^\.env|\.sql|\.md)$">
    Require all denied
</FilesMatch>
```
- Blocca `.env`, i file `.sql` (struttura del database) e i file `.md` (documentazione).

---

## 3. `db.php` — connessione al database

### Righe 2-5 — protezione dall'apertura diretta
```php
if (realpath($_SERVER['SCRIPT_FILENAME']) === __FILE__) {
    http_response_code(403);
    exit;
}
```
- `$_SERVER['SCRIPT_FILENAME']` è il file che PHP sta eseguendo come «pagina principale».
- `__FILE__` è il percorso di questo file.
- Se coincidono, qualcuno ha aperto `db.php` direttamente nel browser (invece di essere incluso da un'altra pagina).
- Allora risponde 403 (vietato) ed `exit` ferma tutto. È una seconda difesa oltre a `.htaccess`.

### Righe 7-23 — leggere la configurazione
```php
function configurazioneDatabase(): array
```
- Definisce una funzione che restituisce un array (`: array`).

```php
$file = __DIR__ . '/.env';
```
- `__DIR__` è la cartella del file; il punto `.` concatena il testo. Risultato: percorso di `.env`.

```php
$valori = is_readable($file) ? parse_ini_file($file, false, INI_SCANNER_RAW) : false;
```
- `is_readable`: il file esiste e si può leggere?
- Se sì, `parse_ini_file` lo legge trasformando `CHIAVE=valore` in un array `['CHIAVE' => 'valore']`.
- `false` = senza «sezioni»; `INI_SCANNER_RAW` = i valori restano testo grezzo (non interpreta parole come `yes`/`null`).
- Se il file non c'è, `$valori` vale `false`.
- `? :` è l'operatore «se…allora…altrimenti» (ternario).

```php
$mancanti = array_diff(
    ['DB_HOST', 'DB_NOME', 'DB_UTENTE', 'DB_PASSWORD'],
    is_array($valori) ? array_keys($valori) : []
);
```
- `array_diff(A, B)` restituisce gli elementi di A che NON sono in B.
- A = le quattro chiavi obbligatorie; B = le chiavi realmente presenti nel file (o un array vuoto se la lettura è fallita).
- Quindi `$mancanti` contiene le chiavi che mancano.

```php
if ($mancanti) {
    error_log('Configurazione .env incompleta, mancano: ' . implode(', ', $mancanti));
    http_response_code(500);
    exit('Servizio non disponibile.');
}
```
- Un array vuoto vale «falso», uno con elementi vale «vero»: se manca qualcosa entra qui.
- `error_log` scrive il dettaglio nel log del server (che vede solo l'amministratore); `implode` unisce i nomi con virgole.
- All'utente si mostra solo un messaggio generico con codice 500 (errore del server), per non rivelare dettagli.

```php
return $valori;
```
- Restituisce l'array con le impostazioni.

### Righe 25-52 — aprire la connessione
```php
function connettiDatabase(): PDO
```
- Restituisce un oggetto `PDO`, lo strumento standard di PHP per parlare con i database.

```php
static $connessione = null;
if ($connessione !== null) {
    return $connessione;
}
```
- `static` fa ricordare alla variabile il suo valore fra una chiamata e l'altra (nella stessa richiesta).
- Alla prima chiamata è `null` e si apre la connessione; dalle successive si riusa quella già aperta. Così si apre una sola connessione per pagina.

```php
$configurazione = configurazioneDatabase();
```
- Legge le impostazioni.

```php
$connessione = new PDO(
    "mysql:host={$configurazione['DB_HOST']};dbname={$configurazione['DB_NOME']};charset=utf8mb4",
    $configurazione['DB_UTENTE'],
    $configurazione['DB_PASSWORD'],
    [ ... ]
);
```
- Primo parametro: la «stringa di connessione» (tipo di database, host, nome, set di caratteri). Le `{...}` dentro le virgolette doppie inseriscono i valori.
- `charset=utf8mb4` permette accenti, emoji e ogni carattere.
- Secondo e terzo: utente e password.
- Quarto: opzioni.

```php
PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
```
- Se una query fallisce, PDO lancia un'eccezione (errore gestibile con `try/catch`) invece di fallire in silenzio.

```php
PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
```
- Le righe lette arrivano come array con i nomi delle colonne (`$riga['nome']`).

```php
PDO::ATTR_EMULATE_PREPARES => false,
```
- Usa i veri «prepared statements» di MySQL: la query e i dati viaggiano separati, quindi un dato non può mai essere interpretato come codice SQL (protezione dalla SQL injection).

```php
} catch (PDOException $errore) {
    error_log('Connessione al database fallita: ' . $errore->getMessage());
    http_response_code(500);
    exit('Servizio non disponibile.');
}
```
- Se la connessione fallisce: dettaglio nel log, messaggio generico all'utente.

```php
return $connessione;
```
- Restituisce la connessione pronta.

---

## 4. `auth.php` — sessioni, accesso e sicurezza

### Righe 2-5 — protezione dall'apertura diretta
Identica a quella di `db.php` (vedi sopra).

### Riga 7
```php
require_once __DIR__ . '/db.php';
```
- Include `db.php` una sola volta (`_once`). Se il file manca, PHP si ferma con errore (`require`, a differenza di `include`).

### Riga 9
```php
const DURATA_INATTIVITA = 7200;
```
- Costante: 7200 secondi = 2 ore. Dopo 2 ore senza fare nulla la sessione scade.

### Righe 11-14 — `percorsoApp()`
```php
return rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'])), '/') . '/';
```
- `$_SERVER['SCRIPT_NAME']` è l'indirizzo della pagina, per esempio `/Alessio/report_ADV/index.php`.
- `dirname` toglie il nome del file: `/Alessio/report_ADV`.
- `str_replace('\\', '/', …)` sostituisce eventuali backslash di Windows con `/`.
- `rtrim(…, '/')` toglie una `/` finale, e poi `. '/'` ne rimette esattamente una.
- Risultato: `/Alessio/report_ADV/`. Serve per far funzionare redirect e cookie anche se la cartella cambia nome.

### Righe 16-33 — `avviaSessione()`
```php
if (session_status() === PHP_SESSION_ACTIVE) {
    return;
}
```
- Se la sessione è già avviata non fa niente (evita avvisi di PHP se la funzione è chiamata più volte).

```php
ini_set('session.use_strict_mode', '1');
```
- Modalità «strict»: PHP rifiuta ID di sessione che non ha creato lui. Impedisce a un malintenzionato di imporre a una vittima un ID scelto da lui (session fixation).

```php
ini_set('session.use_only_cookies', '1');
```
- L'ID di sessione viaggia solo nei cookie, mai nell'indirizzo (dove finirebbe in cronologia e log).

```php
session_name('report_adv');
```
- Dà un nome personalizzato al cookie di sessione.

```php
session_set_cookie_params([
    'lifetime' => 0,
    'path' => percorsoApp(),
    'secure' => !empty($_SERVER['HTTPS']),
    'httponly' => true,
    'samesite' => 'Strict',
]);
```
- `lifetime => 0`: il cookie vive finché il browser resta aperto.
- `path`: il cookie è valido solo nella cartella del sito.
- `secure`: il cookie viaggia solo su HTTPS, ma solo se il sito è servito in HTTPS (`!empty($_SERVER['HTTPS'])`); in locale su `http` è automaticamente `false`.
- `httponly => true`: il JavaScript della pagina non può leggere il cookie (protegge dal furto via XSS).
- `samesite => 'Strict'`: il browser non invia il cookie quando la richiesta parte da un altro sito (protegge dal CSRF).

```php
session_start();
```
- Avvia la sessione: crea o riprende l'array `$_SESSION`, i dati salvati sul server per questo utente.

### Righe 35-39 — `nonMemorizzareInCache()`
```php
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
```
- `header()` invia un'intestazione HTTP al browser.
- Dicono al browser di non conservare la pagina: dopo il logout, il tasto «Indietro» non mostra pagine riservate. `Pragma` è la versione per i browser più vecchi.

### Righe 41-45 — `vaiA($pagina)`
```php
function vaiA(string $pagina): never
{
    header('Location: ' . percorsoApp() . $pagina);
    exit;
}
```
- `never` indica che la funzione non ritorna mai (termina sempre con `exit`).
- L'intestazione `Location` ordina al browser di andare a un altro indirizzo (redirect).
- `exit` è indispensabile: senza, PHP continuerebbe a eseguire il resto della pagina.

### Righe 47-61 — `chiudiSessione()`
```php
$_SESSION = [];
```
- Svuota i dati della sessione.

```php
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
```
- Se le sessioni usano cookie, si riprendono i parametri del cookie e se ne manda uno con lo stesso nome, vuoto e già scaduto (`time() - 3600` = un'ora fa): il browser lo cancella.
- Stesso `path`, `secure` e simili: è necessario perché il browser riconosca che è lo stesso cookie.

```php
session_destroy();
```
- Elimina la sessione dal server.

### Righe 63-73 — `accediComeUtente($utente)`
```php
session_regenerate_id(true);
```
- Cambia l'ID di sessione al momento del login e cancella il vecchio (`true`). Così un ID noto prima del login non vale più dopo.

```php
$_SESSION = [
    'id' => (int) $utente['id'],
    'nome' => $utente['nome'],
    'ruolo' => $utente['ruolo'],
    'ultima_attivita' => time(),
    'csrf' => bin2hex(random_bytes(32)),
];
```
- Salva nella sessione: id, nome, **ruolo** (è qui che «la sessione salva il ruolo»), momento dell'ultima attività e un token CSRF.
- `(int)` forza il numero intero.
- `time()` è l'ora attuale in secondi.
- `random_bytes(32)` genera 32 byte casuali crittograficamente sicuri; `bin2hex` li scrive come 64 caratteri esadecimali. Questo è il token segreto anti-CSRF.

### Righe 75-84 — `negaAccesso($api)`
```php
chiudiSessione();
if ($api) {
    http_response_code(401);
    header('Content-Type: application/json; charset=utf-8');
    exit(json_encode(['errore' => 'Sessione scaduta']));
}
vaiA('index.php');
```
- Chiude la sessione e poi risponde in due modi:
  - se è una richiesta dell'API (`$api` vero): codice 401 («non autenticato») e un messaggio JSON, perché `script.js` si aspetta JSON, non una pagina;
  - altrimenti: redirect alla pagina di login.
- `json_encode` trasforma un array PHP in testo JSON.

### Righe 86-111 — `richiediLogin($api = false)` (la funzione più importante)
```php
avviaSessione();
nonMemorizzareInCache();
```
- Avvia la sessione e vieta la cache.

```php
$scaduta = isset($_SESSION['ultima_attivita'])
    && time() - $_SESSION['ultima_attivita'] > DURATA_INATTIVITA;
```
- `$scaduta` è vero se esiste un'ultima attività e sono passati più di 7200 secondi da allora.
- `isset` verifica che la chiave esista; `&&` = «e».

```php
if (!isset($_SESSION['id']) || $scaduta) {
    negaAccesso($api);
}
```
- Se non c'è un utente in sessione (`!` = «non») **oppure** la sessione è scaduta (`||` = «o») → accesso negato.

```php
$consulta = connettiDatabase()->prepare('SELECT id, nome, ruolo, attivo FROM users WHERE id = ?');
$consulta->execute([$_SESSION['id']]);
$utente = $consulta->fetch();
```
- Si rilegge l'utente dal database a ogni richiesta.
- `prepare` prepara la query con un segnaposto `?`; `execute` fornisce il valore; `fetch` restituisce la riga (o `false` se non esiste).
- Perché: se l'admin disattiva, elimina o cambia ruolo a qualcuno, l'effetto è immediato.

```php
if (!$utente || !$utente['attivo']) {
    negaAccesso($api);
}
```
- Utente eliminato o disattivato → fuori.

```php
$_SESSION['nome'] = $utente['nome'];
$_SESSION['ruolo'] = $utente['ruolo'];
$_SESSION['ultima_attivita'] = time();
```
- Aggiorna nome e ruolo (potrebbero essere cambiati) e fa ripartire il timer dell'inattività.

```php
return ['id' => (int) $utente['id'], 'nome' => $utente['nome'], 'ruolo' => $utente['ruolo']];
```
- Restituisce i dati dell'utente alla pagina che ha chiamato la funzione.

### Righe 113-121 — `richiediRuolo($ruolo)`
```php
$utente = richiediLogin();
if ($utente['ruolo'] !== $ruolo) {
    http_response_code(403);
    exit('Accesso negato.');
}
return $utente;
```
- Prima verifica che sia loggato, poi che abbia il ruolo richiesto. `!==` = «diverso (anche come tipo)».
- Se il ruolo non basta: 403 «vietato». Si usa in `admin.php` con `'admin'`.

### Righe 123-130 — `tokenCsrf()`
```php
avviaSessione();
if (empty($_SESSION['csrf'])) {
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
}
return $_SESSION['csrf'];
```
- Restituisce il token della sessione, creandolo se non esiste (per esempio nella pagina di login, dove l'utente non è ancora entrato).
- `empty` è vero per valori assenti o vuoti.

### Righe 132-136 — `verificaCsrf($token)`
```php
return is_string($token) && !empty($_SESSION['csrf']) && hash_equals($_SESSION['csrf'], $token);
```
- Controlla tre cose insieme: il token ricevuto è un testo, in sessione ce n'è uno, e sono identici.
- `hash_equals` confronta in tempo costante, per non rivelare con i tempi di risposta quanti caratteri erano giusti.
- Il parametro `?string` significa «testo oppure null».

> **Che cos'è il CSRF:** un sito malevolo potrebbe far inviare al tuo browser un form verso il nostro sito sfruttando il fatto che sei loggato. Il token è un segreto che solo le nostre pagine conoscono: un form falso non può includerlo, quindi la richiesta viene scartata.

---

## 5. `index.php` — la pagina di accesso (righe 1-64: parte PHP)

### Righe 2-8
```php
require_once __DIR__ . '/auth.php';
avviaSessione();
nonMemorizzareInCache();
```
- Carica le funzioni di sicurezza, avvia la sessione, vieta la cache.

```php
header('X-Frame-Options: DENY');
```
- La pagina non può essere mostrata dentro un `iframe` di un altro sito (difesa dal clickjacking, cioè dal «tasto invisibile» sovrapposto).

```php
header('X-Content-Type-Options: nosniff');
```
- Il browser non deve «indovinare» il tipo dei file: usa quello dichiarato.

```php
header("Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'");
```
- Politica di sicurezza dei contenuti: la pagina può caricare risorse solo dal proprio sito (`'self'`).
- `style-src … 'unsafe-inline'`: ammette anche stili scritti nella pagina.
- `frame-ancestors 'none'`: nessuno può incorniciare la pagina (come `X-Frame-Options`, per i browser moderni).
- Non c'è `script-src`: la pagina di login non usa JavaScript, e comunque `default-src 'self'` impedirebbe script esterni.

### Righe 10-12
```php
if (isset($_SESSION['id'])) {
    vaiA('campagne.php');
}
```
- Se sei già loggato, non serve rivedere il login: vai direttamente alle campagne.

### Righe 14-16 — costanti
```php
const HASH_FITTIZIO = '$2y$10$usesomesillystringfore7hnbRJHxXVLeakoG8K30oukPsA.ztMG';
const TENTATIVI_MASSIMI = 5;
const ATTESA_BLOCCO = 300;
```
- `HASH_FITTIZIO`: un hash bcrypt di una password inventata. Serve (vedi più sotto) per impiegare lo stesso tempo anche quando il nome utente non esiste.
- 5 tentativi sbagliati e 300 secondi (5 minuti) di blocco.

### Righe 18-19
```php
$errore = '';
$nomeInserito = '';
```
- Variabili iniziali: nessun errore, nessun nome. Il form le userà.

### Righe 21-24 — è stato inviato il form?
```php
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
```
- Un form di login viene inviato con il metodo POST; l'apertura normale della pagina è GET.

```php
$nomeInserito = trim((string) ($_POST['nome'] ?? ''));
$password = (string) ($_POST['password'] ?? '');
$bloccatoFino = $_SESSION['bloccato_fino'] ?? 0;
```
- `$_POST['nome']` contiene quanto scritto nel campo `nome`.
- `??` = «se non esiste, usa questo valore» (qui `''`). Evita errori se un campo manca.
- `(string)` forza il tipo testo (un attaccante potrebbe inviare un array).
- `trim` toglie spazi iniziali e finali dal nome (non dalla password, in cui gli spazi contano).
- `$bloccatoFino`: se l'utente è bloccato, contiene il momento in cui il blocco finisce; altrimenti 0.

### Righe 26-30 — i tre controlli in ordine
```php
if (!verificaCsrf($_POST['csrf'] ?? null)) {
    $errore = 'Sessione scaduta, riprova.';
} elseif ($bloccatoFino > time()) {
    $errore = 'Troppi tentativi. Riprova tra qualche minuto.';
} else {
```
1. Token CSRF sbagliato o assente → errore.
2. Se il blocco finisce in futuro (`> time()`) → ancora bloccato.
3. Altrimenti si procede con la verifica delle credenziali.

### Righe 31-35 — cercare l'utente
```php
$consulta = connettiDatabase()->prepare(
    'SELECT id, nome, password, ruolo, attivo FROM users WHERE nome = ?'
);
$consulta->execute([mb_substr($nomeInserito, 0, 100)]);
$utente = $consulta->fetch();
```
- Query preparata: il nome non viene mai incollato nel testo SQL, quindi la SQL injection è impossibile.
- `mb_substr(..., 0, 100)` taglia a 100 caratteri (limite della colonna).
- `$utente` sarà la riga trovata oppure `false`.

### Righe 37-41 — verificare la password
```php
$salvata = $utente['password'] ?? HASH_FITTIZIO;
```
- Se l'utente esiste, usa la sua password salvata; se non esiste usa l'hash fittizio. Così il calcolo successivo dura sempre uguale e chi attacca non può capire se un nome esiste misurando i tempi.

```php
$inChiaro = password_get_info($salvata)['algo'] === null;
```
- `password_get_info` analizza una stringa: se non riconosce un algoritmo di hash, `algo` è `null`. Significa che la password nel database è ancora scritta in chiaro (caso dei tuoi tre utenti iniziali).

```php
$corretta = $inChiaro
    ? hash_equals($salvata, $password)
    : password_verify($password, $salvata);
```
- Se la password salvata è in chiaro, la confronta direttamente (in tempo costante); altrimenti usa `password_verify`, la funzione che confronta una password con il suo hash.

### Righe 43-51 — accesso riuscito
```php
if ($utente && $utente['attivo'] && $corretta) {
```
- Tutte e tre vere: l'utente esiste, è attivo, la password è giusta.

```php
if ($inChiaro || password_needs_rehash($salvata, PASSWORD_DEFAULT)) {
    connettiDatabase()
        ->prepare('UPDATE users SET password = ? WHERE id = ?')
        ->execute([password_hash($password, PASSWORD_DEFAULT), $utente['id']]);
}
```
- Se la password era in chiaro (o l'hash usa un algoritmo ormai superato), la riscrive nel database come hash moderno. È un'«aggiornamento automatico al primo accesso».
- `password_hash` genera l'hash con sale casuale incluso: due password uguali danno hash diversi.

```php
accediComeUtente($utente);
vaiA('campagne.php');
```
- Crea la sessione (con il ruolo) e porta alle campagne.

### Righe 53-59 — accesso fallito
```php
$_SESSION['tentativi'] = ($_SESSION['tentativi'] ?? 0) + 1;
```
- Aumenta di uno il contatore degli errori (partendo da 0 se non esiste).

```php
if ($_SESSION['tentativi'] >= TENTATIVI_MASSIMI) {
    $_SESSION['bloccato_fino'] = time() + ATTESA_BLOCCO;
    $_SESSION['tentativi'] = 0;
}
```
- Al quinto errore fissa il blocco a «adesso + 300 secondi» e azzera il contatore.

```php
usleep(500000);
```
- Pausa di 500.000 microsecondi = mezzo secondo: rende lenti i tentativi automatici.

```php
$errore = 'Nome o password non corretti.';
```
- Messaggio volutamente identico se sbaglia il nome o la password.

### Riga 63
```php
$csrf = tokenCsrf();
```
- Prepara il token da inserire nel form.

### Parte HTML (dopo la riga 64)
```php
<?= htmlspecialchars($errore, ENT_QUOTES, 'UTF-8') ?>
```
- `<?= … ?>` è la forma breve di «scrivi in pagina questo valore».
- `htmlspecialchars` converte `<`, `>`, `&`, `"` e `'` in codici innocui. Se qualcuno scrivesse codice malevolo nel campo nome, verrebbe mostrato come testo e non eseguito (difesa dall'XSS). Va usato **sempre** quando si stampa un testo che viene dall'esterno.

```php
<?php if ($errore !== ''): ?> … <?php endif; ?>
```
- Sintassi alternativa dell'`if` per i file HTML: mostra il blocco solo se c'è un errore.

```html
<input type="hidden" name="csrf" value="<?= htmlspecialchars($csrf, …) ?>">
```
- Campo nascosto che porta il token insieme al form.

Gli attributi del campo nome: `maxlength="100"` (limite lato browser), `required` (obbligatorio), `autofocus` (cursore subito qui), `autocomplete="username"` e, per la password, `autocomplete="current-password"` (aiutano il gestore di password del browser). Il campo password è `type="password"` (testo nascosto). Il nome già digitato viene rimesso con `value="<?= htmlspecialchars($nomeInserito, …) ?>"` in modo che dopo un errore non debba essere riscritto.

---

## 6. `logout.php`

```php
require_once __DIR__ . '/auth.php';
avviaSessione();
```
- Carica le funzioni e riprende la sessione.

```php
if ($_SERVER['REQUEST_METHOD'] === 'POST' && verificaCsrf($_POST['csrf'] ?? null)) {
    chiudiSessione();
}
```
- Esce solo se la richiesta è un POST **e** il token è valido. Se il logout funzionasse con un semplice link (GET), un altro sito potrebbe disconnetterti inserendo un'immagine che punta a `logout.php`.

```php
vaiA('index.php');
```
- In ogni caso torna alla pagina di login.

---

## 7. `campagne.php` — la parte PHP

### Righe 1-4
```php
<?php
require_once __DIR__ . '/auth.php';
$utente = richiediLogin();
?>
```
- Prima di mostrare qualsiasi HTML controlla l'accesso. Se non sei loggato, `richiediLogin` ti rimanda al login e la pagina non viene mai generata. In `$utente` finiscono id, nome e ruolo.

### Riga 11
```php
<meta name="csrf-token" content="<?= htmlspecialchars(tokenCsrf(), ENT_QUOTES, 'UTF-8') ?>">
```
- Inserisce il token CSRF nella testata della pagina. `script.js` lo legge e lo manda all'API in ogni richiesta di scrittura.

### Righe 31-37 — nome, ruolo e pulsanti in alto a destra
```php
<?= htmlspecialchars($utente['nome'], …) ?> (<?= htmlspecialchars($utente['ruolo'], …) ?>)
```
- Mostra «nome (ruolo)».

```php
<?php if ($utente['ruolo'] === 'admin'): ?>
    <a class="link-azione" href="admin.php">Area admin</a>
<?php endif; ?>
```
- **Il link all'area admin viene scritto nella pagina solo se il ruolo in sessione è admin.** Per un operatore non esiste proprio nel codice HTML. (Anche scrivendo `admin.php` nell'URL, `admin.php` ricontrolla il ruolo.)

```html
<form method="post" action="logout.php"> … csrf … <button>Esci</button></form>
```
- Il pulsante «Esci» è un form POST con token, come richiede `logout.php`.

---

## 8. `api_campagne.php` — l'API delle campagne

> Un'**API** è un indirizzo a cui un programma (qui `script.js`) chiede dati e che risponde in formato JSON invece che con una pagina web.

### Riga 4
```php
richiediLogin(true);
```
- Prima di tutto verifica la sessione. Con `true` un eventuale rifiuto è una risposta 401 in JSON (non un redirect).

### Righe 6-8 — intestazioni di risposta
```php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('X-Content-Type-Options: nosniff');
```
- Dichiara che la risposta è JSON, vieta la cache (i dati devono sempre arrivare freschi dal database) e il «nosniff».

### Righe 10-15 — costanti di validazione
```php
const LIMITI_TESTO = ['cliente' => 100, 'campagna' => 255, 'piattaforma' => 50, 'periodo' => 7, 'obiettivo' => 50];
```
- Lunghezza massima dei campi di testo, uguale a quella delle colonne del database.

```php
const COLONNE_DECIMALI = ['budget', 'spesa', 'conversioni', 'ricavi'];
const COLONNE_INTERE = ['impression', 'copertura', 'click', 'lead'];
```
- Quali numeri hanno i decimali (euro) e quali sono numeri interi (conteggi).

```php
const VALORE_MASSIMO = 99999999.99;
const CAMPAGNE_PER_RICHIESTA = 2000;
const DIMENSIONE_MASSIMA_EXTRA = 60000;
```
- Valore massimo accettato per un numero (limite di `DECIMAL(10,2)`), massimo di campagne per singola richiesta e dimensione massima in byte del campo JSON `extra`. Sono protezioni da dati esagerati.

### Righe 17-23 — la classe `ErroreRichiesta`
```php
class ErroreRichiesta extends Exception
{
    public function __construct(string $messaggio, public int $stato = 400)
    {
        parent::__construct($messaggio);
    }
}
```
- Un tipo di errore personalizzato: «errore causato da una richiesta sbagliata».
- `extends Exception` = è un'eccezione PHP con qualche aggiunta.
- `public int $stato = 400` crea in un colpo solo una proprietà `stato` con il codice HTTP da restituire (400 = richiesta errata se non specificato).
- `parent::__construct($messaggio)` salva il messaggio nell'eccezione base.
- Serve per distinguere gli errori «colpa dell'utente» (messaggio mostrato) da quelli «colpa del server» (messaggio generico).

### Righe 25-30 — `rispondi($dati, $stato)`
```php
http_response_code($stato);
echo json_encode($dati, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
exit;
```
- Imposta il codice HTTP (200 = ok, 400 = richiesta errata, 401 = non autenticato, 403 = vietato, 404 = non trovato, 405 = metodo non consentito, 500 = errore del server).
- Trasforma l'array in JSON. `JSON_UNESCAPED_UNICODE` lascia gli accenti leggibili (non `è`); `JSON_INVALID_UTF8_SUBSTITUTE` sostituisce eventuali caratteri non validi invece di far fallire tutto.
- `exit` termina: ogni risposta chiude la richiesta.

### Righe 32-35 — `numeroComeTesto($valore)`
```php
return str_contains($valore, '.') ? rtrim(rtrim($valore, '0'), '.') : $valore;
```
- MySQL restituisce i decimali con sempre due cifre: `"12.50"`, `"100.00"`, `"0.00"`.
- Se contiene un punto: `rtrim(…, '0')` toglie gli zeri finali (`"12.5"`, `"100."`, `"0."`), poi il secondo `rtrim(…, '.')` toglie il punto rimasto (`"12.5"`, `"100"`, `"0"`).
- I numeri interi non hanno il punto e restano uguali.
- Serve perché `script.js` si aspetta i numeri nello stesso formato di prima del database.

### Righe 37-51 — `campagnaDallaRiga($riga)` (da riga del database a campagna per il browser)
```php
$extra = $riga['extra'] !== null ? json_decode($riga['extra'], true) : [];
$campagna = is_array($extra) ? $extra : [];
```
- Se `extra` contiene JSON lo ritrasforma in array (`true` = array associativo), altrimenti parte da un array vuoto. Il controllo `is_array` protegge da JSON corrotti.

```php
foreach (array_keys(LIMITI_TESTO) as $colonna) {
    $campagna[$colonna] = (string) $riga[$colonna];
}
```
- Per ogni campo di testo copia il valore della colonna. Sovrascrive eventuali omonimi dell'`extra`: le colonne vere hanno la precedenza.
- `cliente` qui esiste perché la query (vedi sotto) lo ha ricavato dalla tabella `clienti`.

```php
foreach ([...COLONNE_DECIMALI, ...COLONNE_INTERE] as $colonna) {
    $campagna[$colonna] = numeroComeTesto((string) $riga[$colonna]);
}
```
- `[...A, ...B]` unisce due array in uno. Per ogni numero applica la formattazione descritta sopra.

```php
$campagna['id'] = (int) $riga['id'];
return $campagna;
```
- L'id è un numero intero. Restituisce la campagna completa.

### Righe 53-69 — `valoreNumerico($valore, $colonna)`
```php
if ($valore === null || $valore === '') {
    return 0.0;
}
```
- Vuoto o assente → 0.

```php
if (is_string($valore)) {
    $valore = str_replace(',', '.', trim($valore));
}
```
- Se arriva come testo, toglie gli spazi e trasforma la virgola italiana in punto decimale.

```php
if (!is_numeric($valore)) {
    return 0.0;
}
```
- Se non è un numero valido → 0 (non si salva spazzatura).

```php
$numero = (float) $valore;
if (abs($numero) > VALORE_MASSIMO) {
    throw new ErroreRichiesta("Il valore di «{$colonna}» è troppo grande.");
}
return $numero;
```
- Converte in numero con decimali; se il valore assoluto (`abs`) supera il massimo lancia un errore comprensibile; altrimenti lo restituisce. `throw` interrompe la funzione sollevando l'errore.

### Righe 71-116 — `preparaCampagna($campagna)` (controlla e pulisce una campagna)
```php
if (!is_array($campagna)) {
    throw new ErroreRichiesta('Campagna non valida.');
}
```
- Deve essere un array.

```php
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
```
- Per ogni campo di testo: prende il valore (vuoto se manca); `is_scalar` accetta solo testi/numeri/booleani (rifiuta array e oggetti); toglie gli spazi; se è più lungo del limite (`mb_strlen` conta i caratteri, non i byte) rifiuta con un messaggio; altrimenti lo mette nell'array pulito `$colonne`.

```php
if ($colonne['cliente'] === '' || $colonne['campagna'] === '') {
    throw new ErroreRichiesta('Cliente e nome campagna sono obbligatori.');
}
```
- Cliente e campagna non possono essere vuoti.

```php
if ($colonne['periodo'] !== '' && !preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $colonne['periodo'])) {
    throw new ErroreRichiesta('Il mese deve avere il formato AAAA-MM.');
}
```
- Il mese, se presente, deve rispettare l'espressione regolare: quattro cifre (`\d{4}`), un trattino, poi `01`-`09` oppure `10`-`12`. `^` e `$` indicano inizio e fine: non sono ammessi altri caratteri.

```php
foreach (COLONNE_DECIMALI as $colonna) {
    $colonne[$colonna] = round(valoreNumerico($campagna[$colonna] ?? null, $colonna), 2);
}
foreach (COLONNE_INTERE as $colonna) {
    $colonne[$colonna] = (int) round(valoreNumerico($campagna[$colonna] ?? null, $colonna));
}
```
- Numeri con decimali arrotondati a due cifre; conteggi arrotondati all'intero.

```php
$extra = array_diff_key(
    $campagna,
    $colonne,
    ['id' => 0, 'created_at' => 0, 'updated_at' => 0, 'extra' => 0]
);
```
- `array_diff_key` restituisce gli elementi del primo array le cui **chiavi** non compaiono negli altri.
- Quindi `$extra` = tutto ciò che il browser ha mandato oltre ai campi che hanno una colonna, escludendo anche i campi riservati (`id`, date, `extra`). I valori `0` sono segnaposto: conta solo la chiave.

```php
$testoExtra = $extra ? json_encode($extra, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) : null;
```
- Se ci sono dati extra li trasforma in JSON (`JSON_THROW_ON_ERROR` fa lanciare un'eccezione in caso di errore); altrimenti `null`.

```php
if ($testoExtra !== null && strlen($testoExtra) > DIMENSIONE_MASSIMA_EXTRA) {
    throw new ErroreRichiesta('I dati della campagna sono troppo grandi.');
}
$colonne['extra'] = $testoExtra;
return $colonne;
```
- Limita la dimensione, aggiunge `extra` e restituisce la campagna pronta per il database.

### Righe 118-137 — `idCliente($db, $nome)` (trova o crea il cliente)
```php
$cerca = $db->prepare('SELECT id FROM clienti WHERE nome = ?');
$cerca->execute([$nome]);
$id = $cerca->fetchColumn();
if ($id !== false) {
    return (int) $id;
}
```
- Cerca il cliente per nome (il confronto di MySQL ignora maiuscole/minuscole: «Acme», «acme» e «ACME» sono lo stesso cliente). `fetchColumn` restituisce il primo valore della riga o `false` se non c'è. Se esiste, restituisce il suo id.

```php
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
```
- Se non esiste lo crea e restituisce l'id appena assegnato (`lastInsertId`).
- Se nel frattempo un altro utente lo ha creato nello stesso istante, il database rifiuta il duplicato con il codice `23000` («violazione di vincolo»): in quel caso si rilegge l'id già creato. Qualsiasi altro errore viene rilanciato.

### Righe 139-159 — `salvaFormati($db, $formati)`
```php
if (!is_array($formati)) {
    throw new ErroreRichiesta('Formati non validi.');
}
```
- Devono essere un array.

```php
$scrittura = $db->prepare(
    'INSERT INTO format_memory (piattaforma, format_config) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE format_config = VALUES(format_config)'
);
```
- Inserisce un formato; se esiste già per quella piattaforma (la colonna è unica) lo aggiorna. Si chiama «upsert» (insert + update).

```php
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
```
- Per ogni formato: il nome (`google`, `meta`…) può avere solo lettere, numeri e `_` fino a 50 caratteri; la configurazione deve essere un array; viene convertita in JSON, controllata nella dimensione e salvata.

### Righe 161-195 — `salva($db, $corpo)` (salva campagne e formati)
```php
$campagne = $corpo['campagne'] ?? [];
if (!is_array($campagne) || count($campagne) > CAMPAGNE_PER_RICHIESTA) {
    throw new ErroreRichiesta('Elenco di campagne non valido.');
}
```
- Prende l'elenco inviato e controlla che sia un array e non troppo grande.

```php
$pronte = array_map('preparaCampagna', array_values($campagne));
```
- `array_values` rinumera l'elenco da 0; `array_map` applica `preparaCampagna` a ogni elemento.
- **Tutte** le campagne vengono validate prima di toccare il database: se una è sbagliata, non si scrive nulla.

```php
$db->beginTransaction();
try {
```
- Inizia una **transazione**: un gruppo di operazioni «tutte o nessuna».

```php
$inserimento = $db->prepare(
    'INSERT INTO campaigns (cliente_id, campagna, ...) VALUES (:cliente_id, :campagna, ...)'
);
```
- Query preparata con segnaposto con nome (`:campagna`), che vengono riempiti dalle chiavi dell'array.

```php
foreach ($pronte as $colonne) {
    $colonne['cliente_id'] = idCliente($db, $colonne['cliente']);
    unset($colonne['cliente']);
    $inserimento->execute($colonne);
}
```
- Per ogni campagna: trova (o crea) il cliente e prende il suo id; poi toglie la chiave `cliente` (il nome non si salva più nella campagna) con `unset`; infine esegue l'inserimento con i valori dell'array.

```php
if (isset($corpo['formati'])) {
    salvaFormati($db, $corpo['formati']);
}
$db->commit();
```
- Se sono arrivati anche i formati CSV li salva, poi `commit` rende definitive tutte le modifiche insieme.

```php
} catch (Throwable $errore) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    throw $errore;
}
```
- Se qualcosa va storto, `rollBack` annulla tutto ciò che la transazione aveva fatto (anche i clienti appena creati), e l'errore viene rilanciato verso l'alto. `Throwable` comprende ogni tipo di errore.

```php
return ['ok' => true, 'salvate' => count($pronte)];
```
- Risposta: tutto ok e quante campagne sono state salvate.

### Righe 197-260 — il «vigile urbano» che smista le richieste
```php
try {
    $db = connettiDatabase();
    $metodo = $_SERVER['REQUEST_METHOD'];
```
- Apre la connessione e legge il metodo HTTP della richiesta (GET per leggere, POST per scrivere).

**Lettura (GET):**
```php
if ($metodo === 'GET') {
    $risorsa = $_GET['risorsa'] ?? '';
```
- `$_GET['risorsa']` è il valore del parametro nell'indirizzo, per esempio `api_campagne.php?risorsa=campagne`.

```php
if ($risorsa === 'campagne') {
    $righe = $db->query(
        'SELECT campaigns.*, clienti.nome AS cliente
         FROM campaigns JOIN clienti ON clienti.id = campaigns.cliente_id
         ORDER BY campaigns.id'
    )->fetchAll();
    rispondi(['campagne' => array_map('campagnaDallaRiga', $righe)]);
}
```
- Query con **JOIN**: unisce ogni campagna al suo cliente tramite `cliente_id` e restituisce il nome come colonna `cliente` (`AS cliente`), così il resto del sito non cambia.
- `campaigns.*` = tutte le colonne di `campaigns`; `ORDER BY campaigns.id` = in ordine di inserimento.
- Questa query non ha parametri forniti dall'utente, quindi non serve `prepare`.
- Ogni riga passa da `campagnaDallaRiga` e l'elenco è restituito in JSON.

```php
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
```
- Legge i formati CSV salvati e li restituisce come mappa `piattaforma → configurazione`.
- `(object)` fa sì che anche quando è vuota diventi `{}` in JSON (e non `[]`), perché `script.js` si aspetta un oggetto.

```php
throw new ErroreRichiesta('Risorsa non valida.', 404);
```
- Parametro sconosciuto → 404.

**Controlli prima di scrivere:**
```php
if ($metodo !== 'POST') {
    throw new ErroreRichiesta('Metodo non consentito.', 405);
}
```
- Oltre a GET e POST (PUT, DELETE…) non si accetta nulla: 405.

```php
if (!verificaCsrf($_SERVER['HTTP_X_CSRF_TOKEN'] ?? null)) {
    throw new ErroreRichiesta('Sessione scaduta, ricarica la pagina.', 403);
}
```
- Il token arriva nell'intestazione `X-CSRF-Token`, che PHP espone come `HTTP_X_CSRF_TOKEN`. Senza token valido: 403. (Le letture GET non lo richiedono: non modificano nulla.)

```php
$corpo = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($corpo)) {
    throw new ErroreRichiesta('Richiesta non valida.');
}
```
- `php://input` è il contenuto grezzo inviato da `script.js` (un testo JSON). `json_decode(…, true)` lo trasforma in array. Se non è un JSON valido → errore.

**Le azioni di scrittura:**
```php
switch ($corpo['azione'] ?? '') {
    case 'salva':
        rispondi(salva($db, $corpo));
```
- `switch` sceglie in base al valore di `azione`. `salva` serve sia per una nuova campagna sia per le importazioni da CSV.

```php
    case 'elimina':
        $id = filter_var($corpo['id'] ?? null, FILTER_VALIDATE_INT);
        if ($id === false) {
            throw new ErroreRichiesta('Campagna non valida.');
        }
        $db->prepare('DELETE FROM campaigns WHERE id = ?')->execute([$id]);
        rispondi(['ok' => true]);
```
- `filter_var` con `FILTER_VALIDATE_INT` restituisce il numero intero oppure `false` se non lo è. Poi elimina la campagna con quell'id (query preparata).

```php
    default:
        throw new ErroreRichiesta('Azione non valida.');
}
```
- Qualunque altra azione è rifiutata. **Non esiste più l'azione «svuota tutto»**.

**La gestione degli errori:**
```php
} catch (ErroreRichiesta $errore) {
    rispondi(['errore' => $errore->getMessage()], $errore->stato);
} catch (Throwable $errore) {
    error_log('Errore API campagne: ' . $errore->getMessage());
    rispondi(['errore' => 'Operazione non riuscita.'], 500);
}
```
- Errori «dell'utente»: il suo messaggio e il suo codice vengono mostrati.
- Qualsiasi altro errore (problema del database, bug): dettagli nel log, all'utente solo «Operazione non riuscita.» con codice 500. Così non si rivelano dettagli interni a un eventuale attaccante.

---

## 9. `admin.php` — l'area riservata (parte PHP, righe 1-251)

### Righe 2-5
```php
require_once __DIR__ . '/auth.php';
$utente = richiediRuolo('admin');
$db = connettiDatabase();
```
- Carica le funzioni, **richiede il ruolo admin** (un operatore riceve 403, un non loggato viene mandato al login) e apre il database. Tutto ciò che segue viene eseguito solo per un admin.

### Righe 7-9 — intestazioni di sicurezza
Come nel login, con in più:
- `script-src 'self'`: sono ammessi solo script del nostro sito (`admin.js`), non script scritti nella pagina o provenienti da altri siti;
- `form-action 'self'`: i form possono inviare dati solo a questo sito.

### Righe 11-12 — costanti
```php
const RUOLI = ['admin', 'operatore'];
const ALFABETO_PASSWORD = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
```
- Elenco dei ruoli ammessi (lista bianca: qualsiasi altro valore è rifiutato).
- Caratteri usati per le password temporanee: mancano volutamente `i`, `l`, `o`, `I`, `O`, `0` e `1`, che si confondono quando si legge la password a voce o su uno schermo.

### Righe 14-17 — `e($testo)`
```php
return htmlspecialchars($testo, ENT_QUOTES, 'UTF-8');
```
- Abbreviazione per scrivere meno: `e(...)` al posto di `htmlspecialchars(...)` ogni volta (difesa dall'XSS).

### Righe 19-22 — `avviso($tipo, $testo, $passwordTemporanea)`
```php
$_SESSION['avviso'] = ['tipo' => $tipo, 'testo' => $testo, 'password' => $passwordTemporanea];
```
- Salva in sessione un messaggio da mostrare dopo il redirect (esito positivo o errore). È un «messaggio flash».

### Righe 24-33 — `errorePassword($password)`
- Meno di 8 caratteri → errore. Più di 72 → errore: `strlen` conta i **byte** perché l'algoritmo bcrypt ignora tutto ciò che supera i 72 byte, e non vogliamo che una password lunga venga accorciata di nascosto.
- Se va bene restituisce `null` (= nessun errore). Il tipo `?string` significa «testo oppure null».

### Righe 35-44 — `erroreNome($nome)`
- Il nome deve avere da 3 a 100 caratteri (`mb_strlen` conta correttamente anche gli accenti).
- `preg_match('/[\x00-\x1F\x7F]/', $nome)` cerca caratteri di controllo (invisibili, come a-capo e tabulazioni), che sono vietati.

### Righe 46-53 — `generaPasswordTemporanea($lunghezza = 12)`
```php
$password = '';
for ($i = 0; $i < $lunghezza; $i++) {
    $password .= ALFABETO_PASSWORD[random_int(0, strlen(ALFABETO_PASSWORD) - 1)];
}
return $password;
```
- Ciclo `for` che ripete 12 volte: sceglie una posizione casuale nell'alfabeto con `random_int` (casualità sicura, adatta alla sicurezza, a differenza di `rand`) e aggiunge quel carattere (`.=` aggiunge in coda).

### Righe 55-62 — `altriAdminAttivi($db, $escludiId)`
```php
"SELECT COUNT(*) FROM users WHERE ruolo = 'admin' AND attivo = 1 AND id <> ? FOR UPDATE"
```
- Conta gli admin attivi **escluso** l'utente indicato (`<>` = «diverso»).
- `FOR UPDATE` blocca quelle righe fino alla fine della transazione, così due admin che agiscono nello stesso istante non possono eliminarsi a vicenda lasciando il sito senza amministratori.

### Righe 64-67 — `proteggeCSV($valore)`
```php
return preg_match('/^[=+\-@\t\r]/', $valore) ? "'" . $valore : $valore;
```
- In Excel una cella che inizia con `=`, `+`, `-` o `@` viene eseguita come formula (attacco «formula injection»). Se il testo inizia con uno di questi caratteri si aggiunge un apice davanti: diventa testo.

### Righe 69-94 — `esportaUtenti($db)`
- Legge tutti gli utenti (senza la colonna password).
- `Content-Type: text/csv` e `Content-Disposition: attachment; filename="utenti-AAAA-MM-GG.csv"` fanno scaricare il file con la data di oggi (`date('Y-m-d')`).
- `fopen('php://output', 'w')` apre il «flusso di uscita» come se fosse un file.
- `fwrite($uscita, "\xEF\xBB\xBF")` scrive il «BOM», tre byte iniziali che dicono a Excel che il file è UTF-8 (altrimenti gli accenti vengono sbagliati).
- `fputcsv($uscita, [...], ';')` scrive una riga CSV con separatore `;` (quello usato da Excel in italiano), mettendo da sé virgolette dove servono. Prima l'intestazione, poi una riga per utente, con `'si'`/`'no'` al posto di 1/0 e il nome protetto con `proteggeCSV`.
- `fclose` chiude il flusso; `exit` termina.

### Righe 96-213 — `eseguiAzione($db, $utente, $dati)` (tutte le azioni sugli utenti)
```php
$azione = (string) ($dati['azione'] ?? '');
$id = (int) ($dati['id'] ?? 0);
```
- Legge quale azione è richiesta e su quale utente (`id`).

**Azione `crea` (righe 101-119):**
```php
$errore = erroreNome($nome) ?? errorePassword($password);
```
- `??` qui restituisce il primo valore non-null: se il nome ha un errore lo usa; altrimenti controlla la password.

```php
if ($errore === null && !in_array($ruolo, RUOLI, true)) {
    $errore = 'Ruolo non valido.';
}
```
- Se finora va tutto bene, il ruolo deve essere uno di quelli ammessi (`in_array` con `true` = confronto rigoroso).

```php
$db->prepare('INSERT INTO users (nome, password, ruolo, attivo) VALUES (?, ?, ?, 1)')
    ->execute([$nome, password_hash($password, PASSWORD_DEFAULT), $ruolo]);
```
- Crea l'utente salvando l'**hash** della password. Il nome duplicato verrà respinto dal database (colonna `UNIQUE`) e gestito più sotto.

**Azione `svuota_periodo` (righe 121-131):**
- Verifica che il mese abbia forma `AAAA-MM`, poi `DELETE FROM campaigns WHERE periodo = ?` e `rowCount()` dice quante righe sono state cancellate.

**Azioni sugli utenti esistenti (righe 133-211):**
```php
$db->beginTransaction();
$consulta = $db->prepare('SELECT id, nome, ruolo, attivo FROM users WHERE id = ? FOR UPDATE');
```
- Apre una transazione e legge (bloccandolo) l'utente su cui si agisce, che si chiama `$bersaglio`.

```php
$siStessi = $id === $utente['id'];
$eAdminAttivo = $bersaglio['ruolo'] === 'admin' && $bersaglio['attivo'];
$perdeAdmin = fn(): bool => $eAdminAttivo && altriAdminAttivi($db, $id) === 0;
```
- `$siStessi`: l'admin sta agendo sul proprio account?
- `$eAdminAttivo`: il bersaglio è un admin attivo?
- `$perdeAdmin`: una «funzione freccia» (`fn() =>`, versione breve di una funzione) che risponde «se faccio questa azione, il sito resta senza admin attivi?». Si calcola solo quando serve.

Le azioni nel `switch`:
- **`salva`**: rinomina e/o cambia ruolo. Se agisci su te stesso il ruolo non cambia (`$siStessi ? $bersaglio['ruolo'] : …`). Non si può togliere il ruolo admin all'ultimo admin attivo.
- **`disattiva`**: vietato su se stessi e sull'ultimo admin attivo; imposta `attivo = 0`. L'utente viene espulso alla richiesta successiva.
- **`attiva`**: rimette `attivo = 1`.
- **`elimina`**: stesse protezioni di `disattiva`; cancella l'utente.
- **`reset`**: genera la password temporanea, ne salva l'hash, fa `commit` e la passa all'avviso, così viene mostrata **una sola volta**. Non esiste modo di rileggerla dopo: nel database c'è solo l'hash.
- **`default`**: azione sconosciuta → `rollBack` (annulla) e errore.

In ogni errore si fa `rollBack()` e `return`; alla fine delle azioni riuscite `commit()` conferma. `break` esce dal `switch`.

La sintassi `"Utente «{$nome}» aggiornato."` inserisce il valore della variabile dentro il testo.

### Righe 215-236 — la richiesta in arrivo
```php
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
```
- Ogni richiesta di modifica deve avere il token CSRF.
- «Esporta» scarica il CSV.
- Le altre azioni sono eseguite in un `try`: se il database rifiuta (per esempio nome duplicato, codice `23000`) mostra un messaggio chiaro, altrimenti uno generico con il dettaglio nel log.
- **`vaiA('admin.php')` dopo ogni POST**: è il pattern «Post/Redirect/Get». Dopo aver agito si ricarica la pagina con una normale richiesta GET, così premendo F5 il browser non ripete l'azione (per esempio non ricrea lo stesso utente).

### Righe 238-251 — preparare i dati da mostrare
```php
$avviso = $_SESSION['avviso'] ?? null;
unset($_SESSION['avviso']);
```
- Prende il messaggio flash e lo cancella subito: si vede una volta sola (così anche la password temporanea).

```php
$utenti = $db->query('SELECT id, nome, ruolo, attivo, created_at FROM users ORDER BY ruolo, nome')->fetchAll();
```
- Elenco utenti ordinato per ruolo e nome (admin per primi). La password non viene nemmeno letta.

```php
"SELECT COUNT(*) AS totale, SUM(attivo = 1) AS attivi, SUM(ruolo = 'admin') AS admin FROM users"
```
- Una sola query per tre numeri: quanti utenti, quanti attivi, quanti admin. `SUM(condizione)` conta le righe in cui la condizione è vera (vero = 1).

```php
$numeroCampagne = (int) $db->query('SELECT COUNT(*) FROM campaigns')->fetchColumn();
$periodi = $db->query('SELECT periodo, COUNT(*) AS campagne FROM campaigns GROUP BY periodo ORDER BY periodo DESC')->fetchAll();
```
- Totale delle campagne e numero di campagne per mese (`GROUP BY periodo` raggruppa per mese, `DESC` = dal più recente).

```php
$csrf = tokenCsrf();
```
- Token da inserire in tutti i form della pagina.

### Parte HTML (dopo la riga 252): come è costruita
- `<?php if ($avviso): ?> … <?php endif; ?>` mostra il riquadro verde (esito) o rosso (errore); la classe si sceglie con `$avviso['tipo'] === 'ok' ? 'esito' : 'errore'`. Se c'è una password temporanea la scrive in un elemento `<code>` selezionabile con un clic.
- Quattro riquadri di riepilogo con `<?= (int) $totali['totale'] ?>` e simili: `(int)` garantisce che si stampi solo un numero.
- La tabella utenti usa `<?php foreach ($utenti as $riga): ?>` per scrivere una riga per ogni utente.
  - Ogni riga ha un form «invisibile» (`<form id="utente-5">`) fuori dalla cella, e i campi della riga (nome, ruolo, pulsanti) lo richiamano con l'attributo `form="utente-5"`. È il trucco che permette di avere un solo form per riga pur essendo i campi in celle diverse (un form non può attraversare le celle di una tabella).
  - `$tu = $idRiga === $utente['id']` indica la riga dell'admin che sta guardando: per lei il ruolo è `disabled`, compare «(tu)» e non ci sono i pulsanti Disattiva/Elimina.
  - `<?= $tu ? 'disabled' : '' ?>` e `<?= $riga['ruolo'] === $ruolo ? 'selected' : '' ?>` scrivono un attributo HTML solo quando serve.
  - I pulsanti hanno `name="azione"` e `value="salva"` / `"disattiva"` / `"reset"` / `"elimina"`: il valore del pulsante premuto è l'azione che arriva a `eseguiAzione`.
  - `data-conferma="…"` contiene il testo della conferma («Eliminare definitivamente l'utente?»), mostrata da `admin.js`.
  - `date('d/m/Y', strtotime($riga['created_at']))` trasforma la data del database in formato italiano.
  - `data-nome="…"` serve alla ricerca in tempo reale di `admin.js`.
- Il form «Nuovo utente» invia `azione=crea`; il campo password ha `minlength="8"` e `maxlength="72"` come controllo lato browser (il controllo vero è comunque in PHP).
- La «Manutenzione campagne» mostra un menu con i mesi presenti nel database; se non ce ne sono, dice che non ci sono campagne salvate.

---

## 10. Concetti da saper spiegare a voce

| Termine | Spiegazione semplice |
|---|---|
| **Sessione** | Memoria che il server tiene per ogni visitatore. Il browser ne conosce solo il numero (nel cookie); il resto (ruolo compreso) sta sul server. |
| **Cookie** | Piccolo dato che il server chiede al browser di conservare e rimandare. |
| **Hash di password** | «Impronta» irreversibile della password: dal database non si può ricavare la password originale; si può solo verificare se una password data produce quell'impronta. |
| **Prepared statement** | Query scritta con segnaposti; i dati viaggiano separati e non possono diventare comandi SQL. |
| **SQL injection** | Attacco che inserisce comandi SQL in un campo di testo. Evitato con i prepared statement. |
| **XSS** | Attacco che inserisce codice JavaScript in un testo mostrato in pagina. Evitato con `htmlspecialchars`. |
| **CSRF** | Attacco che fa compiere azioni al tuo browser mentre sei loggato. Evitato con il token segreto e `SameSite`. |
| **Transazione** | Gruppo di operazioni «tutte o nessuna»: se una fallisce, si annulla tutto (`rollBack`). |
| **Chiave esterna** | Collegamento garantito fra tabelle: `campaigns.cliente_id` deve puntare a un cliente esistente. |
| **API / JSON** | Indirizzo che risponde con dati strutturati (JSON) invece che con una pagina. |
| **Redirect (Post/Redirect/Get)** | Dopo un'azione si rimanda a una pagina normale, così «ricarica» non ripete l'azione. |
| **Codici HTTP** | 200 ok · 302 redirect · 400 richiesta errata · 401 non autenticato · 403 vietato · 404 non trovato · 405 metodo non consentito · 500 errore del server. |

---

## 11. Domande che potrebbero farti, con la risposta

- **«Come impedite a un operatore di entrare nell'area admin?»**
  Tre livelli: il link non viene scritto nella pagina; `admin.php` chiama `richiediRuolo('admin')` e risponde 403; ogni azione richiede il token CSRF.
- **«Dove sono salvate le password?»**
  Nel database, solo come hash (`password_hash`). Nemmeno l'admin può leggerle: può solo generarne una nuova temporanea.
- **«Cosa succede se disattivo un utente mentre è collegato?»**
  A ogni richiesta `richiediLogin` ricontrolla il database: alla prossima azione viene espulso.
- **«Perché un solo file `auth.php`?»**
  Perché ogni pagina riusa le stesse funzioni (`richiediLogin`, `richiediRuolo`, CSRF): un solo punto da mantenere e controllare.
- **«Che succede se due persone salvano lo stesso cliente insieme?»**
  `idCliente` gestisce il conflitto: il database rifiuta il duplicato e il codice rilegge l'id già creato.
- **«Cosa succede se un import ha una riga sbagliata?»**
  Non viene salvato niente: la transazione annulla tutto.
- **«Come proteggete le credenziali del database?»**
  Stanno in `.env`, escluso da GitHub e bloccato da Apache.
