import { Repository } from 'typeorm';
import { CreateUserDto } from './create-user.dto';
import { User } from './users.entity';
export declare class UsersService {
    private readonly userRepository;
    constructor(userRepository: Repository<User>);
    create(dto: CreateUserDto): Promise<number>;
    find(id: number): Promise<User>;
    findByEmail(email: string): Promise<User | null>;
    findByRole(roleNumber: number): Promise<{
        id: number;
        name: string;
    }[]>;
}
