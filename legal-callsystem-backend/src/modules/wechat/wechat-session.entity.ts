import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { Customer } from '../customers/customer.entity';

@Entity('wechat_sessions')
export class WechatSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  tenant: Tenant;

  @ManyToOne(() => Customer, (customer) => customer.wechatSessions, { onDelete: 'CASCADE' })
  customer: Customer;

  @Column()
  wechatId: string;

  @Column({ nullable: true })
  friendStatus: 'pending' | 'accepted' | 'rejected' | 'deleted';

  @Column({ nullable: true })
  lastMessageAt: Date;

  @Column('text', { nullable: true })
  lastMessage: string;

  @Column({ nullable: true })
  contactWayId: string;

  @Column({ default: 'active' })
  status: 'active' | 'blocked' | 'archived' | 'pending' | 'closed' | 'added' | 'chatting';

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
