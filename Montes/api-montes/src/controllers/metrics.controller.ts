import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { MetricsService } from '../services/metrics.service';
import { CreateMetricDto } from '../models/dto/create-metric.dto';

@Controller('')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Post()
  async create(@Body() dto: CreateMetricDto) {
    return this.metricsService.createMetric(dto);
  }

  @Get('latest')
  async latestAllNames() {
    return this.metricsService.findLatestForEachName();
  }

  @Get('totalizador/:name')
  async getDailyTotalizer(
    @Param('name') name: string,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    return this.metricsService.getDailyTotalizer(name, start, end);
  }

  @Get('caudal/:name')
  async getFlowRate(
    @Param('name') name: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    return this.metricsService.getFlowRate(name, start, end);
  }

  @Get('totalizador-hora/:name')
  async getHourlyTotalizer(
    @Param('name') name: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    return this.metricsService.getHourlyTotalizer(name, start, end);
  }
}
