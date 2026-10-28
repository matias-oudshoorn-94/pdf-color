-- Estado de los mensajes del formulario de contacto: no leído, leído o respondido.
-- Los mensajes que ya existían quedan como "no leído".
-- Aplicar sobre bases creadas antes de esta versión:
--   mysql -u USUARIO -p BASE < migrations/020_message_status.sql

ALTER TABLE messages
  ADD COLUMN status ENUM('no_leido','leido','respondido') NOT NULL DEFAULT 'no_leido' AFTER body,
  ADD KEY ix_messages_status (status);
