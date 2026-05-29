import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { Customer } from '../customers/customer.entity';
import { CallTask } from './call-task.entity';
import { CallStatus } from './types';

@Entity('call_logs')
export class CallLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  tenant: Tenant;

  @ManyToOne(() => Customer, (customer) => customer.callLogs, { onDelete: 'CASCADE' })
  customer: Customer;

  @ManyToOne(() => CallTask, (task) => task.callLogs, { nullable: true })
  task: CallTask;

  @Column({ nullable: true })
  callId: string;

  @Column({ type: 'varchar', default: CallStatus.INITIATED })
  callStatus: CallStatus;

  @Column({ default: 0 })
  duration: number;

  @Column({ nullable: true })
  recordingUrl: string;

  @Column({ nullable: true })
  transcript: string;

  @Column({ nullable: true })
  intentResult: string;

  @Column('simple-json', { nullable: true })
  keywords: Record<string, boolean>;

  @Column({ nullable: true })
  summary: string;

  @Column({ nullable: true })
  errorMsg: string;

  @CreateDateColumn()
  createdAt: Date;
}