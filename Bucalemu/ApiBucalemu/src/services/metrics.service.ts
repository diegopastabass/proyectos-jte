// metrics.service.ts
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { DatabaseConfig } from "../config/database.config";
import { CreateMetricDto } from "../models/create-metric.dto";
import { Metric } from "../models/metric.interface";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(
    private readonly dbConfig: DatabaseConfig,
    private readonly httpService: HttpService
  ) {}

  async create(dto: CreateMetricDto): Promise<number> {
    try {
      const [result] = await this.dbConfig.pool.execute(
        "INSERT INTO ssr_bucalemu (mt_name, mt_value) VALUES (?, ?)",
        [dto.mt_name, dto.mt_value]
      );

      const insertedId = (result as any).insertId;

      try {
        await firstValueFrom(
          this.httpService.post("http://localhost:3004/metrics", dto)
        );
        this.logger.log(`Replicated metric to Postgres API`);
      } catch (err) {
        this.logger.error(
          "Failed to replicate to Postgres API:" +
            (err instanceof Error ? err.message : String(err))
        );
      }

      return insertedId;
    } catch (error) {
      throw new InternalServerErrorException("Error creating metric");
    }
  }

  async findLatest(limit: number): Promise<Metric[]> {
    try {
      const [rows] = await this.dbConfig.pool.query(
        "SELECT mt_id, mt_name, mt_value, mt_time_2 FROM ssr_bucalemu ORDER BY mt_time_2 DESC LIMIT ?",
        [limit]
      );
      return rows as Metric[];
    } catch (error) {
      throw new InternalServerErrorException("Error fetching latest metrics");
    }
  }

  async findLatestByName(name: string): Promise<Metric | null> {
    try {
      const [rows] = await this.dbConfig.pool.query(
        "SELECT mt_value FROM ssr_bucalemu WHERE mt_name = ? ORDER BY mt_time_2 DESC LIMIT 1",
        [name]
      );
      const metrics = rows as Metric[];
      return metrics.length > 0 ? metrics[0] : null;
    } catch (error) {
      throw new InternalServerErrorException(
        "Error fetching latest metric by name"
      );
    }
  }

  async findLatestForEachName(): Promise<{
    [key: string]: { value: number; time: string };
  }> {
    try {
      const [rows] = await this.dbConfig.pool.query(
        `SELECT m1.mt_name, m1.mt_value, m1.mt_time_2
       FROM ssr_bucalemu m1
       JOIN (
           SELECT mt_name, MAX(mt_time_2) AS max_time
           FROM ssr_bucalemu
           GROUP BY mt_name
       ) m2 ON m1.mt_name = m2.mt_name AND m1.mt_time_2 = m2.max_time;`
      );

      const result: { [key: string]: { value: number; time: string } } = {};
      (rows as Metric[]).forEach((row: Metric) => {
        result[row.mt_name] = {
          value: row.mt_value,
          time: new Date(row.mt_time_2).toISOString(),
        };
      });
      return result;
    } catch (error) {
      this.logger.error("Error fetching latest metrics for all names", error);
      throw new InternalServerErrorException(
        "Error fetching latest metrics for all names"
      );
    }
  }

  async findLastUpdateTime(): Promise<Date | null> {
    try {
      const [rows] = await this.dbConfig.pool.query(
        "SELECT MAX(mt_time_2) AS last_update FROM ssr_bucalemu"
      );
      const result = (rows as { last_update: string | null }[])[0];
      return result && result.last_update ? new Date(result.last_update) : null;
    } catch (error) {
      this.logger.error("Error fetching last update time", error);
      throw new InternalServerErrorException("Error fetching last update time");
    }
  }

  async estimateEmptyingTimes(): Promise<{ [key: string]: string }> {
    try {
      const rawQuery = `
      SELECT *
      FROM (
        SELECT 
          "mt_name",
          "mt_value",
          "mt_time_2",
          ROW_NUMBER() OVER (PARTITION BY "mt_name" ORDER BY "mt_time_2" DESC) AS rn
        FROM "ssr_bucalemu"
        WHERE "mt_name" LIKE '%nivel'
      ) t
      WHERE t.rn <= 2
      ORDER BY t."mt_name", t.rn;
    `;

      type MeasurementRow = {
        mt_name: string;
        mt_value: number | string;
        mt_time_2: string | Date;
        rn: number;
      };

      const rows = (await this.metricRepository.query(
        rawQuery
      )) as MeasurementRow[];

      const grouped: Record<string, { value: number; time: string }[]> = {};
      rows.forEach((row) => {
        if (!grouped[row.mt_name]) grouped[row.mt_name] = [];
        grouped[row.mt_name].push({
          value: Number(row.mt_value),
          time: new Date(row.mt_time_2).toISOString(),
        });
      });

      const result: { [key: string]: string } = {};
      for (const name in grouped) {
        const datos = grouped[name];
        if (datos.length < 2) continue;

        const nivel1 = datos[0].value;
        const timestamp1 = datos[0].time;
        const nivel2 = datos[1].value;
        const timestamp2 = datos[1].time;

        const segundos = this.estimateEmptyingTime(
          nivel1,
          timestamp1,
          nivel2,
          timestamp2
        );

        const key = `t_vaciado_${name.replace(/^ssr_/, "")}`;
        result[key] = isNaN(segundos)
          ? "NaN"
          : this.formatSecondsToDuration(Math.round(segundos));
      }

      return result;
    } catch (error) {
      this.logger.error("Error estimating emptying times", error);
      throw new InternalServerErrorException("Error estimating emptying times");
    }
  }

  private estimateEmptyingTime(
    level1: number,
    timestamp1: string,
    level2: number,
    timestamp2: string
  ): number {
    if (isNaN(level1) || isNaN(level2)) {
      return NaN;
    }

    if (level1 >= level2) {
      return 0;
    }

    const date1 = new Date(timestamp1);
    const date2 = new Date(timestamp2);
    const deltaTimeSeconds = Math.abs(
      (date2.getTime() - date1.getTime()) / 1000
    );

    if (deltaTimeSeconds === 0) {
      return NaN;
    }

    const lossRate = (level2 - level1) / deltaTimeSeconds;
    return level1 / lossRate;
  }

  private formatSecondsToDuration(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    let result = "";
    if (days > 0) result += `${days}d `;
    if (hours > 0) result += `${hours}h `;
    if (minutes > 0) result += `${minutes}m `;
    if (secs > 0 || result === "") result += `${secs}s`;

    return result.trim();
  }

  async findAllMeasurements() {
    const query = `
    SELECT mt_name, mt_value, mt_time_2
    FROM (
      SELECT 
        mt_name,
        mt_value,
        mt_time_2,
        ROW_NUMBER() OVER (PARTITION BY mt_name ORDER BY mt_time_2 DESC) as row_num
      FROM ssr_bucalemu
      WHERE mt_name LIKE ?
    ) t
    WHERE row_num <= 100
    ORDER BY mt_name, mt_time_2 ASC
  `;

    const [results] = await this.dbConfig.pool.query(query, ["%nivel%"]);

    const grouped: Record<string, { mt_value: number; mt_time_2: string }[]> =
      {};

    for (const row of results as any[]) {
      const { mt_name, mt_value, mt_time_2 } = row;

      if (!grouped[mt_name]) {
        grouped[mt_name] = [];
      }

      grouped[mt_name].push({
        mt_value: parseFloat(mt_value),
        mt_time_2: this.formatDate(new Date(mt_time_2)),
      });
    }

    return grouped;
  }

  private formatDate(date: Date): string {
    const pad = (n: number) => (n < 10 ? "0" + n : n);
    return (
      date.getFullYear() +
      "-" +
      pad(date.getMonth() + 1) +
      "-" +
      pad(date.getDate()) +
      " " +
      pad(date.getHours()) +
      ":" +
      pad(date.getMinutes()) +
      ":" +
      pad(date.getSeconds())
    );
  }
}
