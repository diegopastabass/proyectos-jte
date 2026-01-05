import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, name: 'ticket_number' })
  ticketNumber: string;

  @Column({ name: 'client_name' })
  clientName: string;

  @Column()
  status: string;

  @Column({ type: 'jsonb' })
  data: any; // Aquí se guarda todo el formulario JSON

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.reports)
  @JoinColumn({ name: 'created_by' })
  user: User;
  
  @Column({ name: 'created_by' })
  createdById: string;
}