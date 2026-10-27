-- Se saca "división" de los cursos: queda solo el año.
-- Aplicar sobre bases creadas antes de esta versión:
--   mysql -u USUARIO -p BASE < migrations/010_remove_division.sql

ALTER TABLE courses
  DROP INDEX uq_courses,
  DROP COLUMN division,
  ADD UNIQUE KEY uq_courses (institution_id, level, career_id, year);
