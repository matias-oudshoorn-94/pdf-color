-- PDF Color · esquema completo
-- Importar desde phpMyAdmin sobre una base vacía.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name          VARCHAR(120) NOT NULL,
  email         VARCHAR(180) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('client','admin') NOT NULL DEFAULT 'client',
  phone         VARCHAR(40) NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tokens de un solo uso para "olvidé mi contraseña". Se guarda el hash SHA-256
-- del token, nunca el token crudo (ese solo viaja por el link del mail).
CREATE TABLE IF NOT EXISTS password_resets (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at    TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_password_resets_user (user_id),
  KEY ix_password_resets_token_hash (token_hash),
  CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  created_by_user TINYINT(1) NOT NULL DEFAULT 0,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_institutions_name (location_id, name),
  KEY ix_institutions_location (location_id),
  CONSTRAINT fk_institutions_location FOREIGN KEY (location_id) REFERENCES locations (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Carreras: solo se usan cuando el nivel del archivo es universitario.
-- Lista libre, igual que subjects: no depende de una institución.
CREATE TABLE IF NOT EXISTS careers (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(160) NOT NULL,
  created_by_user TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_careers_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Años: lista libre, igual que subjects y careers. Depende solo del nivel
-- educativo, no de una institución (un mismo "1er año" sirve para cualquier
-- escuela de ese nivel).
CREATE TABLE IF NOT EXISTS years (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  level      ENUM('primaria','secundaria','universitario') NOT NULL,
  name       VARCHAR(40) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_years (level, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Materias: lista global, independiente del año, la institución y el nivel.
CREATE TABLE IF NOT EXISTS subjects (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(120) NOT NULL,
  created_by_user TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_subjects_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Institución, nivel, carrera, año y materia son cinco ejes independientes del
-- archivo: ninguno depende ni filtra a los demás (institution_id ya no pasa
-- por un "curso" intermedio).
CREATE TABLE IF NOT EXISTS files (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id        INT UNSIGNED NULL,
  institution_id INT UNSIGNED NULL,
  level          ENUM('primaria','secundaria','universitario') NULL,
  career_id      INT UNSIGNED NULL,
  year_id        INT UNSIGNED NULL,
  subject_id     INT UNSIGNED NULL,
  title          VARCHAR(180) NOT NULL,
  description    VARCHAR(500) NULL,
  original_name  VARCHAR(255) NOT NULL,
  stored_name    VARCHAR(255) NOT NULL,
  mime_type      VARCHAR(120) NOT NULL,
  size_bytes     BIGINT UNSIGNED NOT NULL,
  content_hash   CHAR(64) NULL,
  page_count     INT UNSIGNED NOT NULL DEFAULT 1,
  is_public      TINYINT(1) NOT NULL DEFAULT 0,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_files_stored_name (stored_name),
  KEY ix_files_user (user_id),
  KEY ix_files_institution (institution_id),
  KEY ix_files_career (career_id),
  KEY ix_files_year (year_id),
  KEY ix_files_subject (subject_id),
  KEY ix_files_public (is_public, created_at),
  KEY ix_files_content_hash (content_hash),
  CONSTRAINT fk_files_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_files_institution FOREIGN KEY (institution_id) REFERENCES institutions (id) ON DELETE SET NULL,
  CONSTRAINT fk_files_career FOREIGN KEY (career_id) REFERENCES careers (id) ON DELETE SET NULL,
  CONSTRAINT fk_files_year FOREIGN KEY (year_id) REFERENCES years (id) ON DELETE SET NULL,
  CONSTRAINT fk_files_subject FOREIGN KEY (subject_id) REFERENCES subjects (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Puntos de retiro: lista libre administrable, con dirección para mostrar el
-- mapa de Google en el checkout cuando se elige "retiro en sucursal".
CREATE TABLE IF NOT EXISTS pickup_points (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(120) NOT NULL,
  address    VARCHAR(300) NOT NULL,
  notes      VARCHAR(300) NULL,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Escalones de descuento: "a partir de X páginas, Y% de descuento". Se evalúa
-- por ítem del pedido (pages del archivo * copias), no sobre el total del pedido.
CREATE TABLE IF NOT EXISTS discount_tiers (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  min_pages        INT UNSIGNED NOT NULL,
  discount_percent DECIMAL(5,2) NOT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_discount_tiers_min_pages (min_pages)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id          INT UNSIGNED NOT NULL,
  status           ENUM('pendiente','en_proceso','listo','entregado','cancelado') NOT NULL DEFAULT 'pendiente',
  notes            VARCHAR(500) NULL,
  delivery_method  ENUM('retiro','envio') NOT NULL DEFAULT 'retiro',
  delivery_address VARCHAR(300) NULL,
  pickup_point_id  INT UNSIGNED NULL,
  shipping_price   DECIMAL(10,2) NOT NULL DEFAULT 0,
  -- payment_status: para pedidos mercadopago guarda el status crudo de la API de
  -- Mercado Pago (approved/rejected/in_process/...); para efectivo, pendiente/aprobado/rechazado.
  payment_method   ENUM('efectivo','mercadopago') NOT NULL DEFAULT 'efectivo',
  payment_status   VARCHAR(30) NOT NULL DEFAULT 'pendiente',
  mp_preference_id VARCHAR(80) NULL,
  mp_payment_id    VARCHAR(80) NULL,
  mp_status_detail VARCHAR(60) NULL,
  -- Última vez que el admin mandó el mail de "listo para retirar".
  ready_notified_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_orders_user (user_id),
  KEY ix_orders_status (status, created_at),
  KEY ix_orders_pickup_point (pickup_point_id),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_orders_pickup_point FOREIGN KEY (pickup_point_id) REFERENCES pickup_points (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- El pedido de Mercado Pago no se crea en orders hasta que el pago se confirma
-- (webhook o chequeo de respaldo): mientras tanto queda acá como "intención",
-- sin figurar en ningún lado si el cliente no llega a pagar.
CREATE TABLE IF NOT EXISTS pending_orders (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id           INT UNSIGNED NOT NULL,
  payload           TEXT NOT NULL,
  mp_preference_id  VARCHAR(80) NULL,
  promoted_order_id INT UNSIGNED NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_pending_orders_user (user_id),
  CONSTRAINT fk_pending_orders_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_pending_orders_promoted FOREIGN KEY (promoted_order_id) REFERENCES orders (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- color queda en 'color' fijo para pedidos nuevos (la imprenta ya no ofrece
-- blanco y negro); la columna se conserva para no perder el dato de pedidos viejos.
CREATE TABLE IF NOT EXISTS order_items (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id         INT UNSIGNED NOT NULL,
  file_id          INT UNSIGNED NOT NULL,
  copies           INT UNSIGNED NOT NULL DEFAULT 1,
  color            ENUM('bn','color') NOT NULL DEFAULT 'color',
  paper_size       ENUM('A4','A3','carta','oficio') NOT NULL DEFAULT 'A4',
  double_side      TINYINT(1) NOT NULL DEFAULT 0,
  finish           ENUM('simple','anillado','engrapado','encuadernado') NOT NULL DEFAULT 'anillado',
  pages            INT UNSIGNED NOT NULL DEFAULT 1,
  unit_price       DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_price      DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  notes            VARCHAR(300) NULL,
  PRIMARY KEY (id),
  KEY ix_items_order (order_id),
  KEY ix_items_file (file_id),
  CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_items_file FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Valoraciones de 1 a 5 estrellas por archivo, una por usuario.
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

CREATE TABLE IF NOT EXISTS settings (
  id              TINYINT UNSIGNED NOT NULL DEFAULT 1,
  price_per_sheet DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_ring      DECIMAL(10,2) NOT NULL DEFAULT 0,
  shipping_price  DECIMAL(10,2) NOT NULL DEFAULT 0,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO settings (id, price_per_sheet, price_ring, shipping_price) VALUES (1, 0, 0, 0)
ON DUPLICATE KEY UPDATE id = id;

CREATE TABLE IF NOT EXISTS messages (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(120) NOT NULL,
  email      VARCHAR(180) NOT NULL,
  phone      VARCHAR(40) NULL,
  body       TEXT NOT NULL,
  status     ENUM('no_leido','leido','respondido') NOT NULL DEFAULT 'no_leido',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_messages_created (created_at),
  KEY ix_messages_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rate_limits (
  id           CHAR(64) NOT NULL,
  attempts     INT UNSIGNED NOT NULL DEFAULT 0,
  window_start TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Admin inicial: admin@pdfcolor.local / cambiar123
-- Cambiá la contraseña apenas ingreses.
INSERT INTO users (name, email, password_hash, role)
SELECT 'Administrador', 'admin@pdfcolor.local',
       '$2y$10$.VKG1xNNdjQH.hFNe7rd5ur0wErEDzdiFgnUFHKvOShTPjvVG.zGe', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@pdfcolor.local');
