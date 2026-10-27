<?php

declare(strict_types=1);

/**
 * Router para el servidor embebido de PHP (desarrollo).
 * Reemplaza lo que en producción hace el .htaccess de Apache.
 *
 *   php -S 127.0.0.1:8001 -t public_html server.php
 */

$root = __DIR__ . '/public_html';
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/';

if (str_starts_with($path, '/api')) {
    require $root . '/api/index.php';

    return true;
}

// El servidor embebido no respeta .htaccess: replicamos el "Deny from all"
// de storage/ para que los archivos subidos solo se sirvan vía la API.
if (str_starts_with($path, '/storage/')) {
    http_response_code(403);

    return true;
}

$file = realpath($root . $path);

if ($file !== false && is_file($file) && str_starts_with($file, $root)) {
    return false; // el servidor embebido sirve el archivo tal cual
}

// El panel es una aplicación aparte con su propio index.
if (str_starts_with($path, '/admin')) {
    require $root . '/admin/index.html';

    return true;
}

require $root . '/index.html';

return true;
