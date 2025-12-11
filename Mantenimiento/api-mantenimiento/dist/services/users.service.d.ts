import { DatabaseConfig } from '../config/database.config';
import { CreateUserDto } from '../models/create-user.dto';
import { User } from '../models/users.interface';
export declare class UsersService {
    private readonly dbConfig;
    constructor(dbConfig: DatabaseConfig);
    create(dto: CreateUserDto): Promise<number>;
    find(id: number): Promise<User | null>;
}
