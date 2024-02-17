import { DataSource } from 'typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions.js';

import { BatchRecord, OrderLineRecord } from './TypeOrmBatchRepository';

const entities = [BatchRecord, OrderLineRecord];

export const getTypeOrmConfig = (): PostgresConnectionOptions => ({
  type: 'postgres',
  host: process.env.PG_HOST ?? '127.0.0.1',
  port: process.env.PG_PORT ? parseInt(process.env.PG_PORT) : 5432,
  username: process.env.PG_USER ?? 'postgres',
  password: process.env.PG_PASSWORD ?? 'postgres',
  database: process.env.PG_DB_NAME ?? 'postgres',
  // Handled manually using Umzug
  synchronize: false,
  logging: true,
  entities,
  subscribers: [],
  migrations: [],
});

export class TypeOrmConnectionPool {
  private static dataSourceInstancePromise?: Promise<DataSource>;

  private constructor(private dataSource: DataSource) {}

  public static async destroy() {
    if (!this.dataSourceInstancePromise) {
      console.warn('Trying to destroy a connection pool that is not initialized');
      return;
    }

    const dataSource = await this.dataSourceInstancePromise;

    await dataSource.destroy();

    this.dataSourceInstancePromise = undefined;
  }

  public static async getInstance(): Promise<TypeOrmConnectionPool> {
    if (!this.dataSourceInstancePromise) {
      this.dataSourceInstancePromise = new DataSource({
        ...getTypeOrmConfig(),
        poolSize: 10,
      }).initialize();
    }

    const dataSource = await this.dataSourceInstancePromise;

    return new TypeOrmConnectionPool(dataSource);
  }

  public createQueryRunner() {
    return this.dataSource.createQueryRunner();
  }

  public async query<T = unknown>(sql: string, parameters?: unknown[]): Promise<T> {
    return this.dataSource.manager.query<T>(sql, parameters);
  }
}
