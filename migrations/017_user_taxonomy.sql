-- Los usuarios pueden cargar instituciones, carreras y materias desde la subida
-- de archivos si no las encuentran en la lista. Se marca el origen para que el
-- admin pueda revisarlas (corregir el nombre o unificar duplicados).
-- Aplicar sobre bases creadas antes de esta versión:
--   mysql -u USUARIO -p BASE < migrations/017_user_taxonomy.sql

ALTER TABLE institutions ADD COLUMN created_by_user TINYINT(1) NOT NULL DEFAULT 0 AFTER name;
ALTER TABLE careers      ADD COLUMN created_by_user TINYINT(1) NOT NULL DEFAULT 0 AFTER name;
ALTER TABLE subjects     ADD COLUMN created_by_user TINYINT(1) NOT NULL DEFAULT 0 AFTER name;
