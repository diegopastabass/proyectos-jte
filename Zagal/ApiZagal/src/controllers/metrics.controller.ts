// metrics.controller.ts
import { Controller, Get, Query } from "@nestjs/common";
import { MetricsService } from "../services/metrics.service";

@Controller("zagal")
export class MetricsController {
  constructor(private readonly service: MetricsService) {}

  @Get("latest")
  async latestAllNames() {
    return this.service.findLatestForEachName();
  }

  @Get("caudal")
  async latestCaudal() {
    return this.service.findLatest(1);
  }

  @Get("update")
  async latestUpdate() {
    return this.service.findLastUpdateTime();
  }

  @Get("interval")
  async irrigationInterval() {
    return this.service.findIrrigationInterval();
  }

  @Get("range")
  async getIrrigationTimeByRange(
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string
  ) {
    return this.service.getIrrigationTimeByRange(startDate, endDate);
  }
}
