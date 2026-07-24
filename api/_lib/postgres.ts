import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { getDatabaseUrl, getPgSchema, isPgSslEnabled } from './env.js';
import { logError } from './logger.js';

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

  // ⚠ ต้องมี listener 'error' เสมอ — idle client ใน pool ที่โดน backend ตัด/ECONNRESET จะ emit
  // 'error' ที่ระดับ pool; ถ้าไม่มี listener Node จะถือเป็น unhandled แล้ว crash ทั้ง process
  // (เจอบ่อยขึ้นเมื่อมี worker ที่ idle ยาวระหว่างรอบ) — log แล้วกลืน; pool จะทิ้ง client เสีย
  // แล้วสร้างใหม่ให้เองในรอบ query ถัดไป
  pool.on('error', (err) => {
    logError('pg.pool.idle_error', { message: err instanceof Error ? err.message : String(err) });
  });

  // ตั้ง search_path แบบ synchronous ก่อนปล่อย connection ให้ query — กัน race กับ query แรก
  pool.on('connect', (client) => {
    const schema = getPgSchema();
    if (!schema) return;
    client.query(`SET search_path TO "${schema}"`).catch(() => {
      /* ignore — queries use qualified table names where critical */
    });
  });

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

/** Run queries on an existing transaction client. */
export async function dbQueryInTx<T extends QueryResultRow>(
  client: PoolClient,
  text: string,
  params?: unknown[],
): Promise<{ rows: T[] }> {
  const result = await client.query<T>(text, params);
  return { rows: result.rows };
}

async function setSearchPath(client: PoolClient): Promise<void> {
  const schema = getPgSchema();
  if (schema) {
    await client.query(`SET search_path TO "${schema}"`);
  }
}

/**
 * Atomic transaction wrapper. Rolls back on any thrown error.
 * Use dbQueryInTx inside the callback — do not mix with dbQuery in the same unit of work.
 */
export async function dbTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const pool = getOrCreatePool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await setSearchPath(client);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* connection may already be broken */
    }
    throw e;
  } finally {
    client.release();
  }
}

export function isPgUniqueViolation(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    (e as { code: string }).code === '23505'
  );
}

export function isPgForeignKeyViolation(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    (e as { code: string }).code === '23503'
  );
}

