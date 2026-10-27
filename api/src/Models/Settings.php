<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;

/** Configuración global del sitio: precio por página y recargo por anillado. */
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

    public static function pricePerSheet(): float
    {
        return self::get()['price_per_sheet'];
    }

    public static function priceRing(): float
    {
        return self::get()['price_ring'];
    }

    public static function shippingPrice(): float
    {
        return self::get()['shipping_price'];
    }

    public static function update(float $pricePerSheet, float $priceRing, float $shippingPrice): array
    {
        Database::execute(
            'INSERT INTO settings (id, price_per_sheet, price_ring, shipping_price) VALUES (1, :price, :ring, :shipping)
             ON DUPLICATE KEY UPDATE price_per_sheet = VALUES(price_per_sheet), price_ring = VALUES(price_ring),
                                      shipping_price = VALUES(shipping_price)',
            ['price' => $pricePerSheet, 'ring' => $priceRing, 'shipping' => $shippingPrice],
        );

        return self::get();
    }
}
