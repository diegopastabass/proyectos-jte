import { User } from '../../users/entities/user.entity';
export declare class Report {
    id: string;
    ticketNumber: number;
    clientName: string;
    status: string;
    data: any;
    createdAt: Date;
    updatedAt: Date;
    user: User;
    createdById: string;
}
