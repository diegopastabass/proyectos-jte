import { Controller, Get, Query } from '@nestjs/common';
import { SsrIdahueService } from './metrics.service';
import { DateRangeDto } from './models/dto/date-range.dto';

@Controller('')
export class SsrIdahueController {
  constructor(private readonly service: SsrIdahueService) {}

  @Get('snapshot')
  getSnapshot() {
    return this.service.getSnapshot();
  }

  @Get('horometro_planta1')
  getHorometroPlanta1(@Query() dto: DateRangeDto) {
    return this.service.getHorometroPlanta1(dto);
  }

  @Get('horometro_planta2')
  getHorometroPlanta2(@Query() dto: DateRangeDto) {
    return this.service.getHorometroPlanta2(dto);
  }

  @Get('nivel_planta1')
  getNivelPlanta1(@Query() dto: DateRangeDto) {
    return this.service.getNivelPlanta1(dto);
  }

  @Get('nivel_planta2')
  getNivelPlanta2(@Query() dto: DateRangeDto) {
    return this.service.getNivelPlanta2(dto);
  }
}
