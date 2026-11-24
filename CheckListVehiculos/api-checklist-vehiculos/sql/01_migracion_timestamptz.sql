-- MIGRACIÓN: columnas de fecha a timestamptz + normalización de patentes.
-- Ejecutar ANTES de desplegar el backend nuevo y con un respaldo hecho (pg_dump o snapshot de RDS).
-- El backend nuevo ya no usa synchronize, así que no cambia el esquema por su cuenta.
--
-- Defina las dos zonas de origen según el diagnóstico (00_diagnostico_zona_horaria.sql):
--   zona_defaults : zona de sesión con la que se evaluó DEFAULT now() al guardar (created_at/updated_at).
--                   Si SHOW timezone en la app daba UTC, use 'UTC'.
--   zona_error_log: zona del proceso Node al guardar error_log.timestamp (el driver pg envía las
--                   fechas en hora local del proceso). Normalmente 'America/Santiago'.

BEGIN;

DO $$
DECLARE
  zona_defaults  text := 'UTC';               -- <<< AJUSTAR
  zona_error_log text := 'America/Santiago';  -- <<< AJUSTAR
BEGIN
  -- Si alguna columna ya es timestamptz no se vuelve a convertir (el script se puede repetir).
  IF (SELECT data_type FROM information_schema.columns WHERE table_name='checklists' AND column_name='created_at') = 'timestamp without time zone' THEN
    EXECUTE format('ALTER TABLE checklists ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE %L', zona_defaults);
    EXECUTE format('ALTER TABLE checklists ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE %L', zona_defaults);
    EXECUTE format('ALTER TABLE checklist_images ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE %L', zona_defaults);
    EXECUTE format('ALTER TABLE users ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE %L', zona_defaults);
    EXECUTE format('ALTER TABLE users ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE %L', zona_defaults);
    EXECUTE format('ALTER TABLE vehicles ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE %L', zona_defaults);
    EXECUTE format('ALTER TABLE error_log ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE %L', zona_defaults);
    EXECUTE format('ALTER TABLE error_log ALTER COLUMN "timestamp" TYPE timestamptz USING "timestamp" AT TIME ZONE %L', zona_error_log);
  END IF;
END $$;

-- Las columnas conservan DEFAULT now(), que con timestamptz ya es el instante real.

-- Normalizar patentes (mayúsculas, sin espacios ni guiones). Falla por la restricción
-- UNIQUE si hay choques: revise la consulta 7 del diagnóstico antes.
UPDATE vehicles SET patente = upper(regexp_replace(patente, '[\s-]', '', 'g'))
WHERE patente <> upper(regexp_replace(patente, '[\s-]', '', 'g'));

-- Índices para el historial paginado y filtrado
CREATE INDEX IF NOT EXISTS idx_checklists_created_at ON checklists (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checklists_vehicle ON checklists (vehicle_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checklists_user ON checklists (user_id, created_at DESC);

COMMIT;

-- Verificación
SELECT table_name, column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND column_name IN ('created_at','updated_at','timestamp')
  AND table_name IN ('users','vehicles','checklists','checklist_images','error_log')
ORDER BY 1,2;
SELECT id, created_at, created_at AT TIME ZONE 'America/Santiago' AS hora_chile FROM checklists ORDER BY id DESC LIMIT 5;
