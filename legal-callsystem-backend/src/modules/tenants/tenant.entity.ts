import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../auth/user.entity';
import { Customer } from '../customers/customer.entity';
import { CallTask } from '../calls/call-task.entity';
import { Script } from '../scripts/script.entity';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  licenseKey: string;

  @Column({ default: 'active' })
  status: 'active' | 'suspended' | 'expired';

  @Column('simple-json', { nullable: true })
  config: Record<string, any>;

  @Column({ default: 50 })
  dailyCallLimit: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => User, (user) => user.tenant)
  users: User[];

  @OneToMany(() => Customer, (customer) => customer.tenant)
  customers: Customer[];

  @OneToMany(() => CallTask, (callTask) => callTask.tenant)
  callTasks: CallTask[];

  @OneToMany(() => Script, (script) => script.tenant)
  scripts: Script[];
}
