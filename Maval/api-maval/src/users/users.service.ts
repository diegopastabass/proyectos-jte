import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  // 1. Crear Usuario
  async create(
    createUserDto: CreateUserDto,
  ): Promise<{ message: string; createdAt: Date }> {
    const { email, password, name } = createUserDto;

    const existing = await this.userRepository.findOne({ where: { email } });
    if (existing) throw new ConflictException('El email ya está registrado');

    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(password, salt);

    const user = this.userRepository.create({
      email,
      password_hash: passwordHash,
      name: name,
      role: '1',
    });

    const savedUser = await this.userRepository.save(user);

    return {
      message: 'Usuario creado exitosamente',
      createdAt: savedUser.created_at,
    };
  }

  async validateUser(loginUserDto: LoginUserDto): Promise<User> {
    const { email, password } = loginUserDto;

    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password_hash')
      .where('user.email = :email', { email })
      .getOne();

    if (user && (await bcrypt.compare(password, user.password_hash))) {
      const { password_hash, ...result } = user;
      return result as User;
    }

    throw new UnauthorizedException('Credenciales inválidas');
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User with id ${id} not found`);
    return user;
  }
}
