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
const config = {
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  server: env.DB_HOST,
  database: env.DB_NAME,
  port: Number(env.DB_PORT || 1433),
  options: {
    encrypt: (env.DB_ENCRYPT || 'false').toLowerCase() === 'true',
    trustServerCertificate: (env.DB_TRUST_SERVER_CERTIFICATE || 'true').toLowerCase() !== 'false',
  },
};

async function main() {
  const pool = await sql.connect(config);

  for (const table of ['st_request_staff', 'st_request_p2', 'ms_site', 'st_ms_request']) {
    const cols = await pool.request().query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '${table}' ORDER BY ORDINAL_POSITION
    `);
    console.log(table, cols.recordset.map((r) => r.COLUMN_NAME).join(', '));
  }

  const sample = await pool.request().query(`
    SELECT TOP 2
      A.request_no,
      A.request_date,
      A.record_date,
      A.want_date_from,
      A.want_date_to,
      A.site_code,
      SS.site_name,
      A.request_code,
      (SELECT z.request_name FROM st_ms_request z WHERE z.request_code = A.request_code) AS request_name,
      (SELECT z.fname + ' ' + z.lname FROM hr_staff z WHERE z.staff_id = A.do_id) AS sender_name,
      S.staff_id,
      (SELECT z.fname + ' ' + z.lname FROM hr_staff z WHERE z.staff_id = S.staff_id) AS abs_name,
      S.resign_date,
      (SELECT z.resign_type_name FROM hr_ms_resign_type z WHERE z.resign_type_code = S.resign_type_code) AS resign_type_name,
      B.work_place1,
      B.age,
      B.sex,
      B.work_date,
      B.work_time,
      C.payment_rate,
      (SELECT z.contact_name FROM st_request_p1 z WHERE z.request_no = A.request_no) AS contact_name,
      (SELECT z.phone FROM st_request_p1 z WHERE z.request_no = A.request_no) AS phone
    FROM st_request_head A
    LEFT JOIN st_request_staff S ON S.request_no = A.request_no
    INNER JOIN st_request_p2 B ON A.request_no = B.request_no
    INNER JOIN st_request_p3_rate C ON B.request_no = C.request_no
    LEFT JOIN ms_site SS ON A.site_code = SS.site_code
    WHERE A.status = 'A'
    ORDER BY A.request_date DESC
  `);
  console.log(JSON.stringify(sample.recordset, null, 2));

  await pool.close();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
