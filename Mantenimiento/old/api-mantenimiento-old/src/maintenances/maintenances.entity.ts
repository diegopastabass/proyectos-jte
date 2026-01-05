import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('maintenances')
export class Maintenance {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number;

  @Column()
  client_id!: number;

  @Column()
  admin_id!: number;

  @Column()
  maintainer_id!: number;

  @Column({ type: 'varchar', length: 50 })
  maintenance_type!: string;

  @Column({ type: 'text', nullable: true })
  observations!: string;

  @Column({ type: 'timestamp' })
  scheduled_date!: Date;

  @Column({ type: 'bool', default: false })
  completed!: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date;
}
