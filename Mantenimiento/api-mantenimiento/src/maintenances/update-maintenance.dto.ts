import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class UpdateMaintenanceDto {
  @IsNotEmpty({ message: 'Maintainer ID is required' })
  @IsNumber({}, { message: 'Maintainer ID must be a number' })
  maintainer_id!: number;

  @IsNotEmpty({ message: 'Maintenance type is required' })
  @IsString({ message: 'Maitenance type must be a string' })
  maintenance_type!: string;

  @IsNotEmpty({ message: 'Scheduled date is required as a string' })
  scheduled_date!: Date;
}
