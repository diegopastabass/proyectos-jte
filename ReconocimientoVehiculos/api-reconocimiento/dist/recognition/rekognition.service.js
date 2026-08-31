"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var RekognitionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RekognitionService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const client_rekognition_1 = require("@aws-sdk/client-rekognition");
let RekognitionService = RekognitionService_1 = class RekognitionService {
    configService;
    logger = new common_1.Logger(RekognitionService_1.name);
    client;
    constructor(configService) {
        this.configService = configService;
        this.client = new client_rekognition_1.RekognitionClient({
            region: this.configService.get('AWS_REGION') || 'us-east-1',
            credentials: {
                accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID') || '',
                secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY') || '',
            },
        });
    }
    async detectTextFromImage(imageBuffer) {
        this.logger.log('Enviando imagen a AWS Rekognition para detección de texto');
        try {
            const command = new client_rekognition_1.DetectTextCommand({
                Image: {
                    Bytes: imageBuffer,
                },
            });
            const response = await this.client.send(command);
            const detections = response.TextDetections || [];
            this.logger.log(`Textos detectados: ${detections.length}`);
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
        }
        catch (error) {
            this.logger.error(`Error en AWS Rekognition: ${error.message}`, error.stack);
            throw error;
        }
    }
    normalizeChileanPlate(raw) {
        let cleaned = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        if (cleaned.length < 6 || cleaned.length > 8) {
            return null;
        }
        if (cleaned.length > 6) {
            for (let i = 0; i <= cleaned.length - 6; i++) {
                const sub = cleaned.substring(i, i + 6);
                const result = this.tryNormalize(sub);
                if (result)
                    return result;
            }
            return null;
        }
        return this.tryNormalize(cleaned);
    }
    tryNormalize(plate) {
        const oldFormat = this.tryOldFormat(plate);
        if (oldFormat)
            return oldFormat;
        const newFormat = this.tryNewFormat(plate);
        if (newFormat)
            return newFormat;
        return null;
    }
    tryOldFormat(plate) {
        if (plate.length !== 6)
            return null;
        let result = '';
        for (let i = 0; i < 2; i++) {
            result += this.toLetterOCR(plate[i]);
        }
        for (let i = 2; i < 6; i++) {
            result += this.toDigitOCR(plate[i]);
        }
        if (/^[A-Z]{2}[0-9]{4}$/.test(result)) {
            return result;
        }
        return null;
    }
    tryNewFormat(plate) {
        if (plate.length !== 6)
            return null;
        let result = '';
        for (let i = 0; i < 4; i++) {
            result += this.toLetterOCR(plate[i]);
        }
        for (let i = 4; i < 6; i++) {
            result += this.toDigitOCR(plate[i]);
        }
        if (/^[A-Z]{4}[0-9]{2}$/.test(result)) {
            return result;
        }
        return null;
    }
    toLetterOCR(char) {
        const map = {
            '0': 'O',
            '1': 'I',
            '2': 'Z',
            '5': 'S',
            '8': 'B',
            '6': 'G',
        };
        return map[char] || char;
    }
    toDigitOCR(char) {
        const map = {
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
};
exports.RekognitionService = RekognitionService;
exports.RekognitionService = RekognitionService = RekognitionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], RekognitionService);
//# sourceMappingURL=rekognition.service.js.map