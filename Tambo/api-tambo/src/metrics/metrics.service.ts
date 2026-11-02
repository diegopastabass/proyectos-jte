import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository, Raw } from 'typeorm';
import { Telemetria } from './models/metrics.entity';
import { DateRangeDto } from './models/dto/date-range.dto';
import {
  CaudalQueryDto,
  DiarioQueryDto,
  NivelQueryDto,
} from './models/dto/sensor-query.dto';
import { MetricSnapshot, Metric } from './models/types';
import {
  ESTANQUES,
  Estanque,
  MT_NAME_DE,
  POZOS,
  Pozo,
  SENSORES,
  TOTALIZADOR_MT_NAME,
} from '../config/sensores.config';

/** Minutos de lecturas recientes con que se estima la tendencia del vaciado. */
const VENTANA_VACIADO_MIN = 20;

function mediana(valores: number[]): number {
  if (valores.length === 0) return NaN;
  const ordenados = [...valores].sort((a, b) => a - b);
  const medio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2
    ? ordenados[medio]
    : (ordenados[medio - 1] + ordenados[medio]) / 2;
}

/** Pendiente Theil-Sen: mediana de las pendientes entre todos los pares de puntos. */
function pendienteTheilSen(xs: number[], ys: number[]): number {
  const pendientes: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    for (let j = i + 1; j < xs.length; j++) {
      if (xs[j] !== xs[i]) pendientes.push((ys[j] - ys[i]) / (xs[j] - xs[i]));
    }
  }
  return mediana(pendientes);
}

/** mt_name del sensor que se sirve con ese nombre, o 503 si aún no tiene sensor. */
function mtNameDe(nombre: Pozo | Estanque): string {
  const mtName = MT_NAME_DE[nombre];
  if (!mtName)
    throw new ServiceUnavailableException(
      `${nombre} aún no tiene sensor configurado (falta su mt_name en sensores.config.ts)`,
    );
  return mtName;
}

function validarValor<T extends string>(
  valor: string | undefined,
  valoresPermitidos: readonly T[],
  nombre: string,
): T {
  if (!valor || !(valoresPermitidos as readonly string[]).includes(valor))
    throw new BadRequestException(
      `${nombre} inválido. Valores: ${valoresPermitidos.join(', ')}`,
    );
  return valor as T;
}

/** Fechas AAAA-MM-DD entre start y end, ambas incluidas. */
function diasEntre(start: string, end: string): string[] {
  const dias: string[] = [];
  const fin = new Date(`${end.slice(0, 10)}T00:00:00Z`);
  for (
    let cursor = new Date(`${start.slice(0, 10)}T00:00:00Z`);
    cursor <= fin;
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    dias.push(cursor.toISOString().slice(0, 10));
  }
  return dias;
}

function aMetrica(r: Telemetria): Metric {
  return {
    time: r.mt_time_2.toISOString(),
    value: Number(r.mt_value),
  };
}

interface FilaSnapshot {
  mt_name: string;
  mt_value: string;
  mt_time_2: Date;
}

interface FilaDiaria {
  dia: string;
  mt_value: string;
}

interface FilaTotalizador {
  dia: string;
  valor: string | null;
}

interface FilaHorometro {
  dia: string;
  minutos: string;
  muestras: string;
}

@Injectable()
export class SsrTamboService {
  private readonly logger = new Logger(SsrTamboService.name);

  constructor(
    @InjectRepository(Telemetria)
    private repo: Repository<Telemetria>,
  ) {}

