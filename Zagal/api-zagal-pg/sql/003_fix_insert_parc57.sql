-- =====================================================================
-- PARC_57_ZAGAL: corregir el rechazo de INSERT de MTDP y reinyectar lo perdido
--
-- Diagnóstico completo: Inventia RAG/DIAGNOSTICO_ODBC_LOST.md
--
-- Resumen: MTDP manda cada lectura como un INSERT de varias filas (sectores,
-- caudal, totalizador...). El trigger verificar_salto_totalizador aborta el
-- INSERT completo cuando la fila del totalizador no le gusta, así que se
-- pierden también los sectores y el caudal del mismo lote:
--   * 2025-10-20 -> 2025-12-04: RAISE EXCEPTION ante lecturas erróneas del
--     totalizador (~1.110.000.000 o 0). Unos 30 lotes al día.
--   * desde 2025-12-10: la versión actual compara varchar >= bigint, error de
--     tipos en TODOS los INSERT con totalizador (~1.440 lotes al día).
--
-- Reemplaza el PASO 3 de 002_triggers_riego.sql (aquella versión deja pasar una
-- lectura errónea si llega después de una hora sin datos).
--
-- Ejecutar por partes. PASO 0 es solo lectura. Nada de esto se ha ejecutado
-- contra producción.
-- =====================================================================


-- =====================================================================
-- PASO 0: DIAGNÓSTICO (solo lectura)
-- =====================================================================

-- 0a) Triggers de la tabla: deben aparecer verificar_salto_totalizador y
--     update_zagal_57_interval. Anotar si son BEFORE o AFTER (RETURN NULL
--     solo descarta la fila en un trigger BEFORE ... FOR EACH ROW).
SELECT tgname, tgenabled, pg_get_triggerdef(oid)
FROM pg_trigger
WHERE tgrelid = 'public.parc_57_zagal'::regclass AND NOT tgisinternal;

-- 0b) Cuerpo actual de las funciones. Si verificar_salto_totalizador compara
--     NEW.mt_value contra un bigint sin castear, es la causa del error.
SELECT p.proname, pg_get_functiondef(p.oid)
FROM pg_proc p
WHERE p.proname IN ('verificar_salto_totalizador', 'update_zagal_57_interval');

-- 0c) Columnas: mt_time_2 debe tener DEFAULT now() (MTDP no la manda).
--     Del log de riego interesa saber si tiene más columnas NOT NULL además
--     de mt_name, start_time y end_time (el PASO 3e solo llena esas tres).
SELECT table_name, column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name IN ('parc_57_zagal', 'zagal_57_irrigation_log')
ORDER BY table_name, ordinal_position;

-- 0d) Zona horaria de la sesión: mt_time_2 = now() se guarda en esta zona.
SHOW TimeZone;
SELECT now(), now()::timestamp;

-- 0e) Calibrar el desfase reloj del equipo -> mt_time_2, para el --offset del
--     script. mt_time es la FECHA del reloj del equipo y mt_time_2 la hora de
--     inserción, así que (equipo - mt_time_2) cae en [offset_min, offset_max).
--     Con datos que llegan atrasados offset_max puede salir menor; offset_min
--     siempre es válido. Según el log de MTDP, en nov-2026 el equipo de la 57
--     adelanta ~49 min respecto de UTC (ver el diagnóstico). --offset = -(desfase en minutos).
SELECT date_trunc('month', mt_time_2)::date AS mes,
       COUNT(*) AS filas,
       MAX(mt_time::timestamp - mt_time_2) AS offset_min,
       MIN(mt_time::timestamp + INTERVAL '1 day' - mt_time_2) AS offset_max
FROM parc_57_zagal
WHERE mt_time_2 >= '2025-06-01'
GROUP BY 1
ORDER BY 1;

-- 0f) (Opcional) Reproducir el error con una fila real del log, sin guardar nada.
--     Debe fallar con "operator does not exist: character varying >= bigint"
--     (o el mensaje del RAISE EXCEPTION).
-- BEGIN;
-- INSERT INTO PARC_57_ZAGAL (mt_name, mt_value, mt_time, mt_quality)
-- VALUES ('PARC_57_ZAGAL--slave.totalizador', '16194691', '2026-11-18 18:19:44.683', '1');
-- ROLLBACK;


-- =====================================================================
-- PASO 1: CORREGIR verificar_salto_totalizador
--
--  * Compara como numeric; ignora valores vacíos o no numéricos.
--  * Referencia = último totalizador guardado ANTES de NEW.mt_time_2, sin
--    límite de tiempo, y el salto permitido crece con el tiempo transcurrido:
--    10.000 + 5.000 por hora. El máximo real medido en el log es ~4.000/h
--    (~38.000/día), y las lecturas erróneas saltan ~1.100 millones, así que
--    se rechazan aunque el sensor haya estado caído meses.
--  * Una lectura en 0 con referencia > 0 también se descarta (se observaron).
--  * Descarta solo esa fila (RETURN NULL) en vez de RAISE EXCEPTION, que
--    abortaba el INSERT completo y perdía el resto del lote.
--  * Avisa con RAISE LOG (log del servidor) y no WARNING: un WARNING llega al
--    cliente ODBC como SQL_SUCCESS_WITH_INFO y no está claro cómo lo trata MTDP.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.verificar_salto_totalizador()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    nuevo_valor NUMERIC;
    ult_valor NUMERIC;
    ult_tiempo TIMESTAMP;
    horas NUMERIC;
