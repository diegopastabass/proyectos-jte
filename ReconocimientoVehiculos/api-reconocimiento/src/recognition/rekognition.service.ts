import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  RekognitionClient,
  DetectTextCommand,
  type TextDetection,
} from '@aws-sdk/client-rekognition';

@Injectable()
export class RekognitionService {
  private readonly logger = new Logger(RekognitionService.name);
  private readonly client: RekognitionClient;

  constructor(private readonly configService: ConfigService) {
    this.client = new RekognitionClient({
      region: this.configService.get<string>('AWS_REGION') || 'us-east-1',
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || '',
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '',
      },
    });
  }

  async detectTextFromImage(imageBuffer: Buffer): Promise<string | null> {
    this.logger.log('Enviando imagen a AWS Rekognition para detección de texto');

    try {
      const command = new DetectTextCommand({
        Image: {
          Bytes: imageBuffer,
        },
      });

      const response = await this.client.send(command);
      const detections: TextDetection[] = response.TextDetections || [];

      this.logger.log(`Textos detectados: ${detections.length}`);

      // Filter LINE type detections and try to normalize each one
      const lines = detections
        .filter((d) => d.Type === 'LINE')
        .sort((a, b) => (b.Confidence || 0) - (a.Confidence || 0));

      for (const detection of lines) {
        const rawText = detection.DetectedText || '';
        this.logger.debug(`Texto detectado: "${rawText}" (confianza: ${detection.Confidence}%)`);

        const normalized = this.normalizeChileanPlate(rawText);
        if (normalized) {
          this.logger.log(`Patente chilena detectada y normalizada: ${normalized}`);
          return normalized;
        }
      }

      // If no LINE matched, try WORD type detections as fallback
      const words = detections
        .filter((d) => d.Type === 'WORD')
        .sort((a, b) => (b.Confidence || 0) - (a.Confidence || 0));

      for (const detection of words) {
        const rawText = detection.DetectedText || '';
        const normalized = this.normalizeChileanPlate(rawText);
        if (normalized) {
          this.logger.log(`Patente chilena detectada (WORD) y normalizada: ${normalized}`);
          return normalized;
        }
      }

      this.logger.warn('No se detectó ninguna patente chilena válida en la imagen');
      return null;
    } catch (error) {
      this.logger.error(`Error en AWS Rekognition: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Normalizes a detected text string to a Chilean license plate format.
   * Chilean plate formats:
   *   - Old: AA1122 (2 letters + 4 digits)
   *   - New: BBCC12 (4 letters + 2 digits)
   *
   * Applies corrections for common OCR confusions:
   *   - O <-> 0, I <-> 1, S <-> 5, B <-> 8, Z <-> 2, G <-> 6, D <-> 0
   */
  normalizeChileanPlate(raw: string): string | null {
    // Remove spaces, dashes, dots, and special characters
    let cleaned = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

    if (cleaned.length < 6 || cleaned.length > 8) {
      return null;
    }

    // If length > 6, try to extract a 6-char substring that could be a plate
    if (cleaned.length > 6) {
      // Try all possible 6-char substrings
      for (let i = 0; i <= cleaned.length - 6; i++) {
        const sub = cleaned.substring(i, i + 6);
        const result = this.tryNormalize(sub);
        if (result) return result;
      }
      return null;
    }

    return this.tryNormalize(cleaned);
  }

  private tryNormalize(plate: string): string | null {
    // Try OLD format: LL-DDDD (2 letters + 4 digits)
    const oldFormat = this.tryOldFormat(plate);
    if (oldFormat) return oldFormat;

    // Try NEW format: LLLL-DD (4 letters + 2 digits)
    const newFormat = this.tryNewFormat(plate);
    if (newFormat) return newFormat;

    return null;
  }

  private tryOldFormat(plate: string): string | null {
    if (plate.length !== 6) return null;

    // First 2 should be letters, last 4 should be digits
    let result = '';

    // Fix first 2 chars to letters
    for (let i = 0; i < 2; i++) {
      result += this.toLetterOCR(plate[i]);
    }

    // Fix last 4 chars to digits
    for (let i = 2; i < 6; i++) {
      result += this.toDigitOCR(plate[i]);
    }

    // Validate: first 2 are letters, last 4 are digits
    if (/^[A-Z]{2}[0-9]{4}$/.test(result)) {
      return result;
    }
    return null;
  }

  private tryNewFormat(plate: string): string | null {
    if (plate.length !== 6) return null;

    // First 4 should be letters, last 2 should be digits
    let result = '';

    // Fix first 4 chars to letters
    for (let i = 0; i < 4; i++) {
      result += this.toLetterOCR(plate[i]);
    }

    // Fix last 2 chars to digits
    for (let i = 4; i < 6; i++) {
      result += this.toDigitOCR(plate[i]);
    }

    // Validate: first 4 are letters, last 2 are digits
    if (/^[A-Z]{4}[0-9]{2}$/.test(result)) {
      return result;
    }
    return null;
  }

  /** Convert a character to a letter, correcting common OCR digit→letter confusions */
  private toLetterOCR(char: string): string {
    const map: Record<string, string> = {
      '0': 'O',
      '1': 'I',
      '2': 'Z',
      '5': 'S',
      '8': 'B',
      '6': 'G',
    };
    return map[char] || char;
  }

  /** Convert a character to a digit, correcting common OCR letter→digit confusions */
  private toDigitOCR(char: string): string {
    const map: Record<string, string> = {
      'O': '0',
      'I': '1',
      'L': '1',
      'Z': '2',
      'S': '5',
      'B': '8',
      'G': '6',
      'D': '0',
      'Q': '0',
    };
    return map[char] || char;
  }
}
