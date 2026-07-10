import sql from 'mssql';

export type SiamrajSqlServerConfig = {
  user: string;
  password: string;
  server: string;
  database: string;
  port: number;
  encrypt: boolean;
  trustServerCertificate: boolean;
};

/** รองรับ DB_HOST แบบ "host" หรือ "host,port" (รูปแบบ connection string ของ SQL Server) */
export function parseSqlServerEndpoint(
  hostRaw: string,
  envPort?: string | number,
): { server: string; port: number } {
  const host = hostRaw.trim();
  const defaultPort =
    envPort !== undefined && String(envPort).trim() !== '' ? Number(envPort) : 1433;

  const commaIdx = host.lastIndexOf(',');
  if (commaIdx > 0) {
    const maybePort = host.slice(commaIdx + 1).trim();
    if (/^\d+$/.test(maybePort)) {
      return { server: host.slice(0, commaIdx).trim(), port: Number(maybePort) };
    }
  }
  return { server: host, port: defaultPort };
}

export function getSiamrajSqlServerConfig(): SiamrajSqlServerConfig | null {
  const hostRaw = (process.env.DB_HOST || '').trim();
  const user = (process.env.DB_USER || '').trim();
  const password = process.env.DB_PASSWORD ?? '';
  const database = (process.env.DB_NAME || '').trim();
  if (!hostRaw || !user || !database) return null;

  const { server, port } = parseSqlServerEndpoint(hostRaw, process.env.DB_PORT);

  return {
    user,
    password,
    server,
    database,
    port,
    encrypt: (process.env.DB_ENCRYPT || 'false').toLowerCase() === 'true',
    trustServerCertificate: (process.env.DB_TRUST_SERVER_CERTIFICATE || 'true').toLowerCase() !== 'false',
  };
}

const globalForMssql = globalThis as unknown as { __jarvisMssqlPool?: sql.ConnectionPool };

export async function getSiamrajSqlServerPool(): Promise<sql.ConnectionPool> {
  const cfg = getSiamrajSqlServerConfig();
  if (!cfg) throw new Error('Missing DB_HOST / DB_USER / DB_NAME for SQL Server');

  if (globalForMssql.__jarvisMssqlPool?.connected) {
    return globalForMssql.__jarvisMssqlPool;
  }

  try {
    const pool = new sql.ConnectionPool({
      user: cfg.user,
      password: cfg.password,
      server: cfg.server,
      database: cfg.database,
      port: cfg.port,
      options: {
        encrypt: cfg.encrypt,
        trustServerCertificate: cfg.trustServerCertificate,
      },
      pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
      connectionTimeout: 30000,
      requestTimeout: 60000,
    });
    await pool.connect();

    globalForMssql.__jarvisMssqlPool = pool;
    return pool;
  } catch (e) {
    globalForMssql.__jarvisMssqlPool = undefined;
    throw e;
  }
}

export async function siamrajSqlServerPing(): Promise<boolean> {
  const pool = await getSiamrajSqlServerPool();
  const result = await pool.request().query<{ ok: number }>('SELECT 1 AS ok');
  return result.recordset[0]?.ok === 1;
}

export async function siamrajSqlQuery<T>(queryText: string, inputs?: Record<string, unknown>): Promise<T[]> {
  const pool = await getSiamrajSqlServerPool();
  const req = pool.request();
  if (inputs) {
    for (const [key, value] of Object.entries(inputs)) {
      req.input(key, value);
    }
  }
  const result = await req.query<T>(queryText);
  return result.recordset;
}
