import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { DatabaseConfig } from "../config/database.config";
import { Metric } from "./metric.interface";

@Injectable()
export class AllParcMetricsService {
  constructor(private readonly dbConfig: DatabaseConfig) {}

  private readonly parcelTables = [
    "parc_18_zagal",
    "parc_82_zagal",
    "parc_57_zagal",
  ];

  private sectorMaps: { [table: string]: { [key: string]: string } } = {
    parc_18_zagal: {
      "PARC_18_ZAGAL--slave.sector1": "SECTOR 1",
      "PARC_18_ZAGAL--slave.sector2": "SECTOR 2",
      "PARC_18_ZAGAL--slave.sector3": "SECTOR 3",
      "PARC_18_ZAGAL--slave.sector4": "SECTOR 4",
      "PARC_18_ZAGAL--slave.sector5": "SECTOR 5",
      "PARC_18_ZAGAL--slave.sector6": "SECTOR 6",
      "PARC_18_ZAGAL--slave.sector7": "SECTOR 7",
      "PARC_18_ZAGAL--slave.sector8": "SECTOR 8",
      "PARC_18_ZAGAL--slave.sector9": "SECTOR 9",
    },
    parc_82_zagal: {
      "PARC_82_ZAGAL--slave.sector1": "SECTOR 1",
      "PARC_82_ZAGAL--slave.sector2": "SECTOR 2",
      "PARC_82_ZAGAL--slave.sector3": "SECTOR 3",
      "PARC_82_ZAGAL--slave.sector4": "SECTOR 4",
      "PARC_82_ZAGAL--slave.sector5": "SECTOR 5",
      "PARC_82_ZAGAL--slave.sector6": "SECTOR 6",
      "PARC_82_ZAGAL--slave.sector7": "SECTOR 7",
      "PARC_82_ZAGAL--slave.sector8": "SECTOR 8",
      "PARC_82_ZAGAL--slave.sector9": "SECTOR 9",
      "PARC_82_ZAGAL--slave.sector10": "SECTOR 10",
      "PARC_82_ZAGAL--slave.sector11": "SECTOR 11",
      "PARC_82_ZAGAL--slave.sector12": "SECTOR 12",
    },
    parc_57_zagal: {
      "PARC_57_ZAGAL--slave.sector1": "NEC 4",
      "PARC_57_ZAGAL--slave.sector2": "RICH LADY",
      "PARC_57_ZAGAL--slave.sector3": "303 NORTE",
      "PARC_57_ZAGAL--slave.sector4": "303 SUR",
      "PARC_57_ZAGAL--slave.sector5": "RP",
      "PARC_57_ZAGAL--slave.sector6": "PARC 54 SUR 1",
      "PARC_57_ZAGAL--slave.sector7": "PARC 54 SUR 2",
      "PARC_57_ZAGAL--slave.sector8": "PARC 54 NORTE",
      "PARC_57_ZAGAL--slave.sector9": "PARC 52",
    },
  };

  private mapSectorName(tableName: string, rawName: string): string {
    const map = this.sectorMaps[tableName];
    return map && map[rawName] ? map[rawName] : rawName;
  }

  async findAllActiveSectors() {
    try {
      const promises = this.parcelTables.map((table) =>
        this.getSectorsByTable(table)
      );
      const results = await Promise.all(promises);

      const response: { [key: string]: any[] } = {};

      this.parcelTables.forEach((table, index) => {
        response[table] = results[index];
      });

      return response;
    } catch (error) {
      console.error("Error fetching all parcel metrics:", error);
      throw new InternalServerErrorException(
        "Error fetching all parcel metrics"
      );
    }
  }

  private async getSectorsByTable(tableName: string) {
    const query = `
        SELECT m1.mt_name, m1.mt_value
        FROM ${tableName} m1
        JOIN (
            SELECT mt_name, MAX(mt_time_2) as max_time
            FROM ${tableName}
            WHERE mt_name LIKE '%sector%'
            GROUP BY mt_name
        ) m2 ON m1.mt_name = m2.mt_name AND m1.mt_time_2 = m2.max_time;
      `;

    const [rows] = await this.dbConfig.pool.query(query);
    const dbRows = rows as Metric[];

    const statusMap: Record<string, number> = {};
    dbRows.forEach((row) => {
      statusMap[row.mt_name] = Number(row.mt_value);
    });

    const mappedResults = dbRows.map((row) => {
      const isActive = Number(row.mt_value) === 1 ? 1 : 0;
      return {
        mt_name: this.mapSectorName(tableName, row.mt_name),
        is_active: isActive,
      };
    });

    return mappedResults.sort((a, b) => a.mt_name.localeCompare(b.mt_name));
  }
}
