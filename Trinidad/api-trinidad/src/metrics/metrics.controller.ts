import { Controller, Get, Query } from '@nestjs/common';
import { SsrTrinidadService } from './metrics.service';
import { DateRangeDto } from './models/dto/date-range.dto';

@Controller('')
export class SsrTrinidadController {
  constructor(private readonly service: SsrTrinidadService) {}

  @Get('snapshot')
  getSnapshot() {
    return this.service.getSnapshot();
  }

  @Get('totalizador_pozo')
  getTotalizador_pozo(@Query() dto: DateRangeDto) {
    return this.service.getTotalizador_pozo(dto);
  }

  @Get('totalizador_sentina')
  getTotalizador_sentina(@Query() dto: DateRangeDto) {
    return this.service.getTotalizador_sentina(dto);
  }

  @Get('horometro_e1')
  getHorometro_e1(@Query() dto: DateRangeDto) {
    return this.service.getHorometro_e1(dto);
  }

  @Get('horometro_e2')
  getHorometro_e2(@Query() dto: DateRangeDto) {
    return this.service.getHorometro_e2(dto);
  }

  @Get('horometro_pozo')
  getHorometro_bomba_pozo(@Query() dto: DateRangeDto) {
    return this.service.getHorometro_pozo(dto);
  }

  @Get('nivel')
  getNivel(@Query() dto: DateRangeDto) {
    return this.service.getNivel(dto);
  }

  @Get('caudal')
  getCaudal(@Query() dto: DateRangeDto) {
    return this.service.getCaudal(dto);
  }

  @Get('bomba_elevadora_1')
  getBombaElevadora1(@Query() dto: DateRangeDto) {
    return this.service.getBombaElevadora1(dto);
  }

  @Get('bomba_elevadora_2')
  getBombaElevadora2(@Query() dto: DateRangeDto) {
    return this.service.getBombaElevadora2(dto);
  }

  @Get('bomba_pozo')
  getBombaPozo(@Query() dto: DateRangeDto) {
    return this.service.getBombaPozo(dto);
  }

  @Get('totalizador_pozo_crecimiento')
  getTotalizadorPozoCrecimiento(@Query() dto: DateRangeDto) {
    return this.service.getTotalizadorPozoCrecimiento(dto);
  }

  @Get('totalizador_sentina_crecimiento')
  getTotalizadorSentinaCrecimiento(@Query() dto: DateRangeDto) {
    return this.service.getTotalizadorSentinaCrecimiento(dto);
  }
}
