-- Guarda cuándo el admin le avisó al cliente (botón "Notificar al cliente" del
-- panel) que el pedido está listo para retirar.
-- Ejecutar: mysql -u USUARIO -p BASE < migrations/016_order_ready_notification.sql

ALTER TABLE orders
  ADD COLUMN ready_notified_at TIMESTAMP NULL AFTER mp_status_detail;
