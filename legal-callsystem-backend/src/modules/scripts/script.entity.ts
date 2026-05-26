import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';

@Entity('scripts')
export class Script {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant, (tenant) => tenant.scripts, { onDelete: 'CASCADE' })
  tenant: Tenant;

  @Column()
  name: string;

  @Column()
  type: 'recording' | 'tts' | 'general' | 'opening' | 'objection' | 'closing';

  @Column({ nullable: true })
  audioUrl: string;

  @Column('text', { nullable: true })
  textContent: string;

  @Column('simple-json', { nullable: true })
  keywords: Record<string, string>;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
