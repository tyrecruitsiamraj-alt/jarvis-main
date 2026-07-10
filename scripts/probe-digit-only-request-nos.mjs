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

const r = await pool.request().query(`
  SELECT TOP 30
    RTRIM(A.request_no) AS request_no,
    RTRIM(SS.department_code) AS department_code,
    A.site_code
  FROM st_request_head A
  LEFT JOIN ms_site SS ON A.site_code = SS.site_code
  WHERE A.request_no NOT LIKE '%[^0-9]%'
    AND LEN(RTRIM(A.request_no)) >= 5
  ORDER BY A.request_date DESC
`);

console.log(JSON.stringify(r.recordset, null, 2));
await pool.close();
