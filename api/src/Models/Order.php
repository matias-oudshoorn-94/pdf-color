<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;

final class Order
{
    public const STATUSES = ['pendiente', 'en_proceso', 'listo', 'entregado', 'cancelado'];

    /** Valores que puede setear el admin a mano (pedidos "efectivo"). Mercado Pago graba su propio vocabulario. */
    public const PAYMENT_STATUSES = ['pendiente', 'aprobado', 'rechazado'];

    public const SORTABLE = [
        'id' => 'o.id',
        'customer_name' => 'u.name',
        'status' => 'o.status',
        'created_at' => 'o.created_at',
        'updated_at' => 'o.updated_at',
    ];

    private const SELECT = 'SELECT o.id, o.user_id, o.status, o.notes, o.delivery_method, o.delivery_address,
                                   o.pickup_point_id, o.shipping_price,
                                   o.payment_method, o.payment_status, o.mp_preference_id, o.mp_payment_id, o.mp_status_detail,
                                   pp.name AS pickup_point_name, pp.address AS pickup_point_address,
                                   o.ready_notified_at, o.created_at, o.updated_at,
                                   u.name AS customer_name, u.email AS customer_email, u.phone AS customer_phone
                            FROM orders o
                            JOIN users u ON u.id = o.user_id
                            LEFT JOIN pickup_points pp ON pp.id = o.pickup_point_id';

    public static function create(
        int $userId,
        ?string $notes,
        string $deliveryMethod,
        ?string $deliveryAddress,
        ?int $pickupPointId,
        float $shippingPrice,
        string $paymentMethod,
        array $items,
    ): array {
        $id = Database::transaction(static function () use (
            $userId,
            $notes,
            $deliveryMethod,
            $deliveryAddress,
            $pickupPointId,
            $shippingPrice,
            $paymentMethod,
            $items,
        ): int {
            $orderId = Database::insert(
                'INSERT INTO orders (user_id, notes, delivery_method, delivery_address, pickup_point_id, shipping_price, payment_method)
                 VALUES (?, ?, ?, ?, ?, ?, ?)',
                [$userId, $notes, $deliveryMethod, $deliveryAddress, $pickupPointId, $shippingPrice, $paymentMethod],
            );

            foreach ($items as $item) {
                Database::execute(
                    'INSERT INTO order_items (order_id, file_id, copies, color, paper_size, double_side, finish, pages, unit_price, total_price, discount_percent, notes)
                     VALUES (:order_id, :file_id, :copies, :color, :paper_size, :double_side, :finish, :pages, :unit_price, :total_price, :discount_percent, :notes)',
                    [
                        'order_id' => $orderId,
                        'file_id' => $item['fileId'],
                        'copies' => $item['copies'],
                        'color' => $item['color'],
                        'paper_size' => $item['paperSize'],
                        'double_side' => (int) $item['doubleSide'],
                        'finish' => $item['finish'],
                        'pages' => $item['pages'],
                        'unit_price' => $item['unit_price'],
                        'total_price' => $item['total_price'],
                        'discount_percent' => $item['discount_percent'],
                        'notes' => $item['notes'] ?? null,
                    ],
                );
            }

            return $orderId;
        });

        return self::find($id);
    }

    /** Convierte una intención de pedido (pending_orders) en un pedido real ya pago. */
    public static function createFromPending(
        array $payload,
        int $userId,
        string $paymentId,
        string $status,
        ?string $statusDetail,
    ): array {
        $order = self::create(
            $userId,
            $payload['notes'] ?? null,
            $payload['deliveryMethod'],
            $payload['deliveryAddress'] ?? null,
            $payload['pickupPointId'] ?? null,
            (float) ($payload['shippingPrice'] ?? 0),
            'mercadopago',
            $payload['items'],
        );

        self::updatePaymentFromWebhook($order['id'], $paymentId, $status, $statusDetail);

        return self::find($order['id']);
    }

    public static function find(int $id): ?array
    {
        $order = Database::selectOne(self::SELECT . ' WHERE o.id = ?', [$id]);

        if ($order === null) {
            return null;
        }

        $order['items'] = self::items([$id])[$id] ?? [];
        $order['total'] = self::sumTotal($order['items'], (float) $order['shipping_price']);

        return $order;
    }

    public static function byUser(int $userId): array
    {
        return self::withItems(
            Database::select(self::SELECT . ' WHERE o.user_id = ? ORDER BY o.created_at DESC', [$userId]),
        );
    }

    public static function all(string $status = ''): array
    {
        $sql = self::SELECT;
        $params = [];

        if ($status !== '') {
            $sql .= ' WHERE o.status = ?';
            $params[] = $status;
        }

        return self::withItems(Database::select($sql . ' ORDER BY o.created_at DESC', $params));
    }

    public static function updateStatus(int $id, string $status): ?array
    {
        Database::execute('UPDATE orders SET status = ? WHERE id = ?', [$status, $id]);

        return self::find($id);
    }

    /** Guarda el id de preferencia de Mercado Pago recién creada. */
    public static function setPreference(int $orderId, string $preferenceId): void
    {
        Database::execute('UPDATE orders SET mp_preference_id = ? WHERE id = ?', [$preferenceId, $orderId]);
    }

