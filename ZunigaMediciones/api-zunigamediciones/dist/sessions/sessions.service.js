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
exports.SessionsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const session_entity_1 = require("./entities/session.entity");
const measurement_entity_1 = require("./entities/measurement.entity");
const user_entity_1 = require("../users/entities/user.entity");
const path_1 = require("path");
const fs_1 = require("fs");
let SessionsService = class SessionsService {
    sessionRepo;
    dataSource;
    constructor(sessionRepo, dataSource) {
        this.sessionRepo = sessionRepo;
        this.dataSource = dataSource;
    }
    getStaticFile(filename) {
        const filePath = (0, path_1.join)(process.cwd(), 'uploads', filename);
        if (filename.includes('..') ||
            filename.includes('/') ||
            filename.includes('\\')) {
            throw new common_1.BadRequestException('Nombre de archivo inválido');
        }
        if (!(0, fs_1.existsSync)(filePath)) {
            throw new common_1.NotFoundException(`La imagen ${filename} no existe en el servidor`);
        }
        return filePath;
    }
    async createFullSession(data, files) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const technicianName = data.reportMetadata?.generatedBy;
            if (!technicianName) {
                throw new common_1.BadRequestException('No se encontró el nombre del técnico (generatedBy) en la metadata.');
            }
            const user = await queryRunner.manager.findOne(user_entity_1.User, {
                where: { name: technicianName },
            });
            if (!user) {
                throw new common_1.BadRequestException(`El usuario con nombre "${technicianName}" no existe en el sistema.`);
            }
            const measurementsToSave = data.measurements.map((item, index) => {
                const measure = new measurement_entity_1.Measurement();
                measure.name = item.name;
                measure.value = Number(item.value);
                measure.time = new Date(item.time);
                measure.location = item.location || '';
                if (files && files[index]) {
                    measure.imagePath = files[index].filename;
                }
                return measure;
            });
            const reportSnapshot = {
                header: {
                    sessionId: null,
                    date: new Date().toISOString(),
                    technicianName: user.name,
                    technicianEmail: user.email,
                },
                items: measurementsToSave.map((m) => ({
                    label: m.name,
                    value: m.value,
                    unit: this.getUnit(m.name),
                    location: m.location,
                    time: m.time,
                    image: m.imagePath,
                })),
                metadata: data.reportMetadata,
            };
            const newSession = new session_entity_1.Session();
            newSession.user = user;
            newSession.measures_number = data.measurements.length;
            newSession.report_json = reportSnapshot;
            newSession.state = '0';
            const savedSession = await queryRunner.manager.save(newSession);
            savedSession.report_json['header']['sessionId'] = savedSession.id;
            await queryRunner.manager.save(savedSession);
            measurementsToSave.forEach((m) => (m.session = savedSession));
            await queryRunner.manager.save(measurementsToSave);
            await queryRunner.commitTransaction();
            return {
                message: 'Sesión creada exitosamente',
                sessionId: savedSession.id,
                state: savedSession.state,
            };
        }
        catch (err) {
            await queryRunner.rollbackTransaction();
            console.error('Error Transaction:', err);
            throw new common_1.BadRequestException('Error al guardar la sesión: ' + err.message);
        }
        finally {
            await queryRunner.release();
        }
    }
    async updateSession(id, data, files) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const session = await queryRunner.manager.findOne(session_entity_1.Session, {
                where: { id },
                relations: ['user'],
            });
            if (!session) {
                throw new common_1.NotFoundException(`Sesión con id "${id}" no encontrada.`);
            }
            if (session.state === '1') {
                throw new common_1.BadRequestException('Esta sesión ya está completa y no puede ser modificada.');
            }
            if (session.update_count >= 3) {
                throw new common_1.BadRequestException('Esta sesión ya alcanzó el máximo de 3 actualizaciones permitidas.');
            }
            const now = new Date();
            const newMeasures = (data.measurements || []).map((item, index) => {
                const m = new measurement_entity_1.Measurement();
                m.name = item.name;
                m.value = Number(item.value);
                m.time = now;
                m.location = item.location || '';
                m.session = session;
                if (files && files[index]) {
                    m.imagePath = files[index].filename;
                }
                return m;
            });
            await queryRunner.manager.save(newMeasures);
            const updatedReportJson = { ...session.report_json };
            updatedReportJson.items = [
                ...(updatedReportJson.items || []),
                ...newMeasures.map((m) => ({
                    label: m.name,
                    value: m.value,
                    unit: this.getUnit(m.name),
                    location: m.location,
                    time: m.time,
                    image: m.imagePath,
                })),
            ];
            session.measures_number = session.measures_number + newMeasures.length;
            session.report_json = updatedReportJson;
            session.update_count = (session.update_count || 0) + 1;
            if (data.markComplete === true || session.update_count >= 3) {
                session.state = '1';
            }
            await queryRunner.manager.save(session);
            await queryRunner.commitTransaction();
            return {
                message: 'Sesión actualizada con nuevas mediciones de cloro.',
                sessionId: session.id,
                state: session.state,
                update_count: session.update_count,
            };
        }
        catch (err) {
            await queryRunner.rollbackTransaction();
            console.error('Error Transaction updateSession:', err);
            throw new common_1.BadRequestException('Error al actualizar la sesión: ' + err.message);
        }
        finally {
            await queryRunner.release();
        }
    }
    async findMeasurementsByRange(startDate, endDate) {
        const start = new Date(`${startDate} 00:00:00`);
        console.log(start);
        const end = new Date(`${endDate} 23:59:59`);
        console.log(end);
        return this.dataSource.getRepository(measurement_entity_1.Measurement).find({
            where: {
                time: (0, typeorm_2.Between)(start, end),
            },
            order: {
                time: 'ASC',
            },
            relations: ['session', 'session.user'],
        });
    }
    getUnit(name) {
        const lower = name.toLowerCase();
        if (lower.includes('cloro'))
            return 'ppm';
        if (lower.includes('caudal'))
            return 'm³';
        if (lower.includes('energía') || lower.includes('kwh'))
            return 'kWh';
        if (lower.includes('horómetro'))
            return 'Hrs';
        return '';
    }
    async findAll() {
        const CHLORO_LABELS = [
            'Cloro en Caseta',
            'Cloro Red Punto 1',
            'Cloro Red Punto 2',
        ];
        const sessions = await this.sessionRepo.find({
            relations: ['user'],
            order: { createdAt: 'DESC' },
            select: {
                id: true,
                createdAt: true,
                measures_number: true,
                state: true,
                update_count: true,
                report_json: true,
                user: {
                    name: true,
                    email: true,
                },
            },
        });
        return sessions.map((s) => {
            const presentLabels = (s.report_json?.items || []).map((item) => item.label);
            const chloro_pending_count = CHLORO_LABELS.filter((label) => !presentLabels.includes(label)).length;
            const { report_json, ...rest } = s;
            return { ...rest, chloro_pending_count };
        });
    }
    async getReportData(id) {
        const session = await this.sessionRepo.findOne({
            where: { id },
            relations: ['user'],
        });
        if (!session)
            throw new common_1.NotFoundException('Sesión no encontrada');
        if (session.report_json && session.report_json.items) {
            return session.report_json;
        }
        return {
            header: {
                date: session.createdAt,
                technicianName: session.user?.name,
            },
            items: [],
        };
    }
    async findOne(id) {
        return this.sessionRepo.findOne({
            where: { id },
            relations: ['measurements', 'user'],
            order: {
                measurements: {
                    time: 'ASC',
                },
            },
        });
    }
    async remove(id) {
        return this.sessionRepo.delete(id);
    }
};
exports.SessionsService = SessionsService;
exports.SessionsService = SessionsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(session_entity_1.Session)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.DataSource])
], SessionsService);
//# sourceMappingURL=sessions.service.js.map