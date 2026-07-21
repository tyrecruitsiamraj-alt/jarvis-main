import sql from 'mssql';
import fs from 'fs';

function parseEnv(p) {
  const o = {};
  if (!fs.existsSync(p)) return o;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    o[t.slice(0, i).trim()] = v;
  }
  return o;
}

const env = { ...parseEnv('.env'), ...parseEnv('.env.local') };
const host = env.DB_HOST || '';
const comma = host.lastIndexOf(',');
const pool = await sql.connect({
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  server: comma > 0 ? host.slice(0, comma) : host,
  database: env.DB_NAME,
  port: comma > 0 ? Number(host.slice(comma + 1)) : Number(env.DB_PORT || 1433),
  options: { encrypt: false, trustServerCertificate: true },
});

const depts = await pool.request().query(`
  SELECT TOP 50 department_code, department_name, seq
  FROM ms_department
  ORDER BY seq, department_code
`);
console.log(JSON.stringify(depts.recordset, null, 2));

const siteDepts = await pool.request().query(`
  SELECT TOP 40 RTRIM(department_code) AS department_code, COUNT(*) AS cnt
  FROM ms_site
  WHERE department_code IS NOT NULL AND RTRIM(department_code) <> ''
  GROUP BY RTRIM(department_code)
  ORDER BY COUNT(*) DESC
`);
console.log('site depts', JSON.stringify(siteDepts.recordset, null, 2));

await pool.close();
