import { Module } from "@nestjs/common";
import { MetricsController } from "./controllers/metrics.controller";
import { MetricsService } from "./services/metrics.service";
import { DatabaseModule } from "../config/database.module";

@Module({
  imports: [DatabaseModule],
  controllers: [MetricsController],
  providers: [MetricsService],
})
export class Parc18Module {}
