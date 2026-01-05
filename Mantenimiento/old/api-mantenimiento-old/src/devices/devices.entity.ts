// devices.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('devices')
export class Device {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column({ type: 'bigint' })
  maintenance_id!: number;

  @Column({ type: 'varchar', length: 50 })
  device_type!: string;

  @Column({ type: 'varchar', length: 100 })
  serial_number!: string;

  @Column({ type: 'varchar', length: 100 })
  model!: string;

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date;
}
