<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Protección CSRF por doble envío: el token viaja en una cookie legible por JS
 * y debe repetirse en el header X-CSRF-Token de cada petición que modifica datos.
 */
final class Csrf
{
    private const COOKIE = 'XSRF-TOKEN';
    private const HEADER = 'x-csrf-token';

    public static function token(): string
    {
        if (empty($_SESSION['csrf_token'])) {
            self::rotate();
        }

        return $_SESSION['csrf_token'];
    }

    public static function rotate(): void
    {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        self::sendCookie($_SESSION['csrf_token']);
    }

    public static function sendCookie(?string $token = null): void
    {
        $https = ($_SERVER['HTTPS'] ?? '') === 'on'
            || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';

        setcookie(self::COOKIE, $token ?? self::token(), [
            'expires' => time() + Config::get('security.session_lifetime'),
            'path' => '/',
            'secure' => $https,
            'httponly' => false,
            'samesite' => 'Lax',
        ]);
    }

    /** Middleware global para métodos que modifican estado. */
    public static function verify(Request $request): void
    {
        if (!$request->isMutating()) {
            return;
        }

        // Webhooks de terceros (ej: Mercado Pago) son llamadas servidor-a-servidor sin
        // cookie de sesión: su seguridad no pasa por acá, sino por re-consultar el dato
        // real contra la API del proveedor antes de guardar nada (ver WebhookController).
        if (str_starts_with($request->path, '/webhooks/')) {
            return;
        }

        $sent = $request->header(self::HEADER) ?? (string) $request->input('_csrf', '');

        if ($sent === '' || !hash_equals(self::token(), $sent)) {
            throw new HttpException(419, 'Tu sesión expiró, recargá la página e intentá de nuevo');
        }
    }
}
