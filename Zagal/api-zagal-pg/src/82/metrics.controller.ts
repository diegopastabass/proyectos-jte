// metrics.controller.ts
import { Controller, Get, Query } from "@nestjs/common";
import {
  MetricsService,
  LatestMetricResult,
} from "./metrics.service";
import { assertDateRange } from "../common/db-errors";

@Controller("82")
export class MetricsController {
  constructor(private readonly service: MetricsService) {}

  @Get("/latest")
  async latestAllNames() {
    return this.service.findLatestForEachName();
  }

  @Get("/metrics")
  async latestMetric(): Promise<LatestMetricResult> {
    return this.service.findLatest();
  }

  @Get("/update")
  async latestUpdate() {
    return this.service.findLastUpdateTime();
  }

  @Get("/interval")
  async irrigationInterval() {
    return this.service.findIrrigationInterval();
  }

  @Get("/summary")
  async getIrrigationTimeSummary(
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string
  ) {
    assertDateRange(startDate, endDate);
    return this.service.getDailyIrrigationSummary(startDate, endDate);
  }

  @Get("/sectors")
  async getLatestSectorMetrics() {
    return this.service.activeSectors();
  }
}
