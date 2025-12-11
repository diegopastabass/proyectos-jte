import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "./config/database.module";
import { Parc57Module } from "./57/parc57.module";
import { Parc18Module } from "./18/parc18.module";
import { Parc82Module } from "./82/parc82.module";
import { AllParcMetricsModule } from "./all-parc-metrics/all-parc-metrics.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    DatabaseModule,
    Parc57Module,
    Parc18Module,
    Parc82Module,
    AllParcMetricsModule,
  ],
})
export class AppModule {}
