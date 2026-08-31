import { UsersService } from './users.service.js';
import { CreateUserDto } from './models/create-user.dto.js';
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    create(createUserDto: CreateUserDto): Promise<Omit<import("./models/user.entity.js").Usuario, "passwordHash">>;
    findAll(): Promise<Omit<import("./models/user.entity.js").Usuario, "passwordHash">[]>;
    toggleActive(id: number): Promise<{
        id: number;
        isActive: boolean;
    }>;
}
