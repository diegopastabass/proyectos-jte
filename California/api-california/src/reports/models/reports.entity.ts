import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';

@Entity('california_reports')
export class CaliforniaReport {
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

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  time: Date;
}
