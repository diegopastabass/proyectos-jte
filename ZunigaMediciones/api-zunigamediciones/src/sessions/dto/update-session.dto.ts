export class UpdateMeasurementDto {
  name: string;
  value: number;
  location?: string;
}

export class UpdateSessionDto {
  measurements: UpdateMeasurementDto[]; // array de 1 o 2 mediciones de cloro
  markComplete?: boolean;               // true = usuario marca sesión como completa
}
