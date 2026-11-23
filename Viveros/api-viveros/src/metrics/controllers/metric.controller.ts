import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { MetricsService } from '../services/metrics.service';
import { CreateMetricDto } from '../models/dto/create-metric.dto';
import { DiaDto, RangoAntiguoDto } from '../models/dto/viveros.dto';

/**
 * Rutas originales. `POST /` (ingesta), `latest` y `min-max` las usan equipos y
 * monitores: su forma no cambia.
 */
@Controller('')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Post()
  async create(@Body() dto: CreateMetricDto) {
    return this.metricsService.createMetric(dto);
  }

  @Get('latest')
  async findLatest() {
    return this.metricsService.findLatestForEachSensor();
  }

  @Get('summary')
  async findSummary(@Query() q: RangoAntiguoDto) {
    return this.metricsService.findMetricsBySensorsAndDateRange(
      q.startDate,
      q.endDate,
    );
  }

  @Get('chart')
  async findChartDataC() {
    return this.metricsService.findChartData();
  }

  @Get('data')
  async findData(@Query() q: RangoAntiguoDto) {
    return this.metricsService.getViverosDataForExcel(q.startDate, q.endDate);
  }

  @Get('min-max')
  async getMinMax(@Query() q: DiaDto) {
    return this.metricsService.getMinMax(q.date);
  }
}
