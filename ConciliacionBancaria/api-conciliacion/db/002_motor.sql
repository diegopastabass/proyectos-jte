-- =====================================================================
-- Motor de sugerencias automáticas
--
--   psql -d conciliacion -v ON_ERROR_STOP=1 -f db/002_motor.sql
--
-- 1. Contrapartes que se concilian por categoría y no documento a documento
--    (COPEC → Combustible, la propia empresa → Traspaso, el dueño → Retiro).
--    Sus documentos quedan en estado 'excluido': no aparecen como deuda por pagar/cobrar.
-- 2. Tabla de sugerencias del motor (pendientes de revisión, aceptadas o rechazadas).
-- 3. Formato de las reglas del usuario.
-- =====================================================================

BEGIN;

ALTER TABLE contraparte ADD COLUMN categoria_id integer REFERENCES categoria (id);
COMMENT ON COLUMN contraparte.categoria_id IS
    'Si no es NULL, los movimientos de esta contraparte se concilian contra esta categoría y sus documentos quedan excluidos';

-- La propia empresa se concilia como traspaso entre cuentas propias.
UPDATE contraparte c
   SET categoria_id = (SELECT id FROM categoria
                        WHERE empresa_id = c.empresa_id AND tipo = 'traspaso' AND activa
                        ORDER BY id LIMIT 1)
 WHERE c.tipo = 'propia' AND c.categoria_id IS NULL;

ALTER TABLE documento DROP CONSTRAINT documento_estado_check;
ALTER TABLE documento ADD CONSTRAINT documento_estado_check
    CHECK (estado IN ('pendiente', 'parcial', 'pagado', 'anulado', 'excluido'));

CREATE OR REPLACE FUNCTION recalcular_documentos(p_ids bigint[]) RETURNS void
LANGUAGE sql AS $$
    UPDATE documento d
       SET saldo_pendiente = d.monto_total - x.rebajado,
           estado = CASE
                        WHEN d.estado = 'anulado'            THEN 'anulado'
                        WHEN x.excluido                      THEN 'excluido'
                        WHEN d.monto_total - x.rebajado = 0  THEN 'pagado'
                        WHEN x.rebajado > 0                  THEN 'parcial'
                        ELSE 'pendiente'
                    END
      FROM (
            SELECT doc.id,
                   COALESCE((SELECT sum(n.monto) FROM nota_credito_aplicacion n
                              WHERE n.deshecha_en IS NULL
                                AND (n.documento_id = doc.id OR n.nota_credito_id = doc.id)), 0)
                 + COALESCE((SELECT sum(l.monto_aplicado) FROM conciliacion_linea l
                               JOIN conciliacion c ON c.id = l.conciliacion_id
                              WHERE c.deshecha_en IS NULL AND l.documento_id = doc.id), 0) AS rebajado,
                   EXISTS (SELECT 1 FROM contraparte cp
                            WHERE cp.id = doc.contraparte_id AND cp.categoria_id IS NOT NULL) AS excluido
              FROM documento doc
             WHERE doc.id = ANY (p_ids)
           ) x
     WHERE d.id = x.id;
$$;

-- Documentos ya cargados de contrapartes que quedaron con categoría.
SELECT recalcular_documentos(array(
    SELECT d.id FROM documento d JOIN contraparte c ON c.id = d.contraparte_id WHERE c.categoria_id IS NOT NULL));

-- Reglas: condicion = {glosaContiene?, signo?: 'abono'|'cargo', montoMin?, montoMax?, cuentaId?}
--         accion    = {categoriaId} | {ignorar: true}
COMMENT ON COLUMN regla.condicion IS '{glosaContiene?, signo?: abono|cargo, montoMin?, montoMax?, cuentaId?} (montos en valor absoluto)';
COMMENT ON COLUMN regla.accion IS '{categoriaId} | {ignorar: true}';

CREATE TABLE sugerencia (
    id                  bigint  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id          integer NOT NULL REFERENCES empresa (id),
    movimiento_id       bigint  NOT NULL REFERENCES movimiento (id),
    nivel               text    NOT NULL,                 -- cómo se encontró: rut, alias, nombre, monto, categoria, combinacion
    score               numeric(4, 3) NOT NULL,
    motivo              text    NOT NULL,                 -- explicación legible para el usuario
    lineas              jsonb   NOT NULL,                 -- [{movimientoId, documentoId|categoriaId, monto}]
    alternativas        jsonb   NOT NULL DEFAULT '[]',    -- [{lineas, score, motivo}] cuando hay más de un candidato
    firma               text    NOT NULL,                 -- identifica la propuesta, para no repetir una rechazada
    estado              text    NOT NULL DEFAULT 'pendiente'
                                CHECK (estado IN ('pendiente', 'aceptada', 'rechazada', 'obsoleta')),
    conciliacion_id     bigint  REFERENCES conciliacion (id),
    creado_por          integer REFERENCES usuario (id),  -- quién ejecutó el motor
    creado_en           timestamptz NOT NULL DEFAULT now(),
    resuelta_por        integer REFERENCES usuario (id),
    resuelta_en         timestamptz
);
-- Una sola sugerencia pendiente por movimiento.
CREATE UNIQUE INDEX sugerencia_pendiente_uq ON sugerencia (movimiento_id) WHERE estado = 'pendiente';
CREATE INDEX sugerencia_empresa_idx ON sugerencia (empresa_id, estado, score DESC);
CREATE INDEX sugerencia_rechazada_idx ON sugerencia (movimiento_id, firma) WHERE estado = 'rechazada';

COMMIT;