BEGIN
    IF NEW.mt_name = 'PARC_57_ZAGAL--slave.totalizador' THEN
        IF NEW.mt_value ~ '^\s*-?\d+(\.\d+)?\s*$' THEN
            nuevo_valor := NEW.mt_value::numeric;
        END IF;

        SELECT mt_value::numeric, mt_time_2 INTO ult_valor, ult_tiempo
        FROM parc_57_zagal
        WHERE mt_name = 'PARC_57_ZAGAL--slave.totalizador'
          AND mt_time_2 <= NEW.mt_time_2
          AND mt_value ~ '^\s*-?\d+(\.\d+)?\s*$'
        ORDER BY mt_time_2 DESC
        LIMIT 1;

        IF nuevo_valor IS NOT NULL AND ult_valor IS NOT NULL THEN
            horas := GREATEST(EXTRACT(EPOCH FROM (NEW.mt_time_2 - ult_tiempo)) / 3600, 0);
            IF (nuevo_valor = 0 AND ult_valor > 0)
               OR nuevo_valor >= ult_valor + 10000 + 5000 * horas THEN
                RAISE LOG 'Totalizador 57 descartado (% -> %), posible error del sensor',
                    ult_valor, nuevo_valor;
                RETURN NULL;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

-- Si 0a mostró el trigger como AFTER, recrearlo como BEFORE (el nombre del
-- trigger sale en 0a; aquí se asume trg_verificar_salto_totalizador):
-- DROP TRIGGER trg_verificar_salto_totalizador ON public.parc_57_zagal;
-- CREATE TRIGGER trg_verificar_salto_totalizador
--   BEFORE INSERT ON public.parc_57_zagal
--   FOR EACH ROW EXECUTE FUNCTION public.verificar_salto_totalizador();


-- =====================================================================
-- PASO 2: VERIFICAR (a los 5-10 min de aplicar el PASO 1)
-- =====================================================================
-- Debe haber filas nuevas de totalizador y de sectores:
SELECT mt_name, MAX(mt_time_2) AS ultimo, COUNT(*) AS filas_10_min
FROM parc_57_zagal
WHERE mt_time_2 > now() - INTERVAL '10 minutes'
GROUP BY mt_name
ORDER BY mt_name;
-- Y en el servidor de MTDP, odbc_lost.log deja de recibir líneas de
-- PARC_57_ZAGAL (en mt_opc.log quedan solo los errores de mt_logger, que se
-- arreglan con Inventia RAG/reinyeccion/mt_logger.sql).
--
-- Anotar la hora en que se aplicó el PASO 1: es el :'hasta' del PASO 3e.


-- =====================================================================
-- PASO 3: REINYECTAR LO PERDIDO (2025-10-20 -> fecha del arreglo)
--
-- Se ejecuta con psql (\copy y variables :'...'). En DBeaver, importar el CSV
-- a la tabla de staging con el asistente y reemplazar las variables a mano.
--
-- 3a) Generar el CSV en una máquina con copia de odbc_lost.log, con el
--     --offset calibrado en 0e (ejemplo con -49 min):
--   python3 "Inventia RAG/reinyeccion/extraer_odbc_lost.py" odbc_lost.log \
--       --tabla PARC_57_ZAGAL --offset -49 --salida parc57_reinyeccion.csv
--   Resultado con el log del 2026-11-18: ~5,58 millones de filas (~460 MB),
--   3.962 lecturas erróneas del totalizador descartadas.
-- =====================================================================

-- 3b) Staging
CREATE TABLE IF NOT EXISTS public.parc_57_zagal_reinyeccion (
    mt_name             varchar,
    mt_value            varchar,
    mt_time_dispositivo timestamp,
    mt_quality          varchar,
    mt_time_2           timestamp
);

\copy public.parc_57_zagal_reinyeccion FROM 'parc57_reinyeccion.csv' WITH (FORMAT csv, HEADER true)

-- 3c) Revisar antes de insertar: filas por mes y cuántas ya existen
SELECT date_trunc('month', mt_time_2)::date AS mes, COUNT(*) AS filas,
       COUNT(DISTINCT (mt_name, mt_time_2)) AS unicas
FROM public.parc_57_zagal_reinyeccion
GROUP BY 1 ORDER BY 1;

SELECT COUNT(*) AS ya_existen
FROM public.parc_57_zagal_reinyeccion r
WHERE EXISTS (SELECT 1 FROM parc_57_zagal p
              WHERE p.mt_name = r.mt_name AND p.mt_time_2 = r.mt_time_2);

