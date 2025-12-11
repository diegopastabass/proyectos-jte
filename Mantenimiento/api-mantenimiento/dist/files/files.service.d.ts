import { Repository } from 'typeorm';
import { File } from './files.entity';
import { CreateFileDto } from './create-file.dto';
export declare class FilesService {
    private filesRepository;
    constructor(filesRepository: Repository<File>);
    createFile(createFileDto: CreateFileDto): Promise<File>;
    findFileByMaintenanceId(maintenanceId: number): Promise<File | null>;
}
