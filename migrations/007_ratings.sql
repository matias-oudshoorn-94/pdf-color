-- Valoraciones de 1 a 5 estrellas por archivo, una por usuario (puede
-- actualizar su propio voto, pero no votar más de una vez por archivo).
-- Aplicar sobre bases creadas antes de esta versión:
--   mysql -u USUARIO -p BASE < migrations/007_ratings.sql

CREATE TABLE IF NOT EXISTS file_ratings (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  file_id    INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  rating     TINYINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_file_ratings (file_id, user_id),
  KEY ix_file_ratings_file (file_id),
  CONSTRAINT fk_file_ratings_file FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE CASCADE,
  CONSTRAINT fk_file_ratings_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_file_ratings_range CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
