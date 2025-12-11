import { Module } from '@nestjs/common';
import { EnvManagerService } from './env-manager.service';
import { EnvManagerController } from './env-manager.controller';

@Module({
  providers: [EnvManagerService],
  controllers: [EnvManagerController],
})
export class EnvManagerModule {}
