import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { MetricsService } from '../services/metrics.service';
import { CreateMetricDto } from '../models/dto/create-metric.dto';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Post()
  async create(@Body() dto: CreateMetricDto) {
    return this.metricsService.createMetric(dto);
  }

  @Get(':limit')
  async find(@Param('limit', ParseIntPipe) limit: number) {
    return this.metricsService.getMetrics(limit);
  }
}
