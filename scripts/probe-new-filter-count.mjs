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

const newWhere = `
  A.status = 'A'
  AND A.is_stop = 'N'
  AND (A.stop_no IS NULL OR RTRIM(A.stop_no) = '')
  AND NOT EXISTS (SELECT 1 FROM st_inform_head IH WHERE IH.request_no = A.request_no)
`;

const [newCount, oldCount, withInform, withStopNo] = await Promise.all([
  pool.request().query(`SELECT COUNT(*) AS cnt FROM st_request_head A WHERE ${newWhere}`),
  pool.request().query(`SELECT COUNT(*) AS cnt FROM st_request_head A WHERE A.status = 'A' AND A.is_stop = 'N'`),
  pool.request().query(`SELECT COUNT(*) AS cnt FROM st_request_head A WHERE A.status = 'A' AND A.is_stop = 'N' AND EXISTS (SELECT 1 FROM st_inform_head IH WHERE IH.request_no = A.request_no)`),
  pool.request().query(`SELECT COUNT(*) AS cnt FROM st_request_head A WHERE A.status = 'A' AND A.is_stop = 'N' AND A.stop_no IS NOT NULL AND RTRIM(A.stop_no) <> ''`),
]);

console.log(JSON.stringify({
  new_filter: newCount.recordset[0].cnt,
  old_filter: oldCount.recordset[0].cnt,
  excluded_has_inform: withInform.recordset[0].cnt,
  excluded_has_stop_no: withStopNo.recordset[0].cnt,
}, null, 2));

await pool.close();
