import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { Customer } from '../customers/customer.entity';
import { CallLog } from './call-log.entity';

@Entity('call_tasks')
export class CallTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant, (tenant) => tenant.callTasks, { onDelete: 'CASCADE' })
  tenant: Tenant;

  @Column()
  name: string;

  @Column()
  scriptId: string;

  @Column({ default: 'pending' })
  status: 'pending' | 'running' | 'completed' | 'paused' | 'cancelled';

  @Column({ type: 'datetime' })
  scheduleTime: Date;

  @Column({ default: 0 })
  totalCount: number;

  @Column({ default: 0 })
  completedCount: number;

  @Column({ default: 0 })
  successCount: number;

  @Column({ default: 0 })
  failedCount: number;

  @Column('simple-json', { nullable: true })
  customerIds: string[];

  @Column('simple-json', { nullable: true })
  config: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => CallLog, (callLog) => callLog.task)
  callLogs: CallLog[];
}