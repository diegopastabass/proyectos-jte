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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_1 = require("../entities/user.entity");
const bcrypt = require("bcrypt");
let UsersService = class UsersService {
    constructor(usersRepository) {
        this.usersRepository = usersRepository;
    }
    async create(createUserDto) {
        const existing = await this.usersRepository.findOne({ where: { email: createUserDto.email } });
        if (existing) {
            throw new common_1.ConflictException('Email already in use');
        }
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(createUserDto.password, salt);
        const user = this.usersRepository.create({
            name: createUserDto.name,
            email: createUserDto.email,
            password_hash,
            is_active: false,
            is_admin: false,
        });
        return this.usersRepository.save(user);
    }
    async findAll() {
        return this.usersRepository.find({ select: ['id', 'name', 'email', 'is_active', 'is_admin', 'created_at'] });
    }
    async findOne(id) {
        const user = await this.usersRepository.findOne({ where: { id } });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        return user;
    }
    async findByEmail(email) {
        return this.usersRepository.findOne({ where: { email } });
    }
    async update(id, updateUserDto) {
        const user = await this.findOne(id);
        if (updateUserDto.password) {
            const salt = await bcrypt.genSalt(10);
            user.password_hash = await bcrypt.hash(updateUserDto.password, salt);
        }
        if (updateUserDto.name !== undefined)
            user.name = updateUserDto.name;
        if (updateUserDto.email !== undefined)
            user.email = updateUserDto.email;
        if (updateUserDto.is_active !== undefined)
            user.is_active = updateUserDto.is_active;
        if (updateUserDto.is_admin !== undefined)
            user.is_admin = updateUserDto.is_admin;
        return this.usersRepository.save(user);
    }
    async remove(id) {
        const user = await this.findOne(id);
        user.is_active = false;
        await this.usersRepository.save(user);
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], UsersService);
//# sourceMappingURL=users.service.js.map