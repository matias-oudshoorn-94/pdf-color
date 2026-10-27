-- Niveles educativos (primaria/secundaria/universitario) + carreras para universitario.
-- Las carreras son una lista libre (igual que las materias), no dependen de una institución:
-- se crean aparte y se asignan al armar el curso de una universidad puntual.
-- Aplicar sobre bases creadas antes de esta versión:
--   mysql -u USUARIO -p BASE < migrations/009_education_levels.sql

CREATE TABLE IF NOT EXISTS careers (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(160) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_careers_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE courses
  ADD COLUMN level ENUM('primaria','secundaria','universitario') NOT NULL DEFAULT 'secundaria' AFTER institution_id,
  ADD COLUMN career_id INT UNSIGNED NULL AFTER level,
  ADD KEY ix_courses_career (career_id),
  ADD CONSTRAINT fk_courses_career FOREIGN KEY (career_id) REFERENCES careers (id) ON DELETE RESTRICT,
  DROP INDEX uq_courses,
  ADD UNIQUE KEY uq_courses (institution_id, level, career_id, year, division);
