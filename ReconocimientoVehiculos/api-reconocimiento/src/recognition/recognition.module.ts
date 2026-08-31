import { Module } from '@nestjs/common';
import { RecognitionService } from './recognition.service.js';
import { RecognitionController } from './recognition.controller.js';
import { RekognitionService } from './rekognition.service.js';
import { VehiclesModule } from '../vehicles/vehicles.module.js';

@Module({
  imports: [VehiclesModule],
  controllers: [RecognitionController],
  providers: [RecognitionService, RekognitionService],
})
export class RecognitionModule {}
