<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Models\DiscountTier;
use App\Models\FileRecord;
use App\Models\Order;
use App\Models\PendingOrder;
use App\Models\PickupPoint;
use App\Models\Settings;
use App\Models\User;
use App\Services\Emails;
use App\Services\MercadoPago;

final class OrderController
{
    private const SIZES = ['A4', 'oficio'];
    private const FINISHES = ['simple', 'anillado'];
    private const DELIVERY_METHODS = ['retiro', 'envio'];
    private const PAYMENT_METHODS = ['efectivo', 'mercadopago'];

    /** Cuánto dura, desde que se inició el pago, el ingreso automático a la vuelta de Mercado Pago. */
    private const RETURN_LOGIN_MINUTES = 120;

    public function store(Request $request): void
    {
        $data = Validator::make($request->body())
            ->string('notes', 0, 500, required: false)
            ->enum('deliveryMethod', self::DELIVERY_METHODS, 'retiro')
            ->enum('paymentMethod', self::PAYMENT_METHODS, 'efectivo')
            ->validated();

        if ($data['deliveryMethod'] === 'envio' && $data['paymentMethod'] === 'efectivo') {
            throw HttpException::badRequest('Con envío a domicilio el pago es con Mercado Pago');
        }

        $deliveryAddress = null;
        $pickupPointId = null;
        $shippingPrice = 0.0;

        if ($data['deliveryMethod'] === 'envio') {
            $deliveryAddress = Validator::make($request->body())
                ->string('deliveryAddress', 5, 300)
                ->validated()['deliveryAddress'];

            $shippingPrice = Settings::shippingPrice();
        } else {
            $pickupPointId = Validator::make($request->body())
                ->int('pickupPointId', 1, PHP_INT_MAX)
                ->validated()['pickupPointId'];

            $pickupPoint = PickupPoint::find($pickupPointId);

            if ($pickupPoint === null || !$pickupPoint['is_active']) {
                throw HttpException::badRequest('Elegí un punto de retiro válido');
            }
        }

        $rawItems = $request->input('items');

        if (!is_array($rawItems) || $rawItems === [] || count($rawItems) > 50) {
            throw HttpException::badRequest('El pedido debe tener entre 1 y 50 archivos');
        }

        $items = [];
        $pricePerSheet = Settings::pricePerSheet();
        $priceRing = Settings::priceRing();

        foreach ($rawItems as $index => $rawItem) {
            if (!is_array($rawItem)) {
                throw HttpException::badRequest('Ítem inválido en la posición ' . ($index + 1));
            }

            $item = Validator::make($rawItem)
                ->int('fileId', 1, PHP_INT_MAX)
                ->int('copies', 1, 999, 1)
                ->enum('paperSize', self::SIZES, 'A4')
                ->enum('finish', self::FINISHES, 'anillado')
                ->bool('doubleSide')
                ->string('notes', 0, 300, required: false)
                ->validated();

            $file = FileRecord::find($item['fileId']);

            if ($file === null) {
                throw HttpException::badRequest('Uno de los archivos del pedido ya no existe');
            }

            if (!$file['is_public'] && (int) $file['user_id'] !== Auth::id()) {
                throw HttpException::forbidden('Uno de los archivos no está disponible para vos');
            }

            $pages = max(1, (int) $file['page_count']);
            $totalPages = $pages * $item['copies'];
            $discountPercent = DiscountTier::bestDiscountFor($totalPages);
            $subtotal = $totalPages * $pricePerSheet;
            $ringCharge = $item['finish'] === 'anillado' ? $priceRing * $item['copies'] : 0.0;

            $item['color'] = 'color';
            $item['pages'] = $pages;
            $item['unit_price'] = $pricePerSheet;
            $item['discount_percent'] = $discountPercent;
            $item['total_price'] = round($subtotal - $subtotal * $discountPercent / 100 + $ringCharge, 2);

            $items[] = $item;
        }

        if ($data['paymentMethod'] === 'efectivo') {
            $order = Order::create(
                Auth::id(),
                $data['notes'],
                $data['deliveryMethod'],
                $deliveryAddress,
                $pickupPointId,
                $shippingPrice,
                'efectivo',
                $items,
            );

            Response::json(['order' => $order, 'pendingId' => null, 'paymentUrl' => null], 201);

            Emails::afterResponse(static fn () => Emails::orderCreated($order));

            return;
        }

        // Mercado Pago: todavía no es un pedido real. Se guarda como intención y
        // recién nace en "orders" cuando el pago se confirma (webhook o el
        // chequeo de respaldo en GET /orders/pending/{id}) — así no queda un
        // pedido fantasma si el cliente no llega a pagar.
        $total = round(array_sum(array_column($items, 'total_price')) + $shippingPrice, 2);

        $pending = PendingOrder::create(Auth::id(), [
            'notes' => $data['notes'],
            'deliveryMethod' => $data['deliveryMethod'],
            'deliveryAddress' => $deliveryAddress,
            'pickupPointId' => $pickupPointId,
            'shippingPrice' => $shippingPrice,
            'items' => $items,
        ]);

        $preference = MercadoPago::createPreference([
            'id' => 'pending-' . $pending['id'],
            'total' => $total,
            'customer_email' => Auth::user()['email'],
        ]);

        PendingOrder::setPreference($pending['id'], $preference['id']);

        Response::json(['order' => null, 'pendingId' => $pending['id'], 'paymentUrl' => $preference['init_point']], 201);
    }

