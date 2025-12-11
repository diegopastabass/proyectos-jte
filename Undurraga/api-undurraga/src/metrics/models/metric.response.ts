export interface SnapshotResponse {
  [sensorId: string]: {
    value: number;
    time: string;
  };
}

export interface TotalizadorResponse {
  value: number;
  time: string;
}
