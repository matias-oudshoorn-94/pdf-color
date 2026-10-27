<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Config;

/** Verificación del ID token que entrega el botón "Continuar con Google" (Google Identity Services). */
final class GoogleAuth
{
    private const TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
    private const ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

    public static function clientId(): string
    {
        return (string) Config::get('google.client_id', '');
    }

    /**
     * Valida el token contra Google (firma y vencimiento los chequea su endpoint)
     * y que haya sido emitido para este sitio. Devuelve ['email', 'name'] o null.
     */
    public static function verify(string $idToken): ?array
    {
        $clientId = self::clientId();

        if ($clientId === '' || $idToken === '') {
            return null;
        }

        $ch = curl_init(self::TOKENINFO_URL . '?id_token=' . rawurlencode($idToken));

        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 8,
        ]);

        $raw = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);

        if ($raw === false) {
            error_log('[google] ' . curl_error($ch));
        }

        curl_close($ch);

        $claims = $raw === false ? null : json_decode((string) $raw, true);

        if ($status !== 200 || !is_array($claims)) {
            return null;
        }

        $email = (string) ($claims['email'] ?? '');

        $ok = hash_equals($clientId, (string) ($claims['aud'] ?? ''))
            && in_array($claims['iss'] ?? '', self::ISSUERS, true)
            && (int) ($claims['exp'] ?? 0) > time()
            // Sin email verificado por Google no se puede confiar en que la casilla sea suya.
            && in_array($claims['email_verified'] ?? false, [true, 'true'], true)
            && filter_var($email, FILTER_VALIDATE_EMAIL) !== false;

        if (!$ok) {
            error_log('[google] token rechazado: ' . json_encode([
                'aud' => $claims['aud'] ?? null,
                'iss' => $claims['iss'] ?? null,
                'email_verified' => $claims['email_verified'] ?? null,
            ]));

            return null;
        }

        return ['email' => mb_strtolower($email), 'name' => trim((string) ($claims['name'] ?? ''))];
    }
}
