import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RecognitionService } from './recognition.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@UseGuards(JwtAuthGuard)
@Controller('recognition')
export class RecognitionController {
  private readonly logger = new Logger(RecognitionController.name);

  constructor(private readonly recognitionService: RecognitionService) {}

  @Post('detect')
  @UseInterceptors(FileInterceptor('image'))
  async detect(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Debe enviar una imagen con el campo "image"');
    }

    this.logger.log(`Imagen recibida: ${file.originalname} (${file.size} bytes)`);
    return this.recognitionService.detectAndVerify(file.buffer);
  }

  @Post('detect-base64')
  async detectBase64(@Body() body: { image: string }) {
    if (!body.image) {
      throw new BadRequestException('Debe enviar la imagen en base64 en el campo "image"');
    }

    this.logger.log(`Imagen base64 recibida (${body.image.length} caracteres)`);

    // Remove data URI prefix if present (e.g. "data:image/jpeg;base64,")
    const base64Data = body.image.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    this.logger.log(`Buffer de imagen: ${imageBuffer.length} bytes`);
    return this.recognitionService.detectAndVerify(imageBuffer);
  }
}
