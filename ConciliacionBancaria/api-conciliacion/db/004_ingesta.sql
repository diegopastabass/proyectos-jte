-- =====================================================================
-- Ingesta automática del RCV y las cartolas a través de Emisso
--
--   psql -d conciliacion -v ON_ERROR_STOP=1 -f db/004_ingesta.sql
--
-- Las claves del SII y de los bancos NO se guardan aquí: la persona las entrega en la página
-- de Emisso (incrustada en Configuración → Conexiones) y quedan en su bóveda. Solo se guarda
-- el id de la conexión (conn_…), que no es secreto.
-- =====================================================================

BEGIN;

CREATE TABLE conexion_externa (
    id                integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id        integer NOT NULL REFERENCES empresa (id),
    proveedor         text    NOT NULL DEFAULT 'emisso' CHECK (proveedor IN ('emisso')),
    sistema           text    NOT NULL CHECK (sistema IN ('sii', 'banco_estado', 'bch_empresas')),
    connection_id     text    UNIQUE,                 -- conn_… ; NULL mientras no se completa el alta
    sesion_id         text,                           -- cs_… del último enlace emitido
    estado            text    NOT NULL DEFAULT 'pendiente'
                              CHECK (estado IN ('pendiente', 'activa', 'pausada')),
    empresa_rut       text,                           -- el RUT que ve Emisso en la conexión
    ultima_lectura_en timestamptz,
    ultimo_error      text,
    creado_en         timestamptz NOT NULL DEFAULT now(),
    actualizado_en    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (empresa_id, sistema)
);

-- Desde qué fecha manda la API en cada cuenta. Antes de esa fecha los movimientos entran por
-- archivo y desde esa fecha por la API: ningún día queda con las dos fuentes.
ALTER TABLE cuenta_bancaria ADD COLUMN api_desde date;

ALTER TABLE importacion ADD COLUMN origen text NOT NULL DEFAULT 'archivo'
    CHECK (origen IN ('archivo', 'api'));
-- Las lecturas programadas no tienen usuario.
ALTER TABLE importacion ALTER COLUMN usuario_id DROP NOT NULL;

-- Identidad del movimiento en el banco, cuando el banco la entrega (Banco de Chile).
ALTER TABLE movimiento ADD COLUMN id_externo text;
CREATE UNIQUE INDEX movimiento_id_externo_uq ON movimiento (cuenta_id, id_externo)
    WHERE id_externo IS NOT NULL;

COMMIT;
