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
import { DateRangeDto } from 'src/models/dto/date-range.dto';

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
}
