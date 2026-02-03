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
const user_entity_1 = require("./entities/user.entity");
const bcrypt = __importStar(require("bcrypt"));
let UsersService = UsersService_1 = class UsersService {
    userRepository;
    logger = new common_1.Logger(UsersService_1.name);
    constructor(userRepository) {
        this.userRepository = userRepository;
    }
    async create(createUserDto) {
        const { email, password, fullName } = createUserDto;
        this.logger.log(`Iniciando creación de usuario: ${email}`);
        try {
            const existing = await this.userRepository.findOne({ where: { email } });
            if (existing) {
                this.logger.warn(`Intento de registro duplicado para: ${email}`);
                throw new common_1.ConflictException('El email ya está registrado');
            }
            this.logger.debug('Generando hash de contraseña...');
            const salt = await bcrypt.genSalt();
            const passwordHash = await bcrypt.hash(password, salt);
            const user = this.userRepository.create({
                email,
                password_hash: passwordHash,
                name: fullName,
                type: '0',
            });
            const savedUser = await this.userRepository.save(user);
            this.logger.log(`Usuario creado exitosamente con ID: ${savedUser.id}`);
            return savedUser;
        }
        catch (error) {
            this.logger.error(`Error en create(): ${error.message}`, error.stack);
            if (error instanceof common_1.ConflictException)
                throw error;
            throw new common_1.InternalServerErrorException('Error al crear el usuario. Revise los logs del servidor.');
        }
    }
    async validateUser(loginUserDto) {
        const { email, password } = loginUserDto;
        this.logger.log(`Validando credenciales para: ${email}`);
        try {
            const user = await this.userRepository.findOne({ where: { email } });
            if (!user) {
                this.logger.warn(`Usuario no encontrado: ${email}`);
                throw new common_1.UnauthorizedException('Credenciales inválidas');
            }
            const isMatch = await bcrypt.compare(password, user.password_hash);
            if (isMatch) {
                this.logger.log(`Login exitoso para: ${email}`);
                const { password_hash, ...result } = user;
                return result;
            }
            else {
                this.logger.warn(`Contraseña incorrecta para: ${email}`);
                throw new common_1.UnauthorizedException('Credenciales inválidas');
            }
        }
        catch (error) {
            this.logger.error(`Error en validateUser(): ${error.message}`, error.stack);
            if (error instanceof common_1.UnauthorizedException)
                throw error;
            throw new common_1.InternalServerErrorException('Error en el proceso de validación');
        }
    }
    async findOne(id) {
        try {
            const user = await this.userRepository.findOne({ where: { id } });
            if (!user) {
                this.logger.warn(`Usuario ID ${id} no encontrado`);
                throw new common_1.NotFoundException(`User with id ${id} not found`);
            }
            return user;
        }
        catch (error) {
            this.logger.error(`Error buscando usuario ID ${id}: ${error.message}`, error.stack);
            if (error instanceof common_1.NotFoundException)
                throw error;
            throw new common_1.InternalServerErrorException('Error al buscar usuario');
        }
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = UsersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], UsersService);
//# sourceMappingURL=users.service.js.map