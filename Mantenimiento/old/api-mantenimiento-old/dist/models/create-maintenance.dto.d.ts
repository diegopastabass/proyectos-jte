export declare class CreateMaintenanceDto {
    client_id: number;
    admin_id: number;
    maintainer_id: number;
    maintenance_type: string;
    observations: string;
    maintenance_status: boolean;
    scheduled_date: Date;
    completed: boolean;
}
