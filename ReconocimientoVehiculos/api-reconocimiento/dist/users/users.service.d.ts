import { Repository } from 'typeorm';
import { Usuario } from './models/user.entity.js';
import { CreateUserDto } from './models/create-user.dto.js';
export declare class UsersService {
    private readonly usuarioRepository;
    private readonly logger;
    constructor(usuarioRepository: Repository<Usuario>);
    create(createUserDto: CreateUserDto): Promise<Omit<Usuario, 'passwordHash'>>;
    findAll(): Promise<Omit<Usuario, 'passwordHash'>[]>;
    findOne(id: number): Promise<Usuario>;
    toggleActive(id: number): Promise<{
        id: number;
        isActive: boolean;
    }>;
}
