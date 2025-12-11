import { UsersService } from '../services/users.service';
import { CreateUserDto } from '../models/create-user.dto';
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
        user: import("../models/users.interface").User;
        message?: undefined;
    }>;
}
