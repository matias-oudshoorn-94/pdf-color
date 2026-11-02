<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Config;
use RuntimeException;

/**
 * Cifrado de secretos que se guardan en la base (ej: access tokens de Mercado Pago).
 * Así un volcado o backup de la base no alcanza para usarlos: también hace falta la
 * clave, que vive en config.local.php y no en la base.
 */
final class Secrets
{
    public static function encrypt(string $plain): string
    {
        $nonce = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);

        return base64_encode($nonce . sodium_crypto_secretbox($plain, $nonce, self::key()));
    }

    /** null si no se puede descifrar (ej: cambió la clave). */
    public static function decrypt(string $stored): ?string
    {
        $raw = base64_decode($stored, true);

        if ($raw === false || strlen($raw) <= SODIUM_CRYPTO_SECRETBOX_NONCEBYTES) {
            return null;
        }

        $nonce = substr($raw, 0, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        $plain = sodium_crypto_secretbox_open(substr($raw, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES), $nonce, self::key());

        return $plain === false ? null : $plain;
    }

    private static function key(): string
    {
        $configured = (string) Config::get('mercadopago.secrets_key', '');
        // Sin clave propia se deriva de la contraseña de la base, que ya es secreta y
        // está fuera de la base. Mejor tener una clave propia (ver config.php).
        $material = $configured !== ''
            ? $configured
            : 'pdfcolor-secrets|' . Config::get('db.pass', '') . '|' . Config::get('db.name', '');

        if ($material === 'pdfcolor-secrets||') {
            throw new RuntimeException('Falta mercadopago.secrets_key para cifrar secretos');
        }

        return sodium_crypto_generichash($material, '', SODIUM_CRYPTO_SECRETBOX_KEYBYTES);
    }
}
