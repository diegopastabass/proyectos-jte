import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './models/dto/create-report.dto';
import { DateRangeDto } from '../metrics/models/dto/date-range.dto';

@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  // POST /reports
  // Usado por tu script de Python para guardar el resultado de la operación DGA
  @Post()
  create(@Body() dto: CreateReportDto) {
    return this.service.create(dto);
  }

  // GET /reports?start=2024-01-01&end=2024-01-31
  // Para ver el historial en tu dashboard
  @Get()
  findAll(@Query() dto: DateRangeDto) {
    return this.service.findAll(dto);
  }
}
