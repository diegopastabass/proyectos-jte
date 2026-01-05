import { UsersService } from './users.service';
import { AuthService } from '../auth/auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
export declare class UsersController {
    private readonly usersService;
    private readonly authService;
    constructor(usersService: UsersService, authService: AuthService);
    create(createUserDto: CreateUserDto): Promise<import("./entities/user.entity").User>;
    login(loginUserDto: LoginUserDto): Promise<{
        access_token: string;
        user: {
            email: string;
            fullName: string;
            role: string;
        };
    }>;
}
