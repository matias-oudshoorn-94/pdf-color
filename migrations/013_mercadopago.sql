-- Agrega pago con Mercado Pago (Checkout Pro) además de "efectivo" (pago en el local).
-- payment_status es VARCHAR a propósito: para pedidos de Mercado Pago se graba tal
-- cual el status que devuelve su API (approved/rejected/in_process/etc, en inglés);
-- para pedidos efectivo se usan valores en español que el admin setea a mano.
-- Ejecutar: mysql -u USUARIO -p BASE < migrations/013_mercadopago.sql

ALTER TABLE orders
  ADD COLUMN payment_method   ENUM('efectivo','mercadopago') NOT NULL DEFAULT 'efectivo' AFTER shipping_price,
  ADD COLUMN payment_status   VARCHAR(30) NOT NULL DEFAULT 'pendiente' AFTER payment_method,
  ADD COLUMN mp_preference_id VARCHAR(80) NULL AFTER payment_status,
  ADD COLUMN mp_payment_id    VARCHAR(80) NULL AFTER mp_preference_id,
  ADD COLUMN mp_status_detail VARCHAR(60) NULL AFTER mp_payment_id;
