// users.service.ts
import {
  Injectable,
  InternalServerErrorException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateUserDto } from './create-user.dto';
import { User } from './users.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(dto: CreateUserDto): Promise<number> {
    try {
      const existingUser = await this.userRepository.findOne({
        where: [{ email: dto.email }],
      });

      if (existingUser) {
        throw new ConflictException('Email already exists');
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
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Duplicate entry for username or email');
      }
      throw new InternalServerErrorException(
        `Error creating user: ${error.message}`,
      );
    }
  }

  async find(id: number): Promise<User> {
    try {
      const user = await this.userRepository.findOne({ where: { id } });
      if (!user) {
        throw new NotFoundException(`User with id ${id} not found`);
      }

      user.password_hash = '';
      return user;
    } catch (error) {
      throw new InternalServerErrorException(
        `Error fetching user: ${error.message}`,
      );
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      const user = await this.userRepository.findOne({ where: { email } });
      if (!user) {
        return null;
      }
      return user;
    } catch (error) {
      throw new InternalServerErrorException(
        `Error fetching user by email: ${error.message}`,
      );
    }
  }

  async findByRole(
    roleNumber: number,
  ): Promise<{ id: number; name: string }[]> {
    try {
      let role: string;

      switch (roleNumber) {
        case 1:
          role = 'admin';
          break;
        case 2:
          role = 'maintainer';
          break;
        default:
          throw new NotFoundException(
            `Role with number ${roleNumber} not found`,
          );
      }

      const users = await this.userRepository.find({
        where: { role },
        select: ['id', 'name'], // 👈 solo traemos id y name
      });

      if (!users || users.length === 0) {
        throw new NotFoundException(`No users found with role ${role}`);
      }

      return users;
    } catch (error) {
      throw new InternalServerErrorException(
        `Error fetching users by role: ${error.message}`,
      );
    }
  }
}
