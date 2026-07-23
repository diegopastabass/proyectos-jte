import { Entity, PrimaryGeneratedColumn, PrimaryColumn, Column } from 'typeorm';

@Entity('ssr_villa_carmen')
export class Telemetria {
  @PrimaryGeneratedColumn()
  mt_name: string;

  @Column('decimal', { precision: 30, scale: 6 })
  mt_value: number;

  @PrimaryColumn('timestamp')
  mt_time_2: Date;
}
