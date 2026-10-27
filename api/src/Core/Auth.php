<?php

declare(strict_types=1);

namespace App\Core;

use App\Models\User;

/** Sesión de usuario sobre sesiones nativas de PHP (cookie httpOnly). */
final class Auth
{
    private static ?array $user = null;

    public static function start(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }

        // Sesiones propias en vez del /tmp compartido del hosting: en hosting
        // compartido ese directorio tiene las sesiones de todas las cuentas del
        // servidor, y el garbage collection de PHP (que escanea ese directorio
        // entero) puede volverse lentísimo sin que aparezca ningún error.
        // La ruta sale de la config (no de __DIR__) para poder vivir afuera de
        // public_html en producción: el Git Deploy de hPanel borra en cada
        // deploy todo lo que no está versionado, y __DIR__ siempre cae dentro
        // del árbol que ese deploy gestiona.
        $sessionPath = (string) Config::get('security.session_path');

        if ($sessionPath !== '' && (is_dir($sessionPath) || @mkdir($sessionPath, 0700, true))) {
            session_save_path($sessionPath);
        }

        $https = ($_SERVER['HTTPS'] ?? '') === 'on'
            || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';

        // Por defecto PHP borra las sesiones con más de 24 minutos sin uso, aunque
        // la cookie dure una semana: sin esto la gente aparece deslogueada sola.
        ini_set('session.gc_maxlifetime', (string) Config::get('security.session_lifetime'));

        session_name(Config::get('security.session_name'));
        session_set_cookie_params([
            'lifetime' => Config::get('security.session_lifetime'),
            'path' => '/',
            'secure' => $https,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_start();
    }

    public static function login(array $user): void
    {
        session_regenerate_id(true);
        $_SESSION['user_id'] = $user['id'];
        self::$user = $user;
        Csrf::rotate();
    }

    public static function logout(): void
    {
        $_SESSION = [];
        session_regenerate_id(true);
        self::$user = null;
        Csrf::rotate();
    }

    public static function user(): ?array
    {
        if (self::$user !== null) {
            return self::$user;
        }

        $id = $_SESSION['user_id'] ?? null;

        if ($id === null) {
            return null;
        }

        self::$user = User::find((int) $id);

        if (self::$user === null) {
            self::logout();
        }

        return self::$user;
    }

    public static function id(): ?int
    {
        return self::user()['id'] ?? null;
    }

    public static function isAdmin(): bool
    {
        return (self::user()['role'] ?? null) === 'admin';
    }

    /** Middleware: exige sesión iniciada. */
    public static function required(): callable
    {
        return static function (Request $request): void {
            if (self::user() === null) {
                throw HttpException::unauthorized();
            }
        };
    }

    /** Middleware: exige rol admin. */
    public static function adminOnly(): callable
    {
        return static function (Request $request): void {
            if (self::user() === null) {
                throw HttpException::unauthorized();
            }

            if (!self::isAdmin()) {
                throw HttpException::forbidden('Solo el administrador puede hacer esto');
            }
        };
    }
}
