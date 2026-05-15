import { User } from '../../users/entities/user.entity';
import { Measurement } from './measurement.entity';
export declare class Session {
    id: string;
    user: User;
    measures_number: number;
    report_json: any;
    state: string;
    update_count: number;
    createdAt: Date;
    measurements: Measurement[];
}
