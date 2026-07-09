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

const types = await pool.request().query(`
  SELECT request_code, RTRIM(request_name) AS request_name
  FROM st_ms_request
  ORDER BY request_code
`);

const openWhere = `
  A.status = 'A'
  AND A.is_stop = 'N'
  AND (A.stop_no IS NULL OR RTRIM(A.stop_no) = '')
  AND ISNULL(A.is_inform_all, 'N') <> 'Y'
  AND (
    NOT EXISTS (SELECT 1 FROM st_inform_head IH WHERE IH.request_no = A.request_no)
    OR (
      (CASE WHEN ISNULL(A.inform_qty, 0) > 0 THEN A.inform_qty ELSE (SELECT COUNT(*) FROM st_inform_head IH WHERE IH.request_no = A.request_no) END) > 0
      AND (CASE WHEN ISNULL(A.inform_qty, 0) > 0 THEN A.inform_qty ELSE (SELECT COUNT(*) FROM st_inform_head IH WHERE IH.request_no = A.request_no) END)
          < ISNULL(NULLIF(A.request_qty, 0), 1)
    )
  )
`;

const byType = await pool.request().query(`
  SELECT
    RTRIM(A.request_code) AS request_code,
    (SELECT TOP 1 RTRIM(z.request_name) FROM st_ms_request z WHERE z.request_code = A.request_code) AS request_name,
    COUNT(*) AS cnt
  FROM st_request_head A
  INNER JOIN ms_site SS ON A.site_code = SS.site_code
  WHERE ${openWhere}
    AND SS.department_code BETWEEN '_' AND 'Z'
    AND A.site_code BETWEEN '_' AND 'Z'
    AND RTRIM(SS.contract_type_code) <> 'C'
  GROUP BY A.request_code
  ORDER BY cnt DESC
`);

console.log('=== st_ms_request types ===');
console.log(JSON.stringify(types.recordset, null, 2));
console.log('=== open feed by request_code ===');
console.log(JSON.stringify(byType.recordset, null, 2));

await pool.close();
