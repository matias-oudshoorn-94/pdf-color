-- Punto de retiro predeterminado: viene elegido en el checkout (el cliente puede cambiarlo)
-- y se muestra primero. Solo uno a la vez; se cambia desde el admin (Puntos de retiro).
-- Arranca marcada la sucursal de Ayacucho, si existe.
-- Aplicar sobre bases creadas antes de esta versión:
--   mysql -u USUARIO -p BASE < migrations/023_pickup_point_default.sql

ALTER TABLE pickup_points
  ADD COLUMN is_default TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active;

UPDATE pickup_points
   SET is_default = 1
 WHERE is_active = 1 AND (name LIKE '%Ayacucho%' OR address LIKE '%Ayacucho%')
 ORDER BY id
 LIMIT 1;
