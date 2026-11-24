export declare class CreateChecklistDto {
    vehicle_id: string;
    kilometraje_actual: number;
    visual_checks: Record<string, any>;
    mechanical_checks: Record<string, any>;
    observaciones_generales?: string;
    has_issues?: boolean;
}
