import { Entity, PrimaryGeneratedColumn, Column, PrimaryColumn  } from 'typeorm';

@Entity('ssr_gonzalez')
export class Telemetria {
  @PrimaryGeneratedColumn()
  mt_id: number;

  @Column()
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