    /** Estado de una intención de pedido de Mercado Pago (poleado por la pantalla de resultado). */
    public function pending(Request $request, array $params): void
    {
        $id = (int) $params['id'];
        $pending = PendingOrder::find($id);

        if ($pending === null) {
            throw HttpException::notFound('El pedido no existe');
        }

        // Lo puede consultar su dueño con sesión, o quien traiga el preference_id
        // que Mercado Pago agrega a la URL de vuelta (no se puede adivinar). Esto
        // último cubre la vuelta del pago en un navegador sin sesión.
        $isOwner = (int) $pending['user_id'] === Auth::id();
        $preferenceId = (string) $request->query('preference_id', '');
        $storedPreferenceId = (string) ($pending['mp_preference_id'] ?? '');

        if (!$isOwner && ($storedPreferenceId === '' || !hash_equals($storedPreferenceId, $preferenceId))) {
            throw HttpException::notFound('El pedido no existe');
        }

        // Pagando desde la app de Mercado Pago en el celular, la vuelta se abre en
        // otro navegador donde la persona nunca ingresó: se la deja ingresada ahí
        // también, para que no parezca que el pago la deslogueó. Solo por un rato
        // desde que inició el pago, y nunca para cuentas admin.
        $session = [];

        if (!$isOwner && Auth::user() === null && (int) $pending['age_minutes'] <= self::RETURN_LOGIN_MINUTES) {
            $owner = User::find((int) $pending['user_id']);

            if ($owner !== null && $owner['role'] !== 'admin') {
                Auth::login($owner);
                $isOwner = true;
                $session = ['user' => $owner];
            }
        }

        // Sin sesión del dueño solo se devuelve número y total del pedido, nada más.
        $present = static fn (array $order): array => $isOwner
            ? $order
            : ['id' => $order['id'], 'total' => $order['total']];

        if ($pending['promoted_order_id'] !== null) {
            Response::json(['status' => 'promoted', 'order' => $present(Order::find((int) $pending['promoted_order_id']))] + $session);

            return;
        }

        // El webhook es el camino rápido; esto es el respaldo si todavía no llegó.
        $payment = MercadoPago::findPaymentByExternalReference('pending-' . $id);

        if ($payment !== null && ($payment['status'] ?? '') === 'approved') {
            $order = Order::createFromPending(
                $pending['payload'],
                (int) $pending['user_id'],
                (string) $payment['id'],
                (string) $payment['status'],
                $payment['status_detail'] ?? null,
            );

            PendingOrder::promote($id, (int) $order['id']);

            Response::json(['status' => 'promoted', 'order' => $present($order)] + $session);

            Emails::afterResponse(static fn () => Emails::orderCreated($order));

            return;
        }

        Response::json(['status' => 'pending'] + $session);
    }

    public function mine(Request $request): void
    {
        Response::json(['orders' => Order::byUser(Auth::id())]);
    }

    public function show(Request $request, array $params): void
    {
        $order = Order::find((int) $params['id']);

        if ($order === null) {
            throw HttpException::notFound('El pedido no existe');
        }

        if ((int) $order['user_id'] !== Auth::id() && !Auth::isAdmin()) {
            throw HttpException::forbidden();
        }

        Response::json(['order' => $order]);
    }

    public function index(Request $request): void
    {
        $status = (string) $request->query('status', '');

        if ($status !== '' && !in_array($status, Order::STATUSES, true)) {
            throw HttpException::badRequest('Estado desconocido');
        }

        Response::json(['orders' => Order::all($status)]);
    }

    public function updateStatus(Request $request, array $params): void
    {
        $data = Validator::make($request->body())
            ->enum('status', Order::STATUSES)
            ->validated();

        $order = Order::updateStatus((int) $params['id'], $data['status']);

        if ($order === null) {
            throw HttpException::notFound('El pedido no existe');
        }

        Response::json(['order' => $order]);
    }
}
