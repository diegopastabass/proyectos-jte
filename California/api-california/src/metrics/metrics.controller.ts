import { Controller, Get, Query } from '@nestjs/common';
import { SsrCaliforniaService } from './metrics.service';
import { DateRangeDto } from './models/dto/date-range.dto';

@Controller('')
export class SsrCaliforniaController {
  constructor(private readonly service: SsrCaliforniaService) {}

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

  @Get('metalico')
  getNivel(@Query() dto: DateRangeDto) {
    return this.service.getNivel(dto);
  }

  @Get('cerro')
  getNivel2(@Query() dto: DateRangeDto) {
    return this.service.getNivel2(dto);
  }
}
