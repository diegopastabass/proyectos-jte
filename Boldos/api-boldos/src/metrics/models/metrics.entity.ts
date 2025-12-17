import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('ssr_boldos')
export class Telemetria {
  @PrimaryGeneratedColumn()
  mt_id: number;

  @Column()
  mt_name: string;

  @Column('decimal', { precision: 30, scale: 6 })
  mt_value: number;

  @Column('datetime')
  mt_time_2: Date;
}
