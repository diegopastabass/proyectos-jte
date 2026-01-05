// measurement.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('measurements')
export class Measurement {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'bigint' })
  device_id!: number;

  @Column({ type: 'bigint' })
  maintenance_id!: number;

  @Column({ type: 'varchar', length: 100 })
  measurement_type!: string;

  @Column({ type: 'float' })
  value!: number;

  @Column({ type: 'varchar', length: 20 })
  unit!: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date;
}
