import { Module } from "@nestjs/common";
import { AllParcMetricsController } from "./all-parc-metrics.controller";
import { AllParcMetricsService } from "./all-parc-metrics.service";
import { DatabaseModule } from "../config/database.module";

@Module({
  imports: [DatabaseModule],
  controllers: [AllParcMetricsController],
  providers: [AllParcMetricsService],
})
export class AllParcMetricsModule {}
