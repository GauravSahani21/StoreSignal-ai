import pg from 'pg';
import type { EnvConfig } from '../config/env.js';

const { Pool } = pg;

let poolInstance: pg.Pool | null = null;

export function getDatabasePool(env: EnvConfig): pg.Pool {
  if (!poolInstance) {
    poolInstance = new Pool({
      connectionString: env.DATABASE_URL,
      max: env.NODE_ENV === 'production' ? 20 : 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return poolInstance;
}

export async function closeDatabasePool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
  }
}

export async function checkDatabaseConnection(pool: pg.Pool): Promise<{ connected: boolean; error?: string }> {
  try {
    const client = await pool.connect();
    try {
      const res = await client.query('SELECT 1 as alive');
      return { connected: res.rows[0]?.alive === 1 };
    } finally {
      client.release();
    }
  } catch (err) {
    return {
      connected: false,
      error: err instanceof Error ? err.message : 'Unknown database connection error',
    };
  }
}
