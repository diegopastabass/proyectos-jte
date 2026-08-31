import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
export declare class DatabaseConfigService implements TypeOrmOptionsFactory {
    private configService;
    constructor(configService: ConfigService);
    createTypeOrmOptions(): TypeOrmModuleOptions;
}
