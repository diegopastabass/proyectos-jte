import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginacionDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) porPagina = 100;
}

export interface Pagina<T> {
  total: number;
  pagina: number;
  porPagina: number;
  items: T[];
}
