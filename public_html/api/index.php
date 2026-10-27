<?php

declare(strict_types=1);

use App\Core\Auth;
use App\Core\Config;
use App\Core\Csrf;
use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;

// Autoload PSR-4 propio: App\Core\Router -> src/Core/Router.php
spl_autoload_register(static function (string $class): void {
    if (!str_starts_with($class, 'App\\')) {
        return;
    }

    $file = __DIR__ . '/src/' . str_replace('\\', '/', substr($class, 4)) . '.php';

    if (is_file($file)) {
        require $file;
    }
});

require __DIR__ . '/src/Core/polyfill.php';

Config::load(__DIR__ . '/config.php');

if (Config::isLocal()) {
    ini_set('display_errors', '1');
    error_reporting(E_ALL);
} else {
    ini_set('display_errors', '0');
}

ini_set('log_errors', '1');
mb_internal_encoding('UTF-8');
date_default_timezone_set('America/Argentina/Buenos_Aires');

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header('X-Frame-Options: DENY');

$request = Request::capture();

if ($request->method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    Auth::start();
    Csrf::verify($request);

    /** @var App\Core\Router $router */
    $router = require __DIR__ . '/src/routes.php';
    $router->dispatch($request);
} catch (HttpException $e) {
    Response::json(array_filter([
        'error' => $e->getMessage(),
        'details' => $e->details() ?: null,
    ]), $e->status());
} catch (Throwable $e) {
    error_log(sprintf('[pdfcolor] %s en %s:%d', $e->getMessage(), $e->getFile(), $e->getLine()));

    Response::json([
        'error' => Config::isLocal() ? $e->getMessage() : 'Ocurrió un error inesperado',
    ], 500);
}
