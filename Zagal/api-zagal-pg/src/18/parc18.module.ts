// 18/parc18.module.ts
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MetricsController } from "./metrics.controller";
import { MetricsService } from "./metrics.service";
import { Parc18Zagal } from "./parc18.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Parc18Zagal])], // Inyectamos el repositorio
  controllers: [MetricsController],
  providers: [MetricsService],
})
export class Parc18Module {}