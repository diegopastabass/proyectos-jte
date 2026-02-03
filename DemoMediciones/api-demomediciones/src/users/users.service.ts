import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const { email, password, fullName } = createUserDto;

    this.logger.log(`Iniciando creación de usuario: ${email}`);

    try {
      const existing = await this.userRepository.findOne({ where: { email } });
      if (existing) {
        this.logger.warn(`Intento de registro duplicado para: ${email}`);
        throw new ConflictException('El email ya está registrado');
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
    } catch (error) {
      this.logger.error(`Error en create(): ${error.message}`, error.stack);

      if (error instanceof ConflictException) throw error;

      throw new InternalServerErrorException(
        'Error al crear el usuario. Revise los logs del servidor.',
      );
    }
  }

  async validateUser(loginUserDto: LoginUserDto): Promise<User> {
    const { email, password } = loginUserDto;
    this.logger.log(`Validando credenciales para: ${email}`);

    try {
      const user = await this.userRepository.findOne({ where: { email } });

      if (!user) {
        this.logger.warn(`Usuario no encontrado: ${email}`);
        throw new UnauthorizedException('Credenciales inválidas');
      }

      const isMatch = await bcrypt.compare(password, user.password_hash);

      if (isMatch) {
        this.logger.log(`Login exitoso para: ${email}`);
        const { password_hash, ...result } = user;
        return result as User;
      } else {
        this.logger.warn(`Contraseña incorrecta para: ${email}`);
        throw new UnauthorizedException('Credenciales inválidas');
      }
    } catch (error) {
      this.logger.error(
        `Error en validateUser(): ${error.message}`,
        error.stack,
      );
      if (error instanceof UnauthorizedException) throw error;
      throw new InternalServerErrorException(
        'Error en el proceso de validación',
      );
    }
  }

  async findOne(id: string): Promise<User> {
    try {
      const user = await this.userRepository.findOne({ where: { id } });
      if (!user) {
        this.logger.warn(`Usuario ID ${id} no encontrado`);
        throw new NotFoundException(`User with id ${id} not found`);
      }
      return user;
    } catch (error) {
      this.logger.error(
        `Error buscando usuario ID ${id}: ${error.message}`,
        error.stack,
      );
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Error al buscar usuario');
    }
  }
}
