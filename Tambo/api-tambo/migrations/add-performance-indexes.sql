-- ============================================================
-- Índice y tabla diaria para api-tambo.
-- Ejecutar manualmente en PostgreSQL (idealmente en horario de baja demanda).
-- CREATE INDEX CONCURRENTLY no puede ir dentro de una transacción (BEGIN/COMMIT).
-- ============================================================

-- Snapshot (último valor por sensor), nivel/caudal con LIMIT y horómetro (LEAD por
-- sensor ordenado por tiempo) leen por (mt_name, mt_time_2) sin ordenar en memoria.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ssr_tambo_name_time
ON ssr_tambo (mt_name, mt_time_2 DESC);

-- Valores diarios cacheados (totalizador y horómetro). Solo crea la tabla si no existe.
-- El código usa ON CONFLICT (mt_name, mt_day), así que la clave primaria es obligatoria.
CREATE TABLE IF NOT EXISTS ssr_tambo_daily_metrics (
  mt_name  TEXT    NOT NULL,
  mt_day   DATE    NOT NULL,
  mt_value NUMERIC NOT NULL,
  PRIMARY KEY (mt_name, mt_day)
);
