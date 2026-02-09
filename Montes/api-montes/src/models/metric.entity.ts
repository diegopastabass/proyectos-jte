import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'montes' })
export class Metric {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ name: 'name' })
  name: string;

  @Column({ name: 'value', type: 'float' })
  value: number;

  @Column({ name: 'time' })
  time: Date;
}
