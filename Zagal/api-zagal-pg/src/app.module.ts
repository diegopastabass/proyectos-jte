import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DatabaseModule } from "./config/database.module";
import { DatabaseConfig } from "./config/database.config";
import { Parc57Module } from "./57/parc57.module";
import { Parc82Module } from "./82/parc82.module";
import { Parc18Module } from "./18/parc18.module";
import { AllParcMetricsModule } from "./all-parc-metrics/all-parc-metrics.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    
    TypeOrmModule.forRootAsync({
      imports: [DatabaseModule],
      useExisting: DatabaseConfig,
    }),

    DatabaseModule,
    Parc57Module,
    Parc18Module,
    Parc82Module,
    AllParcMetricsModule,
  ],
})
export class AppModule {}