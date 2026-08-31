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
var RecognitionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecognitionService = void 0;
const common_1 = require("@nestjs/common");
const rekognition_service_js_1 = require("./rekognition.service.js");
const vehicle_service_js_1 = require("../vehicles/vehicle.service.js");
let RecognitionService = RecognitionService_1 = class RecognitionService {
    rekognitionService;
    vehiculoService;
    logger = new common_1.Logger(RecognitionService_1.name);
    constructor(rekognitionService, vehiculoService) {
        this.rekognitionService = rekognitionService;
        this.vehiculoService = vehiculoService;
    }
    async detectAndVerify(imageBuffer) {
        this.logger.log('Iniciando flujo de reconocimiento de patente');
        const patente = await this.rekognitionService.detectTextFromImage(imageBuffer);
        if (!patente) {
            this.logger.warn('No se detectó patente válida en la imagen');
            return {
                status: 'sin_patente',
                message: 'No se pudo detectar una patente chilena válida en la imagen',
            };
        }
        this.logger.log(`Patente detectada: ${patente}. Consultando base de datos...`);
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
};
exports.RecognitionService = RecognitionService;
exports.RecognitionService = RecognitionService = RecognitionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [rekognition_service_js_1.RekognitionService,
        vehicle_service_js_1.VehiculoService])
], RecognitionService);
//# sourceMappingURL=recognition.service.js.map