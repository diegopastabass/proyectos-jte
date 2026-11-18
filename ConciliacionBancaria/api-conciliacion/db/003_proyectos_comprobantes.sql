-- =====================================================================
-- Centros de costo / proyectos y comprobantes (fotos de boletas)
--
--   psql -d conciliacion -v ON_ERROR_STOP=1 -f db/003_proyectos_comprobantes.sql
--
-- 1. Proyecto (centro de costo): agrupa documentos y movimientos para sacar su
--    balance (ingresos, gastos, resultado e IVA).
--    * Un documento asignado cuenta por su neto e IVA (devengado).
--    * Un movimiento asignado cuenta solo por la parte que NO se concilió con un
--      documento (gastos con boleta, peajes, comisiones...): lo que se pagó con
--      factura ya lo cuenta la factura. Así no se cuenta dos veces.
-- 2. Comprobante: foto (cámara del celular o archivo del dispositivo) o PDF que respalda
--    un movimiento (la boleta del restaurante). La imagen se guarda en el disco del
--    servidor (COMPROBANTES_DIR); en la tabla solo quedan su id y su ruta.
-- =====================================================================

BEGIN;

CREATE TABLE proyecto (
    id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id      integer NOT NULL REFERENCES empresa (id),
    codigo          text,                                 -- opcional, ej. "OBR-2026-01"
    nombre          text    NOT NULL,
    descripcion     text,
    contraparte_id  integer REFERENCES contraparte (id),  -- cliente del proyecto, si tiene
    fecha_inicio    date,
    fecha_fin       date,
    presupuesto     bigint  CHECK (presupuesto >= 0),     -- gasto neto presupuestado
    activo          boolean NOT NULL DEFAULT true,
    creado_en       timestamptz NOT NULL DEFAULT now(),
    UNIQUE (empresa_id, nombre)
);
CREATE UNIQUE INDEX proyecto_codigo_uq ON proyecto (empresa_id, codigo) WHERE codigo IS NOT NULL;

ALTER TABLE movimiento ADD COLUMN proyecto_id integer REFERENCES proyecto (id);
ALTER TABLE documento  ADD COLUMN proyecto_id integer REFERENCES proyecto (id);
CREATE INDEX movimiento_proyecto_idx ON movimiento (proyecto_id) WHERE proyecto_id IS NOT NULL;
CREATE INDEX documento_proyecto_idx  ON documento  (proyecto_id) WHERE proyecto_id IS NOT NULL;

CREATE TABLE comprobante (
    id                  bigint  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id          integer NOT NULL REFERENCES empresa (id),
    movimiento_id       bigint  NOT NULL REFERENCES movimiento (id),
    -- boleta: el IVA va incluido y no da crédito fiscal; factura: el IVA es crédito fiscal.
    tipo                text    NOT NULL CHECK (tipo IN ('boleta', 'factura', 'otro')),
    fecha               date,
    monto_total         bigint  NOT NULL CHECK (monto_total > 0),
    monto_iva           bigint  NOT NULL DEFAULT 0,
    rut_emisor          text,
    razon_social        text,
    folio               text,
    descripcion         text,
    archivo_id          uuid    NOT NULL UNIQUE,          -- nombre con que se guardó (sin extensión)
    archivo_ruta        text    NOT NULL,                 -- ruta completa en el servidor
    conciliacion_id     bigint  REFERENCES conciliacion (id),  -- si se consolidó al subirlo
    creado_por          integer NOT NULL REFERENCES usuario (id),
    creado_en           timestamptz NOT NULL DEFAULT now(),
    eliminado_en        timestamptz,
    eliminado_por       integer REFERENCES usuario (id),
    CHECK (monto_iva >= 0 AND monto_iva <= monto_total)
);
CREATE INDEX comprobante_movimiento_idx ON comprobante (movimiento_id) WHERE eliminado_en IS NULL;

-- Categoría para el caso típico de boleta: comidas con clientes, colaciones en terreno.
INSERT INTO categoria (empresa_id, nombre, tipo)
SELECT id, 'Alimentación y representación', 'gasto' FROM empresa
ON CONFLICT (empresa_id, nombre) DO NOTHING;

COMMIT;
