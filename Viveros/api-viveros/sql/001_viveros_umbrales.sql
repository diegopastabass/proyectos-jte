-- Viveros · actualización 2026-11 (ver Viveros/PLAN_MEJORAS.md)
-- Ejecutar antes de desplegar la API. Es idempotente.

-- 1. Índice para "último dato por sensor" y para las series por rango.
--    CONCURRENTLY no bloquea las inserciones; no puede ir dentro de una transacción.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_viveros_tambo_sensor_time
    ON viveros_tambo (sensor_id, time DESC);

-- 2. Rangos permitidos por zona y variable. Única fuente para el dashboard, el
--    informe semanal y el monitor de alarmas (GET /config). Se editan desde el
--    panel de administración del dashboard (PATCH /config).
CREATE TABLE IF NOT EXISTS viveros_umbrales (
    zona        varchar(16) NOT NULL,   -- frio | calor | exterior
    variable    varchar(8)  NOT NULL,   -- t | hr | vpd
    min         double precision NULL,  -- NULL = sin límite inferior
    max         double precision NULL,  -- NULL = sin límite superior
    alerta      boolean NOT NULL DEFAULT false,  -- envía WhatsApp al salir del rango
    actualizado timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (zona, variable),
    CHECK (min IS NULL OR max IS NULL OR min < max)
);

-- Valores del .env del monitor al 2026-11-18 (confirmar con el cliente).
-- El VPD de la cámara de frío queda sin rango hasta confirmar si aplica.
INSERT INTO viveros_umbrales (zona, variable, min, max, alerta) VALUES
    ('frio',     't',   0,    5,    true),
    ('frio',     'hr',  80,   NULL, false),
    ('frio',     'vpd', NULL, NULL, false),
    ('calor',    't',   22,   30,   true),
    ('calor',    'hr',  80,   NULL, false),
    ('calor',    'vpd', 0.8,  1.2,  false),
    ('exterior', 't',   NULL, 23,   false),
    ('exterior', 'hr',  40,   NULL, false),
    ('exterior', 'vpd', NULL, 2,    true)
ON CONFLICT (zona, variable) DO NOTHING;

-- VPD ambiental (exterior): normal bajo 2 kPa; sobre eso avisa por WhatsApp con la T y HR del momento.
-- El INSERT anterior no pisa filas existentes, por eso se actualiza aparte.
UPDATE viveros_umbrales SET min = NULL, max = 2, alerta = true, actualizado = CURRENT_TIMESTAMP
 WHERE zona = 'exterior' AND variable = 'vpd';
