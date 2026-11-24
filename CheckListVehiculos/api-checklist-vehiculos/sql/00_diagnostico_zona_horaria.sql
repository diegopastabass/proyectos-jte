-- DIAGNÓSTICO (solo lectura). Ejecutar con el mismo usuario que usa la API.

-- 1) Zona de la sesión y del servidor de BD, y tipo actual de las columnas
SHOW timezone;
SELECT now() AS ahora_sesion, now() AT TIME ZONE 'UTC' AS ahora_utc,
       now() AT TIME ZONE 'America/Santiago' AS ahora_santiago;
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name IN ('created_at', 'updated_at', 'timestamp')
  AND table_name IN ('users', 'vehicles', 'checklists', 'checklist_images', 'error_log')
ORDER BY table_name, column_name;

-- 2) Zonas fijadas a nivel de base o de usuario (pueden ser distintas de la del servidor)
SELECT d.datname, s.setconfig FROM pg_db_role_setting s
LEFT JOIN pg_database d ON d.oid = s.setdatabase WHERE s.setconfig::text ILIKE '%timezone%';

-- 3) Últimos checklists: compare created_at con la hora real en que se crearon.
--    Si se creó a las 12:00 hora de Chile y aquí dice 15:00, la zona de escritura fue UTC.
SELECT id, created_at, pg_typeof(created_at) AS tipo FROM checklists ORDER BY id DESC LIMIT 5;

-- 4) Para decidir la zona de origen de la migración: ¿a qué hora (hora de pared guardada)
--    se concentran los registros? Un uso en horario laboral chileno (8-19 h) que aparezca
--    entre 11 y 22 h indica UTC; si aparece entre 8 y 19 h, la zona de escritura era Santiago.
SELECT extract(hour FROM created_at)::int AS hora_guardada, count(*)
FROM checklists GROUP BY 1 ORDER BY 1;

-- 5) Checklists sin fotos (daño del bug de subida, desde el 24-oct-2026)
SELECT count(*) AS sin_fotos, min(c.created_at), max(c.created_at)
FROM checklists c LEFT JOIN checklist_images i ON i.checklist_id = c.id
WHERE i.id IS NULL;

-- 6) Patentes que no cumplen el formato normalizado (el backend nuevo las exige así)
SELECT id, patente FROM vehicles WHERE patente !~ '^([A-Z]{2}[0-9]{4}|[A-Z]{4}[0-9]{2}|[A-Z]{3}[0-9]{2})$';

-- 7) Choques al normalizar patentes (mismo valor tras quitar espacios/guiones y pasar a mayúsculas)
SELECT upper(regexp_replace(patente, '[\s-]', '', 'g')) AS normalizada, count(*)
FROM vehicles GROUP BY 1 HAVING count(*) > 1;
