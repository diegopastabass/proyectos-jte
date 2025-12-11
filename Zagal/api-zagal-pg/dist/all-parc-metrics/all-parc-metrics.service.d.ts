import { DataSource } from "typeorm";
export declare class AllParcMetricsService {
    private readonly dataSource;
    constructor(dataSource: DataSource);
    private readonly parcelTables;
    private sectorMaps;
    private mapSectorName;
    findAllActiveSectors(): Promise<{
        [key: string]: any[];
    }>;
    private getSectorsByTable;
}
