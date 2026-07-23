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
const path_1 = require("path");
const fs_1 = require("fs");
const uuid_1 = require("uuid");
function log(level, context, message, extra) {
    const timestamp = new Date().toISOString();
    const base = `[${timestamp}] [${level}] [ReportsService.${context}] ${message}`;
    if (extra) {
        const details = JSON.stringify(extra, null, 2);
        if (level === 'ERROR') {
            console.error(`${base}\n${details}`);
        }
        else if (level === 'WARN') {
            console.warn(`${base}\n${details}`);
        }
        else {
            console.log(`${base}\n${details}`);
        }
    }
    else {
        if (level === 'ERROR') {
            console.error(base);
        }
        else if (level === 'WARN') {
            console.warn(base);
        }
        else {
            console.log(base);
        }
    }
}
function logError(context, message, error) {
    const err = error;
    log('ERROR', context, message, {
        errorMessage: err?.message ?? String(error),
        errorName: err?.name,
        errorCode: err?.code,
        errorDetail: err?.detail,
        errorHint: err?.hint,
        errorTable: err?.table,
        errorColumn: err?.column,
        stack: err?.stack,
    });
}
let ReportsService = class ReportsService {
    reportRepository;
    UPLOAD_DIR = (0, path_1.join)(process.cwd(), 'uploads', 'reports');
    PUBLIC_PATH_PREFIX = '/uploads/reports';
    constructor(reportRepository) {
        this.reportRepository = reportRepository;
        this.ensureUploadDirExists();
    }
    async create(createReportDto, userId, files = []) {
        log('INFO', 'create', 'Iniciando creación de reporte', {
            userId,
            clientName: createReportDto.clientName,
            status: createReportDto.status,
            filesCount: files.length,
            createdAtRecibido: createReportDto.createdAt ?? null,
        });
        try {
            log('INFO', 'create', 'Guardando imágenes en disco', { count: files.length });
            const imagePaths = this.saveImages(files);
            log('INFO', 'create', 'Imágenes guardadas correctamente', { paths: imagePaths });
            const { ticketNumber, ...reportData } = createReportDto;
            const resolvedCreatedAt = reportData.createdAt
                ? new Date(reportData.createdAt)
                : new Date();
            log('INFO', 'create', 'Fecha de creación resuelta', {
                fuenteFecha: reportData.createdAt ? 'cliente' : 'servidor',
                resolvedCreatedAt: resolvedCreatedAt.toISOString(),
            });
            const report = this.reportRepository.create({
                ...reportData,
                createdAt: resolvedCreatedAt,
                images: imagePaths,
                user: { id: userId },
            });
            log('INFO', 'create', 'Ejecutando INSERT (primer save)…');
            const savedReport = await this.reportRepository.save(report);
            log('INFO', 'create', 'Primer save exitoso', {
                id: savedReport.id,
                ticketNumber: savedReport.ticketNumber,
                createdAt: savedReport.createdAt,
            });
            const generatedOT = savedReport.ticketNumber.toString();
            const ticketDate = resolvedCreatedAt.toISOString().slice(0, 10);
            log('INFO', 'create', `Actualizando data.ticket → OT #${generatedOT}, fecha ${ticketDate}`);
            savedReport.data = {
                ...savedReport.data,
                ticket: {
                    ...savedReport.data?.ticket,
                    number: generatedOT,
                    date: ticketDate,
                },
            };
            savedReport.createdAt = resolvedCreatedAt;
            log('INFO', 'create', `Actualizando OT en data.ticket → OT #${generatedOT} (segundo save)…`);
            const finalReport = await this.reportRepository.save(savedReport);
            log('INFO', 'create', '✅ Reporte creado exitosamente', {
                id: finalReport.id,
                ot: finalReport.ticketNumber,
                clientName: finalReport.clientName,
                status: finalReport.status,
                createdAt: finalReport.createdAt,
            });
            return finalReport;
        }
        catch (error) {
            logError('create', '❌ Error al crear el reporte', error);
            throw error;
        }
    }
    async findAll() {
        log('INFO', 'findAll', 'Consultando todos los reportes');
        try {
            const reports = await this.reportRepository.find({
                select: ['id', 'ticketNumber', 'clientName', 'status', 'createdAt'],
                relations: ['user'],
                order: { createdAt: 'DESC' },
            });
            log('INFO', 'findAll', `✅ Reportes obtenidos: ${reports.length}`);
            return reports;
        }
        catch (error) {
            logError('findAll', '❌ Error al consultar reportes', error);
            throw error;
        }
    }
    async findOne(id) {
        log('INFO', 'findOne', 'Buscando reporte', { id });
        try {
            const report = await this.reportRepository.findOne({
                where: { id },
                relations: ['user'],
            });
            if (!report) {
                log('WARN', 'findOne', `Reporte no encontrado`, { id });
                throw new common_1.NotFoundException(`Reporte con ID ${id} no encontrado`);
            }
            log('INFO', 'findOne', '✅ Reporte encontrado', {
                id: report.id,
                ot: report.ticketNumber,
                clientName: report.clientName,
            });
            return report;
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException)
                throw error;
            logError('findOne', '❌ Error al buscar reporte', error);
            throw error;
        }
    }
    async update(id, updateReportDto) {
        log('INFO', 'update', 'Iniciando actualización de reporte', {
            id,
            camposRecibidos: Object.keys(updateReportDto),
            createdAtRecibido: updateReportDto.createdAt ?? null,
        });
        try {
            const report = await this.findOne(id);
            log('INFO', 'update', 'Reporte cargado para actualización', {
                ot: report.ticketNumber,
                clientName: report.clientName,
                createdAtActual: report.createdAt,
            });
            const { id: _, ticketNumber: __, data, createdAt, ...rest } = updateReportDto;
            if (createdAt) {
                report.createdAt = new Date(createdAt);
                log('INFO', 'update', 'Fecha de creación actualizada', {
                    nuevaFecha: report.createdAt.toISOString(),
                });
            }
            this.reportRepository.merge(report, rest);
            if (data) {
                report.data = { ...report.data, ...data };
                report.clientName = data.client?.name || report.clientName;
                report.status = data.status || report.status;
                log('INFO', 'update', 'Campo data fusionado', {
                    clientName: report.clientName,
                    status: report.status,
                });
            }
            if (createdAt && report.data?.ticket) {
                const ticketDate = report.createdAt.toISOString().slice(0, 10);
                report.data = {
                    ...report.data,
                    ticket: { ...report.data.ticket, date: ticketDate },
                };
                log('INFO', 'update', `data.ticket.date sincronizado → ${ticketDate}`);
            }
            log('INFO', 'update', 'Ejecutando UPDATE (save)…');
            const updated = await this.reportRepository.save(report);
            log('INFO', 'update', '✅ Reporte actualizado exitosamente', {
                id: updated.id,
                ot: updated.ticketNumber,
                clientName: updated.clientName,
                status: updated.status,
                createdAt: updated.createdAt,
            });
            return updated;
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException)
                throw error;
            logError('update', `❌ Error al actualizar el reporte ID=${id}`, error);
            throw error;
        }
    }
    async remove(id) {
        log('INFO', 'remove', 'Eliminando reporte', { id });
        try {
            const result = await this.reportRepository.delete(id);
            if (result.affected === 0) {
                log('WARN', 'remove', 'Reporte no encontrado para eliminar', { id });
                throw new common_1.NotFoundException(`No se pudo eliminar el reporte ${id}`);
            }
            log('INFO', 'remove', '✅ Reporte eliminado', { id, affected: result.affected });
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException)
                throw error;
            logError('remove', `❌ Error al eliminar el reporte ID=${id}`, error);
            throw error;
        }
    }
    async getUniqueClientNames() {
        log('INFO', 'getUniqueClientNames', 'Consultando nombres de clientes únicos');
        try {
            const results = await this.reportRepository
                .createQueryBuilder('report')
                .select('DISTINCT report.clientName', 'clientName')
                .where('report.clientName IS NOT NULL')
                .andWhere("report.clientName != ''")
                .orderBy('report.clientName', 'ASC')
                .getRawMany();
            const names = results.map((row) => row.clientName);
            log('INFO', 'getUniqueClientNames', `✅ Clientes únicos encontrados: ${names.length}`);
            return names;
        }
        catch (error) {
            logError('getUniqueClientNames', '❌ Error al consultar clientes únicos', error);
            throw error;
        }
    }
    ensureUploadDirExists() {
        if (!(0, fs_1.existsSync)(this.UPLOAD_DIR)) {
            log('INFO', 'ensureUploadDirExists', `Creando directorio de uploads: ${this.UPLOAD_DIR}`);
            (0, fs_1.mkdirSync)(this.UPLOAD_DIR, { recursive: true });
            log('INFO', 'ensureUploadDirExists', 'Directorio creado correctamente');
        }
        else {
            log('INFO', 'ensureUploadDirExists', `Directorio de uploads ya existe: ${this.UPLOAD_DIR}`);
        }
    }
    saveImages(files) {
        if (!files || files.length === 0)
            return [];
        return files.map((file) => {
            const extension = this.extractExtension(file.originalname, file.mimetype);
            const filename = `${(0, uuid_1.v4)()}.${extension}`;
            const absolutePath = (0, path_1.join)(this.UPLOAD_DIR, filename);
            try {
                (0, fs_1.writeFileSync)(absolutePath, file.buffer);
                log('INFO', 'saveImages', `Imagen guardada: ${filename}`, {
                    originalname: file.originalname,
                    size: file.size,
                });
            }
            catch (err) {
                logError('saveImages', `Error guardando imagen ${filename}`, err);
                throw new common_1.InternalServerErrorException(`No se pudo guardar la imagen: ${file.originalname}`);
            }
            return `${this.PUBLIC_PATH_PREFIX}/${filename}`;
        });
    }
    extractExtension(originalname, mimetype) {
        const parts = originalname?.split('.');
        if (parts && parts.length > 1) {
            return parts[parts.length - 1].toLowerCase();
        }
        const mimeMap = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/webp': 'webp',
            'image/gif': 'gif',
        };
        return mimeMap[mimetype] ?? 'jpg';
    }
};
exports.ReportsService = ReportsService;
exports.ReportsService = ReportsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(report_entity_1.Report)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ReportsService);
//# sourceMappingURL=reports.service.js.map