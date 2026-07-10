import sql from 'mssql';
import fs from 'fs';

function parseEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[t.slice(0, i).trim()] = val;
  }
  return out;
}

const requestNo = (process.argv[2] || 'OPL6907040').trim().toUpperCase();
const env = { ...parseEnvFile('.env'), ...parseEnvFile('.env.local') };
const host = env.DB_HOST || '';
const comma = host.lastIndexOf(',');
const server = comma > 0 ? host.slice(0, comma) : host;
const port = comma > 0 ? Number(host.slice(comma + 1)) : Number(env.DB_PORT || 1433);

const pool = await sql.connect({
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  server,
  database: env.DB_NAME,
  port,
  options: { encrypt: false, trustServerCertificate: true },
});

const r = await pool.request().input('no', sql.NVarChar, requestNo).query(`
  SELECT
    A.request_no,
    A.request_date,
    CONVERT(varchar(10), A.request_date, 23) AS request_date_ymd,
    A.want_date_from,
    CONVERT(varchar(10), A.want_date_from, 23) AS want_date_from_ymd,
    A.request_code,
    (SELECT TOP 1 RTRIM(z.request_name) FROM st_ms_request z WHERE z.request_code = A.request_code) AS request_name
  FROM st_request_head A
  WHERE UPPER(RTRIM(A.request_no)) = @no
`);

console.log(JSON.stringify(r.recordset[0], null, 2));
await pool.close();
