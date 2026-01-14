import { Controller, Get, Query } from '@nestjs/common';
import { SsrPuQuillayService } from './metrics.service';
import { DateRangeDto } from './models/dto/date-range.dto';

@Controller('')
export class SsrPuQuillayController {
  constructor(private readonly service: SsrPuQuillayService) {}

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

  @Get('caudal')
  getCaudal(@Query() dto: DateRangeDto) {
    return this.service.getCaudal(dto);
  }
}
