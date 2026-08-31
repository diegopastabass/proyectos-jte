import { Controller, Get, Query } from '@nestjs/common';
import { SsrCumpeoService } from './metrics.service';
import { DateRangeDto } from './models/dto/date-range.dto';

@Controller('')
export class SsrCumpeoController {
  constructor(private readonly service: SsrCumpeoService) {}

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

  @Get('horometro-pozo2')
  getHorometroPozo2(@Query() dto: DateRangeDto) {
    return this.service.getHorometroPozo2(dto);
  }

  @Get('nivel')
  getNivel(@Query() dto: DateRangeDto) {
    return this.service.getNivel(dto);
  }

  @Get('caudal')
  getCaudal(@Query() dto: DateRangeDto) {
    return this.service.getCaudal(dto);
  }
}
