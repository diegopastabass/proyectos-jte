import { Controller, Get, Query } from '@nestjs/common';
import { SsrCuevasService } from './metrics.service';
import { DateRangeDto } from './models/dto/date-range.dto';

@Controller('')
export class SsrCuevasController {
  constructor(private readonly service: SsrCuevasService) {}

  @Get('snapshot')
  getSnapshot() {
    return this.service.getSnapshot();
  }

  @Get('totalizador')
  getTotalizador(@Query() dto: DateRangeDto) {
    return this.service.getTotalizador(dto);
  }

  @Get('horometro')
  getHorometro(@Query() dto: DateRangeDto) {
    return this.service.getHorometro(dto);
  }

  @Get('nivel')
  getNivel(@Query() dto: DateRangeDto) {
    return this.service.getNivel(dto);
  }

  @Get('nivel2')
  getNivel2(@Query() dto: DateRangeDto) {
    return this.service.getNivel2(dto);
  }

  @Get('caudal')
  getCaudal(@Query() dto: DateRangeDto) {
    return this.service.getCaudal(dto);
  }

  @Get('freatico')
  getFreatico(@Query() dto: DateRangeDto) {
    return this.service.getFreatico(dto);
  }

  @Get('kwh')
  getKwh(@Query() dto: DateRangeDto) {
    return this.service.getKwh(dto);
  }

  @Get('voltaje')
  getVoltaje(@Query() dto: DateRangeDto) {
    return this.service.getVoltaje(dto);
  }

  @Get('corriente')
  getCorriente(@Query() dto: DateRangeDto) {
    return this.service.getCorriente(dto);
  }
}
