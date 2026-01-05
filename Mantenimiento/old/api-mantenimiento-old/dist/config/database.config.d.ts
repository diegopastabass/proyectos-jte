import { ConfigService } from '@nestjs/config';
import { Pool } from 'mysql2/promise';
export declare class DatabaseConfig {
    private readonly config;
    pool: Pool;
    constructor(config: ConfigService);
}
