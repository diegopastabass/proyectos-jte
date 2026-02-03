import { Session } from './session.entity';
export declare class Measurement {
    id: string;
    session: Session;
    name: string;
    value: number;
    time: Date;
    location: string;
    imagePath: string;
}
