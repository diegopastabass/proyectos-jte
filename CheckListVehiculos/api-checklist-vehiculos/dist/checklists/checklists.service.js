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
exports.ChecklistsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const checklist_entity_1 = require("../entities/checklist.entity");
const vehicle_entity_1 = require("../entities/vehicle.entity");
const checklist_image_entity_1 = require("../entities/checklist-image.entity");
let ChecklistsService = class ChecklistsService {
    constructor(checklistsRepository, vehiclesRepository, dataSource) {
        this.checklistsRepository = checklistsRepository;
        this.vehiclesRepository = vehiclesRepository;
        this.dataSource = dataSource;
    }
    async create(user_id, createChecklistDto, files) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const vehicle = await queryRunner.manager.findOne(vehicle_entity_1.Vehicle, { where: { id: createChecklistDto.vehicle_id } });
            if (!vehicle) {
                throw new common_1.NotFoundException('Vehicle not found');
            }
            if (createChecklistDto.kilometraje_actual < vehicle.kilometraje) {
                throw new common_1.BadRequestException('Current kilometraje cannot be less than previous kilometraje');
            }
            const kmDiff = createChecklistDto.kilometraje_actual - vehicle.kilometraje;
            vehicle.kilometraje = createChecklistDto.kilometraje_actual;
            vehicle.km_desde_ultima_mantencion += kmDiff;
            await queryRunner.manager.save(vehicle);
            const checklist = queryRunner.manager.create(checklist_entity_1.Checklist, {
                user_id,
                vehicle_id: createChecklistDto.vehicle_id,
                kilometraje_actual: createChecklistDto.kilometraje_actual,
                visual_checks: createChecklistDto.visual_checks,
                mechanical_checks: createChecklistDto.mechanical_checks,
                observaciones_generales: createChecklistDto.observaciones_generales,
                has_issues: createChecklistDto.has_issues,
            });
            const savedChecklist = await queryRunner.manager.save(checklist);
            if (files && files.length > 0) {
                const checklistImages = files.map(file => {
                    return queryRunner.manager.create(checklist_image_entity_1.ChecklistImage, {
                        checklist_id: savedChecklist.id,
                        image_path: file.filename,
                        check_type: 'general',
                        check_item: 'general',
                        description: file.originalname,
                    });
                });
                await queryRunner.manager.save(checklistImages);
            }
            await queryRunner.commitTransaction();
            return this.checklistsRepository.findOne({ where: { id: savedChecklist.id }, relations: ['images'] });
        }
        catch (err) {
            await queryRunner.rollbackTransaction();
            throw err;
        }
        finally {
            await queryRunner.release();
        }
    }
    async findAll(user) {
        if (user.is_admin) {
            return this.checklistsRepository.find({ relations: ['images'] });
        }
        return this.checklistsRepository.find({ where: { user_id: user.userId }, relations: ['images'] });
    }
    async findOne(id, user) {
        const checklist = await this.checklistsRepository.findOne({ where: { id }, relations: ['images'] });
        if (!checklist) {
            throw new common_1.NotFoundException('Checklist not found');
        }
        if (!user.is_admin && checklist.user_id !== user.userId) {
            throw new common_1.NotFoundException('Checklist not found');
        }
        return checklist;
    }
};
exports.ChecklistsService = ChecklistsService;
exports.ChecklistsService = ChecklistsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(checklist_entity_1.Checklist)),
    __param(1, (0, typeorm_1.InjectRepository)(vehicle_entity_1.Vehicle)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource])
], ChecklistsService);
//# sourceMappingURL=checklists.service.js.map