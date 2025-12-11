import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { MetricsService } from '../services/metrics.service';
import { CreateMetricDto } from '../models/dto/create-metric.dto';
import { BadRequestException } from '@nestjs/common';

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
  async findSummary(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.metricsService.findMetricsBySensorsAndDateRange(
      startDate,
      endDate,
    );
  }

  @Get('chart')
  async findChartDataC() {
    return this.metricsService.findChartData();
  }

  @Get('data')
  async findData(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.metricsService.getViverosDataForExcel(startDate, endDate);
  }

  @Get('min-max')
  async getMinMax(@Query('date') date: string) {
    if (!date) {
      throw new BadRequestException(
        'Debe proveer la fecha en formato YYYY-MM-DD',
      );
    }

    try {
      const data = await this.metricsService.getMinMax(date);
      return data;
    } catch (error) {
      throw error;
    }
  }
}
