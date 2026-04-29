import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Session } from './session.entity';

@Entity('measures')
export class Measurement {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @ManyToOne(() => Session, (session) => session.measurements, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sesion_id' })
  session: Session;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'float' })
  value: number;

  @Column({ type: 'timestamp' })
  time: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location: string;

  @Column({ name: 'image_path', type: 'varchar', length: 255, nullable: true })
  imagePath: string;
}
