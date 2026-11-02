-- =====================================================================
-- Conciliación bancaria: esquema inicial
--
-- Ejecutar sobre una BD vacía:
--   createdb conciliacion
--   psql -d conciliacion -v ON_ERROR_STOP=1 -f db/001_esquema.sql
--
-- Convenciones:
--   * Montos en bigint, en la unidad mínima de la moneda (CLP = peso).
--   * Movimientos con signo: + abono, − cargo.
--   * Montos de documentos tal como los informa el SII (siempre positivos);
--     el efecto de una nota de crédito se resuelve con nota_credito_aplicacion.
--   * Nada se borra: conciliaciones y aplicaciones se "deshacen" con
--     deshecha_en / deshecha_por, para mantener la trazabilidad.
--   * Los campos de estado se validan con CHECK (no ENUM) para poder
--     agregar valores sin migraciones complicadas.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Usuarios y empresas
-- ---------------------------------------------------------------------

CREATE TABLE usuario (
    id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email           text        NOT NULL,
    hash_password   text        NOT NULL,
    nombre          text        NOT NULL,
    es_admin        boolean     NOT NULL DEFAULT false,   -- admin global: crea usuarios y empresas
    activo          boolean     NOT NULL DEFAULT true,
    creado_en       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX usuario_email_uq ON usuario (lower(email));

CREATE TABLE empresa (
    id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    rut             text        NOT NULL UNIQUE,          -- normalizado: 76907914-9
    razon_social    text        NOT NULL,
    creado_en       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE usuario_empresa (
    usuario_id      integer NOT NULL REFERENCES usuario (id),
    empresa_id      integer NOT NULL REFERENCES empresa (id),
    rol             text    NOT NULL CHECK (rol IN ('admin', 'operador', 'lector')),
    PRIMARY KEY (usuario_id, empresa_id)
);

CREATE TABLE cuenta_bancaria (
    id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id      integer NOT NULL REFERENCES empresa (id),
    banco           text    NOT NULL CHECK (banco IN ('bancoestado', 'banco_chile')),
    numero          text    NOT NULL,
    alias           text,
    moneda          text    NOT NULL DEFAULT 'CLP' CHECK (moneda IN ('CLP', 'USD')),
    activa          boolean NOT NULL DEFAULT true,
    creado_en       timestamptz NOT NULL DEFAULT now(),
    UNIQUE (empresa_id, banco, numero)
);

-- Clientes, proveedores, la propia empresa (traspasos) y personas (retiros, sueldos).
CREATE TABLE contraparte (
    id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id      integer NOT NULL REFERENCES empresa (id),
    rut             text,                                 -- puede faltar en personas sin RUT conocido
    nombre          text    NOT NULL,
    tipo            text    NOT NULL CHECK (tipo IN ('cliente', 'proveedor', 'cliente_proveedor', 'propia', 'persona', 'otro')),
    creado_en       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX contraparte_rut_uq ON contraparte (empresa_id, rut) WHERE rut IS NOT NULL;

-- Lo que el banco escribe en la glosa para una contraparte. Las cartolas de BancoEstado
-- truncan el nombre (ej. "COMITE DE AGUA POTABLE RANGU"), así que el sistema aprende la
-- relación texto → contraparte a medida que el usuario confirma conciliaciones.
CREATE TABLE contraparte_alias (
    id                  integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id          integer NOT NULL REFERENCES empresa (id),
    contraparte_id      integer NOT NULL REFERENCES contraparte (id),
    patron              text    NOT NULL,                 -- texto de contraparte normalizado
    veces_confirmado    integer NOT NULL DEFAULT 1,
    creado_en           timestamptz NOT NULL DEFAULT now(),
    UNIQUE (empresa_id, patron, contraparte_id)
);

CREATE TABLE categoria (
    id              integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id      integer NOT NULL REFERENCES empresa (id),
    nombre          text    NOT NULL,
    tipo            text    NOT NULL CHECK (tipo IN ('ingreso', 'gasto', 'traspaso', 'retiro', 'impuesto', 'otro')),
    activa          boolean NOT NULL DEFAULT true,
    UNIQUE (empresa_id, nombre)
);

-- ---------------------------------------------------------------------
-- Importaciones
-- ---------------------------------------------------------------------

CREATE TABLE importacion (
    id                  integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id          integer NOT NULL REFERENCES empresa (id),
    cuenta_id           integer REFERENCES cuenta_bancaria (id),   -- solo cartolas
    tipo                text    NOT NULL CHECK (tipo IN ('cartola', 'rcv_compra', 'rcv_venta')),
    lector              text    NOT NULL,                 -- ej. 'bancoestado_xlsx', 'sii_rcv_csv'
    archivo_nombre      text    NOT NULL,
    archivo_sha256      text    NOT NULL,
    periodo_desde       date,
    periodo_hasta       date,
    n_cartola           integer,                          -- correlativo del banco, para detectar cartolas faltantes
    saldo_inicial       bigint,
    saldo_final         bigint,
    filas_leidas        integer NOT NULL DEFAULT 0,
    filas_nuevas        integer NOT NULL DEFAULT 0,
    filas_duplicadas    integer NOT NULL DEFAULT 0,
    advertencias        jsonb   NOT NULL DEFAULT '[]',
    usuario_id          integer NOT NULL REFERENCES usuario (id),
    creado_en           timestamptz NOT NULL DEFAULT now(),
    UNIQUE (empresa_id, archivo_sha256),
    CHECK ((tipo = 'cartola') = (cuenta_id IS NOT NULL))
);

-- ---------------------------------------------------------------------
-- Movimientos bancarios
-- ---------------------------------------------------------------------

CREATE TABLE movimiento (
    id                  bigint  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id          integer NOT NULL REFERENCES empresa (id),
    cuenta_id           integer NOT NULL REFERENCES cuenta_bancaria (id),
    importacion_id      integer NOT NULL REFERENCES importacion (id),
    fecha               date    NOT NULL,
    orden               integer NOT NULL,                 -- posición en la cartola (mantiene el orden del banco dentro del día)
    monto               bigint  NOT NULL CHECK (monto <> 0),
    saldo               bigint,                           -- saldo informado por el banco después del movimiento
    glosa               text    NOT NULL,
    glosa_normalizada   text    NOT NULL,
    n_operacion         text,
    sucursal            text,
    contraparte_texto   text,                             -- nombre extraído de la glosa (puede venir truncado)
    rut_contraparte     text,                             -- solo si la glosa trae un RUT válido
    contraparte_id      integer REFERENCES contraparte (id),
    ignorado            boolean NOT NULL DEFAULT false,   -- excluido de la conciliación a propósito
    monto_conciliado    bigint  NOT NULL DEFAULT 0 CHECK (monto_conciliado >= 0),
    estado              text    NOT NULL DEFAULT 'pendiente'
                                CHECK (estado IN ('pendiente', 'parcial', 'conciliado', 'ignorado')),
    nota                text,
    hash_dedup          text    NOT NULL,
    creado_en           timestamptz NOT NULL DEFAULT now(),
    UNIQUE (cuenta_id, hash_dedup),
    CHECK (monto_conciliado <= abs(monto))
);
CREATE INDEX movimiento_empresa_estado_idx ON movimiento (empresa_id, estado, fecha);
CREATE INDEX movimiento_cuenta_fecha_idx   ON movimiento (cuenta_id, fecha, orden);
CREATE INDEX movimiento_contraparte_idx    ON movimiento (empresa_id, contraparte_id);

-- ---------------------------------------------------------------------
-- Documentos tributarios (RCV)
-- ---------------------------------------------------------------------

CREATE TABLE documento (
    id                  bigint  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id          integer NOT NULL REFERENCES empresa (id),
    importacion_id      integer REFERENCES importacion (id),   -- NULL si se ingresó a mano
    direccion           text    NOT NULL CHECK (direccion IN ('emitido', 'recibido')),  -- venta | compra
    tipo_dte            smallint NOT NULL,                -- 33, 34, 46, 56, 61, ...
    folio               bigint  NOT NULL,
    rut_contraparte     text    NOT NULL,
    razon_social        text    NOT NULL,
    contraparte_id      integer REFERENCES contraparte (id),
    fecha_emision       date    NOT NULL,
    fecha_recepcion     timestamptz,
    monto_exento        bigint  NOT NULL DEFAULT 0,
    monto_neto          bigint  NOT NULL DEFAULT 0,
    monto_iva           bigint  NOT NULL DEFAULT 0,
    monto_total         bigint  NOT NULL CHECK (monto_total >= 0),
    ref_tipo_dte        smallint,                         -- documento que referencia (notas de crédito/débito de venta)
    ref_folio           bigint,
    saldo_pendiente     bigint  NOT NULL CHECK (saldo_pendiente >= 0),
    estado              text    NOT NULL DEFAULT 'pendiente'
                                CHECK (estado IN ('pendiente', 'parcial', 'pagado', 'anulado')),
    creado_en           timestamptz NOT NULL DEFAULT now(),
    UNIQUE (empresa_id, direccion, rut_contraparte, tipo_dte, folio),
    CHECK (saldo_pendiente <= monto_total)
);
CREATE INDEX documento_empresa_estado_idx ON documento (empresa_id, direccion, estado, fecha_emision);
CREATE INDEX documento_rut_idx            ON documento (empresa_id, rut_contraparte);
CREATE INDEX documento_monto_idx          ON documento (empresa_id, saldo_pendiente) WHERE saldo_pendiente > 0;

-- Una nota de crédito (61) rebaja el saldo de la factura que referencia.
-- En ventas el RCV trae la referencia y se aplica sola; en compras se aplica a mano.
CREATE TABLE nota_credito_aplicacion (
    id                  integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id          integer NOT NULL REFERENCES empresa (id),
    nota_credito_id     bigint  NOT NULL REFERENCES documento (id),
    documento_id        bigint  NOT NULL REFERENCES documento (id),
    monto               bigint  NOT NULL CHECK (monto > 0),
    origen              text    NOT NULL CHECK (origen IN ('auto', 'manual')),
    creado_por          integer REFERENCES usuario (id),  -- NULL si origen = 'auto'
    creado_en           timestamptz NOT NULL DEFAULT now(),
    deshecha_en         timestamptz,
    deshecha_por        integer REFERENCES usuario (id),
    CHECK (nota_credito_id <> documento_id)
);
CREATE INDEX nca_nota_idx      ON nota_credito_aplicacion (nota_credito_id) WHERE deshecha_en IS NULL;
CREATE INDEX nca_documento_idx ON nota_credito_aplicacion (documento_id)    WHERE deshecha_en IS NULL;

-- ---------------------------------------------------------------------
-- Conciliación
-- ---------------------------------------------------------------------

CREATE TABLE conciliacion (
    id                  bigint  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id          integer NOT NULL REFERENCES empresa (id),
    origen              text    NOT NULL CHECK (origen IN ('auto', 'regla', 'manual')),
    score               numeric(4, 3),                    -- confianza del motor (NULL si es manual)
    nota                text,
    creado_por          integer REFERENCES usuario (id),  -- NULL si la creó el motor sin intervención
    creado_en           timestamptz NOT NULL DEFAULT now(),
    deshecha_en         timestamptz,
    deshecha_por        integer REFERENCES usuario (id)
);
CREATE INDEX conciliacion_empresa_idx ON conciliacion (empresa_id, creado_en);

-- Cada línea aplica parte de un movimiento a un documento o a una categoría
-- (gastos sin documento: comisiones, retiros, traspasos entre cuentas propias).
-- N:M: un pago puede cubrir varias facturas y una factura pagarse en varios abonos.
CREATE TABLE conciliacion_linea (
    id                  bigint  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conciliacion_id     bigint  NOT NULL REFERENCES conciliacion (id),
    movimiento_id       bigint  NOT NULL REFERENCES movimiento (id),
    documento_id        bigint  REFERENCES documento (id),
    categoria_id        integer REFERENCES categoria (id),
    monto_aplicado      bigint  NOT NULL CHECK (monto_aplicado > 0),   -- valor absoluto
    CHECK ((documento_id IS NULL) <> (categoria_id IS NULL))
);
CREATE INDEX cl_conciliacion_idx ON conciliacion_linea (conciliacion_id);
CREATE INDEX cl_movimiento_idx   ON conciliacion_linea (movimiento_id);
CREATE INDEX cl_documento_idx    ON conciliacion_linea (documento_id) WHERE documento_id IS NOT NULL;

-- Reglas del usuario (fase 2). condicion: {glosa_contiene, rut, monto_min, monto_max, signo, cuenta_id}
-- accion: {categoria_id} | {contraparte_id} | {ignorar: true}
CREATE TABLE regla (
    id                  integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id          integer NOT NULL REFERENCES empresa (id),
    nombre              text    NOT NULL,
    prioridad           integer NOT NULL DEFAULT 100,
    activa              boolean NOT NULL DEFAULT true,
    condicion           jsonb   NOT NULL,
    accion              jsonb   NOT NULL,
    creado_en           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE auditoria (
    id                  bigint  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    empresa_id          integer REFERENCES empresa (id),
    usuario_id          integer REFERENCES usuario (id),
    accion              text    NOT NULL,                 -- ej. 'conciliacion.crear', 'importacion.crear'
    entidad             text    NOT NULL,
    entidad_id          text,
    detalle             jsonb   NOT NULL DEFAULT '{}',
    creado_en           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auditoria_empresa_idx ON auditoria (empresa_id, creado_en);

-- ---------------------------------------------------------------------
-- Recalcular saldos y estados (los llama la API dentro de cada transacción)
-- ---------------------------------------------------------------------

-- Saldo de un documento = total − notas de crédito aplicadas − montos conciliados.
-- Para una nota de crédito el "saldo" es el crédito que aún no se ha aplicado/reembolsado.
CREATE FUNCTION recalcular_documentos(p_ids bigint[]) RETURNS void
LANGUAGE sql AS $$
    UPDATE documento d
       SET saldo_pendiente = d.monto_total - x.rebajado,
           estado = CASE
                        WHEN d.estado = 'anulado'            THEN 'anulado'
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
                              WHERE c.deshecha_en IS NULL AND l.documento_id = doc.id), 0) AS rebajado
              FROM documento doc
             WHERE doc.id = ANY (p_ids)
           ) x
     WHERE d.id = x.id;
$$;

CREATE FUNCTION recalcular_movimientos(p_ids bigint[]) RETURNS void
LANGUAGE sql AS $$
    UPDATE movimiento m
       SET monto_conciliado = x.conciliado,
           estado = CASE
                        WHEN m.ignorado                 THEN 'ignorado'
                        WHEN x.conciliado = abs(m.monto) THEN 'conciliado'
                        WHEN x.conciliado > 0           THEN 'parcial'
                        ELSE 'pendiente'
                    END
      FROM (
            SELECT mov.id,
                   COALESCE((SELECT sum(l.monto_aplicado) FROM conciliacion_linea l
                               JOIN conciliacion c ON c.id = l.conciliacion_id
                              WHERE c.deshecha_en IS NULL AND l.movimiento_id = mov.id), 0) AS conciliado
              FROM movimiento mov
             WHERE mov.id = ANY (p_ids)
           ) x
     WHERE m.id = x.id;
$$;

COMMIT;
