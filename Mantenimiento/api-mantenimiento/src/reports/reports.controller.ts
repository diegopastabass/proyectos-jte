import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './dto/create-report.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // 1. Crear Reporte: Accesible para cualquier usuario logueado (rol 0 o 1)
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() createReportDto: CreateReportDto, @Request() req) {
    // req.user viene del JWT, contiene { userId, fullName, ... }
    return this.reportsService.create(createReportDto, req.user.userId);
  }

  // 2. Listar Reportes: Solo Admins (rol 1)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  findAll() {
    return this.reportsService.findAll();
  }

  // 3. Ver Detalle Reporte: Solo Admins (rol 1)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.reportsService.findOne(id);
  }
}