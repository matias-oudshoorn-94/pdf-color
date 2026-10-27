-- Separa "materia" de "curso": las materias pasan a ser una lista global
-- (tabla subjects), independiente del año/división de cada institución.
-- También agrega el recargo configurable por anillado.
-- Aplicar sobre bases creadas antes de esta versión:
--   mysql -u USUARIO -p BASE < migrations/004_subjects_and_ring_price.sql

-- ---------------------------------------------------------------------------
-- 1) Materias globales
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subjects (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_subjects_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO subjects (name)
SELECT DISTINCT subject FROM courses
ON DUPLICATE KEY UPDATE name = name;

-- ---------------------------------------------------------------------------
-- 2) Los archivos referencian curso y materia por separado
-- ---------------------------------------------------------------------------
ALTER TABLE files
  ADD COLUMN subject_id INT UNSIGNED NULL AFTER course_id,
  ADD KEY ix_files_subject (subject_id),
  ADD CONSTRAINT fk_files_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE SET NULL;

UPDATE files f
JOIN courses c ON c.id = f.course_id
JOIN subjects s ON s.name = c.subject
SET f.subject_id = s.id;

-- ---------------------------------------------------------------------------
-- 3) Fusionar cursos que solo diferían por materia (ahora es el mismo curso)
-- ---------------------------------------------------------------------------
CREATE TEMPORARY TABLE course_canon AS
SELECT institution_id, year, division, MIN(id) AS canonical_id
FROM courses
GROUP BY institution_id, year, division;

UPDATE files f
JOIN courses c ON c.id = f.course_id
JOIN course_canon cc ON cc.institution_id = c.institution_id
                     AND cc.year = c.year
                     AND (cc.division <=> c.division)
SET f.course_id = cc.canonical_id
WHERE c.id <> cc.canonical_id;

DELETE c FROM courses c
JOIN course_canon cc ON cc.institution_id = c.institution_id
                     AND cc.year = c.year
                     AND (cc.division <=> c.division)
WHERE c.id <> cc.canonical_id;

DROP TEMPORARY TABLE course_canon;

-- ---------------------------------------------------------------------------
-- 4) `courses` deja de tener materia: representa solo año/división
-- ---------------------------------------------------------------------------
ALTER TABLE courses DROP INDEX uq_courses;
ALTER TABLE courses DROP COLUMN subject;
ALTER TABLE courses ADD UNIQUE KEY uq_courses (institution_id, year, division);

-- ---------------------------------------------------------------------------
-- 5) Recargo configurable por anillado
-- ---------------------------------------------------------------------------
ALTER TABLE settings
  ADD COLUMN price_ring DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER price_per_sheet;
