import { User } from './user.entity';
export declare class ErrorLog {
    id: string;
    user_id: string;
    user: User;
    error: string;
    timestamp: Date;
    created_at: Date;
}
