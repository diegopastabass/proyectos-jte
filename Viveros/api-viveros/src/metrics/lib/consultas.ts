import type { Repository } from 'typeorm';
import type { Metric } from '../models/metric.entity';
import { valorSql } from '../viveros.config';

export interface FilaSensor {
  sensor_id: string;
  value: number;
  time: Date;
}

/**
 * Últimas `limite` lecturas de cada sensor, en orden cronológico. Una consulta por
 * sensor con `$1` sin tipo: Postgres lo convierte al tipo real de `sensor_id`, que en
 * producción es numérico aunque la entidad diga varchar (comparar con un `text[]`
 * explícito da el error 42883). Cada consulta usa el índice (sensor_id, time).
 */
export async function ultimasPorSensor(
  repo: Repository<Metric>,
  sensores: string[],
  limite = 1,
): Promise<FilaSensor[]> {
  const n = Math.max(1, Math.floor(limite));
  const partes = await Promise.all(
    sensores.map(async (id) => {
      const filas: { value: number; time: Date }[] = await repo.query(
        `SELECT (${valorSql()})::float8 AS value,
                time AT TIME ZONE 'America/Santiago' AS time
           FROM viveros_tambo
          WHERE sensor_id = $1
          ORDER BY time DESC
          LIMIT ${n}`,
        [id],
      );
      return filas
        .reverse()
        .map((f) => ({ sensor_id: id, value: Number(f.value), time: f.time }));
    }),
  );
  return partes.flat();
}
