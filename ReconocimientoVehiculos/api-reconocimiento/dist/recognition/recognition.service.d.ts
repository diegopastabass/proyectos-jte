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
export declare class RecognitionService {
    private readonly rekognitionService;
    private readonly vehiculoService;
    private readonly logger;
    constructor(rekognitionService: RekognitionService, vehiculoService: VehiculoService);
    detectAndVerify(imageBuffer: Buffer): Promise<RecognitionResult>;
}
