import { Controller, Get, Query } from '@nestjs/common';
import { SsrTamboService } from './metrics.service';
import {
  CaudalQueryDto,
  DiarioQueryDto,
  NivelQueryDto,
} from './models/dto/sensor-query.dto';

@Controller('')
export class SsrTamboController {
  constructor(private readonly service: SsrTamboService) {}

  @Get('snapshot')
  getSnapshot() {
    return this.service.getSnapshot();
  }

  // ?pozo=pozo_1|pozo_3&start=AAAA-MM-DD&end=AAAA-MM-DD
  @Get('totalizador')
  getTotalizador(@Query() dto: DiarioQueryDto) {
    return this.service.getTotalizador(dto);
  }

  // ?pozo=pozo_1|pozo_3&start=AAAA-MM-DD&end=AAAA-MM-DD
  @Get('horometro')
  getHorometro(@Query() dto: DiarioQueryDto) {
    return this.service.getHorometro(dto);
  }

  // ?estanque=estanque_superior|estanque_intermedio|estanque_inferior&start&end (o limit)
  @Get('nivel')
  getNivel(@Query() dto: NivelQueryDto) {
    return this.service.getNivel(dto);
  }

  // ?pozo=pozo_1|pozo_3&start&end (o limit)
  @Get('caudal')
  getCaudal(@Query() dto: CaudalQueryDto) {
    return this.service.getCaudal(dto);
  }
}
