import { Repository } from 'typeorm';
import { Task } from './tasks.entity';
import { CreateTaskDto } from './create-task.dto';
export declare class TasksService {
    private tasksRepository;
    constructor(tasksRepository: Repository<Task>);
    create(dtos: CreateTaskDto[]): Promise<number[]>;
    find(id: number): Promise<Task>;
    findByDevice(deviceId: number): Promise<Task[]>;
    updateStatus(id: number, status: boolean): Promise<void>;
}
