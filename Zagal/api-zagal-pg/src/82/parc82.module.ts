// 82/parc82.module.ts
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MetricsController } from "./metrics.controller";
import { MetricsService } from "./metrics.service";
import { Parc82Zagal } from "./parc82.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Parc82Zagal])], // Inyectamos el repositorio
  controllers: [MetricsController],
  providers: [MetricsService],
})
export class Parc82Module {}