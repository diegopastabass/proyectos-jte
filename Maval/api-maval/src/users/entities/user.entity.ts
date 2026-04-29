import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Quote } from '../../quotes/entities/quote.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  password_hash: string;

  @Column({ default: '0' })
  role: string;

  @CreateDateColumn()
  created_at: Date;

  // Relación Inversa
  @OneToMany(() => Quote, (quote) => quote.user)
  quotes: Quote[];
}
