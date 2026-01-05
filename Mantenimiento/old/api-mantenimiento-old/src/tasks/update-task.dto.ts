// update-task.dto.ts
import { IsNotEmpty, IsBoolean } from 'class-validator';

export class UpdateTaskDto {
  @IsBoolean({ message: 'task_status must be a boolean' })
  @IsNotEmpty()
  task_status!: boolean;
}
