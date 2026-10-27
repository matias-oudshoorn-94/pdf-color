<?php

declare(strict_types=1);

namespace App\Core;

/** Acceso a la configuración con notación de puntos: Config::get('db.host'). */
final class Config
{
    private static array $values = [];

    public static function load(string $file): void
    {
        self::$values = require $file;
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        $value = self::$values;

        foreach (explode('.', $key) as $segment) {
            if (!is_array($value) || !array_key_exists($segment, $value)) {
                return $default;
            }
            $value = $value[$segment];
        }

        return $value;
    }

    public static function isLocal(): bool
    {
        return self::get('app.env') === 'local';
    }

    /** URL pública del sitio (para back_urls/webhooks de terceros). Usa app.url si está seteado, o la auto-detecta. */
    public static function appUrl(): string
    {
        $configured = (string) self::get('app.url', '');

        if ($configured !== '') {
            return rtrim($configured, '/');
        }

        $https = ($_SERVER['HTTPS'] ?? '') === 'on'
            || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';

        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';

        return ($https ? 'https://' : 'http://') . $host;
    }
}
