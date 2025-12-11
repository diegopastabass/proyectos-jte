import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseIntPipe,
  Query
} from '@nestjs/common';
import { MetricsService } from '../services/metrics.service';
import { CreateMetricDto } from '../models/dto/create-metric.dto';
import { DateRangeDto } from 'src/models/dto/date-range.dto';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Post()
  async create(@Body() dto: CreateMetricDto) {
    return this.metricsService.createMetric(dto);
  }

  @Get('limit/:limit')
  async latest(@Param('limit', ParseIntPipe) limit: number) {
    return this.metricsService.findLatestMetrics(limit);
  }

  @Get('name/:name')
  async latestByName(@Param('name') name: string) {
    return this.metricsService.findLatestMetricByName(name);
  }

  @Get('latest')
  async latestAllNames() {
    return this.metricsService.findLatestForEachName();
  }

  @Get('update')
  async latestUpdate() {
    return this.metricsService.findLastUpdateTime();
  }

  @Get('emptying')
  async emptyingTimes() {
    return this.metricsService.estimateEmptyingTimes();
  }

  @Get('totalizador')
  getTotalizador(@Query() dto: DateRangeDto) {
    return this.metricsService.getTotalizador(dto);
  }

  @Get('all')
  async allMeasurements() {
    return this.metricsService.findAllMeasurements();
  }

  @Get('caudal')
  getCaudal(@Query() dto: DateRangeDto) {
    return this.metricsService.getCaudal(dto);
  }
}
