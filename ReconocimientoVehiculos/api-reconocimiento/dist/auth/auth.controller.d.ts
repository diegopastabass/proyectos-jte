import { AuthService } from './auth.service.js';
import { LoginDto } from './models/login.dto.js';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    login(loginDto: LoginDto): Promise<{
        access_token: string;
    }>;
}
