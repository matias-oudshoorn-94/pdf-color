-- Precios por cantidad según la faz: reemplaza a los "descuentos por cantidad" (discount_tiers).
-- Cada fila es "desde X páginas, $Y por página" para doble o simple faz. El rango se evalúa
-- por archivo del pedido (páginas del archivo × copias) y todas las páginas se cobran al
-- precio del rango en que cae ese total.
-- La tabla discount_tiers queda sin uso; se puede borrar más adelante.
-- Aplicar sobre bases creadas antes de esta versión:
--   mysql -u USUARIO -p BASE < migrations/021_price_tiers.sql

CREATE TABLE IF NOT EXISTS price_tiers (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  side           ENUM('doble','simple') NOT NULL,
  min_pages      INT UNSIGNED NOT NULL,
  price_per_page DECIMAL(10,2) NOT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_price_tiers_side_min (side, min_pages)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO price_tiers (side, min_pages, price_per_page) VALUES
  ('doble', 1, 200),
  ('doble', 2, 150),
  ('doble', 11, 60),
  ('doble', 501, 55),
  ('doble', 1001, 50),
  ('doble', 1501, 40),
  ('simple', 1, 200),
  ('simple', 2, 170),
  ('simple', 11, 150),
  ('simple', 21, 80)
ON DUPLICATE KEY UPDATE price_per_page = VALUES(price_per_page);
