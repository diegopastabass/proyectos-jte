import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UsePipes,
  ValidationPipe,
  BadRequestException,
  Param,
} from '@nestjs/common';
import { MetricsService } from '../services/metrics.service';
import { CreateMetricDto } from '../models/dto/create-metric.dto';

@Controller('')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Post()
  @UsePipes(new ValidationPipe({ transform: true }))
  async createMetric(@Body() dto: CreateMetricDto) {
    return this.metricsService.createMetric(dto);
  }

  @Get('snapshot')
  async getSnapshot() {
    return this.metricsService.getSnapshot();
  }

  @Get('totalizador-piscina')
  async getTotalizadorPiscina(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException(
        'Debe proporcionar las fechas de inicio (startDate) y fin (endDate) para la consulta.',
      );
    }

    return this.metricsService.getTotalizadorPiscina(startDate, endDate);
  }

  @Get('totalizador-1')
  async getTotalizador1(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException(
        'Debe proporcionar las fechas de inicio (startDate) y fin (endDate) para la consulta.',
      );
    }

    return this.metricsService.getTotalizador1(startDate, endDate);
  }

  @Get('totalizador-2')
  async getTotalizador2(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    if (!startDate || !endDate) {
      throw new BadRequestException(
        'Debe proporcionar las fechas de inicio (startDate) y fin (endDate) para la consulta.',
      );
    }

    return this.metricsService.getTotalizador2(startDate, endDate);
  }

  @Get('caudal/:sensorId')
  async getCaudal(@Param('sensorId') sensorId: number) {
    return this.metricsService.getCaudal(sensorId);
  }
}
