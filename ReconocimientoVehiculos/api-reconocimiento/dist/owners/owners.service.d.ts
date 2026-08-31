import { Repository } from 'typeorm';
import { Persona } from './models/owner.entity.js';
import { CreatePersonaDto } from './models/create-owner.dto.js';
import { UpdatePersonaDto } from './models/update-owner.dto.js';
export declare class OwnersService {
    private readonly personaRepository;
    private readonly logger;
    constructor(personaRepository: Repository<Persona>);
    create(createPersonaDto: CreatePersonaDto): Promise<Persona>;
    findAll(): Promise<Persona[]>;
    findOne(id: number): Promise<Persona>;
    update(id: number, updatePersonaDto: UpdatePersonaDto): Promise<Persona>;
    remove(id: number): Promise<{
        message: string;
    }>;
}
