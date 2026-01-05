import { IsNotEmpty, IsString, IsNumber, IsInt } from 'class-validator';

export class CreateMaintenanceDto {
  @IsNotEmpty({ message: 'Client ID is required' })
  @IsNumber({}, { message: 'Client ID must be a number' })
  client_id!: number;

  @IsNotEmpty({ message: 'Maintainer ID is required' })
  @IsNumber({}, { message: 'Maintainer ID must be a number' })
  maintainer_id!: number;

  @IsNotEmpty({ message: 'Maintenance type is required' })
  @IsString({ message: 'Maintenance type must be a string' })
  maintenance_type!: string;

  @IsNotEmpty({ message: 'Scheduled date is required' })
  scheduled_date!: Date;

  @IsInt({ message: 'Admin id must be a int number' })
  @IsNotEmpty({ message: 'Admin id is required' })
  admin_id!: number;
}
