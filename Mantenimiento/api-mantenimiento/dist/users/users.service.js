"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const users_entity_1 = require("./users.entity");
const bcrypt = __importStar(require("bcrypt"));
let UsersService = class UsersService {
    userRepository;
    constructor(userRepository) {
        this.userRepository = userRepository;
    }
    async create(dto) {
        try {
            const existingUser = await this.userRepository.findOne({
                where: [{ email: dto.email }],
            });
            if (existingUser) {
                throw new common_1.ConflictException('Email already exists');
            }
            const saltRounds = 10;
            const passwordHash = await bcrypt.hash(dto.password, saltRounds);
            const user = this.userRepository.create({
                name: dto.name,
                email: dto.email,
                password_hash: passwordHash,
                role: dto.role,
            });
            await this.userRepository.save(user);
            return user.id;
        }
        catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                throw new common_1.ConflictException('Duplicate entry for username or email');
            }
            throw new common_1.InternalServerErrorException(`Error creating user: ${error.message}`);
        }
    }
    async find(id) {
        try {
            const user = await this.userRepository.findOne({ where: { id } });
            if (!user) {
                throw new common_1.NotFoundException(`User with id ${id} not found`);
            }
            user.password_hash = '';
            return user;
        }
        catch (error) {
            throw new common_1.InternalServerErrorException(`Error fetching user: ${error.message}`);
        }
    }
    async findByEmail(email) {
        try {
            const user = await this.userRepository.findOne({ where: { email } });
            if (!user) {
                return null;
            }
            return user;
        }
        catch (error) {
            throw new common_1.InternalServerErrorException(`Error fetching user by email: ${error.message}`);
        }
    }
    async findByRole(roleNumber) {
        try {
            let role;
            switch (roleNumber) {
                case 1:
                    role = 'admin';
                    break;
                case 2:
                    role = 'maintainer';
                    break;
                default:
                    throw new common_1.NotFoundException(`Role with number ${roleNumber} not found`);
            }
            const users = await this.userRepository.find({
                where: { role },
                select: ['id', 'name'],
            });
            if (!users || users.length === 0) {
                throw new common_1.NotFoundException(`No users found with role ${role}`);
            }
            return users;
        }
        catch (error) {
            throw new common_1.InternalServerErrorException(`Error fetching users by role: ${error.message}`);
        }
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(users_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], UsersService);
//# sourceMappingURL=users.service.js.map