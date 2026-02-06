import { Entity, Column } from 'typeorm';

@Entity({ name: 'montes' })
export class Metric {
  @Column({ name: 'mt_id', primary: true })
  mt_id: number;

  @Column({ name: 'mt_name' })
  mt_name: string;

  @Column({ name: 'mt_value', type: 'float' })
  mt_value: number;

  @Column({ name: 'mt_time_2' })
  mt_time_2: Date;
}
