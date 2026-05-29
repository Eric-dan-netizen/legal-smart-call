import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from '@nestjs-modules/ioredis';
import { ScheduleModule } from '@nestjs/schedule';

// 模块
import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { CustomersModule } from './modules/customers/customers.module';
import { CallsModule } from './modules/calls/calls.module';
import { ScriptsModule } from './modules/scripts/scripts.module';
import { WechatModule } from './modules/wechat/wechat.module';
import { VoiceModule } from './modules/voice/index';
import { StatisticsModule } from './modules/statistics/statistics.module';

// 实体
import { Tenant } from './modules/tenants/tenant.entity';
import { User } from './modules/auth/user.entity';
import { Customer } from './modules/customers/customer.entity';
import { CallTask } from './modules/calls/call-task.entity';
import { CallLog } from './modules/calls/call-log.entity';
import { Blacklist } from './modules/calls/blacklist.entity';
import { CallFrequency } from './modules/calls/call-frequency.entity';
import { Script } from './modules/scripts/script.entity';
import { WechatSession } from './modules/wechat/wechat-session.entity';

@Module({
  imports: [
    // 配置模块
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // 数据库 - 使用 SQLite 开发，PostgreSQL 生产
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const dbType = configService.get('DB_TYPE', 'better-sqlite');
        
        if (dbType === 'better-sqlite' || dbType === 'sqlite') {
          return {
            type: 'better-sqlite3',
            database: configService.get('DB_SQLITE_PATH', ':memory:'),
            entities: [Tenant, User, Customer, CallTask, CallLog, Blacklist, CallFrequency, Script, WechatSession],
            synchronize: true,
            logging: process.env.NODE_ENV === 'development',
          };
        }
        
        // PostgreSQL 生产配置
        return {
          type: 'postgres',
          host: configService.get('DB_HOST', 'localhost'),
          port: configService.get<number>('DB_PORT', 5432),
          username: configService.get('DB_USER', 'postgres'),
          password: configService.get('DB_PASSWORD'),
          database: configService.get('DB_NAME', 'legal_call_db'),
          entities: [Tenant, User, Customer, CallTask, CallLog, Blacklist, CallFrequency, Script, WechatSession],
          synchronize: process.env.NODE_ENV === 'development',
          logging: process.env.NODE_ENV === 'development',
        };
      },
      inject: [ConfigService],
    }),

    // Redis - 开发环境跳过，避免因无Redis导致崩溃
    // 实际使用时请配置 Redis
    // RedisModule.forRootAsync({...}),

    // 定时任务
    ScheduleModule.forRoot(),

    // 业务模块
    StatisticsModule,
    AuthModule,
    TenantsModule,
    CustomersModule,
    CallsModule,
    ScriptsModule,
    WechatModule,
    VoiceModule,
  ],
})
export class AppModule {}
