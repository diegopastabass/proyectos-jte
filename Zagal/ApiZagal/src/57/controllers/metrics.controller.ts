// metrics.controller.ts
import { Controller, Get, Query } from "@nestjs/common";
import {
  MetricsService,
  LatestMetricResult,
} from "../services/metrics.service";

@Controller("")
export class MetricsController {
  constructor(private readonly service: MetricsService) {}

  @Get("/57/latest")
  async latestAllNames() {
    return this.service.findLatestForEachName();
  }

  @Get("/57/metrics")
  async latestMetric(): Promise<LatestMetricResult> {
    return this.service.findLatest();
  }

  @Get("/57/update")
  async latestUpdate() {
    return this.service.findLastUpdateTime();
  }

  @Get("/57/interval")
  async irrigationInterval() {
    return this.service.findIrrigationInterval();
  }

  @Get("/57/summary")
  async getIrrigationTimeSummary(
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string
  ) {
    return this.service.getDailyIrrigationSummary(startDate, endDate);
  }

  @Get("/57/sectors")
  async getLatestSectorMetrics() {
    return this.service.activeSectors();
  }
}
