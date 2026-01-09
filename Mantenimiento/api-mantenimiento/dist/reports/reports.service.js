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
const report_entity_1 = require("./entities/report.entity");
let ReportsService = class ReportsService {
    reportRepository;
    constructor(reportRepository) {
        this.reportRepository = reportRepository;
    }
    async create(createReportDto, userId) {
        const { ticketNumber, ...reportData } = createReportDto;
        const report = this.reportRepository.create({
            ...reportData,
            user: { id: userId },
        });
        const savedReport = await this.reportRepository.save(report);
        const generatedOT = savedReport.ticketNumber.toString();
        savedReport.data = {
            ...savedReport.data,
            ticket: {
                ...savedReport.data.ticket,
                number: generatedOT
            }
        };
        return this.reportRepository.save(savedReport);
    }
    async findAll() {
        return this.reportRepository.find({
            select: ['id', 'ticketNumber', 'clientName', 'status', 'createdAt'],
            relations: ['user'],
            order: { createdAt: 'DESC' },
        });
    }
    async findOne(id) {
        const report = await this.reportRepository.findOne({
            where: { id },
            relations: ['user'],
        });
        if (!report)
            throw new common_1.NotFoundException(`Reporte con ID ${id} no encontrado`);
        return report;
    }
    async update(id, updateReportDto) {
        const report = await this.findOne(id);
        this.reportRepository.merge(report, updateReportDto);
        if (updateReportDto.data) {
            report.clientName = updateReportDto.data.client?.name || report.clientName;
            report.status = updateReportDto.data.status || report.status;
        }
        return this.reportRepository.save(report);
    }
    async remove(id) {
        const result = await this.reportRepository.delete(id);
        if (result.affected === 0) {
            throw new common_1.NotFoundException(`No se pudo eliminar el reporte ${id}`);
        }
    }
};
exports.ReportsService = ReportsService;
exports.ReportsService = ReportsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(report_entity_1.Report)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ReportsService);
//# sourceMappingURL=reports.service.js.map