import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { User } from '../users/users.entity';
export declare class AuthService {
    private readonly usersService;
    private readonly jwtService;
    constructor(usersService: UsersService, jwtService: JwtService);
    validateUser(email: string, pass: string): Promise<Omit<User, 'password_hash'> | null>;
    login(user: User): Promise<{
        access_token: string;
        id: number;
    }>;
    authenticate(email: string, password: string): Promise<{
        access_token: string;
        id: number;
    }>;
}
