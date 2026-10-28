<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;

/**
 * Configuración global del sitio: recargo por anillado y costo de envío.
 * El precio por página ya no sale de acá sino de los precios por cantidad (PriceTier);
 * price_per_sheet queda en la tabla sin uso.
 */
final class Settings
{
    public static function get(): array
    {
        $row = Database::selectOne('SELECT price_per_sheet, price_ring, shipping_price FROM settings WHERE id = 1');

        return [
            'price_per_sheet' => $row !== null ? (float) $row['price_per_sheet'] : 0.0,
            'price_ring' => $row !== null ? (float) $row['price_ring'] : 0.0,
            'shipping_price' => $row !== null ? (float) $row['shipping_price'] : 0.0,
        ];
    }

    public static function priceRing(): float
    {
        return self::get()['price_ring'];
    }

    public static function shippingPrice(): float
    {
        return self::get()['shipping_price'];
    }

    public static function update(float $priceRing, float $shippingPrice): array
    {
        Database::execute(
            'INSERT INTO settings (id, price_ring, shipping_price) VALUES (1, :ring, :shipping)
             ON DUPLICATE KEY UPDATE price_ring = VALUES(price_ring), shipping_price = VALUES(shipping_price)',
            ['ring' => $priceRing, 'shipping' => $shippingPrice],
        );

        return self::get();
    }
}
