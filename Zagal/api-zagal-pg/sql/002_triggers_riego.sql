-- =====================================================================
-- Triggers de riego (update_zagal_XX_interval, verificar_salto_totalizador)
--
-- El log zagal_XX_irrigation_log lo llena update_zagal_XX_interval en cada
-- INSERT del datalogger: abre una fila en 0->1 y la cierra (end_time) en 1->0.
-- Ejecutar por partes: PASO 1 es solo lectura.
-- =====================================================================


-- =====================================================================
-- PASO 1: DIAGNÓSTICO (solo lectura)
-- =====================================================================

-- 1a) Tipo real de mt_value en la 57 (la función del trigger asume texto)
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('parc_18_zagal', 'parc_57_zagal', 'parc_82_zagal')
  AND column_name = 'mt_value';

[{"table_name":"parc_57_zagal","column_name":"mt_value","data_type":"character varying"},{"table_name":"parc_18_zagal","column_name":"mt_value","data_type":"character varying"},{"table_name":"parc_82_zagal","column_name":"mt_value","data_type":"character varying"}]

-- 1b) ¿Se está guardando el totalizador de la 57? Si su último dato es muy
--     anterior al del caudal, el trigger verificar_salto_totalizador está
--     rechazando todos los INSERT.
SELECT mt_name,
       MAX(mt_time_2) AS ultimo_dato,
       COUNT(*) FILTER (WHERE mt_time_2 > now() - INTERVAL '1 day') AS filas_ultimo_dia
FROM parc_57_zagal
WHERE mt_name IN ('PARC_57_ZAGAL--slave.totalizador', 'PARC_57_ZAGAL--slave.caudal')
GROUP BY mt_name;

[{"mt_name":"PARC_57_ZAGAL--slave.caudal","ultimo_dato":"2026-10-24 12:59:36.800663","filas_ultimo_dia":"2"},{"mt_name":"PARC_57_ZAGAL--slave.totalizador","ultimo_dato":"2025-12-10 13:29:01.410019","filas_ultimo_dia":"0"}]

-- 1c) Cobertura del log por mes. Filas del trigger = riegos completos (minutos u
--     horas). Filas de ~1 min = backfill antiguo del GET (pares de muestras).
--     Un mes sin filas sale vacío en el mapa de calor. Repetir con 57 y 82.
SELECT date_trunc('month', start_time)::date AS mes,
       COUNT(*) AS filas,
       ROUND(AVG(EXTRACT(EPOCH FROM (end_time - start_time)))) AS seg_promedio,
       COUNT(*) FILTER (WHERE end_time IS NULL) AS abiertas
FROM zagal_18_irrigation_log
GROUP BY 1
ORDER BY 1;

[{"mes":"2026-02-01","filas":"4581","seg_promedio":"79","abiertas":"0"},{"mes":"2026-03-01","filas":"16770","seg_promedio":"82","abiertas":"0"},{"mes":"2026-04-01","filas":"5840","seg_promedio":"135","abiertas":"0"},{"mes":"2026-05-01","filas":"1596","seg_promedio":"78","abiertas":"0"},{"mes":"2026-06-01","filas":"1641","seg_promedio":"83","abiertas":"0"},{"mes":"2026-07-01","filas":"445","seg_promedio":"33","abiertas":"0"},{"mes":"2026-08-01","filas":"619","seg_promedio":"88","abiertas":"0"},{"mes":"2026-09-01","filas":"1423","seg_promedio":"641","abiertas":"0"},{"mes":"2026-10-01","filas":"922","seg_promedio":"3647","abiertas":"0"}]

-- 1d) Riegos abiertos hace mucho (sensor quedó en '1' o se perdió el '0'):
--     el resumen los cuenta hasta "ahora", inflando el tiempo de riego.
SELECT 'zagal_18' AS log, mt_name, start_time FROM zagal_18_irrigation_log
WHERE end_time IS NULL AND start_time < now() - INTERVAL '1 day'
UNION ALL
SELECT 'zagal_57', mt_name, start_time FROM zagal_57_irrigation_log
WHERE end_time IS NULL AND start_time < now() - INTERVAL '1 day'
UNION ALL
SELECT 'zagal_82', mt_name, start_time FROM zagal_82_irrigation_log
WHERE end_time IS NULL AND start_time < now() - INTERVAL '1 day';

No hay respuesta 0 rows
-- =====================================================================
-- PASO 2: ÍNDICES PARA LOS TRIGGERS (seguro, ejecutar cada uno por separado)
--
-- En cada 1->0 el trigger hace
--   UPDATE zagal_XX_irrigation_log SET end_time = ... WHERE mt_name = ... AND end_time IS NULL
-- que hoy recorre todo el log. Este índice parcial solo contiene las filas
-- abiertas (unas pocas), así que es diminuto.
-- (El SELECT del último totalizador que hace el trigger en cada 0->1 ya queda
--  cubierto por los índices de 001_indices_mt_time_2.sql.)
-- =====================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_log18_abiertos
  ON public.zagal_18_irrigation_log (mt_name) WHERE end_time IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_log57_abiertos
  ON public.zagal_57_irrigation_log (mt_name) WHERE end_time IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_log82_abiertos
  ON public.zagal_82_irrigation_log (mt_name) WHERE end_time IS NULL;


-- =====================================================================
-- PASO 3: CORREGIR verificar_salto_totalizador (57)
-- Aplicar SOLO si 1a dice que mt_value es character varying y 1b confirma
-- que el totalizador no se está guardando.
--
-- La versión actual compara NEW.mt_value (varchar) >= bigint, lo que en
-- Postgres es un error ("el operador no existe: character varying >= bigint")
-- en TODOS los INSERT del totalizador, incluido el primero.
--
-- Cambios:
--  * Compara como numeric; ignora valores vacíos o no numéricos.
--  * Solo usa como referencia un valor de la última hora: si el sensor estuvo
--    caído, el primer valor nuevo no se compara contra uno de hace meses (si
--    no, al arreglarlo se rechazaría todo para siempre).
--  * Descarta la fila (RETURN NULL + WARNING) en vez de RAISE EXCEPTION, que
--    abortaba el INSERT completo (con un lote, se perdían también las demás filas).
-- =====================================================================
CREATE OR REPLACE FUNCTION public.verificar_salto_totalizador()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    nuevo_valor NUMERIC;
    ult_valor NUMERIC;
BEGIN
    IF NEW.mt_name = 'PARC_57_ZAGAL--slave.totalizador' THEN
        IF NEW.mt_value ~ '^\s*-?\d+(\.\d+)?\s*$' THEN
            nuevo_valor := NEW.mt_value::numeric;
        END IF;

        SELECT mt_value::numeric INTO ult_valor
        FROM parc_57_zagal
        WHERE mt_name = 'PARC_57_ZAGAL--slave.totalizador'
          AND mt_time_2 >= NEW.mt_time_2 - INTERVAL '1 hour'
          AND mt_time_2 <= NEW.mt_time_2
          AND mt_value ~ '^\s*-?\d+(\.\d+)?\s*$'
        ORDER BY mt_time_2 DESC
        LIMIT 1;

        IF nuevo_valor IS NOT NULL AND ult_valor IS NOT NULL
           AND nuevo_valor >= ult_valor + 10000 THEN
            RAISE WARNING 'Totalizador descartado (% -> %), posible error del sensor',
                ult_valor, nuevo_valor;
            RETURN NULL;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;
