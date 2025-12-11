// 57/parc57.module.ts
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MetricsController } from "./metrics.controller";
import { MetricsService } from "./metrics.service";
import { Parc57Zagal } from "./parc57.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Parc57Zagal])], // Inyectamos el repositorio
  controllers: [MetricsController],
  providers: [MetricsService],
})
export class Parc57Module {}