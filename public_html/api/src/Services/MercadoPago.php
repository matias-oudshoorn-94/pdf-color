<?php

declare(strict_types=1);

namespace App\Services;

use App\Core\Config;
use App\Core\HttpException;

/** Integración con Mercado Pago Checkout Pro: crear preferencias y consultar pagos. */
final class MercadoPago
{
    private const API_BASE = 'https://api.mercadopago.com';

    /** Crea la preferencia de pago y devuelve ['id' => preferenceId, 'init_point' => url de pago]. */
    public static function createPreference(array $order): array
    {
        $appUrl = Config::appUrl();
        $returnUrl = $appUrl . '/pedido/resultado';

        $payload = [
            'items' => [[
                'title' => sprintf('Pedido #%s · Jetcopy', $order['id']),
                'quantity' => 1,
                'unit_price' => (float) $order['total'],
                'currency_id' => 'ARS',
            ]],
            'external_reference' => (string) $order['id'],
            'payer' => ['email' => $order['customer_email']],
            'back_urls' => [
                'success' => $returnUrl,
                'failure' => $returnUrl,
                'pending' => $returnUrl,
            ],
            'notification_url' => $appUrl . '/api/webhooks/mercadopago',
        ];

        // auto_return exige que back_urls.success sea un dominio público real: Mercado
        // Pago lo rechaza con "localhost" (entorno de desarrollo), así que solo se pide
        // la vuelta automática fuera de local; en producción sí vuelve sin botón extra.
        if (!Config::isLocal()) {
            $payload['auto_return'] = 'approved';
        }

        $response = self::request('POST', '/checkout/preferences', $payload);

        if ($response === null || !isset($response['id'], $response['init_point'])) {
            error_log('[mercadopago] no se pudo crear la preferencia: ' . json_encode($response));

            throw HttpException::badRequest(
                'No se pudo iniciar el pago con Mercado Pago. Probá de nuevo o elegí pagar en el local.',
            );
        }

        return ['id' => (string) $response['id'], 'init_point' => (string) $response['init_point']];
    }

    /** Consulta un pago real contra la API (nunca se confía en lo que manda el webhook). */
    public static function getPayment(string $paymentId): ?array
    {
        $response = self::request('GET', '/v1/payments/' . rawurlencode($paymentId));

        return is_array($response) && isset($response['id']) ? $response : null;
    }

    /** Respaldo por si el webhook todavía no llegó: busca el pago más reciente de esa referencia. */
    public static function findPaymentByExternalReference(string $externalReference): ?array
    {
        $response = self::request(
            'GET',
            '/v1/payments/search?external_reference=' . rawurlencode($externalReference) . '&sort=date_created&criteria=desc',
        );

        $results = $response['results'] ?? null;

        return is_array($results) && isset($results[0]) ? $results[0] : null;
    }

    private static function request(string $method, string $path, ?array $payload = null): ?array
    {
        $accessToken = (string) Config::get('mercadopago.access_token');

        if ($accessToken === '') {
            error_log('[mercadopago] falta access_token en la configuración');

            return null;
        }

        $ch = curl_init(self::API_BASE . $path);

        $options = [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $accessToken,
                'Content-Type: application/json',
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
        ];

        if ($payload !== null) {
            $options[CURLOPT_POSTFIELDS] = json_encode($payload, JSON_UNESCAPED_UNICODE);
        }

        curl_setopt_array($ch, $options);

        $raw = curl_exec($ch);

        if ($raw === false) {
            error_log('[mercadopago] ' . curl_error($ch));
            curl_close($ch);

            return null;
        }

        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $data = json_decode((string) $raw, true);

        if ($status >= 400) {
            error_log(sprintf('[mercadopago] %s %s -> %d: %s', $method, $path, $status, $raw));
        }

        return is_array($data) ? $data : null;
    }
}
