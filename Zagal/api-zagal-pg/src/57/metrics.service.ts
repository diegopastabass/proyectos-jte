// 57/metrics.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Parc57Zagal } from './parc57.entity';
import { QueryCache } from '../common/query-cache';
import { rethrowDbError, todayInChile } from '../common/db-errors';
import {
  ZagalTables,
  dailySummarySql,
  latestAllValuesSql,
  latestValuesSql,
} from '../common/zagal-queries';

export interface LatestMetricResult {
  caudal: number;
  totalizador: number;
}

// Datos "en vivo": el frontend refresca cada 2 min, 30 s de caché basta
const LIVE_TTL = 30_000;
// Resumen que incluye hoy o ayer (aún puede cambiar)
const SUMMARY_OPEN_TTL = 60_000;
// Resumen de días ya cerrados
const SUMMARY_CLOSED_TTL = 15 * 60_000;

@Injectable()
export class MetricsService {
  constructor(
    @InjectRepository(Parc57Zagal)
    private readonly repo: Repository<Parc57Zagal>,
  ) {}

  private readonly cache = new QueryCache();

  private readonly tables: ZagalTables = {
    raw: 'parc_57_zagal',
    log: 'zagal_57_irrigation_log',
    prefix: 'PARC_57_ZAGAL--slave',
  };

  private sectorMap: { [key: string]: string } = {
    'PARC_57_ZAGAL--slave.sector1': 'NEC 4',
    'PARC_57_ZAGAL--slave.sector2': 'RICH LADY',
    'PARC_57_ZAGAL--slave.sector3': '303 NORTE',
    'PARC_57_ZAGAL--slave.sector4': '303 SUR',
    'PARC_57_ZAGAL--slave.sector5': 'RP',
    'PARC_57_ZAGAL--slave.sector6': 'PARC 54 SUR 1',
    'PARC_57_ZAGAL--slave.sector7': 'PARC 54 SUR 2',
    'PARC_57_ZAGAL--slave.sector8': 'PARC 54 NORTE',
    'PARC_57_ZAGAL--slave.sector9': 'PARC 52',
  };

  private sectorAreas: Record<string, number> = {
    'PARC_57_ZAGAL--slave.sector1': 45966.44,
    'PARC_57_ZAGAL--slave.sector2': 46353.54,
    'PARC_57_ZAGAL--slave.sector3': 38344.63,
    'PARC_57_ZAGAL--slave.sector4': 32509.61,
    'PARC_57_ZAGAL--slave.sector5': 13818.9,
    'PARC_57_ZAGAL--slave.sector6': 54194.63,
    'PARC_57_ZAGAL--slave.sector7': 61377.81,
    'PARC_57_ZAGAL--slave.sector8': 74784.69,
    'PARC_57_ZAGAL--slave.sector9': 87068.37,
  };

  private mapParcela(name: string): string {
    return this.sectorMap[name] || name;
  }

  async findLatest(): Promise<LatestMetricResult> {
    return this.cache.get('latest', LIVE_TTL, async () => {
      try {
        const rows = await this.repo.query(latestValuesSql(this.tables.raw), [
          [`${this.tables.prefix}.caudal`, `${this.tables.prefix}.totalizador`],
        ]);

        const result: LatestMetricResult = { caudal: 0, totalizador: 0 };

        for (const row of rows) {
          const value = Number(row.mt_value); // Convertir varchar a numero
          if (row.mt_name.includes('caudal')) result.caudal = value;
          if (row.mt_name.includes('totalizador'))
            result.totalizador = value / 10;
        }

        return result;
      } catch (error) {
        rethrowDbError(error, 'Error fetching latest metrics');
      }
    });
  }

  async activeSectors(): Promise<{ mt_name: string; is_active: number }[]> {
    return this.cache.get('sectors', LIVE_TTL, async () => {
      try {
        const rows = await this.repo.query(latestValuesSql(this.tables.raw), [
          Object.keys(this.sectorMap),
        ]);

        const statusMap: Record<string, number> = {};
        rows.forEach((row) => {
          // En Postgres comparamos string '1', no number 1
          statusMap[row.mt_name] = row.mt_value === '1' ? 1 : 0;
        });

        return Object.keys(this.sectorMap).map((key) => ({
          mt_name: this.sectorMap[key],
          is_active: statusMap[key] || 0,
        }));
      } catch (error) {
        rethrowDbError(error, 'Error fetching active sectors');
      }
    });
  }

