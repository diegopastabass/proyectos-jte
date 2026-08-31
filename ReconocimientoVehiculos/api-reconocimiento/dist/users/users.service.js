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
var UsersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_entity_js_1 = require("./models/user.entity.js");
const bcrypt = __importStar(require("bcrypt"));
let UsersService = UsersService_1 = class UsersService {
    usuarioRepository;
    logger = new common_1.Logger(UsersService_1.name);
    constructor(usuarioRepository) {
        this.usuarioRepository = usuarioRepository;
    }
    async create(createUserDto) {
        const { username, password } = createUserDto;
        this.logger.log(`Iniciando creación de usuario: ${username}`);
        try {
            const existing = await this.usuarioRepository.findOne({ where: { username } });
            if (existing) {
                this.logger.warn(`Intento de registro duplicado para: ${username}`);
                throw new common_1.ConflictException('El nombre de usuario ya está registrado');
            }
            const salt = await bcrypt.genSalt();
            const passwordHash = await bcrypt.hash(password, salt);
            const user = this.usuarioRepository.create({
                username,
                passwordHash,
                rol: 'user',
                isActive: false,
            });
            const savedUser = await this.usuarioRepository.save(user);
            this.logger.log(`Usuario creado exitosamente con ID: ${savedUser.id}`);
            const { passwordHash: _, ...result } = savedUser;
            return result;
        }
        catch (error) {
            if (error instanceof common_1.ConflictException)
                throw error;
            this.logger.error(`Error en create(): ${error.message}`, error.stack);
            throw new common_1.InternalServerErrorException('Error al crear el usuario');
        }
    }
    async findAll() {
        this.logger.log('Listando todos los usuarios');
        try {
            const users = await this.usuarioRepository.find({
                select: ['id', 'username', 'rol', 'isActive'],
            });
            return users;
        }
        catch (error) {
            this.logger.error(`Error en findAll(): ${error.message}`, error.stack);
            throw new common_1.InternalServerErrorException('Error al listar usuarios');
        }
    }
    async findOne(id) {
        try {
            const user = await this.usuarioRepository.findOne({ where: { id } });
            if (!user) {
                this.logger.warn(`Usuario ID ${id} no encontrado`);
                throw new common_1.NotFoundException(`Usuario con id ${id} no encontrado`);
            }
            return user;
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException)
                throw error;
            this.logger.error(`Error buscando usuario ID ${id}: ${error.message}`, error.stack);
            throw new common_1.InternalServerErrorException('Error al buscar usuario');
        }
    }
    async toggleActive(id) {
        this.logger.log(`Toggling is_active para usuario ID: ${id}`);
        try {
            const user = await this.findOne(id);
            user.isActive = !user.isActive;
            await this.usuarioRepository.save(user);
            this.logger.log(`Usuario ID ${id} ahora tiene is_active: ${user.isActive}`);
            return { id: user.id, isActive: user.isActive };
        }
        catch (error) {
            if (error instanceof common_1.NotFoundException)
                throw error;
            this.logger.error(`Error en toggleActive(): ${error.message}`, error.stack);
            throw new common_1.InternalServerErrorException('Error al cambiar estado del usuario');
        }
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = UsersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_js_1.Usuario)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], UsersService);
//# sourceMappingURL=users.service.js.map