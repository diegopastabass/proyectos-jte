// metrics.controller.ts
import { Controller, Get, Query } from "@nestjs/common";
import {
  MetricsService,
  LatestMetricResult,
} from "../services/metrics.service";

@Controller("")
export class MetricsController {
  constructor(private readonly service: MetricsService) {}

  @Get("/18/latest")
  async latestAllNames() {
    return this.service.findLatestForEachName();
  }

  @Get("/18/metrics")
  async latestMetric(): Promise<LatestMetricResult> {
    return this.service.findLatest();
  }

  @Get("/18/update")
  async latestUpdate() {
    return this.service.findLastUpdateTime();
  }

  @Get("/18/interval")
  async irrigationInterval() {
    return this.service.findIrrigationInterval();
  }

  @Get("/18/summary")
  async getIrrigationTimeSummary(
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string
  ) {
    return this.service.getDailyIrrigationSummary(startDate, endDate);
  }

  @Get("/18/sectors")
  async getLatestSectorMetrics() {
    return this.service.activeSectors();
  }
}
