-- Datos iniciales: localidades de la provincia de Buenos Aires
-- e instituciones / cursos de ejemplo para Mar del Plata.
--
-- Es idempotente (INSERT IGNORE): se puede correr varias veces sin duplicar.
--   mysql -u USUARIO -p BASE < migrations/002_seed_localidades.sql
--
-- Las instituciones, cursos y materias son una base de trabajo:
-- revisalos y ajustalos desde el panel según la realidad de cada establecimiento.

-- ---------------------------------------------------------------------------
-- Localidades
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO locations (name) VALUES
  ('Mar del Plata'),
  ('Balcarce'),
  ('Tandil'),
  ('Miramar'),
  ('Necochea'),
  ('Batán'),
  ('Sierra de los Padres'),
  ('Mar de Cobo'),
  ('Santa Clara del Mar'),
  ('Mar Chiquita'),
  ('Villa Gesell'),
  ('Pinamar'),
  ('Madariaga'),
  ('Santa Teresita'),
  ('San Clemente del Tuyú'),
  ('San Bernardo'),
  ('Mar de Ajó'),
  ('Lobería'),
  ('Ayacucho'),
  ('Rauch'),
  ('Maipú'),
  ('Dolores'),
  ('Chascomús'),
  ('Benito Juárez'),
  ('Azul'),
  ('Olavarría'),
  ('Tres Arroyos'),
  ('Coronel Suárez'),
  ('Bahía Blanca'),
  ('Punta Alta'),
  ('Coronel Dorrego'),
  ('Carmen de Patagones'),
  ('La Plata'),
  ('Berisso'),
  ('Ensenada'),
  ('Quilmes'),
  ('Avellaneda'),
  ('Lanús'),
  ('Lomas de Zamora'),
  ('La Matanza'),
  ('Morón'),
  ('San Isidro'),
  ('Vicente López'),
  ('Tigre'),
  ('Pilar'),
  ('Escobar'),
  ('Luján'),
  ('Mercedes'),
  ('Chivilcoy'),
  ('Bragado'),
  ('Junín'),
  ('Pergamino'),
  ('San Nicolás de los Arroyos'),
  ('Zárate'),
  ('Campana'),
  ('9 de Julio'),
  ('Trenque Lauquen'),
  ('Pehuajó'),
  ('Bolívar'),
  ('Saladillo');

-- ---------------------------------------------------------------------------
-- Instituciones de Mar del Plata
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO institutions (location_id, name)
SELECT l.id, i.name
FROM locations l
CROSS JOIN (
  SELECT 'Universidad Nacional de Mar del Plata' AS name
  UNION ALL SELECT 'Universidad Tecnológica Nacional - Facultad Regional Mar del Plata'
  UNION ALL SELECT 'Universidad FASTA'
  UNION ALL SELECT 'Universidad CAECE Mar del Plata'
  UNION ALL SELECT 'Colegio Nacional Dr. Arturo U. Illia'
  UNION ALL SELECT 'Escuela de Educación Secundaria N° 1'
  UNION ALL SELECT 'Escuela de Educación Secundaria N° 2'
  UNION ALL SELECT 'Escuela de Educación Secundaria N° 3'
  UNION ALL SELECT 'Escuela de Educación Secundaria N° 5'
  UNION ALL SELECT 'Escuela de Educación Secundaria Técnica N° 5'
  UNION ALL SELECT 'Escuela Normal Superior N° 1'
  UNION ALL SELECT 'Instituto Superior de Formación Docente N° 19'
) i
WHERE l.name = 'Mar del Plata';

-- ---------------------------------------------------------------------------
-- Materias (lista global, independiente del curso e institución)
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO subjects (name) VALUES
  ('Matemática'),
  ('Lengua y Literatura'),
  ('Historia'),
  ('Geografía'),
  ('Biología'),
  ('Física'),
  ('Química'),
  ('Inglés'),
  ('Dibujo Técnico'),
  ('Electrotecnia'),
  ('Tecnología de los Materiales'),
  ('Instalaciones Eléctricas'),
  ('Análisis Matemático I'),
  ('Álgebra'),
  ('Física I'),
  ('Química General'),
  ('Algoritmos y Estructuras de Datos'),
  ('Introducción a la Economía'),
  ('Anatomía'),
  ('Derecho Constitucional'),
  ('Didáctica General'),
  ('Psicología Educacional'),
  ('Práctica Docente'),
  ('Historia de la Educación Argentina');

-- ---------------------------------------------------------------------------
-- Cursos de secundario (4to a 6to, divisiones A y B)
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO courses (institution_id, year, division)
SELECT i.id, y.year, d.division
FROM institutions i
JOIN locations l ON l.id = i.location_id
CROSS JOIN (
  SELECT '4to' AS year UNION ALL SELECT '5to' UNION ALL SELECT '6to'
) y
CROSS JOIN (
  SELECT 'A' AS division UNION ALL SELECT 'B'
) d
WHERE l.name = 'Mar del Plata'
  AND i.name IN (
    'Colegio Nacional Dr. Arturo U. Illia',
    'Escuela de Educación Secundaria N° 1',
    'Escuela de Educación Secundaria N° 2',
    'Escuela de Educación Secundaria N° 3',
    'Escuela de Educación Secundaria N° 5',
    'Escuela Normal Superior N° 1'
  );

-- Cursos de la escuela técnica (4to a 7mo, división A)
INSERT IGNORE INTO courses (institution_id, year, division)
SELECT i.id, y.year, 'A'
FROM institutions i
JOIN locations l ON l.id = i.location_id
CROSS JOIN (
  SELECT '4to' AS year UNION ALL SELECT '5to' UNION ALL SELECT '6to' UNION ALL SELECT '7mo'
) y
WHERE l.name = 'Mar del Plata'
  AND i.name = 'Escuela de Educación Secundaria Técnica N° 5';

-- ---------------------------------------------------------------------------
-- Cursos universitarios (1er a 3er año, comisiones A y B)
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO courses (institution_id, year, division)
SELECT i.id, y.year, d.division
FROM institutions i
JOIN locations l ON l.id = i.location_id
CROSS JOIN (
  SELECT '1er año' AS year UNION ALL SELECT '2do año' UNION ALL SELECT '3er año'
) y
CROSS JOIN (
  SELECT 'A' AS division UNION ALL SELECT 'B'
) d
WHERE l.name = 'Mar del Plata'
  AND i.name IN (
    'Universidad Nacional de Mar del Plata',
    'Universidad Tecnológica Nacional - Facultad Regional Mar del Plata',
    'Universidad FASTA',
    'Universidad CAECE Mar del Plata'
  );

-- Profesorados (1ro a 4to año, división A)
INSERT IGNORE INTO courses (institution_id, year, division)
SELECT i.id, y.year, 'A'
FROM institutions i
JOIN locations l ON l.id = i.location_id
CROSS JOIN (
  SELECT '1er año' AS year UNION ALL SELECT '2do año' UNION ALL SELECT '3er año' UNION ALL SELECT '4to año'
) y
WHERE l.name = 'Mar del Plata'
  AND i.name = 'Instituto Superior de Formación Docente N° 19';
