export interface Punto {
  value: number;
  /** ISO (lecturas y horas), AAAA-MM-DD (días) o AAAA-MM (meses). */
  time: string;
}

export type Latest = Partial<Record<string, Punto>>;
