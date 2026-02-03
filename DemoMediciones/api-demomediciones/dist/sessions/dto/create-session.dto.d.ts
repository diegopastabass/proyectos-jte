export declare class CreateMeasurementDto {
    name: string;
    value: number;
    time: string;
    location?: string;
}
export declare class CreateSessionDto {
    userId: string;
    measurements: CreateMeasurementDto[];
    reportMetadata?: any;
}
