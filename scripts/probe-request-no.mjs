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

const q = (process.argv[2] || '6907001').trim();
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

const r = await pool.request().input('q', sql.NVarChar, `%${q}%`).query(`
  SELECT TOP 20
    RTRIM(A.request_no) AS request_no,
    A.site_code,
    RTRIM(SS.site_name) AS site_name,
    RTRIM(SS.department_code) AS department_code,
    A.status,
    A.request_date
  FROM st_request_head A
  LEFT JOIN ms_site SS ON A.site_code = SS.site_code
  WHERE RTRIM(A.request_no) LIKE @q
  ORDER BY A.request_date DESC
`);

console.log(JSON.stringify(r.recordset, null, 2));
await pool.close();
