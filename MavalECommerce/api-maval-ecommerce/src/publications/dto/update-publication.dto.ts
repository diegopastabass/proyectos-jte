import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreatePublicationDto } from './create-publication.dto';

/**
 * DTO for updating an existing publication.
 * All fields from CreatePublicationDto are optional, plus isActive.
 */
export class UpdatePublicationDto extends PartialType(CreatePublicationDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
