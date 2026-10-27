-- Precios automáticos por hoja: precio configurable en el panel + cálculo
-- automático (hojas del archivo × copias × precio por hoja) en cada pedido.

ALTER TABLE files
  ADD COLUMN page_count INT UNSIGNED NOT NULL DEFAULT 1 AFTER size_bytes;

ALTER TABLE order_items
  ADD COLUMN pages       INT UNSIGNED NOT NULL DEFAULT 1 AFTER finish,
  ADD COLUMN unit_price  DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER pages,
  ADD COLUMN total_price DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER unit_price;

CREATE TABLE IF NOT EXISTS settings (
  id              TINYINT UNSIGNED NOT NULL DEFAULT 1,
  price_per_sheet DECIMAL(10,2) NOT NULL DEFAULT 0,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO settings (id, price_per_sheet) VALUES (1, 0)
ON DUPLICATE KEY UPDATE id = id;
