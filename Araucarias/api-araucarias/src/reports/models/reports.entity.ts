import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('araucarias_reports')
export class AraucariasReport {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('float')
  freatico: number;

  @Column('float')
  caudal: number;

  @Column('float')
  totalizador: number;

  @Column({ type: 'jsonb', nullable: true })
  response: any;

  @CreateDateColumn({ type: 'timestamp' })
  time: Date;
}
