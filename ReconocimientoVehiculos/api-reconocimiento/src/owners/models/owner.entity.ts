import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Vehiculo } from '../../vehicles/models/vehicle.entity.js';

@Entity('persona')
export class Persona {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  nombre: string;

  @OneToMany(() => Vehiculo, (vehiculo) => vehiculo.persona)
  vehiculos: Vehiculo[];
}
