-- Subida de archivos sin cuenta: el login pasa a pedirse recién en el checkout.
-- Los archivos subidos por visitantes quedan sin dueño (user_id NULL) hasta que
-- el visitante inicia sesión o se registra en esa misma sesión y los reclama.
-- Aplicar sobre bases creadas antes de esta versión:
--   mysql -u USUARIO -p BASE < migrations/008_guest_uploads.sql

ALTER TABLE files MODIFY user_id INT UNSIGNED NULL;