-- 3d) Insertar SIN disparar los triggers: el del totalizador ya lo filtró el
--     script, y el de riego compararía contra datos de otra fecha. El log de
--     riego se reconstruye en 3e. session_replication_role requiere
--     rds_superuser (usuario maestro de RDS). Si no se puede, ver la nota de abajo.
--     Es idempotente: si se corta, se puede volver a correr.
BEGIN;
SET LOCAL statement_timeout = 0;
SET LOCAL session_replication_role = replica;

INSERT INTO parc_57_zagal (mt_name, mt_value, mt_time, mt_quality, mt_time_2)
SELECT DISTINCT ON (r.mt_name, r.mt_time_2)
       r.mt_name, r.mt_value, r.mt_time_dispositivo::date, r.mt_quality, r.mt_time_2
FROM public.parc_57_zagal_reinyeccion r
WHERE NOT EXISTS (SELECT 1 FROM parc_57_zagal p
                  WHERE p.mt_name = r.mt_name AND p.mt_time_2 = r.mt_time_2)
ORDER BY r.mt_name, r.mt_time_2;

COMMIT;
-- Nota: sin rds_superuser, en su lugar el dueño de la tabla puede hacer
--   ALTER TABLE parc_57_zagal DISABLE TRIGGER USER;  -> INSERT de arriba -> ENABLE TRIGGER USER;
-- pero mientras tanto los INSERT en vivo de MTDP tampoco disparan triggers:
-- hacerlo rápido y extender :'hasta' de 3e hasta después del ENABLE.

ANALYZE parc_57_zagal;

-- 3e) Reconstruir zagal_57_irrigation_log en el periodo reinyectado.
--     Un riego = corrida de muestras '1' de un sector. Termina en la primera
--     muestra '0' (igual que el trigger) o, si los datos se cortan más de
--     :corte, en la última muestra '1': en el periodo hay cortes de días
--     (equipo sin señal) que el trigger habría contado como un riego de días.
--     Ojo: cuando el equipo manda solo por evento (pocas muestras al día, como
--     en nov-2026), un :corte corto acorta riegos reales; 2 horas es un
--     compromiso. Se omiten los riegos de duración cero.
--     No toca riegos que ya existan en el log y se traslapen.
--     :'desde' = primer mt_time_2 reinyectado; :'hasta' = hora del PASO 1.
\set desde '2025-10-20 00:00'
\set hasta '2026-11-18 23:59'
\set corte '2 hours'

BEGIN;
WITH m AS (
    SELECT mt_name, mt_time_2, mt_value,
           LAG(mt_value)  OVER w AS valor_ant,
           LAG(mt_time_2) OVER w AS tiempo_ant
    FROM parc_57_zagal
    WHERE mt_name ~ '^PARC_57_ZAGAL--slave\.sector[0-9]+$'
      AND mt_value IN ('0', '1')
      AND mt_time_2 >= :'desde' AND mt_time_2 < :'hasta'
    WINDOW w AS (PARTITION BY mt_name ORDER BY mt_time_2)
),
grupos AS (
    SELECT *, SUM(CASE WHEN valor_ant IS DISTINCT FROM mt_value
                         OR mt_time_2 - tiempo_ant > :'corte'::interval
                       THEN 1 ELSE 0 END) OVER (PARTITION BY mt_name ORDER BY mt_time_2) AS grupo
    FROM m
),
corridas AS (
    SELECT mt_name, grupo, MIN(mt_value) AS valor,
           MIN(mt_time_2) AS inicio, MAX(mt_time_2) AS ultima
    FROM grupos
    GROUP BY mt_name, grupo
),
riegos AS (
    SELECT mt_name, valor, inicio, ultima,
           LEAD(inicio) OVER (PARTITION BY mt_name ORDER BY inicio) AS sig_inicio
    FROM corridas
),
nuevos AS (
    SELECT mt_name, inicio AS start_time,
           CASE WHEN sig_inicio - ultima <= :'corte'::interval THEN sig_inicio
                ELSE ultima END AS end_time
    FROM riegos
    WHERE valor = '1'
)
INSERT INTO zagal_57_irrigation_log (mt_name, start_time, end_time)
SELECT n.mt_name, n.start_time, n.end_time
FROM nuevos n
WHERE n.end_time > n.start_time
  AND NOT EXISTS (
      SELECT 1 FROM zagal_57_irrigation_log l
      WHERE l.mt_name = n.mt_name
        AND l.start_time <= n.end_time
        AND COALESCE(l.end_time, 'infinity') >= n.start_time);
-- Revisar con la consulta 1c de 002_triggers_riego.sql (sobre zagal_57) y
-- hacer COMMIT si las cifras por mes son razonables; si no, ROLLBACK.
-- COMMIT;

-- 3f) Limpiar cuando todo esté revisado
-- DROP TABLE public.parc_57_zagal_reinyeccion;
