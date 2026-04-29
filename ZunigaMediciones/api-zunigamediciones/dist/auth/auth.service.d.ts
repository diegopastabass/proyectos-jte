import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { LoginUserDto } from '../users/dto/login-user.dto';
export declare class AuthService {
    private usersService;
    private jwtService;
    constructor(usersService: UsersService, jwtService: JwtService);
    login(loginUserDto: LoginUserDto): Promise<{
        access_token: string;
        user: {
            email: string;
            fullName: string;
            type: string;
        };
    }>;
}
