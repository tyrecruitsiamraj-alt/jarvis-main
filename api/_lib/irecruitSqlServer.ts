import sql from 'mssql';
import {
  parseSqlServerEndpoint,
  type SiamrajSqlServerConfig,
} from './siamrajSqlServer.js';

export function getIrecruitSqlServerConfig(): SiamrajSqlServerConfig | null {
  const explicitHost = (process.env.IRECRUIT_DB_HOST || '').trim();
  const useMainDb =
    !explicitHost && (process.env.DB_NAME || '').trim().toLowerCase() === 'irecruit';

  const hostRaw = explicitHost || (useMainDb ? (process.env.DB_HOST || '').trim() : '');
  const user = (
    process.env.IRECRUIT_DB_USER ||
    (useMainDb ? process.env.DB_USER : '') ||
    ''
  ).trim();
  const password =
    process.env.IRECRUIT_DB_PASSWORD ??
    (useMainDb ? process.env.DB_PASSWORD : '') ??
    '';
  const database = (
    process.env.IRECRUIT_DB_NAME ||
    (useMainDb ? process.env.DB_NAME : '') ||
    'irecruit'
  ).trim();

  if (!hostRaw || !user || !database) return null;

  const { server, port } = parseSqlServerEndpoint(
    hostRaw,
    process.env.IRECRUIT_DB_PORT || (useMainDb ? process.env.DB_PORT : undefined),
  );

  return {
    user,
    password,
    server,
    database,
    port,
    encrypt: (process.env.IRECRUIT_DB_ENCRYPT || process.env.DB_ENCRYPT || 'false').toLowerCase() === 'true',
    trustServerCertificate:
      (process.env.IRECRUIT_DB_TRUST_SERVER_CERTIFICATE || process.env.DB_TRUST_SERVER_CERTIFICATE || 'true')
        .toLowerCase() !== 'false',
  };
}

const globalForMssql = globalThis as unknown as { __jarvisIrecruitMssqlPool?: sql.ConnectionPool };

export async function getIrecruitSqlServerPool(): Promise<sql.ConnectionPool> {
  const cfg = getIrecruitSqlServerConfig();
  if (!cfg) throw new Error('Missing IRECRUIT_DB_HOST / IRECRUIT_DB_USER / IRECRUIT_DB_NAME for SQL Server');

  if (globalForMssql.__jarvisIrecruitMssqlPool?.connected) {
    return globalForMssql.__jarvisIrecruitMssqlPool;
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

    globalForMssql.__jarvisIrecruitMssqlPool = pool;
    return pool;
  } catch (e) {
    globalForMssql.__jarvisIrecruitMssqlPool = undefined;
    throw e;
  }
}

export async function irecruitSqlQuery<T>(
  queryText: string,
  inputs?: Record<string, unknown>,
): Promise<T[]> {
  const pool = await getIrecruitSqlServerPool();
  const req = pool.request();
  if (inputs) {
    for (const [key, value] of Object.entries(inputs)) {
      req.input(key, value);
    }
  }
  const result = await req.query<T>(queryText);
  return result.recordset;
}
