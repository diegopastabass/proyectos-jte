import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DatabaseModule } from "./config/database.module";
import { DatabaseConfig } from "./config/database.config";

// Nuevos Módulos
import { UsersModule } from './users/users.module';
import { ReportsModule } from './reports/reports.module';

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
    
    UsersModule,
    ReportsModule,
  ],
})
export class AppModule {}