import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('ssr_ranguil')
export class Telemetria {
  @PrimaryColumn()
  mt_name: string;

  @Column('decimal', { precision: 30, scale: 6 })
  mt_value: number;

  @PrimaryColumn('timestamp')
  mt_time_2: Date;
}
