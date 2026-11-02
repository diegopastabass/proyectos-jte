import { DateRangeDto } from './date-range.dto';

// pozo y estanque se validan en el servicio contra src/config/sensores.config.ts

export class CaudalQueryDto extends DateRangeDto {
  pozo?: string;
}

export class NivelQueryDto extends DateRangeDto {
  estanque?: string;
}

// Totalizador y horómetro son diarios: start y end son obligatorios.
export class DiarioQueryDto {
  start?: string;
  end?: string;
  pozo?: string;
}
