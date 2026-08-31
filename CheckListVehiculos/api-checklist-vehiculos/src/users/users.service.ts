import { Injectable, ConflictException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    try {
      const existing = await this.usersRepository.findOne({ where: { email: createUserDto.email } });
      if (existing) {
        throw new ConflictException('Email already in use');
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

      return await this.usersRepository.save(user);
    } catch (error) {
      this.logger.error(`Error in create: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findAll(): Promise<User[]> {
    try {
      return await this.usersRepository.find({ select: ['id', 'name', 'email', 'is_active', 'is_admin', 'created_at'] });
    } catch (error) {
      this.logger.error(`Error in findAll: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findOne(id: string): Promise<User> {
    try {
      const user = await this.usersRepository.findOne({ where: { id } });
      if (!user) throw new NotFoundException('User not found');
      return user;
    } catch (error) {
      this.logger.error(`Error in findOne: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findByEmail(email: string): Promise<User> {
    try {
      return await this.usersRepository.findOne({ where: { email } });
    } catch (error) {
      this.logger.error(`Error in findByEmail: ${error.message}`, error.stack);
      throw error;
    }
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    try {
      const user = await this.findOne(id);
      
      if (updateUserDto.password) {
        const salt = await bcrypt.genSalt(10);
        user.password_hash = await bcrypt.hash(updateUserDto.password, salt);
      }
      
      if (updateUserDto.name !== undefined) user.name = updateUserDto.name;
      if (updateUserDto.email !== undefined) user.email = updateUserDto.email;
      if (updateUserDto.is_active !== undefined) user.is_active = updateUserDto.is_active;
      if (updateUserDto.is_admin !== undefined) user.is_admin = updateUserDto.is_admin;
      
      return await this.usersRepository.save(user);
    } catch (error) {
      this.logger.error(`Error in update: ${error.message}`, error.stack);
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    try {
      const user = await this.findOne(id);
      user.is_active = false;
      await this.usersRepository.save(user);
    } catch (error) {
      this.logger.error(`Error in remove: ${error.message}`, error.stack);
      throw error;
    }
  }
}
