import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
export declare class AuthController {
    private authService;
    private usersService;
    constructor(authService: AuthService, usersService: UsersService);
    login(loginDto: LoginDto): Promise<{
        access_token: string;
        user: {
            id: any;
            name: any;
            email: any;
            is_admin: any;
        };
    }>;
    register(createUserDto: CreateUserDto): Promise<{
        message: string;
        userId: string;
    }>;
}
