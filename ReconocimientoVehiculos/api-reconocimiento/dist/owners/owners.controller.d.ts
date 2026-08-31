import { OwnersService } from './owners.service.js';
import { CreatePersonaDto } from './models/create-owner.dto.js';
import { UpdatePersonaDto } from './models/update-owner.dto.js';
export declare class OwnersController {
    private readonly ownersService;
    constructor(ownersService: OwnersService);
    create(createPersonaDto: CreatePersonaDto): Promise<import("./models/owner.entity.js").Persona>;
    findAll(): Promise<import("./models/owner.entity.js").Persona[]>;
    findOne(id: number): Promise<import("./models/owner.entity.js").Persona>;
    update(id: number, updatePersonaDto: UpdatePersonaDto): Promise<import("./models/owner.entity.js").Persona>;
    remove(id: number): Promise<{
        message: string;
    }>;
}
