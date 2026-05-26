import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  Unique,
} from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { CallLog } from '../calls/call-log.entity';
import { WechatSession } from '../wechat/wechat-session.entity';

@Entity('customers')
@Unique(['tenant', 'phoneEncrypted'])
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @ManyToOne(() => Tenant, (tenant) => tenant.customers, { onDelete: 'CASCADE' })
  tenant: Tenant;

  @Column()
  name: string;

  @Column()
  phoneEncrypted: string;

  @Column({ nullable: true })
  caseType: string;

  @Column({ default: 'import' })
  source: 'import' | 'web' | 'referral' | 'other';

  @Column({ default: 'new' })
  status: 'new' | 'contacted' | 'interested' | 'wechat_added' | 'appointed' | 'closed' | 'rejected';

  @Column('simple-array', { nullable: true })
  tags: string[];

  @Column({ nullable: true })
  lastCallAt: Date;

  @Column({ nullable: true })
  nextFollowUpAt: Date;

  @Column({ nullable: true })
  assignedTo: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => CallLog, (callLog) => callLog.customer)
  callLogs: CallLog[];

  @OneToMany(() => WechatSession, (session) => session.customer)
  wechatSessions: WechatSession[];
}
