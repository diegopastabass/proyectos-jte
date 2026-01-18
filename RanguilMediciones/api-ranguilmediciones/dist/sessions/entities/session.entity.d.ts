import { User } from '../../users/entities/user.entity';
import { Measurement } from './measurement.entity';
export declare class Session {
    id: string;
    user: User;
    measures_number: number;
    report_json: any;
    createdAt: Date;
    measurements: Measurement[];
}
