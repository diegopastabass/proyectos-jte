import { DataSource } from 'typeorm';
export declare class DatabaseService {
    private dataSource;
    constructor(dataSource: DataSource);
    getDataSource(): DataSource;
}
