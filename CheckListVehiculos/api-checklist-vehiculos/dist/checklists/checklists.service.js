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
var ChecklistsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChecklistsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const checklist_entity_1 = require("../entities/checklist.entity");
const vehicle_entity_1 = require("../entities/vehicle.entity");
const checklist_image_entity_1 = require("../entities/checklist-image.entity");
const REQUIRED_EXTERIOR = ['foto_frontal', 'foto_trasera', 'foto_lateral_izquierdo', 'foto_lateral_derecho'];
const MIN_INTERIOR = 2;
const MAX_CHECK_ITEMS = 40;
const TZ = 'America/Santiago';
let ChecklistsService = ChecklistsService_1 = class ChecklistsService {
    constructor(checklistsRepository, dataSource) {
        this.checklistsRepository = checklistsRepository;
        this.dataSource = dataSource;
        this.logger = new common_1.Logger(ChecklistsService_1.name);
    }
    baseName(originalname) {
        return (originalname || '').replace(/\.[^.]+$/, '');
    }
    cleanChecks(section, raw, photoNames) {
        const keys = Object.keys(raw);
        if (keys.length === 0 || keys.length > MAX_CHECK_ITEMS) {
            throw new common_1.BadRequestException(`${section}: cantidad de ítems inválida`);
        }
        const out = {};
        for (const key of keys) {
            const item = raw[key];
            if (!/^[a-z0-9_]{1,60}$/.test(key) || !item || typeof item !== 'object' || typeof item.isGood !== 'boolean') {
                throw new common_1.BadRequestException(`${section}: ítem "${key}" inválido`);
            }
            const observation = typeof item.observation === 'string' ? item.observation.trim().slice(0, 500) : '';
            const label = typeof item.label === 'string' ? item.label.slice(0, 100) : key;
            if (!item.isGood && !observation) {
                throw new common_1.BadRequestException(`Debe indicar una observación para "${label}" (marcado como MALO)`);
            }
            out[key] = { id: key, label, isGood: item.isGood, observation, hasPhoto: photoNames.has(key) };
        }
        return out;
    }
    async create(user_id, dto, files) {
        files = files ?? [];
        const photoNames = new Set(files.map(f => this.baseName(f.originalname)));
        const missing = REQUIRED_EXTERIOR.filter(n => !photoNames.has(n));
        if (missing.length) {
            throw new common_1.BadRequestException(`Faltan fotos exteriores obligatorias: ${missing.map(m => m.replace('foto_', '')).join(', ')}`);
        }
        const interior = [...photoNames].filter(n => n.startsWith('foto_interior_')).length;
        if (interior < MIN_INTERIOR) {
            throw new common_1.BadRequestException(`Debe adjuntar al menos ${MIN_INTERIOR} fotos interiores`);
        }
        const visual = this.cleanChecks('visual_checks', dto.visual_checks, photoNames);
        const mechanical = this.cleanChecks('mechanical_checks', dto.mechanical_checks, photoNames);
        const has_issues = [...Object.values(visual), ...Object.values(mechanical)].some(i => !i.isGood);
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const vehicle = await queryRunner.manager.findOne(vehicle_entity_1.Vehicle, {
                where: { id: dto.vehicle_id },
                lock: { mode: 'pessimistic_write' },
            });
            if (!vehicle) {
                throw new common_1.NotFoundException('Vehicle not found');
            }
            if (!vehicle.is_active) {
                throw new common_1.BadRequestException('El vehículo está dado de baja');
            }
            if (dto.kilometraje_actual < vehicle.kilometraje) {
                throw new common_1.BadRequestException(`El kilometraje (${dto.kilometraje_actual}) no puede ser menor al último registrado (${vehicle.kilometraje})`);
            }
            vehicle.kilometraje = dto.kilometraje_actual;
            await queryRunner.manager.save(vehicle);
            const savedChecklist = await queryRunner.manager.save(queryRunner.manager.create(checklist_entity_1.Checklist, {
                user_id,
                vehicle_id: dto.vehicle_id,
                kilometraje_actual: dto.kilometraje_actual,
                visual_checks: visual,
                mechanical_checks: mechanical,
                observaciones_generales: dto.observaciones_generales?.trim() || null,
                has_issues,
            }));
            if (files.length > 0) {
                const images = files.map(file => {
                    const name = this.baseName(file.originalname);
                    let check_type = 'general';
                    let check_item = name.slice(0, 100) || 'general';
                    if (name in visual)
                        check_type = 'visual';
                    else if (name in mechanical)
                        check_type = 'mecanico';
                    else if (REQUIRED_EXTERIOR.includes(name))
                        check_type = 'exterior';
                    else if (name.startsWith('foto_interior_'))
                        check_type = 'interior';
                    return queryRunner.manager.create(checklist_image_entity_1.ChecklistImage, {
                        checklist_id: savedChecklist.id,
                        image_path: file.filename,
                        check_type,
                        check_item,
                        description: (file.originalname || '').slice(0, 255),
                    });
                });
                await queryRunner.manager.save(images);
            }
            await queryRunner.commitTransaction();
            return await this.checklistsRepository.findOne({ where: { id: savedChecklist.id }, relations: ['images'] });
        }
        catch (err) {
            this.logger.error(`Error in create: ${err.message}`, err.stack);
            await queryRunner.rollbackTransaction();
            throw err;
        }
        finally {
            await queryRunner.release();
        }
    }
    async findAll(user, q) {
        const page = q.page ?? 1;
        const limit = q.limit ?? 20;
        const qb = this.checklistsRepository
            .createQueryBuilder('c')
            .leftJoinAndSelect('c.images', 'images')
            .leftJoinAndSelect('c.vehicle', 'vehicle')
            .leftJoin('c.user', 'u')
            .addSelect(['u.id', 'u.name', 'u.email'])
            .orderBy('c.created_at', 'DESC')
            .addOrderBy('c.id', 'DESC')
            .skip((page - 1) * limit)
            .take(limit);
        if (!user.is_admin)
            qb.andWhere('c.user_id = :uid', { uid: user.userId });
        if (q.vehicle_id)
            qb.andWhere('c.vehicle_id = :vid', { vid: q.vehicle_id });
        if (q.patente)
            qb.andWhere('vehicle.patente ILIKE :pat', { pat: `%${q.patente.replace(/[\s-]/g, '').replace(/[%_]/g, '')}%` });
        if (q.has_issues !== undefined)
            qb.andWhere('c.has_issues = :hi', { hi: q.has_issues });
        if (q.desde)
            qb.andWhere(`c.created_at >= (:desde::date)::timestamp AT TIME ZONE '${TZ}'`, { desde: q.desde.slice(0, 10) });
        if (q.hasta)
            qb.andWhere(`c.created_at < ((:hasta::date + 1)::timestamp AT TIME ZONE '${TZ}')`, { hasta: q.hasta.slice(0, 10) });
        const [items, total] = await qb.getManyAndCount();
        return { items, total, page, limit };
    }
    async findOne(id, user) {
        const checklist = await this.checklistsRepository
            .createQueryBuilder('c')
            .leftJoinAndSelect('c.images', 'images')
            .leftJoinAndSelect('c.vehicle', 'vehicle')
            .leftJoin('c.user', 'u')
            .addSelect(['u.id', 'u.name', 'u.email'])
            .where('c.id = :id', { id })
            .getOne();
        if (!checklist || (!user.is_admin && checklist.user_id !== user.userId)) {
            throw new common_1.NotFoundException('Checklist not found');
        }
        return checklist;
    }
    async remove(id, user) {
        const checklist = await this.findOne(id, user);
        const paths = (checklist.images ?? []).map(i => i.image_path);
        await this.checklistsRepository.remove(checklist);
        await Promise.all(paths.map(p => (0, promises_1.unlink)((0, path_1.join)(process.cwd(), 'uploads', p.replace(/^.*[\\/]/, ''))).catch(() => undefined)));
    }
};
exports.ChecklistsService = ChecklistsService;
exports.ChecklistsService = ChecklistsService = ChecklistsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(checklist_entity_1.Checklist)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.DataSource])
], ChecklistsService);
//# sourceMappingURL=checklists.service.js.map