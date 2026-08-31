import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Persona } from '../../owners/models/owner.entity.js';

@Entity('vehiculo')
export class Vehiculo {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 10 })
  patente: string;

  @Column({ name: 'persona_id' })
  personaId: number;

  @ManyToOne(() => Persona, (persona) => persona.vehiculos, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'persona_id' })
  persona: Persona;
}
