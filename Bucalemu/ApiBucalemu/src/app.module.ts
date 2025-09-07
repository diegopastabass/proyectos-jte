import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseConfig } from "./config/database.config";
import { MetricsController } from "./controllers/metrics.controller";
import { MetricsService } from "./services/metrics.service";
import { HttpModule } from "@nestjs/axios";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    HttpModule,
  ],
  controllers: [MetricsController],
  providers: [DatabaseConfig, MetricsService],
})
export class AppModule {}
