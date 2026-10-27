-- Todos los archivos subidos pasan a ser públicos (el catálogo es el objetivo
-- del sitio); ya no existe la opción de subir un archivo privado.
-- Aplicar sobre bases creadas antes de esta versión:
--   mysql -u USUARIO -p BASE < migrations/006_all_files_public.sql

UPDATE files SET is_public = 1 WHERE is_public = 0;
