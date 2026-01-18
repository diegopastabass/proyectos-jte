import { Report } from '../../reports/entities/report.entity';
export declare class User {
    id: string;
    email: string;
    password_hash: string;
    full_name: string;
    role: string;
    createdAt: Date;
    updatedAt: Date;
    reports: Report[];
}
