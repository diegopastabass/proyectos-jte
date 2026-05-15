export declare class UpdateMeasurementDto {
    name: string;
    value: number;
    location?: string;
}
export declare class UpdateSessionDto {
    measurements: UpdateMeasurementDto[];
    markComplete?: boolean;
}
