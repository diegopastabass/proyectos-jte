import { JwtPayload } from './jwt.payload.interface.js';
import { ConfigService } from '@nestjs/config';
declare const JwtStrategy_base: new (...args: any) => any;
export declare class JwtStrategy extends JwtStrategy_base {
    constructor(configService: ConfigService);
    validate(payload: JwtPayload): Promise<{
        userId: number;
        username: string;
        rol: string;
    }>;
}
export {};
