<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Models\Order;
use App\Models\PendingOrder;
use App\Services\Emails;
use App\Services\MercadoPago;

/** Notificaciones servidor-a-servidor de proveedores externos. Sin autenticación de sesión. */
final class WebhookController
{
    public function mercadopago(Request $request): void
    {
        // Mercado Pago manda el aviso de dos formas: notificación nueva por JSON body
        // ({type, data: {id}}) o IPN clásica por query string (?topic=payment&id=123;
        // PHP convierte los puntos en "_", por eso data_id y no data.id).
        $body = $request->body();
        $type = (string) ($body['type'] ?? $request->query('type') ?? $request->query('topic') ?? '');
        $paymentId = (string) ($body['data']['id'] ?? $request->query('data_id') ?? $request->query('id') ?? '');

        if ($type !== 'payment' || $paymentId === '') {
            // Otro tipo de notificación (ej: merchant_order) o payload incompleto: no hay nada que procesar.
            Response::json(['ok' => true]);

            return;
        }

        // Nunca se confía en el body del webhook: se vuelve a pedir el pago real con el access token.
        $payment = MercadoPago::getPayment($paymentId);

        if ($payment === null) {
            error_log('[mercadopago webhook] no se pudo obtener el pago ' . $paymentId);
            Response::json(['ok' => false], 502);

            return;
        }

        $externalReference = (string) ($payment['external_reference'] ?? '');

        if (str_starts_with($externalReference, 'pending-')) {
            $pendingId = (int) substr($externalReference, strlen('pending-'));
            $pending = PendingOrder::find($pendingId);

            if ($pending !== null && $pending['promoted_order_id'] === null && ($payment['status'] ?? '') === 'approved') {
                $order = Order::createFromPending(
                    $pending['payload'],
                    (int) $pending['user_id'],
                    (string) $payment['id'],
                    (string) $payment['status'],
                    $payment['status_detail'] ?? null,
                );

                PendingOrder::promote($pendingId, (int) $order['id']);

                Response::json(['ok' => true]);

                Emails::afterResponse(static fn () => Emails::orderCreated($order));

                return;
            }
        } else {
            // Compatibilidad con external_reference numérico directo (ya no se genera desde acá).
            $orderId = (int) $externalReference;

            if ($orderId > 0 && Order::find($orderId) !== null) {
                Order::updatePaymentFromWebhook(
                    $orderId,
                    (string) $payment['id'],
                    (string) ($payment['status'] ?? 'pending'),
                    $payment['status_detail'] ?? null,
                );
            }
        }

        Response::json(['ok' => true]);
    }
}
