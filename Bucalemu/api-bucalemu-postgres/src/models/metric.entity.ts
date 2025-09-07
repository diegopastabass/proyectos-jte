import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity({ name: 'ssr_bucalemu' })
export class Metric {
  @PrimaryGeneratedColumn()
  mt_id: number;

  @Column({ type: 'varchar', length: 255 })
  mt_name: string;

  @Column({ type: 'double precision' })
  mt_value: number;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  mt_time_2: Date;
}
