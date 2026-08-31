import { PartialType } from '@nestjs/mapped-types';
import { CreatePersonaDto } from './create-owner.dto.js';

export class UpdatePersonaDto extends PartialType(CreatePersonaDto) {}
