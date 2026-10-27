-- El pedido de Mercado Pago ya no se crea antes de ir a pagar: se guarda como
-- "intención" acá, y recién se convierte en un pedido real (orders) cuando el
-- pago se confirma (webhook o el chequeo de respaldo en /orders/pending/{id}).
-- Así no quedan pedidos fantasma si el cliente no completa el pago.
-- Ejecutar: mysql -u USUARIO -p BASE < migrations/014_pending_orders.sql

CREATE TABLE IF NOT EXISTS pending_orders (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id           INT UNSIGNED NOT NULL,
  payload           TEXT NOT NULL,
  mp_preference_id  VARCHAR(80) NULL,
  promoted_order_id INT UNSIGNED NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_pending_orders_user (user_id),
  CONSTRAINT fk_pending_orders_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_pending_orders_promoted FOREIGN KEY (promoted_order_id) REFERENCES orders (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
