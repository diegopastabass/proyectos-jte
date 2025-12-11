"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllParcMetricsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
let AllParcMetricsService = class AllParcMetricsService {
    dataSource;
    constructor(dataSource) {
        this.dataSource = dataSource;
    }
    parcelTables = [
        "parc_18_zagal",
        "parc_82_zagal",
        "parc_57_zagal",
    ];
    sectorMaps = {
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
    mapSectorName(tableName, rawName) {
        const map = this.sectorMaps[tableName];
        return map && map[rawName] ? map[rawName] : rawName;
    }
    async findAllActiveSectors() {
        try {
            const promises = this.parcelTables.map((table) => this.getSectorsByTable(table));
            const results = await Promise.all(promises);
            const response = {};
            this.parcelTables.forEach((table, index) => {
                response[table] = results[index];
            });
            return response;
        }
        catch (error) {
            console.error("Error fetching all parcel metrics:", error);
            throw new common_1.InternalServerErrorException("Error fetching all parcel metrics");
        }
    }
    async getSectorsByTable(tableName) {
        if (!this.parcelTables.includes(tableName)) {
            throw new Error(`Table ${tableName} is not whitelisted`);
        }
        const query = `
        SELECT DISTINCT ON (mt_name) mt_name, mt_value
        FROM "${tableName}" 
        WHERE mt_name LIKE '%sector%'
        ORDER BY mt_name, mt_time_2 DESC
    `;
        const rows = await this.dataSource.query(query);
        const mappedResults = rows.map((row) => {
            const isActive = row.mt_value === '1' ? 1 : 0;
            return {
                mt_name: this.mapSectorName(tableName, row.mt_name),
                is_active: isActive,
            };
        });
        return mappedResults.sort((a, b) => a.mt_name.localeCompare(b.mt_name, undefined, { numeric: true }));
    }
};
exports.AllParcMetricsService = AllParcMetricsService;
exports.AllParcMetricsService = AllParcMetricsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [typeorm_1.DataSource])
], AllParcMetricsService);
//# sourceMappingURL=all-parc-metrics.service.js.map