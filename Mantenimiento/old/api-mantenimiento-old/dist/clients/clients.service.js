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
exports.ClientsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const clients_entity_1 = require("./clients.entity");
let ClientsService = class ClientsService {
    clientesRepo;
    constructor(clientesRepo) {
        this.clientesRepo = clientesRepo;
    }
    async create(dto) {
        try {
            const cliente = this.clientesRepo.create(dto);
            const result = await this.clientesRepo.save(cliente);
            return result.id;
        }
        catch (error) {
            throw new common_1.InternalServerErrorException(`Error creating client: ${error}`);
        }
    }
    async find(id) {
        try {
            const client = await this.clientesRepo.findOne({ where: { id } });
            return client || null;
        }
        catch (error) {
            throw new common_1.InternalServerErrorException(`Error fetching client: ${error}`);
        }
    }
    async findAll() {
        try {
            const clients = await this.clientesRepo.find({
                select: ['id', 'name'],
            });
            return clients;
        }
        catch (error) {
            throw new common_1.InternalServerErrorException(`Error fetching clients: ${error}`);
        }
    }
};
exports.ClientsService = ClientsService;
exports.ClientsService = ClientsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(clients_entity_1.Client)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ClientsService);
//# sourceMappingURL=clients.service.js.map