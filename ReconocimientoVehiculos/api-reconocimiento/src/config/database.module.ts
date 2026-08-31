import { Module } from '@nestjs/common';
import { DatabaseConfig } from './database.config.js';

@Module({
  providers: [DatabaseConfig],
  exports: [DatabaseConfig],
})
export class DatabaseModule {}