  async findLatestByName(name: string): Promise<Parc57Zagal | null> {
    try {
      const metric = await this.repo.findOne({
        where: { mt_name: name },
        order: { mt_time_2: 'DESC' },
      });
      if (metric) metric.mt_name = this.mapParcela(metric.mt_name);
      return metric;
    } catch (error) {
      rethrowDbError(error, 'Error fetching latest metric by name');
    }
  }

  async findLatestForEachName(): Promise<{ [key: string]: number }> {
    return this.cache.get('latestAll', LIVE_TTL, async () => {
      try {
        const rows = await this.repo.query(latestAllValuesSql(this.tables.raw));

        const result: { [key: string]: number } = {};
        rows.forEach((row) => {
          result[this.mapParcela(row.mt_name)] = Number(row.mt_value);
        });
        return result;
      } catch (error) {
        rethrowDbError(error, 'Error fetching metrics');
      }
    });
  }

  async findLastUpdateTime(): Promise<Date | null> {
    return this.cache.get('update', LIVE_TTL, async () => {
      try {
        const result = await this.repo
          .createQueryBuilder('p')
          .select('MAX(p.mt_time_2)', 'max')
          .getRawOne();
        return result ? result.max : null;
      } catch (error) {
        rethrowDbError(error, 'Error fetching last update');
      }
    });
  }

  async findIrrigationInterval() {
    return this.cache.get('interval', LIVE_TTL, async () => {
      try {
        const intervalRows = await this.repo.query(
          `SELECT * FROM zagal_57_interval`,
        );

        const activeSectors = intervalRows.filter(
          (r: any) => r.is_active === '1',
        );
        const activeNames = activeSectors.map((r: any) => r.mt_name);

        const totalActiveArea = activeNames.reduce((sum, name) => {
          return sum + (this.sectorAreas[name] || 0);
        }, 0);

        const allSectors = Object.keys(this.sectorMap);
        const now = new Date().getTime();

        return allSectors.map((mt_name) => {
          const row = intervalRows.find((r: any) => r.mt_name === mt_name);
          const is_active = row && row.is_active === '1';
          const sinceTime = row ? new Date(row.since).getTime() : now;

          let tiempo_riego_segundos = 0;
          let sectorTotalizer = 0;

          if (is_active) {
            tiempo_riego_segundos = Math.floor((now - sinceTime) / 1000);

            const first = row.first_totalizador
              ? Number(row.first_totalizador)
              : 0;
            const last = row.last_totalizador
              ? Number(row.last_totalizador)
              : 0;
            const rawDelta = Math.max(0, last - first);

            if (totalActiveArea > 0) {
              const sectorArea = this.sectorAreas[mt_name] || 0;
              const ratio = sectorArea / totalActiveArea;
              sectorTotalizer = rawDelta * ratio;
            }
          }

          return {
            mt_name: this.sectorMap[mt_name],
            is_active: is_active ? 1 : 0,
            tiempo_riego_segundos,
            totalizador: sectorTotalizer,
          };
        });
      } catch (error) {
        rethrowDbError(error, 'Error fetching irrigation interval');
      }
    });
  }

  async getDailyIrrigationSummary(startDate: string, endDate: string) {
    const ttl =
      endDate >= todayInChile(-1) ? SUMMARY_OPEN_TTL : SUMMARY_CLOSED_TTL;

    return this.cache.get(`summary:${startDate}:${endDate}`, ttl, async () => {
      try {
        const rows = await this.repo.query(dailySummarySql(this.tables), [
          startDate,
          endDate,
        ]);

        return rows.map((r) => ({
          mt_name: this.mapParcela(r.mt_name),
          date: r.date,
          value: Number(r.value),
          totalizador: Number(r.totalizador),
          caudal: Number(r.caudal),
        }));
      } catch (error) {
        rethrowDbError(error, 'Error fetching irrigation summary');
      }
    });
  }
}
