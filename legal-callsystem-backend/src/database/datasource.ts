import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';

export const datasourceProvider = {
  provide: 'DATA_SOURCE',
  useFactory: async (configService: ConfigService) => {
    const dataSource = new DataSource({
      type: 'postgres',
      host: configService.get('DB_HOST', 'localhost'),
      port: configService.get<number>('DB_PORT', 5432),
      username: configService.get('DB_USER', 'postgres'),
      password: configService.get('DB_PASSWORD'),
      database: configService.get('DB_NAME', 'legal_call_db'),
      entities: [],
      migrations: ['src/database/migrations/*.ts'],
      synchronize: false,
    });

    return dataSource.initialize();
  },
  inject: ['ConfigService'],
};
