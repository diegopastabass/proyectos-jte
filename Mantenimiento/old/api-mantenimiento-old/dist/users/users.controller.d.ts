import { UsersService } from './users.service';
import { CreateUserDto } from './create-user.dto';
export declare class UsersController {
    private readonly service;
    constructor(service: UsersService);
    create(dto: CreateUserDto): Promise<{
        success: boolean;
        insertedId: number;
    }>;
    findOne(id: number): Promise<{
        success: boolean;
        message: string;
        user?: undefined;
    } | {
        success: boolean;
        user: import("./users.entity").User;
        message?: undefined;
    }>;
    findUserByRole(num: number): Promise<{
        success: boolean;
        users: {
            id: number;
            name: string;
        }[];
    }>;
}
