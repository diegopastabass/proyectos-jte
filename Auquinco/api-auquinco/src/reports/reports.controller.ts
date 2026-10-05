import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ReportsService } from './reports.service';
import { CreateReportDto } from './models/dto/create-report.dto';
import { DateRangeDto } from '../metrics/models/dto/date-range.dto';

@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  // POST /reports
  // Usado por el script de Python para guardar el resultado de la operación DGA
  @Post()
  create(@Req() req: Request, @Body() dto: CreateReportDto) {
    const clientIp = req.ip;
    const isLocalhost =
      clientIp === '127.0.0.1' ||
      clientIp === '::1' ||
      clientIp === '::ffff:127.0.0.1';

    // Si la IP no es localhost (directamente o por proxy local), rechazamos
    if (!isLocalhost) {
      throw new UnauthorizedException(
        'El acceso a este endpoint está restringido a localhost',
      );
    }

    // Verificamos la contraseña en los headers
    const password = req.headers['x-api-password'];
    if (!password || password !== process.env.REPORTS_API_PASSWORD) {
      throw new UnauthorizedException('Contraseña inválida o ausente');
    }

    return this.service.create(dto);
  }

  // GET /reports?start=2024-01-01&end=2024-01-31
  // Para ver el historial en el dashboard
  @Get()
  findAll(@Query() dto: DateRangeDto) {
    return this.service.findAll(dto);
  }
}
