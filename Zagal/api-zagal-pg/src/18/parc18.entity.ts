// 18/entities/parc18.entity.ts
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('parc_18_zagal')
export class Parc18Zagal {
  @PrimaryGeneratedColumn({ name: 'mt_id' })
  mt_id: number;

  @Column()
  mt_name: string;

  @Column()
  mt_value: string; // Es varchar en la DB, lo manejamos como string

  @Column({ name: 'mt_time', type: 'date', nullable: true })
  mt_time: string;

  @Column()
  mt_quality: string;

  @Column({ name: 'mt_time_2', type: 'timestamp' })
  mt_time_2: Date;
}