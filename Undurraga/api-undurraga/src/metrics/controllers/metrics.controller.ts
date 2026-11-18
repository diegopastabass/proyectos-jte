import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { MetricsService } from '../services/metrics.service';
import { CreateMetricDto } from '../models/dto/create-metric.dto';
import {
  DateRangeDto,
  LegacyDateRangeDto,
  MesesDto,
} from '../models/dto/date-range.dto';

const TOTALIZADOR_1 = 4;
const TOTALIZADOR_2 = 3;
const PISCINA = 5;

@Controller('')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  /** Ingesta desde terreno: la ruta, el cuerpo y la respuesta no deben cambiar. */
  @Post()
  @UsePipes(new ValidationPipe({ transform: true }))
  createMetric(@Body() dto: CreateMetricDto) {
    return this.metricsService.createMetric(dto);
  }

  @Get('latest')
  async latest() {
    return this.metricsService.getSnapshot();
  }

  /** Alias de `latest`: lo usan el dashboard anterior y el monitor de desconexión. */
  @Get('snapshot')
  async getSnapshot() {
    return this.metricsService.getSnapshot();
  }

  @Get('caudal/:sensor')
  async getCaudal(
    @Param('sensor', ParseIntPipe) sensor: number,
    @Query() { start, end }: DateRangeDto,
  ) {
    return this.metricsService.getCaudal(sensor, start, end);
  }

  @Get('totalizador/:sensor')
  async getDailyTotalizer(
    @Param('sensor', ParseIntPipe) sensor: number,
    @Query() { start, end }: DateRangeDto,
  ) {
    return this.metricsService.getDailyTotalizer(sensor, start, end);
  }

  @Get('totalizador-mes/:sensor')
  async getMonthlyTotalizer(
    @Param('sensor', ParseIntPipe) sensor: number,
    @Query() { meses }: MesesDto,
  ) {
    return this.metricsService.getMonthlyTotalizer(sensor, meses);
  }

  @Get('totalizador-hora/:sensor')
  async getHourlyTotalizer(
    @Param('sensor', ParseIntPipe) sensor: number,
    @Query() { start, end }: DateRangeDto,
  ) {
    return this.metricsService.getHourlyTotalizer(sensor, start, end);
  }

  @Get('consumo-hora/:sensor')
  async getHourlyVolumeFromFlow(
    @Param('sensor', ParseIntPipe) sensor: number,
    @Query() { start, end }: DateRangeDto,
  ) {
    return this.metricsService.getHourlyVolumeFromFlow(sensor, start, end);
  }

  // --- Rutas anteriores (se mantienen mientras se actualiza el dashboard) ---

  @Get('totalizador-1')
  async getTotalizador1(@Query() { startDate, endDate }: LegacyDateRangeDto) {
    return this.metricsService.getDailyTotalizer(
      TOTALIZADOR_1,
      startDate,
      endDate,
    );
  }

  @Get('totalizador-2')
  async getTotalizador2(@Query() { startDate, endDate }: LegacyDateRangeDto) {
    return this.metricsService.getDailyTotalizer(
      TOTALIZADOR_2,
      startDate,
      endDate,
    );
  }

  @Get('totalizador-piscina')
  async getTotalizadorPiscina(
    @Query() { startDate, endDate }: LegacyDateRangeDto,
  ) {
    return this.metricsService.getDailyTotalizer(PISCINA, startDate, endDate);
  }
}
