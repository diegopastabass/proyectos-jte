-- ============================================================
-- Índices de rendimiento para la tabla ssr_bucalemu
-- Ejecutar manualmente en PostgreSQL (idealmente en horario de baja demanda)
-- CONCURRENTLY evita bloquear la tabla durante la creación
-- ============================================================

-- Índice compuesto para queries filtradas por nombre + fecha
-- Mejora: getCaudal, getTotalizador, findAllMeasurements, estimateEmptyingTimes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ssr_bucalemu_name_time 
ON ssr_bucalemu (mt_name, mt_time_2 DESC);

-- Índice parcial para las métricas de nivel (más selectivo y pequeño)
-- Mejora: findAllMeasurements y estimateEmptyingTimes específicamente
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ssr_bucalemu_levels_recent
ON ssr_bucalemu (mt_name, mt_time_2 DESC)
WHERE mt_name IN ('CASUTO--slave.AI12', 'BBAJO_NUEVO--slave.nivel_balto', 'ssr_bucalemu_bajo_nivel', 'ssr_nilahue_nivel');
