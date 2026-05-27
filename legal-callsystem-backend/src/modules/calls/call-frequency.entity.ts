import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';

@Entity('call_frequency')
@Unique(['tenant', 'phoneHash', 'year', 'weekNumber'])
export class CallFrequency {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  tenant: Tenant;

  @Column()
  phoneHash: string;

  @Column()
  year: number;

  @Column()
  weekNumber: number;

  @Column({ default: 0 })
  callCount: number;

  @Column({ nullable: true })
  lastCallAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
