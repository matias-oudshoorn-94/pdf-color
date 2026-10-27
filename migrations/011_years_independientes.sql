-- "Año" deja de depender de la institución: pasa a ser una lista libre
-- (igual que materias y carreras) que solo depende del nivel educativo.
-- Institución, nivel, carrera, año y materia pasan a ser cinco ejes
-- independientes referenciados directo desde "files"; la tabla "courses"
-- deja de existir.
-- Aplicar sobre bases creadas antes de esta versión:
--   mysql -u USUARIO -p BASE < migrations/011_years_independientes.sql

CREATE TABLE IF NOT EXISTS years (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  level      ENUM('primaria','secundaria','universitario') NOT NULL,
  name       VARCHAR(40) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_years (level, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Los años distintos que ya existían (atados a cada institución) pasan a la lista libre.
INSERT IGNORE INTO years (level, name)
SELECT DISTINCT level, year FROM courses;

ALTER TABLE files
  ADD COLUMN institution_id INT UNSIGNED NULL AFTER user_id,
  ADD COLUMN level ENUM('primaria','secundaria','universitario') NULL AFTER institution_id,
  ADD COLUMN career_id INT UNSIGNED NULL AFTER level,
  ADD COLUMN year_id INT UNSIGNED NULL AFTER career_id;

-- Traslada a cada archivo los datos de su curso actual.
UPDATE files f
JOIN courses c ON c.id = f.course_id
JOIN years y ON y.level = c.level AND y.name = c.year
SET f.institution_id = c.institution_id,
    f.level = c.level,
    f.career_id = c.career_id,
    f.year_id = y.id;

ALTER TABLE files
  ADD KEY ix_files_institution (institution_id),
  ADD KEY ix_files_career (career_id),
  ADD KEY ix_files_year (year_id),
  ADD CONSTRAINT fk_files_institution FOREIGN KEY (institution_id) REFERENCES institutions (id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_files_career FOREIGN KEY (career_id) REFERENCES careers (id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_files_year FOREIGN KEY (year_id) REFERENCES years (id) ON DELETE SET NULL,
  DROP FOREIGN KEY fk_files_course,
  DROP KEY ix_files_course,
  DROP COLUMN course_id;

DROP TABLE courses;
