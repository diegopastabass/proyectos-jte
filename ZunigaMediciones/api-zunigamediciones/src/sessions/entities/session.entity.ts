import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Measurement } from './measurement.entity';

@Entity('sesion')
export class Session {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'measures_number', type: 'int' })
  measures_number: number;

  @Column({ name: 'report_json', type: 'jsonb', nullable: true })
  report_json: any;

  @Column({ type: 'char', length: 1, default: '0' })
  state: string;

  @Column({ name: 'update_count', type: 'int', default: 0 })
  update_count: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => Measurement, (measurement) => measurement.session, {
    cascade: true,
  })
  measurements: Measurement[];
}
