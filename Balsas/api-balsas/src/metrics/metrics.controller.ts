import { Controller, Get, Query } from '@nestjs/common';
import { SsrBalsasService } from './metrics.service';
import {
  DateRangeDto,
  PozoQueryDto,
  VoltajeQueryDto,
} from './models/dto/date-range.dto';

@Controller('')
export class SsrBalsasController {
  constructor(private readonly service: SsrBalsasService) {}

  @Get('snapshot')
  getSnapshot() {
    return this.service.getSnapshot();
  }

  // Último dato de cada equipo: lo usa el monitor para avisar desconexiones
  @Get('equipos')
  getEquipos() {
    return this.service.getEquipos();
  }

  // Series: ?start=AAAA-MM-DD&end=AAAA-MM-DD, o ?limit=N (100 por defecto)
  @Get('nivel')
  getNivel(@Query() dto: DateRangeDto) {
    return this.service.getNivel(dto);
  }

  @Get('caudal')
  getCaudal(@Query() dto: DateRangeDto) {
    return this.service.getCaudal(dto);
  }

  @Get('presion')
  getPresion(@Query() dto: DateRangeDto) {
    return this.service.getPresion(dto);
  }

  @Get('caudal_descarga')
  getCaudalDescarga(@Query() dto: DateRangeDto) {
    return this.service.getCaudalDescarga(dto);
  }

  @Get('solar')
  getSolar(@Query() dto: DateRangeDto) {
    return this.service.getSolar(dto);
  }

  // ?pozo=pozo_1|pozo_2&tipo=linea|fase, más el rango o limit
  @Get('voltaje')
  getVoltaje(@Query() dto: VoltajeQueryDto) {
    return this.service.getVoltaje(dto);
  }

  // ?pozo=pozo_1|pozo_2, más el rango o limit
  @Get('corriente')
  getCorriente(@Query() dto: PozoQueryDto) {
    return this.service.getCorriente(dto);
  }

  // Diarios: start y end obligatorios
  @Get('totalizador')
  getTotalizador(@Query() dto: DateRangeDto) {
    return this.service.getTotalizador(dto);
  }

  @Get('totalizador_descarga')
  getTotalizadorDescarga(@Query() dto: DateRangeDto) {
    return this.service.getTotalizadorDescarga(dto);
  }

  // ?pozo=pozo_1|pozo_2&start&end: minutos de operación por día
  @Get('horometro')
  getHorometro(@Query() dto: PozoQueryDto) {
    return this.service.getHorometro(dto);
  }
}
