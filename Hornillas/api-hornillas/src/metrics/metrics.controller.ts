import { Controller, Get, Query } from "@nestjs/common";
import { SsrMetricsService } from "./metrics.service";
import { DateRangeDto } from "./models/dto/date-range.dto";

@Controller("")
export class SsrMetricsController {
  constructor(private readonly service: SsrMetricsService) {}

  @Get("snapshot")
  getSnapshot() {
    return this.service.getSnapshot();
  }
  //
  @Get("totalizador")
  getTotalizador_1(@Query() dto: DateRangeDto) {
    return this.service.getTotalizador_1(dto);
  }
  //
  @Get("totalizador2")
  getTotalizador_2(@Query() dto: DateRangeDto) {
    return this.service.getTotalizador_2(dto);
  }
  //
  @Get("totalizador_pozo")
  getTotalizador_pozo(@Query() dto: DateRangeDto) {
    return this.service.getTotalizador_pozo(dto);
  }
  //
  @Get("horometro")
  getHorometro_1(@Query() dto: DateRangeDto) {
    return this.service.getHorometro_1(dto);
  }
  //
  @Get("horometro2")
  getHorometro_2(@Query() dto: DateRangeDto) {
    return this.service.getHorometro_2(dto);
  }
  //
  @Get("nivel")
  getNivel(@Query() dto: DateRangeDto) {
    return this.service.getNivel_1(dto);
  }
  //
  @Get("nivel2")
  getNivel2(@Query() dto: DateRangeDto) {
    return this.service.getNivel_2(dto);
  }
  //
  @Get("caudal")
  getCaudal_1(@Query() dto: DateRangeDto) {
    return this.service.getCaudal_1(dto);
  }
  //
  @Get("caudal2")
  getCaudal_2(@Query() dto: DateRangeDto) {
    return this.service.getCaudal_2(dto);
  }
  //
  @Get("caudal_pozo")
  getCaudal_pozo(@Query() dto: DateRangeDto) {
    return this.service.getCaudal_pozo(dto);
  }

  //
  @Get("horometro_pozo")
  getHorometro_pozo(@Query() dto: DateRangeDto) {
    return this.service.getHorometro_pozo(dto);
  }
  //
  @Get("presion")
  getPresion_1(@Query() dto: DateRangeDto) {
    return this.service.getPresion_1(dto);
  }
  //
  @Get("presion2")
  getPresion_2(@Query() dto: DateRangeDto) {
    return this.service.getPresion_2(dto);
  }
}
