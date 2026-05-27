import { Module } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { UploadsController } from './uploads.controller';

/**
 * Module for file upload management utilities.
 * Static file serving is configured in the root AppModule.
 * This module provides cleanup and management services.
 */
@Module({
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
