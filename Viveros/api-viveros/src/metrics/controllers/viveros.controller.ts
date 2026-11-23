import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import {
  ActualizarUmbralesDto,
  EpisodiosDto,
  HorarioDto,
  RangoDto,
  SerieDto,
} from '../models/dto/viveros.dto';
import { UmbralesService } from '../services/umbrales.service';
import { ViverosService } from '../services/viveros.service';

/** Rutas por zona que usa el dashboard nuevo. Las antiguas siguen en MetricsController. */
@Controller('')
export class ViverosController {
  constructor(
    private readonly viveros: ViverosService,
    private readonly umbrales: UmbralesService,
  ) {}

  /** Zonas y rangos permitidos. También lo lee el monitor de alarmas. */
  @Get('config')
  config() {
    return this.umbrales.config();
  }

  @Patch('config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('0')
  async actualizarConfig(@Body() dto: ActualizarUmbralesDto) {
    await this.umbrales.actualizar(dto.umbrales);
    return this.umbrales.config();
  }

  @Get('estado')
  estado() {
    return this.viveros.estado();
  }

  /** `?zona=frio&start&end` (días, `end` inclusivo) o `?zona=frio&horas=24`. */
  @Get('serie')
  serie(@Query() q: SerieDto) {
    return this.viveros.serie(q);
  }

  @Get('resumen-diario')
  resumenDiario(@Query() q: RangoDto) {
    return this.viveros.resumenDiario(q.start, q.end);
  }

  @Get('horario')
  horario(@Query() q: HorarioDto) {
    return this.viveros.horario(q.zona, q.start, q.end);
  }

  @Get('episodios')
  episodios(@Query() q: EpisodiosDto) {
    return this.viveros.episodios(q.start, q.end, q.zona);
  }
}
