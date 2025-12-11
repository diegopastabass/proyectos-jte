import { Controller, Get } from "@nestjs/common";
import { AllParcMetricsService } from "./all-parc-metrics.service";

@Controller("")
export class AllParcMetricsController {
  constructor(private readonly metricsService: AllParcMetricsService) {}

  @Get("active")
  async getActiveSectors() {
    return await this.metricsService.findAllActiveSectors();
  }
}
