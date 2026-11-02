import { DataSource, EntityManager } from 'typeorm';

/** Registra una acción en `auditoria` dentro de la transacción en curso. */
export async function auditar(
  em: EntityManager,
  datos: {
    empresaId: number | null;
    usuarioId: number | null;
    accion: string;
    entidad: string;
    entidadId?: string | number | null;
    detalle?: Record<string, unknown>;
  },
): Promise<void> {
  await em.query(
    `INSERT INTO auditoria (empresa_id, usuario_id, accion, entidad, entidad_id, detalle)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      datos.empresaId,
      datos.usuarioId,
      datos.accion,
      datos.entidad,
      datos.entidadId === undefined || datos.entidadId === null
        ? null
        : String(datos.entidadId),
      JSON.stringify(datos.detalle ?? {}),
    ],
  );
}

/**
 * UPDATE ... RETURNING. Ojo: con UPDATE/DELETE, `em.query` de TypeORM devuelve `[filas, cantidad]`
 * y no las filas (con SELECT/INSERT sí devuelve las filas), así que se desarma aquí.
 */
export async function actualizarDevolviendo<T>(
  em: EntityManager,
  sql: string,
  parametros: unknown[],
): Promise<T[]> {
  const resultado: [T[], number] = await em.query(sql, parametros);
  const [filas] = resultado;
  return filas;
}

/** Recalcula saldos/estados con las funciones SQL del esquema. */
export async function recalcular(
  em: EntityManager,
  ids: { documentos?: number[]; movimientos?: number[] },
): Promise<void> {
  if (ids.documentos?.length)
    await em.query('SELECT recalcular_documentos($1::bigint[])', [
      ids.documentos,
    ]);
  if (ids.movimientos?.length)
    await em.query('SELECT recalcular_movimientos($1::bigint[])', [
      ids.movimientos,
    ]);
}

/** SELECT tipado (el `query` de TypeORM devuelve `any`). */
export async function consultar<T>(
  db: DataSource | EntityManager,
  sql: string,
  parametros: unknown[] = [],
): Promise<T[]> {
  const filas: T[] = await db.query(sql, parametros);
  return filas;
}
