import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service.js';
import { UsersController } from './users.controller.js';
import { Usuario } from './models/user.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
