-- =====================================================================
-- Índices para las consultas de la API (todas filtran/ordenan por mt_time_2)
--
-- En 18 y 82 los índices existentes están sobre mt_time (columna DATE),
-- que la API no usa: por eso esas tablas hacen Seq Scan completo.
-- La 57 ya tiene los índices correctos (idx_sensor_fecha_val_57, idx_solo_fecha_57).
--
-- CONCURRENTLY no bloquea las inserciones del datalogger, pero NO puede
-- ejecutarse dentro de una transacción: correr cada sentencia por separado
-- (en DBeaver/pgAdmin desactivar el auto-commit "manual" o usar psql).
-- =====================================================================

SET statement_timeout = 0;

-- Parcela 18 -----------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sensor_fecha2_val18
  ON public.parc_18_zagal USING btree (mt_name, mt_time_2 DESC) INCLUDE (mt_value);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_solo_fecha18
  ON public.parc_18_zagal USING btree (mt_time_2 DESC);

-- Parcela 82 -----------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sensor_fecha2_val82
  ON public.parc_82_zagal USING btree (mt_name, mt_time_2 DESC) INCLUDE (mt_value);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_solo_fecha82
  ON public.parc_82_zagal USING btree (mt_time_2 DESC);

-- Logs de riego (el resumen filtra por start_time) ---------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_log18_start
  ON public.zagal_18_irrigation_log USING btree (start_time);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_log57_start
  ON public.zagal_57_irrigation_log USING btree (start_time);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_log82_start
  ON public.zagal_82_irrigation_log USING btree (start_time);

ANALYZE public.parc_18_zagal;
ANALYZE public.parc_82_zagal;
ANALYZE public.zagal_18_irrigation_log;
ANALYZE public.zagal_57_irrigation_log;
ANALYZE public.zagal_82_irrigation_log;

-- =====================================================================
-- Verificación: debe aparecer "Index Scan using idx_solo_fecha18"
-- =====================================================================
-- EXPLAIN (ANALYZE, BUFFERS)
-- SELECT * FROM parc_18_zagal
-- WHERE mt_time_2 >= '2024-01-01' AND mt_time_2 < '2024-02-01';

-- =====================================================================
-- OPCIONAL (más adelante): índices redundantes.
-- idx_telemetria_rapida18 e idx_sensor_fecha_val18 tienen las mismas
-- columnas (mt_name, mt_time DESC); cada índice extra encarece cada INSERT
-- del datalogger. Antes de borrar alguno, revisar si alguien los usa
-- (idx_scan = 0 después de varios días con la API nueva => no se usan):
-- =====================================================================
-- SELECT relname, indexrelname, idx_scan, pg_size_pretty(pg_relation_size(indexrelid))
-- FROM pg_stat_user_indexes
-- WHERE relname LIKE '%zagal%'
-- ORDER BY relname, indexrelname;
