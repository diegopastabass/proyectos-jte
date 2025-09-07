// maintenances.controller.ts
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { MaintenancesService } from './maintenances.service';
import { CreateMaintenanceDto } from './create-maintenance.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('maintenances')
export class MaintenancesController {
  constructor(private readonly service: MaintenancesService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post()
  async create(@CurrentUser() user: any, @Body() dto: CreateMaintenanceDto) {
    if (!user?.id) {
      throw new BadRequestException('Invalid user ID');
    }

    try {
      const insertedId = await this.service.create({
        ...dto,
        admin_id: user.id, // ya es número gracias a JwtStrategy
      });
      return { success: true, insertedId };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('find/:id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const maintenance = await this.service.find(id);
    if (!maintenance) {
      return { success: false, message: 'Maintenance not found' };
    }
    return { success: true, maintenance };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin')
  async findByAdmin(@CurrentUser() user: any) {
    const maintenances = await this.service.findByAdmin(user.id);
    return { success: true, maintenances };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('maintainer')
  @Get('maintainer')
  async findByMaintainer(@CurrentUser() user: any) {
    const maintenances = await this.service.findByMaintainer(user.id);
    return { success: true, maintenances };
  }
}
