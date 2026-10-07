<?php
require_once __DIR__ . '/auth.php';

avviaSessione();

if ($_SERVER['REQUEST_METHOD'] === 'POST' && verificaCsrf($_POST['csrf'] ?? null)) {
    chiudiSessione();
}

vaiA('index.php');
