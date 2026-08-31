import { User } from './user.entity';
import { Vehicle } from './vehicle.entity';
import { ChecklistImage } from './checklist-image.entity';
export declare class Checklist {
    id: string;
    user_id: string;
    vehicle_id: string;
    user: User;
    vehicle: Vehicle;
    kilometraje_actual: number;
    visual_checks: any;
    mechanical_checks: any;
    observaciones_generales: string;
    has_issues: boolean;
    images: ChecklistImage[];
    created_at: Date;
    updated_at: Date;
}