    /** Pisa el estado de pago con un dato ya verificado contra la API de Mercado Pago. */
    public static function updatePaymentFromWebhook(int $orderId, string $paymentId, string $status, ?string $statusDetail): void
    {
        Database::execute(
            'UPDATE orders SET mp_payment_id = ?, payment_status = ?, mp_status_detail = ? WHERE id = ?',
            [$paymentId, $status, $statusDetail, $orderId],
        );
    }

    /** Para el botón manual del admin en pedidos "efectivo". */
    public static function updatePaymentStatus(int $id, string $status): ?array
    {
        Database::execute('UPDATE orders SET payment_status = ? WHERE id = ?', [$status, $id]);

        return self::find($id);
    }

    /** Registra que se avisó al cliente que puede retirar; si todavía no estaba "listo", lo pasa a ese estado. */
    public static function markReadyNotified(int $id): ?array
    {
        Database::execute(
            "UPDATE orders
             SET ready_notified_at = CURRENT_TIMESTAMP,
                 status = IF(status IN ('pendiente', 'en_proceso'), 'listo', status)
             WHERE id = ?",
            [$id],
        );

        return self::find($id);
    }

    public static function delete(int $id): void
    {
        Database::execute('DELETE FROM orders WHERE id = ?', [$id]);
    }

    /** Búsqueda para el panel: por número de pedido, cliente o email. */
    public static function search(string $status, string $term, ?\App\Core\Paginator $page = null): array
    {
        [$where, $params] = self::adminFilters($status, $term);

        $sql = self::SELECT . " {$where} ";
        $sql .= $page ? $page->orderBy() . ' ' . $page->limit() : 'ORDER BY o.created_at DESC';

        return self::withItems(Database::select($sql, $params));
    }

    public static function countSearch(string $status, string $term): int
    {
        [$where, $params] = self::adminFilters($status, $term);

        return (int) Database::selectOne(
            "SELECT COUNT(*) AS total FROM orders o JOIN users u ON u.id = o.user_id {$where}",
            $params,
        )['total'];
    }

    private static function adminFilters(string $status, string $term): array
    {
        $conditions = [];
        $params = [];

        if ($status !== '') {
            $conditions[] = 'o.status = :status';
            $params['status'] = $status;
        }

        if ($term !== '') {
            $conditions[] = '(u.name LIKE :s1 OR u.email LIKE :s2 OR o.id = :exact)';
            $params['s1'] = $params['s2'] = '%' . $term . '%';
            $params['exact'] = ctype_digit($term) ? (int) $term : 0;
        }

        return [$conditions === [] ? '' : 'WHERE ' . implode(' AND ', $conditions), $params];
    }

    public static function stats(): array
    {
        $byStatus = Database::select('SELECT status, COUNT(*) AS total FROM orders GROUP BY status');
        $counts = array_fill_keys(self::STATUSES, 0);

        foreach ($byStatus as $row) {
            $counts[$row['status']] = (int) $row['total'];
        }

        return [
            'orders' => array_sum($counts),
            'byStatus' => $counts,
            'clients' => (int) Database::selectOne("SELECT COUNT(*) AS t FROM users WHERE role = 'client'")['t'],
            'admins' => (int) Database::selectOne("SELECT COUNT(*) AS t FROM users WHERE role = 'admin'")['t'],
            'files' => (int) Database::selectOne('SELECT COUNT(*) AS t FROM files')['t'],
            'storageBytes' => (int) (Database::selectOne('SELECT COALESCE(SUM(size_bytes), 0) AS t FROM files')['t']),
            'messages' => (int) Database::selectOne('SELECT COUNT(*) AS t FROM messages')['t'],
            'lastOrders' => self::withItems(Database::select(self::SELECT . ' ORDER BY o.created_at DESC LIMIT 5')),
        ];
    }

    /** Total de copias de todos los pedidos no cancelados (mismo criterio que los reportes). */
    public static function copiesSold(): int
    {
        return (int) Database::selectOne(
            "SELECT COALESCE(SUM(oi.copies), 0) AS t
               FROM order_items oi
               JOIN orders o ON o.id = oi.order_id
              WHERE o.status <> 'cancelado'",
        )['t'];
    }

    /** Carga los ítems de varios pedidos en una sola consulta. */
    private static function withItems(array $orders): array
    {
        if ($orders === []) {
            return [];
        }

        $grouped = self::items(array_column($orders, 'id'));

        foreach ($orders as &$order) {
            $order['items'] = $grouped[$order['id']] ?? [];
            $order['total'] = self::sumTotal($order['items'], (float) $order['shipping_price']);
        }

        return $orders;
    }

    private static function sumTotal(array $items, float $shippingPrice = 0.0): float
    {
        $itemsTotal = array_sum(array_map(static fn (array $item): float => (float) $item['total_price'], $items));

        return round($itemsTotal + $shippingPrice, 2);
    }

    private static function items(array $orderIds): array
    {
        $placeholders = implode(',', array_fill(0, count($orderIds), '?'));

        $rows = Database::select(
            "SELECT oi.*, f.title, f.original_name, f.mime_type
             FROM order_items oi
             JOIN files f ON f.id = oi.file_id
             WHERE oi.order_id IN ({$placeholders})
             ORDER BY oi.id",
            array_map('intval', $orderIds),
        );

        $grouped = [];

        foreach ($rows as $row) {
            $grouped[(int) $row['order_id']][] = $row;
        }

        return $grouped;
    }
}
