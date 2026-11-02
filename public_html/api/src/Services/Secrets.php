<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Config;
use RuntimeException;

/**
 * Cifrado de secretos que se guardan en la base (ej: access tokens de Mercado Pago).
 * Así un volcado o backup de la base no alcanza para usarlos: también hace falta la
 * clave, que vive en config.local.php y no en la base.
 *
 * Usa sodium si el PHP del servidor lo tiene y, si no, OpenSSL (AES-256-GCM): no todos
 * los hostings habilitan sodium. Cada valor guardado lleva un prefijo con el método
 * ("s1:" o "o1:") para poder descifrarlo aunque después cambie lo que hay instalado.
 */
final class Secrets
{
    private const SODIUM = 's1:';
    private const OPENSSL = 'o1:';
    private const OPENSSL_CIPHER = 'aes-256-gcm';

    public static function encrypt(string $plain): string
    {
        if (self::hasSodium()) {
            $nonce = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);

            return self::SODIUM . base64_encode($nonce . sodium_crypto_secretbox($plain, $nonce, self::key()));
        }

        if (self::hasOpenssl()) {
            $iv = random_bytes(12);
            $tag = '';
            $cipher = openssl_encrypt($plain, self::OPENSSL_CIPHER, self::key(), OPENSSL_RAW_DATA, $iv, $tag);

            if ($cipher === false) {
                throw new RuntimeException('No se pudo cifrar el secreto con OpenSSL');
            }

            return self::OPENSSL . base64_encode($iv . $tag . $cipher);
        }

        throw new RuntimeException('El PHP del servidor no tiene sodium ni OpenSSL para cifrar secretos');
    }

    /** null si no se puede descifrar (ej: cambió la clave). */
    public static function decrypt(string $stored): ?string
    {
        if (str_starts_with($stored, self::OPENSSL)) {
            return self::decryptOpenssl(substr($stored, strlen(self::OPENSSL)));
        }

        // Sin prefijo: valores guardados antes de que existiera la alternativa con OpenSSL.
        $payload = str_starts_with($stored, self::SODIUM) ? substr($stored, strlen(self::SODIUM)) : $stored;

        return self::decryptSodium($payload);
    }

    private static function decryptSodium(string $payload): ?string
    {
        $raw = base64_decode($payload, true);

        if (!self::hasSodium() || $raw === false || strlen($raw) <= SODIUM_CRYPTO_SECRETBOX_NONCEBYTES) {
            return null;
        }

        $nonce = substr($raw, 0, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
        $plain = sodium_crypto_secretbox_open(substr($raw, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES), $nonce, self::key());

        return $plain === false ? null : $plain;
    }

    private static function decryptOpenssl(string $payload): ?string
    {
        $raw = base64_decode($payload, true);

        if (!self::hasOpenssl() || $raw === false || strlen($raw) <= 28) {
            return null;
        }

        $plain = openssl_decrypt(
            substr($raw, 28),
            self::OPENSSL_CIPHER,
            self::key(),
            OPENSSL_RAW_DATA,
            substr($raw, 0, 12),
            substr($raw, 12, 16),
        );

        return $plain === false ? null : $plain;
    }

    /** Clave de 32 bytes derivada de mercadopago.secrets_key (o, si falta, de la contraseña de la base). */
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

        return hash('sha256', $material, true);
    }

    private static function hasSodium(): bool
    {
        return function_exists('sodium_crypto_secretbox');
    }

    private static function hasOpenssl(): bool
    {
        return function_exists('openssl_encrypt') && in_array(self::OPENSSL_CIPHER, openssl_get_cipher_methods(), true);
    }
}
