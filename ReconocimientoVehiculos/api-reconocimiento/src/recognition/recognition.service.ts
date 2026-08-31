import { Injectable, Logger } from '@nestjs/common';
import { RekognitionService } from './rekognition.service.js';
import { VehiculoService } from '../vehicles/vehicle.service.js';

export interface RecognitionResult {
  status: 'registrado' | 'no_reconocido' | 'sin_patente';
  patente?: string;
  persona?: {
    id: number;
    nombre: string;
  };
  message?: string;
}

@Injectable()
export class RecognitionService {
  private readonly logger = new Logger(RecognitionService.name);

  constructor(
    private readonly rekognitionService: RekognitionService,
    private readonly vehiculoService: VehiculoService,
  ) {}

  async detectAndVerify(imageBuffer: Buffer): Promise<RecognitionResult> {
    this.logger.log('Iniciando flujo de reconocimiento de patente');

    // Step 1: OCR via AWS Rekognition
    const patente = await this.rekognitionService.detectTextFromImage(imageBuffer);

    if (!patente) {
      this.logger.warn('No se detectó patente válida en la imagen');
      return {
        status: 'sin_patente',
        message: 'No se pudo detectar una patente chilena válida en la imagen',
      };
    }

    this.logger.log(`Patente detectada: ${patente}. Consultando base de datos...`);

    // Step 2: Query database
    const vehiculo = await this.vehiculoService.findByPatente(patente);

    if (vehiculo && vehiculo.persona) {
      this.logger.log(`Patente ${patente} encontrada. Dueño: ${vehiculo.persona.nombre}`);
      return {
        status: 'registrado',
        patente,
        persona: {
          id: vehiculo.persona.id,
          nombre: vehiculo.persona.nombre,
        },
      };
    }

    this.logger.log(`Patente ${patente} no registrada en el sistema`);
    return {
      status: 'no_reconocido',
      patente,
      message: 'Patente no registrada en el sistema',
    };
  }
}
