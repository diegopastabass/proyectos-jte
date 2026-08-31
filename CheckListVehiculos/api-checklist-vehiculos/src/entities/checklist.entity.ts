import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from './user.entity';
import { Vehicle } from './vehicle.entity';
import { ChecklistImage } from './checklist-image.entity';

@Entity('checklists')
export class Checklist {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column()
  user_id: string;

  @Column()
  vehicle_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Vehicle)
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle;

  @Column({ type: 'int' })
  kilometraje_actual: number;

  @Column({ type: 'jsonb' })
  visual_checks: any;

  @Column({ type: 'jsonb' })
  mechanical_checks: any;

  @Column({ type: 'text', nullable: true })
  observaciones_generales: string;

  @Column({ default: false })
  has_issues: boolean;

  @OneToMany(() => ChecklistImage, image => image.checklist, { cascade: true })
  images: ChecklistImage[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
