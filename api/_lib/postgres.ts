import { Pool } from 'pg';
import { getDatabaseUrl, getPgSchema, isPgSslEnabled } from './env.js';

type PoolState = {
  pool: Pool | null;
};

const globalForPg = globalThis as unknown as { __jarvisPgPool?: PoolState };

function getOrCreatePool(): Pool {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    throw new Error('Missing DATABASE_URL/POSTGRES_URL');
  }

  if (!globalForPg.__jarvisPgPool) {
    globalForPg.__jarvisPgPool = { pool: null };
  }

  if (globalForPg.__jarvisPgPool.pool) return globalForPg.__jarvisPgPool.pool;

  const pool = new Pool({
    connectionString: databaseUrl,
    // Vercel Postgres usually requires SSL. If your URL already includes SSL, this can be ignored.
    ssl: isPgSslEnabled()
      ? {
          rejectUnauthorized: false,
        }
      : undefined,
    max: process.env.PG_MAX ? Number(process.env.PG_MAX) : 10,
  });

  const schema = getPgSchema();
  if (schema) {
    pool.on('connect', (client) => {
      void client.query(`SET search_path TO "${schema}"`);
    });
  }

  globalForPg.__jarvisPgPool.pool = pool;
  return pool;
}

export async function dbPing(): Promise<boolean> {
  const pool = getOrCreatePool();
  const result = await pool.query<{ ok: number }>('select 1 as ok');
  return result.rows[0]?.ok === 1;
}

export async function dbQuery<T>(
  text: string,
  params?: unknown[]
): Promise<{ rows: T[] }> {
  const pool = getOrCreatePool();
  const result = await pool.query<T>(text, params);
  return { rows: result.rows };
}

