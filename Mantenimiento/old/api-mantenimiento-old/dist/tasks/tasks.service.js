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
exports.TasksService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const tasks_entity_1 = require("./tasks.entity");
let TasksService = class TasksService {
    tasksRepository;
    constructor(tasksRepository) {
        this.tasksRepository = tasksRepository;
    }
    async create(dtos) {
        try {
            const tasks = this.tasksRepository.create(dtos);
            await this.tasksRepository.save(tasks);
            return tasks.map((t) => t.id);
        }
        catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                throw new common_1.ConflictException('Duplicate entry for task');
            }
            throw new common_1.InternalServerErrorException(`Error creating tasks: ${error.message}`);
        }
    }
    async find(id) {
        try {
            const task = await this.tasksRepository.findOne({ where: { id } });
            if (!task) {
                throw new common_1.NotFoundException(`Task with id ${id} not found`);
            }
            return task;
        }
        catch (error) {
            throw new common_1.InternalServerErrorException(`Error finding task: ${error.message}`);
        }
    }
    async findByDevice(deviceId) {
        try {
            const tasks = await this.tasksRepository.find({
                where: { device_id: deviceId },
            });
            return tasks;
        }
        catch (error) {
            throw new common_1.InternalServerErrorException(`Error finding tasks for device: ${error.message}`);
        }
    }
    async updateStatus(id, status) {
        try {
            const task = await this.tasksRepository.findOne({ where: { id } });
            if (!task) {
                throw new common_1.NotFoundException(`Task with id ${id} not found`);
            }
            task.task_status = status;
            await this.tasksRepository.save(task);
        }
        catch (error) {
            throw new common_1.InternalServerErrorException(`Error updating task status: ${error.message}`);
        }
    }
};
exports.TasksService = TasksService;
exports.TasksService = TasksService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(tasks_entity_1.Task)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], TasksService);
//# sourceMappingURL=tasks.service.js.map