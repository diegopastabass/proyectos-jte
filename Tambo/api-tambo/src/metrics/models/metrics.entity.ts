import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('ssr_tambo')
export class Telemetria {
  @PrimaryColumn()
  mt_id: number;

  @Column()
  mt_name: string;

  @Column()
  mt_value: string;

  @PrimaryColumn('timestamp')
  mt_time_2: Date;
}
