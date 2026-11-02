-- Varias cuentas de Mercado Pago: cada punto de retiro puede cobrar en su propia cuenta.
-- - mp_accounts: las cuentas, con el access token cifrado (ver Services/Secrets.php).
--   La cuenta "principal" (is_default) cobra los envíos a domicilio y los puntos de
--   retiro sin cuenta asignada. Si no hay ninguna cuenta cargada, se sigue usando
--   mercadopago.access_token de config.php, como antes.
--   Las cuentas no se borran, se archivan (is_active = 0): así se pueden seguir
--   verificando pagos que lleguen tarde a esa cuenta.
-- - pickup_points.mp_account_id: con qué cuenta cobra ese punto (NULL = la principal).
-- - orders.mp_account_id: en qué cuenta se cobró el pedido (NULL = token de config).
-- Aplicar sobre bases creadas antes de esta versión:
--   mysql -u USUARIO -p BASE < migrations/022_mp_accounts.sql

CREATE TABLE IF NOT EXISTS mp_accounts (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name             VARCHAR(120) NOT NULL,
  access_token_enc TEXT NOT NULL,
  token_hint       VARCHAR(12) NOT NULL,
  is_test          TINYINT(1) NOT NULL DEFAULT 0,
  mp_user_id       VARCHAR(40) NULL,
  mp_nickname      VARCHAR(120) NULL,
  mp_email         VARCHAR(180) NULL,
  is_default       TINYINT(1) NOT NULL DEFAULT 0,
  is_active        TINYINT(1) NOT NULL DEFAULT 1,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE pickup_points
  ADD COLUMN mp_account_id INT UNSIGNED NULL AFTER notes,
  ADD CONSTRAINT fk_pickup_points_mp_account FOREIGN KEY (mp_account_id) REFERENCES mp_accounts (id) ON DELETE SET NULL;

ALTER TABLE orders
  ADD COLUMN mp_account_id INT UNSIGNED NULL AFTER mp_status_detail,
  ADD CONSTRAINT fk_orders_mp_account FOREIGN KEY (mp_account_id) REFERENCES mp_accounts (id) ON DELETE SET NULL;
