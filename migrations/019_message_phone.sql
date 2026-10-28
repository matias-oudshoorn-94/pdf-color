-- Teléfono obligatorio en el formulario de contacto.
-- Queda NULL en la base para no romper los mensajes que ya existían.
-- Aplicar sobre bases creadas antes de esta versión:
--   mysql -u USUARIO -p BASE < migrations/019_message_phone.sql

ALTER TABLE messages
  ADD COLUMN phone VARCHAR(40) NULL AFTER email;
