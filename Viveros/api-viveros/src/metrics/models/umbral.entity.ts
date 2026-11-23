import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Rango permitido por zona y variable (ver `sql/001_viveros_umbrales.sql`). */
@Entity({ name: 'viveros_umbrales' })
export class UmbralEntity {
  @PrimaryColumn({ type: 'varchar', length: 16 })
  zona: string;

  @PrimaryColumn({ type: 'varchar', length: 8 })
  variable: string;

  @Column({ type: 'double precision', nullable: true })
  min: number | null;

  @Column({ type: 'double precision', nullable: true })
  max: number | null;

  @Column({ type: 'boolean', default: false })
  alerta: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  actualizado: Date;
}
