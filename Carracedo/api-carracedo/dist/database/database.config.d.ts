import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
export declare class DatabaseConfig implements TypeOrmOptionsFactory {
    private config;
    constructor(config: ConfigService);
    createTypeOrmOptions(): TypeOrmModuleOptions;
}
