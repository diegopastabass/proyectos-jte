-- =====================================================================
-- mt_logger: tabla por defecto de MTDP para equipos que no están en sample.xml
--
-- MTDP escribe en mt_logger (nombre fijo, con mt_name = "<IP>--1.<registro>")
-- todo lo que llega de un equipo sin <network> configurado, o de uno que aún
-- no se había agregado. La tabla no existe, así que cada uno de esos INSERT
-- falla: ~600 al día en noviembre de 2026, 126.511 en odbc_lost.log.
--
-- Recomendación: crearla como tabla "de descarte" con retención de 90 días.
--  * Se cortan los errores en mt_opc.log y odbc_lost.log deja de crecer
--    (hoy los errores reales, como los de PARC_57, quedan enterrados).
--  * Quedan registrados los equipos nuevos antes de configurarlos (DOS_BALSAS
--    del 29-oct al 2-nov, PLANTA2_IDAHUE feb-mar 2026...), para recuperar
--    esos días si se quiere.
--  * Volumen chico: ~3.000 filas/día hoy.
-- Ignorarlos no es una opción real: MTDP no tiene un parámetro para dejar de
-- escribir los equipos desconocidos.
--
-- Revisar y ejecutar a mano. Reemplazar <usuario_mtdp> por el usuario ODBC
-- de MTDP (está en sample.xml, no se copia aquí).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.mt_logger (
    mt_name    varchar(100),
    mt_value   varchar(50),
    mt_time    timestamp,                 -- hora del equipo, completa (no DATE)
    mt_quality varchar(10),
    recibido   timestamp DEFAULT now()    -- hora de inserción
);

CREATE INDEX IF NOT EXISTS idx_mt_logger_recibido ON public.mt_logger (recibido);
CREATE INDEX IF NOT EXISTS idx_mt_logger_name ON public.mt_logger (mt_name, recibido DESC);

GRANT INSERT, SELECT ON public.mt_logger TO <usuario_mtdp>;


-- Retención: borrar lo de más de 90 días. Con pg_cron (si está habilitado en
-- el parameter group de RDS):
--   SELECT cron.schedule('purga_mt_logger', '30 4 * * *',
--     $$DELETE FROM public.mt_logger WHERE recibido < now() - INTERVAL '90 days'$$);
-- Sin pg_cron, un cron en el servidor Linux nuevo con psql y la misma sentencia.


-- ---------------------------------------------------------------------
-- Uso: qué equipos desconocidos están mandando datos
-- ---------------------------------------------------------------------
-- SELECT split_part(mt_name, '--', 1) AS ip, COUNT(*) AS filas,
--        MIN(recibido) AS desde, MAX(recibido) AS hasta,
--        string_agg(DISTINCT split_part(mt_name, '.', 5), ', ') AS registros
-- FROM public.mt_logger
-- WHERE recibido > now() - INTERVAL '7 days'
-- GROUP BY 1 ORDER BY 2 DESC;
--
-- En odbc_lost.log (2026-11-18), las IP sin <network> en sample.xml son:
--   151.21.17.58   83.022 lotes, desde 2026-04-09, AI17 y AI18 cada minuto
--   151.25.49.38   26.643 lotes, desde 2026-08-17, AI23 / REG826 / REG827
--                  (mismo mapa que SSR_CUMPEO: caudal_pozos AI23, estanque REG826;
--                  SSR_CUMPEO está configurado con 151.25.49.41)
--   151.26.12.113     394 lotes, desde 2026-11-17, REG830-835 / AI17 / AI24
-- Conviene identificarlas y agregarlas a sample.xml.


-- ---------------------------------------------------------------------
-- (Opcional) Reinyectar el histórico perdido en mt_logger
-- ---------------------------------------------------------------------
-- python3 extraer_odbc_lost.py odbc_lost.log --tabla mt_logger \
--     --sin-filtro-totalizador --salida mt_logger.csv
-- (~1,25 millones de filas; hay relojes de equipo en 1902 y 2027, se
--  descartan abajo con el filtro de fechas)
--
-- CREATE TEMP TABLE mt_logger_csv (mt_name varchar, mt_value varchar,
--     mt_time_dispositivo timestamp, mt_quality varchar, mt_time_2 timestamp);
-- \copy mt_logger_csv FROM 'mt_logger.csv' WITH (FORMAT csv, HEADER true)
-- INSERT INTO public.mt_logger (mt_name, mt_value, mt_time, mt_quality, recibido)
-- SELECT DISTINCT mt_name, mt_value, mt_time_dispositivo, mt_quality, mt_time_dispositivo
-- FROM mt_logger_csv
-- WHERE mt_time_dispositivo BETWEEN '2024-01-01' AND now() + INTERVAL '1 day';
-- (con retención de 90 días, solo vale la pena si se va a usar enseguida)
