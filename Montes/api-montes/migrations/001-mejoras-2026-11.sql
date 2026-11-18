-- ============================================================
-- Mejoras api-montes (2026-11). Ejecutar manualmente en PostgreSQL,
-- idealmente en horario de baja demanda y en este orden.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Columna `value` de texto a número (P3)
-- ------------------------------------------------------------
-- 1a. Valores no numéricos. En producción hay filas con value = 'error' (2026-02-09, del
--     provider antiguo; el actual descarta lo que no es número). Ver cuántas son y de cuándo:
SELECT name, value, COUNT(*) AS filas, MIN(time) AS desde, MAX(time) AS hasta, MIN(id), MAX(id)
FROM montes
WHERE value IS NULL
   OR value !~ '^-?[0-9]+(\.[0-9]+)?([eE][-+]?[0-9]+)?$'
GROUP BY name, value
ORDER BY desde;

-- 1b. Respaldarlas en una tabla aparte y sacarlas de `montes` (no son mediciones).
--     Para deshacerlo: INSERT INTO montes SELECT * FROM montes_valores_invalidos;
--     (antes del ALTER de 1c, mientras `value` siga siendo texto).
BEGIN;
CREATE TABLE IF NOT EXISTS montes_valores_invalidos AS
  SELECT * FROM montes WITH NO DATA;
INSERT INTO montes_valores_invalidos
  SELECT * FROM montes
  WHERE value IS NULL
     OR value !~ '^-?[0-9]+(\.[0-9]+)?([eE][-+]?[0-9]+)?$';
DELETE FROM montes
  WHERE value IS NULL
     OR value !~ '^-?[0-9]+(\.[0-9]+)?([eE][-+]?[0-9]+)?$';
COMMIT;

-- 1c. Reescribe la tabla (bloquea escrituras unos segundos con el volumen actual).
--     El provider puede seguir corriendo: si una inserción espera el bloqueo, entra después.
ALTER TABLE montes
  ALTER COLUMN value TYPE double precision USING value::double precision;

-- ------------------------------------------------------------
-- 2. Consumo diario cacheado (P2)
-- ------------------------------------------------------------
-- La API guarda aquí el consumo de cada día ya cerrado. mt_value NULL = día sin datos
-- (se guarda igual para no recalcularlo en cada consulta). El día de hoy nunca se guarda.
CREATE TABLE IF NOT EXISTS montes_daily_metrics (
  mt_name  TEXT             NOT NULL,
  mt_day   DATE             NOT NULL,
  mt_value DOUBLE PRECISION,
  PRIMARY KEY (mt_name, mt_day)
);

-- Si alguna vez cambia la forma de calcular el consumo diario, vaciar la tabla
-- y la API la vuelve a llenar sola:
-- TRUNCATE montes_daily_metrics;

-- ------------------------------------------------------------
-- 3. (Opcional) `time` con zona horaria (P7)
-- ------------------------------------------------------------
-- Elimina la ambigüedad de la hora repetida en abril y la dependencia de la zona
-- horaria del proceso Node. La API funciona igual con o sin este cambio.
-- Las filas ya guardadas en la hora repetida quedan asignadas a una de las dos pasadas.
-- ALTER TABLE montes
--   ALTER COLUMN time TYPE timestamptz USING time AT TIME ZONE 'America/Santiago';
