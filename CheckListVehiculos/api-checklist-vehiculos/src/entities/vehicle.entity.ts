import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  model: string;

  @Column({ unique: true })
  patente: string;

  @Column({ type: 'int', default: 0 })
  kilometraje: number;

  @Column({ type: 'int', default: 0 })
  km_ultima_mantencion: number;

  @Column({ type: 'date', nullable: true })
  fecha_venc_revision_tecnica: Date;

  @Column({ type: 'date', nullable: true })
  fecha_venc_circulacion: Date;

  @Column({ type: 'date', nullable: true })
  fecha_prox_mantencion: Date;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;
}
