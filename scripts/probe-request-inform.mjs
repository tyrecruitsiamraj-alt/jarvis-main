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

const requestNo = (process.argv[2] || 'LBM6903002').trim().toUpperCase();
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

const head = await pool.request().input('no', sql.NVarChar, requestNo).query(`
  SELECT
    A.request_no,
    A.request_date,
    A.request_qty,
    A.inform_qty,
    A.is_inform_all,
    A.status,
    A.is_stop,
    A.stop_no,
    RTRIM(SS.site_name) AS site_name,
  (SELECT COUNT(*) FROM st_inform_head IH WHERE IH.request_no = A.request_no) AS inform_doc_count
  FROM st_request_head A
  LEFT JOIN ms_site SS ON A.site_code = SS.site_code
  WHERE UPPER(RTRIM(A.request_no)) = @no
`);

const informs = await pool.request().input('no', sql.NVarChar, requestNo).query(`
  SELECT TOP 20
    IH.inform_no,
    IH.inform_date,
    IH.status AS inform_status
  FROM st_inform_head IH
  WHERE IH.request_no = @no
  ORDER BY IH.inform_date DESC
`);

// try detail table if exists
let details = { recordset: [] };
try {
  details = await pool.request().input('no', sql.NVarChar, requestNo).query(`
    SELECT TOP 20
      ID.inform_no,
      ID.staff_id,
      (SELECT z.fname + ' ' + z.lname FROM hr_staff z WHERE z.staff_id = ID.staff_id) AS staff_name
    FROM st_inform_detail ID
    INNER JOIN st_inform_head IH ON IH.inform_no = ID.inform_no
    WHERE IH.request_no = @no
    ORDER BY ID.inform_no
  `);
} catch {
  /* table/columns may differ */
}

console.log(JSON.stringify({ head: head.recordset[0], informs: informs.recordset, details: details.recordset }, null, 2));
await pool.close();
