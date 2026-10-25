-- ============================================================
-- Índice de rendimiento para la tabla ssr_zuniga
-- Ejecutar manualmente en PostgreSQL (idealmente en horario de baja demanda).
-- CONCURRENTLY evita bloquear la tabla durante la creación; no se puede
-- ejecutar dentro de una transacción (BEGIN/COMMIT).
-- ============================================================

-- Contexto: idx_telemetria_rapida1_zun solo cubre mt_name. Para
-- "WHERE mt_name = X ORDER BY mt_time_2 DESC LIMIT n" Postgres debe leer las
-- ~150.000 filas de ese sensor, ordenarlas y quedarse con n. Con caché fría
-- eso supera el statement_timeout de 10 s de la API (500 en GET /nivel?limit=2).
-- Con este índice la consulta lee solo n entradas del índice.
-- Mejora: getNivel, getNivel2, getCaudal y el cálculo de vaciado de getSnapshot.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ssr_zuniga_name_time
ON ssr_zuniga (mt_name, mt_time_2 DESC);

-- Verificación: debe aparecer "Index Scan using idx_ssr_zuniga_name_time" sin Sort.
-- EXPLAIN (ANALYZE, BUFFERS)
-- SELECT mt_name, mt_value, mt_time_2 FROM ssr_zuniga
-- WHERE mt_name = 'SSR_ZUNIGA--slave.estanque'
-- ORDER BY mt_time_2 DESC LIMIT 2;
