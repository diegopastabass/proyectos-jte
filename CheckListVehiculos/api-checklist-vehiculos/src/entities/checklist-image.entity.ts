import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Checklist } from './checklist.entity';

@Entity('checklist_images')
export class ChecklistImage {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column({ type: 'bigint' })
  checklist_id: string;

  @ManyToOne(() => Checklist, checklist => checklist.images, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'checklist_id' })
  checklist: Checklist;

  @Column({ type: 'varchar', length: 512 })
  image_path: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 20 })
  check_type: string;

  @Column({ type: 'varchar', length: 100 })
  check_item: string;

  @CreateDateColumn()
  created_at: Date;
}
