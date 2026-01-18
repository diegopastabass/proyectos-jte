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
let SessionsService = class SessionsService {
    sessionRepo;
    dataSource;
    constructor(sessionRepo, dataSource) {
        this.sessionRepo = sessionRepo;
        this.dataSource = dataSource;
    }
    async createFullSession(data, files) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const user = new user_entity_1.User();
            user.id = data.userId;
            const newSession = new session_entity_1.Session();
            newSession.user = user;
            newSession.measures_number = data.measurements.length;
            newSession.report_json = data.reportMetadata || {};
            const savedSession = await queryRunner.manager.save(newSession);
            const measurementsToSave = data.measurements.map((item, index) => {
                const measure = new measurement_entity_1.Measurement();
                measure.session = savedSession;
                measure.name = item.name;
                measure.value = Number(item.value);
                measure.time = new Date(item.time);
                measure.location = item.location || '';
                if (files && files[index]) {
                    measure.imagePath = files[index].filename;
                }
                return measure;
            });
            await queryRunner.manager.save(measurementsToSave);
            await queryRunner.commitTransaction();
            return {
                message: 'Sesión creada exitosamente',
                sessionId: savedSession.id,
            };
        }
        catch (err) {
            await queryRunner.rollbackTransaction();
            throw new common_1.BadRequestException('Error al guardar la sesión: ' + err.message);
        }
        finally {
            await queryRunner.release();
        }
    }
    async findAll() {
        return this.sessionRepo.find({
            relations: ['user'],
            order: { createdAt: 'DESC' },
            select: {
                id: true,
                createdAt: true,
                measures_number: true,
                user: {
                    full_name: true,
                    email: true,
                },
            },
        });
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