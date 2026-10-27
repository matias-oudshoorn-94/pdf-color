-- Huella SHA-256 del contenido de cada archivo, para avisarle a quien sube un
-- archivo que ya está en el catálogo (y ofrecerle pedir ese en vez de duplicarlo).
-- Los archivos ya subidos se completan solos de a poco (ver FileRecord::backfillHashes).
-- Aplicar sobre bases creadas antes de esta versión:
--   mysql -u USUARIO -p BASE < migrations/018_file_content_hash.sql

ALTER TABLE files
  ADD COLUMN content_hash CHAR(64) NULL AFTER size_bytes,
  ADD KEY ix_files_content_hash (content_hash);
