import { Controller, Get, Query } from '@nestjs/common';
import { SsrCarmenService } from './metrics.service';
import { DateRangeDto } from './models/dto/date-range.dto';

@Controller('')
export class SsrCarmenController {
  constructor(private readonly service: SsrCarmenService) {}

  @Get('snapshot')
  getSnapshot() {
    return this.service.getSnapshot();
  }

  @Get('horometro_bajo')
  getHorometroBajo(@Query() dto: DateRangeDto) {
    return this.service.getHorometroBajo(dto);
  }

  @Get('horometro_sentina')
  getHorometroSentina(@Query() dto: DateRangeDto) {
    return this.service.getHorometroSentina(dto);
  }

  @Get('nivel_bajo')
  getNivelBajo(@Query() dto: DateRangeDto) {
    return this.service.getNivelBajo(dto);
  }

  @Get('nivel_sentina')
  getNivelSentina(@Query() dto: DateRangeDto) {
    return this.service.getNivelSentina(dto);
  }
}
