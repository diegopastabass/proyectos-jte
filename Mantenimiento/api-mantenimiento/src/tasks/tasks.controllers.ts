// tasks.controllers.ts
import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './create-task.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('tasks')
export class TasksController {
  constructor(private readonly service: TasksService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post()
  async create(@Body() dto: CreateTaskDto[] | CreateTaskDto) {
    const dtos = Array.isArray(dto) ? dto : [dto];
    const insertedIds = await this.service.create(dtos);
    return { success: true, insertedIds };
  }

  @UseGuards(JwtAuthGuard)
  @Get('find/:id')
  async findOne(@Param('id') id: number) {
    const task = await this.service.find(id);
    if (!task) {
      return { success: false, message: 'Task not found' };
    }
    return { success: true, task };
  }
  @UseGuards(JwtAuthGuard)
  @Get('device/:deviceId')
  async findByDevice(@Param('deviceId') deviceId: number) {
    const tasks = await this.service.findByDevice(deviceId);
    return { success: true, tasks };
  }
  @UseGuards(JwtAuthGuard)
  @Put('update/:id/status')
  async updateStatus(@Param('id') id: number, @Body('status') status: boolean) {
    await this.service.updateStatus(id, status);
    return { success: true };
  }
}
