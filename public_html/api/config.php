<?php

declare(strict_types=1);

/**
 * Configuración del sitio. Editá este archivo al subir al hosting.
 * Para no versionar credenciales, podés crear config.local.php (se carga si existe y pisa estos valores).
 */

$config = [
    'app' => [
        'name' => 'PDF Color',
        'env' => 'production',          // 'local' muestra errores detallados
        'url' => 'https://pdfcolor.com.ar',
    ],

    'db' => [
        'host' => 'localhost',
        'port' => 3306,
        'name' => 'u245081402_pdfcolor',
        'user' => 'u245081402_pdfcolor_admin',
        'pass' => '', // completar con la contraseña de la base de PDF Color
        'charset' => 'utf8mb4',
    ],

    'uploads' => [
        // A propósito FUERA de public_html: el Git Deploy de hPanel borra en cada
        // deploy todo lo que no está en el repo (los PDFs que suben los clientes
        // nunca están versionados), así que esta carpeta tiene que vivir afuera
        // del árbol que ese deploy gestiona. Confirmá la ruta real de tu cuenta
        // en hPanel → Administrador de archivos antes de subir este cambio.
        'path' => '/home/u245081402/domains/pdfcolor.com.ar/storage/uploads',
        'max_bytes' => 50 * 1024 * 1024,
        'allowed' => [
            'application/pdf' => 'pdf',
        ],
    ],

    'security' => [
        'session_name' => 'pdfcolor_session',
        'session_lifetime' => 60 * 60 * 24 * 7,
        'login_max_attempts' => 8,
        'login_window' => 900,           // segundos
        // Mismo motivo que uploads.path: afuera de public_html para que el Git
        // Deploy no cierre la sesión de todo el mundo en cada push.
        'session_path' => '/home/u245081402/domains/pdfcolor.com.ar/storage/sessions',
    ],

    'recaptcha' => [
        // Clave pública: va también en el HTML/JS, no hace falta ocultarla.
        'site_key' => '6Lc-Rr8tAAAAAPCh7CMl-Du2TyGegegCTP8SmiBC',
        // Clave secreta: se completa en config.local.php (no versionado) o acá antes
        // de subir a producción. Sin ella, la verificación se salta.
        'secret_key' => '',
        // Puntaje mínimo de reCAPTCHA v3 (0 = seguro bot, 1 = seguro humano).
        'min_score' => 0.5,
    ],

    'google' => [
        // Ninguna de las dos es secreta (van al navegador), pero hay que restringirlas
        // al dominio del sitio en Google Cloud Console. Vacías = función apagada.
        // ID de cliente OAuth (tipo "Aplicación web") para el botón "Continuar con Google".
        'client_id' => '',
        // Clave de Maps con "Maps JavaScript API" y "Places API (New)" habilitadas,
        // para autocompletar la dirección de envío en el checkout.
        'maps_api_key' => '',
    ],

    'mercadopago' => [
        // Clave pública: no hace falta ocultarla (no se usa todavía, reservada para Checkout Bricks/Wallet).
        'public_key' => '',
        // Access token: secreto, se completa en config.local.php (no versionado) o acá antes de subir a producción.
        'access_token' => '',
    ],

    'mail' => [
        // SMTP del buzón que manda los mails (ej: "olvidé mi contraseña"). Credenciales
        // secretas: se completan en config.local.php (no versionado), nunca acá.
        'host' => '',
        'port' => 465,
        'encryption' => 'ssl', // 'ssl' (puerto 465) o 'tls' (puerto 587, STARTTLS)
        'username' => '',
        'password' => '',
        'from_address' => '',
        'from_name' => 'PDF Color',
    ],

    'contact' => [
        'email' => 'info@pdfcolor.com.ar',
        'phone' => '223 5 655434',
        'whatsapp' => '5492235655434',
        'address' => 'Ayacucho 3592, Mar del Plata',
        'hours' => 'Lunes a viernes de 9 a 18 h · Sábados de 9 a 13 h',
    ],
];

// Mismo motivo que storage/uploads y storage/sessions: adentro de public_html el
// Git Deploy de hPanel lo borra en cada push (config.local.php está gitignored
// a propósito, son credenciales). Primero busca afuera de public_html; si no
// está ahí, usa la ubicación de siempre (entorno local, donde no hay ese problema).
$externalLocalConfig = '/home/u245081402/domains/pdfcolor.com.ar/config.local.php';
$localConfigFile = is_file($externalLocalConfig) ? $externalLocalConfig : __DIR__ . '/config.local.php';

if (is_file($localConfigFile)) {
    $config = array_replace_recursive($config, require $localConfigFile);
}

return $config;
