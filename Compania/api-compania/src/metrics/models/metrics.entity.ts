import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('ssr_compania')
export class Telemetria {
  @Column()
  mt_name: string;

  @Column()
  mt_value: string;

  @PrimaryColumn('timestamp')
  mt_time_2: Date;
}
