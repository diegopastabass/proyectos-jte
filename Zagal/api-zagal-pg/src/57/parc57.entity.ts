// 57/entities/parc57.entity.ts
import { Entity, Column, PrimaryColumn } from 'typeorm';

// La tabla no tiene PK en la base. TypeORM exige una para arrancar, así que
// se declara (mt_name, mt_time_2) como clave solo a nivel de metadatos
// (synchronize: false, no se crea nada en la base).
@Entity('parc_57_zagal')
export class Parc57Zagal {
  @PrimaryColumn()
  mt_name: string;

  @Column()
  mt_value: string; // Es varchar en la DB, lo manejamos como string

  @Column({ name: 'mt_time', type: 'date', nullable: true })
  mt_time: string;

  @Column()
  mt_quality: string;

  @PrimaryColumn({ name: 'mt_time_2', type: 'timestamp' })
  mt_time_2: Date;
}
