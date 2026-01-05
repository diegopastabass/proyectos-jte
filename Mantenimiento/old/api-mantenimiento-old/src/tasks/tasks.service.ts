// tasks.service.ts
import {
  Injectable,
  InternalServerErrorException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './tasks.entity';
import { CreateTaskDto } from './create-task.dto';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private tasksRepository: Repository<Task>,
  ) {}

  async create(dtos: CreateTaskDto[]): Promise<number[]> {
    try {
      const tasks = this.tasksRepository.create(dtos); // crea entidades a partir del arreglo
      await this.tasksRepository.save(tasks); // inserta en lote
      return tasks.map((t) => t.id);
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Duplicate entry for task');
      }
      throw new InternalServerErrorException(
        `Error creating tasks: ${error.message}`,
      );
    }
  }

  async find(id: number): Promise<Task> {
    try {
      const task = await this.tasksRepository.findOne({ where: { id } });
      if (!task) {
        throw new NotFoundException(`Task with id ${id} not found`);
      }
      return task;
    } catch (error) {
      throw new InternalServerErrorException(
        `Error finding task: ${error.message}`,
      );
    }
  }
  async findByDevice(deviceId: number): Promise<Task[]> {
    try {
      const tasks = await this.tasksRepository.find({
        where: { device_id: deviceId },
      });
      return tasks;
    } catch (error) {
      throw new InternalServerErrorException(
        `Error finding tasks for device: ${error.message}`,
      );
    }
  }

  async updateStatus(id: number, status: boolean): Promise<void> {
    try {
      const task = await this.tasksRepository.findOne({ where: { id } });
      if (!task) {
        throw new NotFoundException(`Task with id ${id} not found`);
      }
      task.task_status = status;
      await this.tasksRepository.save(task);
    } catch (error) {
      throw new InternalServerErrorException(
        `Error updating task status: ${error.message}`,
      );
    }
  }
}
