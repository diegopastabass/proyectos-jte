-- ============================================================
-- Índice para api-balsas.
-- Ejecutar manualmente en PostgreSQL (idealmente en horario de baja demanda).
-- CREATE INDEX CONCURRENTLY no puede ir dentro de una transacción (BEGIN/COMMIT).
-- ============================================================

-- Snapshot (último valor por sensor), series y totales diarios leen por
-- (mt_name, mt_time_2) sin ordenar en memoria.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ssr_balsas_name_time
ON ssr_balsas (mt_name, mt_time_2 DESC);
