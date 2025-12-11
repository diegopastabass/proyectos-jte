import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('undurraga_users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column({ unique: true })
  email: string;

  @Column({ type: 'char', length: 1, default: '1' })
  role: string;

  @Column()
  password_hash: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
