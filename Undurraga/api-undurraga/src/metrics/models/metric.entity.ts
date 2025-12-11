import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'undurraga_metrics' })
export class Metric {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'sensor_id', type: 'int' })
  sensor_id: number;

  @Column({ name: 'value', type: 'float' })
  value: number;

  @Column({ name: 'time', default: () => 'CURRENT_TIMESTAMP' })
  time: Date;
}
