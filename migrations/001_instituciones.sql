-- Localidades, instituciones y cursos + vínculo con los archivos.
-- Aplicar sobre bases creadas antes de esta versión:
--   mysql -u USUARIO -p BASE < migrations/001_instituciones.sql

CREATE TABLE IF NOT EXISTS locations (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_locations_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS institutions (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  location_id INT UNSIGNED NOT NULL,
  name        VARCHAR(160) NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_institutions_name (location_id, name),
  KEY ix_institutions_location (location_id),
  CONSTRAINT fk_institutions_location FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS courses (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  institution_id INT UNSIGNED NOT NULL,
  year           VARCHAR(40) NOT NULL,
  division       VARCHAR(40) NULL,
  subject        VARCHAR(120) NOT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_courses (institution_id, year, division, subject),
  KEY ix_courses_institution (institution_id),
  CONSTRAINT fk_courses_institution FOREIGN KEY (institution_id) REFERENCES institutions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE files
  ADD COLUMN course_id INT UNSIGNED NULL AFTER user_id,
  ADD KEY ix_files_course (course_id),
  ADD CONSTRAINT fk_files_course FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE SET NULL;
