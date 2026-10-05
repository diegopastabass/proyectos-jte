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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const reports_entity_1 = require("./models/reports.entity");
let ReportsService = class ReportsService {
    repo;
    constructor(repo) {
        this.repo = repo;
    }
    async create(dto) {
        const report = this.repo.create(dto);
        return await this.repo.save(report);
    }
    async findAll(dto) {
        if (!dto.start || !dto.end) {
            return this.repo.find({
                order: { time: 'DESC' },
                take: 100,
            });
        }
        const start = new Date(`${dto.start}T00:00:00`);
        const end = new Date(`${dto.end}T23:59:59`);
        return this.repo.find({
            where: {
                time: (0, typeorm_2.Between)(start, end),
            },
            order: { time: 'DESC' },
        });
    }
};
exports.ReportsService = ReportsService;
exports.ReportsService = ReportsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(reports_entity_1.CarracedoReport)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ReportsService);
//# sourceMappingURL=reports.service.js.map