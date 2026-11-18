-- ============================================================
-- Mejoras api-undurraga (2026-11). Ejecutar manualmente en PostgreSQL,
-- idealmente en horario de baja demanda y en este orden.
-- `time` ya es timestamptz y los índices (sensor_id, time) ya existen: no se tocan.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Limpieza de datos (respaldo en tabla aparte + borrado)
-- ------------------------------------------------------------
-- Para deshacer: INSERT INTO undurraga_metrics (id, sensor_id, value, time)
--                SELECT id, sensor_id, value, time FROM undurraga_metrics_descartadas WHERE motivo = '...';
BEGIN;
CREATE TABLE IF NOT EXISTS undurraga_metrics_descartadas AS
  SELECT *, ''::text AS motivo FROM undurraga_metrics WITH NO DATA;

-- 1a. Duplicados exactos (mismo sensor, hora y valor): se conserva la fila de menor id.
--     Son ~48.700 filas de la piscina; no cambian el consumo, solo duplican la tabla.
INSERT INTO undurraga_metrics_descartadas
  SELECT m.*, 'duplicado' FROM undurraga_metrics m
  WHERE EXISTS (SELECT 1 FROM undurraga_metrics o
                WHERE o.sensor_id = m.sensor_id AND o.time = m.time
                  AND o.value = m.value AND o.id < m.id);

-- 1b. Sensor 6: 7 filas de prueba anteriores a la puesta en marcha (21 y 22-10-2025).
INSERT INTO undurraga_metrics_descartadas
  SELECT *, 'sensor 6 de prueba' FROM undurraga_metrics WHERE sensor_id = 6;

-- 1c. SOLO si el cliente o el técnico confirman que 135 es un valor de falla de la piscina
--     (88 % de las filas de febrero y 76 % de las de marzo de 2026).
-- INSERT INTO undurraga_metrics_descartadas
--   SELECT *, 'valor de falla 135' FROM undurraga_metrics WHERE sensor_id = 5 AND value = 135;

DELETE FROM undurraga_metrics m
USING undurraga_metrics_descartadas d
WHERE m.id = d.id;
COMMIT;

-- Revisar lo que se respaldó:
SELECT motivo, sensor_id, COUNT(*) FROM undurraga_metrics_descartadas GROUP BY 1, 2 ORDER BY 1, 2;

-- ------------------------------------------------------------
-- 2. Consumo diario cacheado
-- ------------------------------------------------------------
-- La API guarda aquí el consumo de cada día ya cerrado. mt_value NULL = día sin datos
-- (se guarda igual para no recalcularlo en cada consulta). El día de hoy nunca se guarda.
CREATE TABLE IF NOT EXISTS undurraga_daily_metrics (
  sensor_id INTEGER          NOT NULL,
  mt_day    DATE             NOT NULL,
  mt_value  DOUBLE PRECISION,
  PRIMARY KEY (sensor_id, mt_day)
);

-- Si se ejecuta la limpieza 1c después de que la API ya llenó esta tabla, vaciarla para que
-- recalcule febrero y marzo sin el 135:
-- TRUNCATE undurraga_daily_metrics;

-- ------------------------------------------------------------
-- 3. (Opcional) Tabla de usuarios
-- ------------------------------------------------------------
-- La API ya no usa `undurraga_users` (se eliminaron los módulos auth y users). Antes de
-- borrarla, confirmar que ningún otro sistema la usa:
-- DROP TABLE undurraga_users;
