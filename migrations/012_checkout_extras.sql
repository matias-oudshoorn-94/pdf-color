-- Agrega: costo de envío fijo (settings), puntos de retiro con dirección para
-- mostrar el mapa de Google en el checkout, y escalones de descuento por
-- cantidad de páginas (evaluado por ítem del pedido: pages * copies).
-- Ejecutar: mysql -u USUARIO -p BASE < migrations/012_checkout_extras.sql

ALTER TABLE settings
  ADD COLUMN shipping_price DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER price_ring;

CREATE TABLE IF NOT EXISTS pickup_points (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(120) NOT NULL,
  address    VARCHAR(300) NOT NULL,
  notes      VARCHAR(300) NULL,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Escalones de descuento: "a partir de X páginas, Y% de descuento". Se evalúa
-- por ítem del pedido (pages del archivo * copias), no sobre el total del pedido.
CREATE TABLE IF NOT EXISTS discount_tiers (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  min_pages        INT UNSIGNED NOT NULL,
  discount_percent DECIMAL(5,2) NOT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_discount_tiers_min_pages (min_pages)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE orders
  ADD COLUMN pickup_point_id INT UNSIGNED NULL AFTER delivery_address,
  ADD COLUMN shipping_price DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER pickup_point_id,
  ADD KEY ix_orders_pickup_point (pickup_point_id),
  ADD CONSTRAINT fk_orders_pickup_point FOREIGN KEY (pickup_point_id) REFERENCES pickup_points (id) ON DELETE SET NULL;

-- Snapshot del descuento aplicado en el momento del pedido (igual criterio que
-- unit_price/total_price): si después cambian los escalones, no recalcula solo.
ALTER TABLE order_items
  ADD COLUMN discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER total_price;
