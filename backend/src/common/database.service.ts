import { Injectable, OnModuleDestroy } from '@nestjs/common';
import pg from 'pg';

/** Pool hoặc client của một transaction đang chạy: hàm ghi nhận cả hai để chạy được trong transaction. */
export type Db = pg.Pool | pg.PoolClient;

/** Kết nối PostgreSQL của app (DATABASE_URL, database "flowable", schema "app"). */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly pool = new pg.Pool({
    connectionString:
      process.env.DATABASE_URL ??
      'postgres://flowable:flowable@localhost:5433/flowable',
  });

  query<R extends pg.QueryResultRow = any>(sql: string, params?: unknown[]) {
    return this.pool.query<R>(sql, params);
  }

  /** Chạy `work` trong một transaction: lỗi thì ROLLBACK và ném lại lỗi. */
  async tx<T>(work: (c: pg.PoolClient) => Promise<T>): Promise<T> {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      const result = await work(c);
      await c.query('COMMIT');
      return result;
    } catch (e) {
      await c.query('ROLLBACK');
      throw e;
    } finally {
      c.release();
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
