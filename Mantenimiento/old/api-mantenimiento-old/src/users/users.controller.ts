// users.controller.ts
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './create-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Post()
  async create(@Body() dto: CreateUserDto) {
    const insertedId = await this.service.create(dto);
    return { success: true, insertedId };
  }

  @UseGuards(JwtAuthGuard)
  @Get('user/:id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const user = await this.service.find(id);
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return { success: true, user };
  }

  @UseGuards(JwtAuthGuard)
  @Get('byrole/:num')
  async findUserByRole(@Param('num', ParseIntPipe) num: number) {
    const users = await this.service.findByRole(num);
    return { success: true, users };
  }
}
