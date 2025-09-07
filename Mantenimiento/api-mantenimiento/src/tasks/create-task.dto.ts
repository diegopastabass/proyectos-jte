// create-task.dto.ts
import { IsNotEmpty, IsString, IsBoolean } from 'class-validator';

export class CreateTaskDto {
  @IsNotEmpty()
  @IsString()
  description!: string;

  @IsNotEmpty()
  device_id!: number;
}
