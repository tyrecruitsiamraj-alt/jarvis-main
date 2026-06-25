/**
 * ทดสอบ SQL Server (Siamraj) — อ่าน DB_HOST / DB_USER / DB_PASSWORD / DB_NAME จาก .env แล้ว .env.local
 * รัน: npm run db:ping:mssql
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sql from 'mssql';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function loadEnvFromFiles() {
  const merged = { ...process.env };
  for (const name of ['.env', '.env.local']) {
    const p = path.join(root, name);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i <= 0) continue;
      const key = t.slice(0, i).trim();
      let val = t.slice(i + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      merged[key] = val;
    }
  }
  return merged;
}

function parseSqlServerEndpoint(hostRaw, envPort) {
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

const env = loadEnvFromFiles();
const { server, port } = parseSqlServerEndpoint(env.DB_HOST || '', env.DB_PORT);
const config = {
  user: (env.DB_USER || '').trim(),
  password: env.DB_PASSWORD ?? '',
  server,
  database: (env.DB_NAME || '').trim(),
  port,
  options: {
    encrypt: (env.DB_ENCRYPT || 'false').toLowerCase() === 'true',
    trustServerCertificate: (env.DB_TRUST_SERVER_CERTIFICATE || 'true').toLowerCase() !== 'false',
  },
  connectionTimeout: 15000,
  requestTimeout: 15000,
};

if (!config.server || !config.user || !config.database) {
  console.error('Missing DB_HOST, DB_USER, or DB_NAME in .env / .env.local');
  process.exit(1);
}

async function main() {
  console.log(`Connecting to ${config.server}:${config.port}/${config.database} as ${config.user} ...`);
  const pool = await sql.connect(config);
  const result = await pool.request().query('SELECT @@VERSION AS version, DB_NAME() AS db_name');
  const row = result.recordset[0];
  console.log('OK — SQL Server connected');
  console.log(`  database: ${row?.db_name}`);
  console.log(`  version:  ${String(row?.version || '').split('\n')[0]}`);
  await pool.close();
}

main().catch((e) => {
  console.error('FAIL —', e.message);
  process.exit(1);
});
