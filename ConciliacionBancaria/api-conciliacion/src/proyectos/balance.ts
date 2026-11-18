import { DataSource, EntityManager } from 'typeorm';
import { consultar } from '../common/auditoria';

/**
 * Balance de un proyecto (centro de costo).
 *
 * - Documentos asignados: cuentan por su total e IVA; las notas de crédito restan.
 * - Movimientos asignados: cuentan solo por la parte que NO se concilió con un documento
 *   (gastos con boleta, peajes, comisiones, lo que aún no se concilia). Lo pagado con
 *   factura ya lo cuenta la factura, si está en el proyecto.
 * - IVA de los movimientos: el de sus comprobantes. El de una factura es crédito fiscal;
 *   el de una boleta no se recupera, así que queda como costo.
 */
export interface BalanceProyecto {
  ingresos: { neto: number; iva: number; total: number };
  gastos: {
    /** Costo sin el IVA recuperable (el IVA de boletas queda dentro). */
    neto: number;
    ivaCredito: number;
    /** IVA pagado en boletas: no da crédito fiscal. */
    ivaBoletas: number;
    total: number;
  };
  /** Ingresos netos − gastos netos. */
  resultado: number;
  iva: {
    debito: number;
    credito: number;
    /** Débito − crédito: positivo = IVA a pagar por el proyecto. */
    saldo: number;
  };
  porCobrar: number;
  porPagar: number;
  documentos: number;
  movimientos: number;
}

export interface FiltroBalance {
  proyectoIds?: number[];
  desde?: string;
  hasta?: string;
}

export function balanceVacio(): BalanceProyecto {
  return {
    ingresos: { neto: 0, iva: 0, total: 0 },
    gastos: { neto: 0, ivaCredito: 0, ivaBoletas: 0, total: 0 },
    resultado: 0,
    iva: { debito: 0, credito: 0, saldo: 0 },
    porCobrar: 0,
    porPagar: 0,
    documentos: 0,
    movimientos: 0,
  };
}

/** Parte de cada movimiento que no está aplicada a documentos, con el IVA de sus comprobantes. */
export const SQL_MOVIMIENTOS_SIN_DOCUMENTO = `
  SELECT m.id, m.proyecto_id, m.fecha, m.monto,
         abs(m.monto) - COALESCE(dl.con_documento, 0) AS sin_documento,
         COALESCE(k.iva_factura, 0) AS iva_factura,
         COALESCE(k.iva_boleta, 0) AS iva_boleta
    FROM movimiento m
    LEFT JOIN LATERAL (
         SELECT sum(l.monto_aplicado) AS con_documento
           FROM conciliacion_linea l
           JOIN conciliacion c ON c.id = l.conciliacion_id AND c.deshecha_en IS NULL
          WHERE l.movimiento_id = m.id AND l.documento_id IS NOT NULL) dl ON true
    LEFT JOIN LATERAL (
         SELECT sum(monto_iva) FILTER (WHERE tipo = 'factura') AS iva_factura,
                sum(monto_iva) FILTER (WHERE tipo = 'boleta') AS iva_boleta
           FROM comprobante
          WHERE movimiento_id = m.id AND eliminado_en IS NULL) k ON true
   WHERE NOT m.ignorado`;

/** Balance de cada proyecto de la empresa (los que no tienen nada no aparecen en el Map). */
export async function calcularBalances(
  db: DataSource | EntityManager,
  empresaId: number,
  f: FiltroBalance = {},
): Promise<Map<number, BalanceProyecto>> {
  const params = [
    empresaId,
    f.proyectoIds ?? null,
    f.desde ?? null,
    f.hasta ?? null,
  ];
  const [docs, movs] = await Promise.all([
    consultar<{
      proyectoId: number;
      direccion: 'emitido' | 'recibido';
      total: number;
      iva: number;
      saldo: number;
      n: number;
    }>(
      db,
      `SELECT d.proyecto_id AS "proyectoId", d.direccion,
              sum(CASE WHEN d.tipo_dte = 61 THEN -1 ELSE 1 END * d.monto_total)::float8 AS total,
              sum(CASE WHEN d.tipo_dte = 61 THEN -1 ELSE 1 END * d.monto_iva)::float8 AS iva,
              sum(CASE WHEN d.estado = 'excluido' THEN 0
                       ELSE CASE WHEN d.tipo_dte = 61 THEN -1 ELSE 1 END * d.saldo_pendiente END)::float8 AS saldo,
              count(*)::int AS n
         FROM documento d
        WHERE d.empresa_id = $1 AND d.proyecto_id IS NOT NULL AND d.estado <> 'anulado'
          AND ($2::int[] IS NULL OR d.proyecto_id = ANY($2))
          AND ($3::date IS NULL OR d.fecha_emision >= $3)
          AND ($4::date IS NULL OR d.fecha_emision <= $4)
        GROUP BY d.proyecto_id, d.direccion`,
      params,
    ),
    consultar<{
      proyectoId: number;
      abono: boolean;
      total: number;
      ivaFactura: number;
      ivaBoleta: number;
      n: number;
    }>(
      db,
      `SELECT x.proyecto_id AS "proyectoId", x.monto > 0 AS abono,
              sum(x.sin_documento)::float8 AS total,
              sum(LEAST(x.iva_factura, x.sin_documento))::float8 AS "ivaFactura",
              sum(LEAST(x.iva_boleta, x.sin_documento))::float8 AS "ivaBoleta",
              count(*)::int AS n
         FROM (${SQL_MOVIMIENTOS_SIN_DOCUMENTO}
                 AND m.empresa_id = $1 AND m.proyecto_id IS NOT NULL
                 AND ($2::int[] IS NULL OR m.proyecto_id = ANY($2))
                 AND ($3::date IS NULL OR m.fecha >= $3)
                 AND ($4::date IS NULL OR m.fecha <= $4)) x
        WHERE x.sin_documento > 0
        GROUP BY x.proyecto_id, x.monto > 0`,
      params,
    ),
  ]);

  const balances = new Map<number, BalanceProyecto>();
  const de = (id: number) => {
    let b = balances.get(id);
    if (!b) balances.set(id, (b = balanceVacio()));
    return b;
  };
  for (const d of docs) {
    const b = de(d.proyectoId);
    b.documentos += d.n;
    if (d.direccion === 'emitido') {
      b.ingresos.total += d.total;
      b.ingresos.iva += d.iva;
      b.porCobrar += d.saldo;
    } else {
      b.gastos.total += d.total;
      b.gastos.ivaCredito += d.iva;
      b.porPagar += d.saldo;
    }
  }
  for (const m of movs) {
    const b = de(m.proyectoId);
    b.movimientos += m.n;
    if (m.abono) {
      b.ingresos.total += m.total;
    } else {
      b.gastos.total += m.total;
      b.gastos.ivaCredito += m.ivaFactura;
      b.gastos.ivaBoletas += m.ivaBoleta;
    }
  }
  for (const b of balances.values()) {
    b.ingresos.neto = b.ingresos.total - b.ingresos.iva;
    b.gastos.neto = b.gastos.total - b.gastos.ivaCredito;
    b.resultado = b.ingresos.neto - b.gastos.neto;
    b.iva = {
      debito: b.ingresos.iva,
      credito: b.gastos.ivaCredito,
      saldo: b.ingresos.iva - b.gastos.ivaCredito,
    };
  }
  return balances;
}
