import { Entity, Column, PrimaryColumn  } from 'typeorm';

@Entity('ssr_california')
export class Telemetria {

  @PrimaryColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  value: string; 

  @PrimaryColumn('timestamp')
  insert_time: Date;

  @Column({ select: false, nullable: true })
  terminal_time: Date;
}
