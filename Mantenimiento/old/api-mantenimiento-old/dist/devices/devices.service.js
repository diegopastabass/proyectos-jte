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
exports.DevicesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const devices_entity_1 = require("./devices.entity");
let DevicesService = class DevicesService {
    deviceRepository;
    constructor(deviceRepository) {
        this.deviceRepository = deviceRepository;
    }
    async create(dtos) {
        try {
            const devices = this.deviceRepository.create(dtos);
            await this.deviceRepository.save(devices);
            return devices.map((d) => d.id);
        }
        catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                throw new common_1.ConflictException('Duplicate entry for serial number');
            }
            throw new common_1.InternalServerErrorException(`Error creating devices: ${error.message}`);
        }
    }
    async find(id) {
        try {
            const device = await this.deviceRepository.findOne({ where: { id } });
            if (!device) {
                throw new common_1.NotFoundException(`Device with id ${id} not found`);
            }
            return device;
        }
        catch (error) {
            throw new common_1.InternalServerErrorException(`Error finding device: ${error.message}`);
        }
    }
    async findByMaintenance(maintenanceId) {
        try {
            const devices = await this.deviceRepository.find({
                where: { maintenance_id: maintenanceId },
            });
            return devices;
        }
        catch (error) {
            throw new common_1.InternalServerErrorException(`Error finding devices by maintenance: ${error.message}`);
        }
    }
};
exports.DevicesService = DevicesService;
exports.DevicesService = DevicesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(devices_entity_1.Device)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], DevicesService);
//# sourceMappingURL=devices.service.js.map