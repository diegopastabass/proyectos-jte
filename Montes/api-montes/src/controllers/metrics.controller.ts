import { Controller, Get, Param, Query } from '@nestjs/common';
import { MetricsService } from '../services/metrics.service';
import { DateRangeDto, MesesDto } from '../models/dto/date-range.dto';

@Controller('')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get('latest')
  async latestAllNames() {
    return this.metricsService.findLatestForEachName();
  }

  @Get('totalizador/:name')
  async getDailyTotalizer(
    @Param('name') name: string,
    @Query() { start, end }: DateRangeDto,
  ) {
    return this.metricsService.getDailyTotalizer(name, start, end);
  }

  @Get('totalizador-mes/:name')
  async getMonthlyTotalizer(
    @Param('name') name: string,
    @Query() { meses }: MesesDto,
  ) {
    return this.metricsService.getMonthlyTotalizer(name, meses);
  }

  @Get('caudal/:name')
  async getFlowRate(
    @Param('name') name: string,
    @Query() { start, end }: DateRangeDto,
  ) {
    return this.metricsService.getFlowRate(name, start, end);
  }

  @Get('totalizador-hora/:name')
  async getHourlyTotalizer(
    @Param('name') name: string,
    @Query() { start, end }: DateRangeDto,
  ) {
    return this.metricsService.getHourlyTotalizer(name, start, end);
  }

  @Get('consumo-hora/:name')
  async getHourlyVolumeFromFlow(
    @Param('name') name: string,
    @Query() { start, end }: DateRangeDto,
  ) {
    return this.metricsService.getHourlyVolumeFromFlow(name, start, end);
  }
}
