<?php

declare(strict_types=1);

namespace App\Core;

/** Verificación de Google reCAPTCHA v3 (invisible, basado en puntaje) contra la API de Google. */
final class Recaptcha
{
    private const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

    /** Middleware: exige un token de reCAPTCHA v3 válido para la acción indicada. */
    public static function verify(string $action): callable
    {
        return static function (Request $request) use ($action): void {
            // En local no se verifica: reCAPTCHA depende de cookies de terceros de
            // google.com, que muchos navegadores bloquean por defecto y rompen el
            // flujo de desarrollo sin que sea un problema real del sitio.
            if (Config::isLocal()) {
                return;
            }

            $secret = (string) Config::get('recaptcha.secret_key');

            // Sin clave secreta configurada en este entorno, no se puede verificar:
            // se deja pasar para no romper el sitio (ver config.local.php).
            if ($secret === '') {
                return;
            }

            $token = (string) $request->input('recaptchaToken', '');

            if ($token === '') {
                throw HttpException::badRequest('Falta la verificación reCAPTCHA, recargá la página e intentá de nuevo');
            }

            $result = self::check($secret, $token, $request->ip());
            $minScore = (float) Config::get('recaptcha.min_score', 0.5);

            $ok = ($result['success'] ?? false) === true
                && ($result['action'] ?? $action) === $action
                && (float) ($result['score'] ?? 0) >= $minScore;

            if (!$ok) {
                error_log('[recaptcha] rechazado: ' . json_encode([
                    'expectedAction' => $action,
                    'response' => $result,
                ]));

                throw HttpException::badRequest('No pudimos verificar que sos humano. Recargá la página e intentá de nuevo');
            }
        };
    }

    /** @return array<string, mixed> */
    private static function check(string $secret, string $token, string $ip): array
    {
        $ch = curl_init(self::VERIFY_URL);

        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query([
                'secret' => $secret,
                'response' => $token,
                'remoteip' => $ip,
            ]),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 5,
        ]);

        $raw = curl_exec($ch);

        if ($raw === false) {
            error_log('[recaptcha] ' . curl_error($ch));
            curl_close($ch);

            return ['success' => false];
        }

        curl_close($ch);

        $data = json_decode((string) $raw, true);

        return is_array($data) ? $data : ['success' => false];
    }
}
