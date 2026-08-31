import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { Usuario } from '../users/models/user.entity.js';
import { LoginDto } from './models/login.dto.js';
export declare class AuthService {
    private usuarioRepository;
    private jwtService;
    constructor(usuarioRepository: Repository<Usuario>, jwtService: JwtService);
    validateUser(loginDto: LoginDto): Promise<any>;
    login(loginDto: LoginDto): Promise<{
        access_token: string;
    }>;
}
