export class UpdateMeasurementDto {
  name: string;
  value: number;
  location?: string;
}

export class UpdateSessionDto {
  measurement: UpdateMeasurementDto;
}
