export class CreateMeasurementDto {
  name: string;
  value: number;
  time: string;
  location?: string;
}

export class CreateSessionDto {
  userId: string;
  measurements: CreateMeasurementDto[];
  reportMetadata?: any;
}
