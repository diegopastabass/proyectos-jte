import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { DataSource } from "typeorm";

@Injectable()
export class AllParcMetricsService {
  constructor(private readonly dataSource: DataSource) {}

  private readonly parcelTables = [
    "parc_18_zagal",
    "parc_82_zagal",
    "parc_57_zagal",
  ];

  // Mismos mapas de siempre
  private sectorMaps: { [table: string]: { [key: string]: string } } = {
    parc_18_zagal: {
      "PARC_18_ZAGAL--slave.sector1": "SECTOR 1",
      "PARC_18_ZAGAL--slave.sector2": "SECTOR 2",
      "PARC_18_ZAGAL--slave.sector3": "SECTOR 3",
      "PARC_18_ZAGAL--slave.sector4": "SECTOR 4",
      "PARC_18_ZAGAL--slave.sector5": "SECTOR 5",
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

  async findAllActiveSectors() {
    try {
      // 1. Consulta única a la tabla optimizada
      const query = `SELECT mt_name, mt_value FROM estado_sectores`;
      const allRows = await this.dataSource.query(query);

      const response: { [key: string]: any[] } = {};

      // 2. Clasificamos los resultados en memoria
      this.parcelTables.forEach((tableName) => {
        const tableMap = this.sectorMaps[tableName];
        
        // Filtramos solo los registros que pertenecen a esta tabla usando las llaves del mapa
        const tableRows = allRows.filter((row: any) => tableMap.hasOwnProperty(row.mt_name));

        // Mapeamos nombres y estado
        const mappedResults = tableRows.map((row: any) => ({
          mt_name: tableMap[row.mt_name],
          is_active: row.mt_value === '1' ? 1 : 0,
        }));

        // Ordenamos alfabética/numéricamente
        response[tableName] = mappedResults.sort((a, b) => 
          a.mt_name.localeCompare(b.mt_name, undefined, { numeric: true })
        );
      });

      return response;

    } catch (error) {
      console.error("Error fetching all parcel metrics:", error);
      throw new InternalServerErrorException(
        "Error fetching all parcel metrics"
      );
    }
  }
}