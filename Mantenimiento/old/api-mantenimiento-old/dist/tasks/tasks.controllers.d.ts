import { TasksService } from './tasks.service';
import { CreateTaskDto } from './create-task.dto';
export declare class TasksController {
    private readonly service;
    constructor(service: TasksService);
    create(dto: CreateTaskDto[] | CreateTaskDto): Promise<{
        success: boolean;
        insertedIds: number[];
    }>;
    findOne(id: number): Promise<{
        success: boolean;
        message: string;
        task?: undefined;
    } | {
        success: boolean;
        task: import("./tasks.entity").Task;
        message?: undefined;
    }>;
    findByDevice(deviceId: number): Promise<{
        success: boolean;
        tasks: import("./tasks.entity").Task[];
    }>;
    updateStatus(id: number, status: boolean): Promise<{
        success: boolean;
    }>;
}