  private normalizeDateRange(
    dto: DateRangeDto,
  ): { start: Date; end: Date } | null {
    if (!dto.start || !dto.end) return null;
    const start = new Date(`${dto.start.slice(0, 10)}T00:00:00Z`);
    const end = new Date(`${dto.end.slice(0, 10)}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end };
  }

  private validarRangoDiario(dto: DiarioQueryDto): string[] {
    if (!dto.start || !dto.end)
      throw new BadRequestException('start y end son obligatorios');
    const dias = diasEntre(dto.start, dto.end);
    if (dias.length === 0)
      throw new BadRequestException(
        'Rango inválido: usar start y end en formato AAAA-MM-DD, con start <= end',
      );
    return dias;
  }

  async getSnapshot() {
    try {
      const filas = await this.repo.query<FilaSnapshot[]>(
        `SELECT DISTINCT ON (mt_name) mt_name, mt_value, mt_time_2
         FROM ssr_tambo
         WHERE mt_name = ANY($1)
         ORDER BY mt_name, mt_time_2 DESC`,
        [Object.keys(SENSORES)],
      );

      const snapshot: MetricSnapshot = {};
      for (const fila of filas) {
        snapshot[SENSORES[fila.mt_name]] = {
          value: Number(fila.mt_value),
          time: new Date(fila.mt_time_2).toISOString(),
        };
      }

      const tiempoVaciado = {} as Record<
        Estanque,
        { tiempo: number; formatted: string }
      >;
      for (const estanque of ESTANQUES) {
        tiempoVaciado[estanque] = await this.calcularTiempoVaciado(
          mtNameDe(estanque),
        );
      }

      return { snapshot, tiempo_vaciado: tiempoVaciado };
    } catch (error) {
      this.logger.error('Error en getSnapshot', error);
      throw error;
    }
  }

  /**
   * Tiempo de vaciado a partir de la tendencia de las lecturas de los últimos
   * VENTANA_VACIADO_MIN minutos. La pendiente es Theil-Sen (mediana de las
   * pendientes entre pares) y el nivel actual sale de la mediana del intercepto:
   * un dato atípico no cambia el resultado. Si la pendiente no es negativa, el
   * estanque no se está vaciando.
   */
  private async calcularTiempoVaciado(mtName: string) {
    const ultima = await this.repo.find({
      where: { mt_name: mtName },
      order: { mt_time_2: 'DESC' },
      take: 1,
    });
    if (ultima.length === 0) return { tiempo: 0, formatted: 'Llenando...' };

    const desde = new Date(
      ultima[0].mt_time_2.getTime() - VENTANA_VACIADO_MIN * 60_000,
    );
    const ventana = await this.repo.find({
      where: { mt_name: mtName, mt_time_2: MoreThanOrEqual(desde) },
      order: { mt_time_2: 'ASC' },
    });
    if (ventana.length < 2) return { tiempo: 0, formatted: 'Llenando...' };

    const xs = ventana.map((r) => r.mt_time_2.getTime() / 1000);
    const ys = ventana.map((r) => Number(r.mt_value));
    const pendiente = pendienteTheilSen(xs, ys); // nivel por segundo
    if (!(pendiente < 0)) return { tiempo: 0, formatted: 'Llenando...' };

    const intercepto = mediana(ys.map((y, i) => y - pendiente * xs[i]));
    const nivel_actual = intercepto + pendiente * xs[xs.length - 1];
    const tasa_vaciado = -pendiente;
    const tiempo = Math.round(nivel_actual / tasa_vaciado);
    const h = Math.floor(tiempo / 3600);
    const m = Math.floor((tiempo % 3600) / 60);
    const s = tiempo % 60;
    return {
      tiempo,
      formatted: `${h.toString().padStart(2, '0')} h ${m.toString().padStart(2, '0')} m ${s.toString().padStart(2, '0')} s`,
    };
  }

  /** Serie cruda de un sensor: por rango de fechas, o los últimos `limit` registros. */
  private async serie(mtName: string, dto: DateRangeDto): Promise<Metric[]> {
    const rango = this.normalizeDateRange(dto);
    if (rango) {
      const results = await this.repo.find({
        where: {
          mt_name: mtName,
          mt_time_2: Raw((a) => `${a} >= :start AND ${a} < :end`, {
            start: rango.start,
            end: rango.end,
          }),
        },
        order: { mt_time_2: 'ASC' },
      });
      return results.map(aMetrica);
    }
    const results = await this.repo.find({
      where: { mt_name: mtName },
      order: { mt_time_2: 'DESC' },
      take: dto.limit ? Number(dto.limit) : 100,
    });
    return results.reverse().map(aMetrica);
  }

  /**
   * Valor diario de cada día del rango. Los días pasados ya guardados se leen de
   * ssr_tambo_daily_metrics. Los que faltan y el día de hoy se calculan y se guardan.
   */
  private async diario(
    clave: string,
    dias: string[],
    calcular: (pendientes: string[]) => Promise<Map<string, number>>,
  ): Promise<Metric[]> {
    const cacheadas = await this.repo.query<FilaDiaria[]>(
      `SELECT mt_day::TEXT AS dia, mt_value
       FROM ssr_tambo_daily_metrics
       WHERE mt_name = $1 AND mt_day BETWEEN $2 AND $3`,
      [clave, dias[0], dias[dias.length - 1]],
    );
    const valores = new Map<string, number>(
      cacheadas.map((fila) => [fila.dia, Number(fila.mt_value)]),
    );

    const hoy = new Date().toISOString().split('T')[0];
    const pendientes = dias.filter((dia) => !valores.has(dia) || dia === hoy);
    if (pendientes.length > 0) {
      const calculadas = await calcular(pendientes);
      for (const dia of pendientes) {
        if (!calculadas.has(dia)) continue;
        const valor = calculadas.get(dia)!;
        await this.repo.query(
          `INSERT INTO ssr_tambo_daily_metrics (mt_name, mt_day, mt_value)
           VALUES ($1, $2, $3)
           ON CONFLICT (mt_name, mt_day) DO UPDATE SET mt_value = EXCLUDED.mt_value`,
          [clave, dia, valor],
        );
        valores.set(dia, valor);
      }
    }

    return dias
      .filter((dia) => valores.has(dia))
      .map((dia) => ({ time: dia, value: valores.get(dia)! }));
  }

  /** Último valor del día menos el primero: consumo diario del totalizador. */
  private async totalizadorPorDia(
    mtName: string,
    pendientes: string[],
  ): Promise<Map<string, number>> {
    const filas = await this.repo.query<FilaTotalizador[]>(
      `WITH bounds AS (
         SELECT mt_time_2::DATE AS dia, MIN(mt_time_2) AS first_ts, MAX(mt_time_2) AS last_ts
         FROM ssr_tambo
         WHERE mt_name = $1
           AND mt_time_2 >= $2::DATE
           AND mt_time_2 < $3::DATE + INTERVAL '1 day'
         GROUP BY mt_time_2::DATE
       )
       SELECT b.dia::TEXT AS dia,
              MAX(CAST(s_last.mt_value AS NUMERIC(30,6))) - MIN(CAST(s_first.mt_value AS NUMERIC(30,6))) AS valor
       FROM bounds b
       JOIN ssr_tambo s_first ON s_first.mt_name = $1 AND s_first.mt_time_2 = b.first_ts
       JOIN ssr_tambo s_last ON s_last.mt_name = $1 AND s_last.mt_time_2 = b.last_ts
       GROUP BY b.dia`,
      [mtName, pendientes[0], pendientes[pendientes.length - 1]],
    );
    return new Map(filas.map((fila) => [fila.dia, Number(fila.valor ?? 0)]));
  }

  /**
   * Minutos por día con el pozo encendido. El caudal es 0 con la bomba apagada y
   * mayor a 0 con la bomba encendida. Cada muestra vale hasta la siguiente, y los
   * tramos que cruzan medianoche se reparten entre los dos días. Se recalcula desde
   * los datos crudos, así que volver a consultar no suma minutos dos veces.
   */
  private async horometroPorDia(
    mtName: string,
    pendientes: string[],
  ): Promise<Map<string, number>> {
    const filas = await this.repo.query<FilaHorometro[]>(
      `WITH muestras AS (
         SELECT mt_time_2 AS ts,
                CAST(mt_value AS NUMERIC) AS valor,
                LEAD(mt_time_2) OVER (ORDER BY mt_time_2) AS siguiente
         FROM ssr_tambo
         WHERE mt_name = $1
           AND mt_time_2 >= $2::DATE - INTERVAL '1 day'
           AND mt_time_2 < $3::DATE + INTERVAL '2 days'
       ),
       dias AS (
         SELECT d::DATE AS inicio FROM unnest($4::DATE[]) AS d
       )
       SELECT dias.inicio::TEXT AS dia,
              ROUND(
                CAST(COALESCE(SUM(EXTRACT(EPOCH FROM (
                  LEAST(m.siguiente, dias.inicio::TIMESTAMP + INTERVAL '1 day')
                  - GREATEST(m.ts, dias.inicio::TIMESTAMP)
                ))) FILTER (WHERE m.valor > 0), 0) AS NUMERIC) / 60,
                2) AS minutos,
              COUNT(m.ts) AS muestras
       FROM dias
       LEFT JOIN muestras m
         ON m.siguiente > dias.inicio::TIMESTAMP
        AND m.ts < dias.inicio::TIMESTAMP + INTERVAL '1 day'
       GROUP BY dias.inicio`,
      [mtName, pendientes[0], pendientes[pendientes.length - 1], pendientes],
    );
    const resultado = new Map<string, number>();
    for (const fila of filas) {
      if (Number(fila.muestras) > 0)
        resultado.set(fila.dia, Number(fila.minutos));
    }
    return resultado;
  }

  async getTotalizador(dto: DiarioQueryDto): Promise<Metric[]> {
    try {
      const pozo = validarValor(dto.pozo, POZOS, 'pozo');
      const dias = this.validarRangoDiario(dto);
      const mtName = TOTALIZADOR_MT_NAME[pozo];
      if (!mtName)
        throw new ServiceUnavailableException(
          `Totalizador de ${pozo} aún no configurado (falta su mt_name en sensores.config.ts)`,
        );
      return await this.diario(`totalizador_${mtName}`, dias, (pendientes) =>
        this.totalizadorPorDia(mtName, pendientes),
      );
    } catch (error) {
      this.logger.error('Error en getTotalizador', error);
      throw error;
    }
  }

  async getHorometro(dto: DiarioQueryDto): Promise<Metric[]> {
    try {
      const pozo = validarValor(dto.pozo, POZOS, 'pozo');
      const dias = this.validarRangoDiario(dto);
      const mtName = mtNameDe(pozo);
      return await this.diario(`horometro_${mtName}`, dias, (pendientes) =>
        this.horometroPorDia(mtName, pendientes),
      );
    } catch (error) {
      this.logger.error('Error en getHorometro', error);
      throw error;
    }
  }

  async getNivel(dto: NivelQueryDto): Promise<Metric[]> {
    try {
      const estanque = validarValor(dto.estanque, ESTANQUES, 'estanque');
      return await this.serie(mtNameDe(estanque), dto);
    } catch (error) {
      this.logger.error('Error en getNivel', error);
      throw error;
    }
  }

  async getCaudal(dto: CaudalQueryDto): Promise<Metric[]> {
    try {
      const pozo = validarValor(dto.pozo, POZOS, 'pozo');
      return await this.serie(mtNameDe(pozo), dto);
    } catch (error) {
      this.logger.error('Error en getCaudal', error);
      throw error;
    }
  }
}
