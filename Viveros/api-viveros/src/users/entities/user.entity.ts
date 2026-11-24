import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('viveros_tambo_users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column({ unique: true })
  email: string;

  @Column({ type: 'varchar', length: 4, default: '1000' })
  role: string;

  @Column()
  password_hash: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
