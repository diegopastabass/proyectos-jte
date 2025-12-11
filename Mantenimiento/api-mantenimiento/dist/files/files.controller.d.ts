import { FilesService } from './files.service';
import { CreateFileDto } from './create-file.dto';
import { File } from './files.entity';
export declare class FilesController {
    private readonly filesService;
    constructor(filesService: FilesService);
    createFile(createFileDto: CreateFileDto): Promise<File>;
    findFileByMaintenanceId(maintenanceId: number): Promise<{
        success: boolean;
        message: string;
        data?: undefined;
    } | {
        success: boolean;
        data: File;
        message?: undefined;
    }>;
}
