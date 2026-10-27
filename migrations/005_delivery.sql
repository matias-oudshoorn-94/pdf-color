-- Modo de entrega del pedido: retiro en sucursal o envío a domicilio
-- (con la dirección de envío correspondiente).
-- Aplicar sobre bases creadas antes de esta versión:
--   mysql -u USUARIO -p BASE < migrations/005_delivery.sql

ALTER TABLE orders
  ADD COLUMN delivery_method  ENUM('retiro','envio') NOT NULL DEFAULT 'retiro' AFTER notes,
  ADD COLUMN delivery_address VARCHAR(300) NULL AFTER delivery_method;
