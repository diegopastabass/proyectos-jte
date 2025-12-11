import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('pozo_miraflores')
export class Telemetria {
  @PrimaryColumn()
  mt_name: string;

  @Column()
  mt_value: string; 

  @PrimaryColumn('timestamp')
  mt_time_2: Date;

  @Column({ select: false, nullable: true })
  mt_time: Date;

  @Column({ select: false, nullable: true })
  mt_quality: string;
}