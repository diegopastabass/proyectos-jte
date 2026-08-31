import { RecognitionService } from './recognition.service.js';
export declare class RecognitionController {
    private readonly recognitionService;
    private readonly logger;
    constructor(recognitionService: RecognitionService);
    detect(file: Express.Multer.File): Promise<import("./recognition.service.js").RecognitionResult>;
    detectBase64(body: {
        image: string;
    }): Promise<import("./recognition.service.js").RecognitionResult>;
}
