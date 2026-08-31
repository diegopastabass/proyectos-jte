import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Usuario } from './models/user.entity.js';
import { CreateUserDto } from './models/create-user.dto.js';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<Omit<Usuario, 'passwordHash'>> {
    const { username, password } = createUserDto;
    this.logger.log(`Iniciando creación de usuario: ${username}`);

    try {
      const existing = await this.usuarioRepository.findOne({ where: { username } });
      if (existing) {
        this.logger.warn(`Intento de registro duplicado para: ${username}`);
        throw new ConflictException('El nombre de usuario ya está registrado');
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
      return result as Omit<Usuario, 'passwordHash'>;
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      this.logger.error(`Error en create(): ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al crear el usuario');
    }
  }

  async findAll(): Promise<Omit<Usuario, 'passwordHash'>[]> {
    this.logger.log('Listando todos los usuarios');
    try {
      const users = await this.usuarioRepository.find({
        select: ['id', 'username', 'rol', 'isActive'],
      });
      return users;
    } catch (error) {
      this.logger.error(`Error en findAll(): ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al listar usuarios');
    }
  }

  async findOne(id: number): Promise<Usuario> {
    try {
      const user = await this.usuarioRepository.findOne({ where: { id } });
      if (!user) {
        this.logger.warn(`Usuario ID ${id} no encontrado`);
        throw new NotFoundException(`Usuario con id ${id} no encontrado`);
      }
      return user;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error buscando usuario ID ${id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al buscar usuario');
    }
  }

  async toggleActive(id: number): Promise<{ id: number; isActive: boolean }> {
    this.logger.log(`Toggling is_active para usuario ID: ${id}`);
    try {
      const user = await this.findOne(id);
      user.isActive = !user.isActive;
      await this.usuarioRepository.save(user);
      this.logger.log(`Usuario ID ${id} ahora tiene is_active: ${user.isActive}`);
      return { id: user.id, isActive: user.isActive };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error en toggleActive(): ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al cambiar estado del usuario');
    }
  }
}
