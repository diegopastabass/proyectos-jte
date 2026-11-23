import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity({ name: 'viveros_tambo' })
export class Metric {
  @PrimaryGeneratedColumn()
  id: number;

  // En producción la columna es numérica: las consultas pasan el id como parámetro
  // sin tipo (ver lib/consultas.ts). synchronize está desactivado.
  @Column({ type: 'varchar', length: 255 })
  sensor_id: string;

  @Column({ type: 'double precision' })
  value: number;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  time: Date;
}
