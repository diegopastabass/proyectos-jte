// metrics.controller.ts
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  ParseIntPipe,
} from "@nestjs/common";
import { MetricsService } from "../services/metrics.service";
import { CreateMetricDto } from "../models/create-metric.dto";

@Controller("metrics")
export class MetricsController {
  constructor(private readonly service: MetricsService) {}

  @Post()
  async create(@Body() dto: CreateMetricDto) {
    const insertedId = await this.service.create(dto);
    return { success: true, insertedId };
  }

  @Get("limit/:limit")
  async latest(@Param("limit", ParseIntPipe) limit: number) {
    return this.service.findLatest(limit);
  }

  @Get("name/:name")
  async latestByName(@Param("name") name: string) {
    return this.service.findLatestByName(name);
  }

  @Get("latest")
  async latestAllNames() {
    return this.service.findLatestForEachName();
  }

  @Get("update")
  async latestUpdate() {
    return this.service.findLastUpdateTime();
  }

  @Get("emptying")
  async emptyingTimes() {
    return this.service.estimateEmptyingTimes();
  }

  @Get("all")
  async allMeasurements() {
    return this.service.findAllMeasurements();
  }
}
