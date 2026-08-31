import { ConfigService } from '@nestjs/config';
export declare class RekognitionService {
    private readonly configService;
    private readonly logger;
    private readonly client;
    constructor(configService: ConfigService);
    detectTextFromImage(imageBuffer: Buffer): Promise<string | null>;
    normalizeChileanPlate(raw: string): string | null;
    private tryNormalize;
    private tryOldFormat;
    private tryNewFormat;
    private toLetterOCR;
    private toDigitOCR;
}
