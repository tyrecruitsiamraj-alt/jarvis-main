import sql from 'mssql';
import fs from 'fs';
import { readFileSync } from 'fs';

function parseEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
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

const openStaffingRequestWhere = (alias = 'A') => `
    ${alias}.status = 'A'
    AND ${alias}.is_stop = 'N'
    AND (${alias}.stop_no IS NULL OR RTRIM(${alias}.stop_no) = '')
    AND ISNULL(${alias}.is_inform_all, 'N') <> 'Y'
    AND (
      NOT EXISTS (SELECT 1 FROM st_inform_head IH WHERE IH.request_no = ${alias}.request_no)
      OR (
        ISNULL(${alias}.inform_qty, 0) > 0
        AND ISNULL(${alias}.inform_qty, 0) < ISNULL(NULLIF(${alias}.request_qty, 0), 1)
      )
    )
  `.trim();

const BASE_SQL = `
  SELECT
    A.request_no AS external_id,
    A.request_no,
    A.request_date AS act_saleco_datetime,
    A.want_date_from,
    S.resign_date,
    A.site_code,
    SS.site_name,
    RTRIM(SS.department_code) AS department_code,
    (SELECT TOP 1 D.department_name FROM ms_department D WHERE D.department_code = SS.department_code ORDER BY D.seq) AS department_name,
    RTRIM(SS.contract_type_code) AS contract_type_code,
    (SELECT TOP 1 CT.contract_type_name FROM st_ms_contract_type CT WHERE CT.contract_type_code = SS.contract_type_code) AS contract_type_name,
    A.status,
    (SELECT z.fname + ' ' + z.lname FROM hr_staff z WHERE z.staff_id = A.do_id) AS requester_name,
    (SELECT z.customer_name FROM st_site_contract_p1 z WHERE z.contract_no = A.contract_no) AS customer_name,
    B.work_place1 + '' + COALESCE(B.work_place2, '') + '' + COALESCE(B.work_place3, '') AS work_addr,
    A.staff_title_code,
    A.job_description_code_1,
    A.job_description_code_2,
    (SELECT z.staff_title_name FROM hr_ms_staff_title z WHERE z.staff_title_code = A.staff_title_code) AS staff_title_name,
    (SELECT z.job_description_name FROM hr_ms_job_description_1 z WHERE z.job_description_code_1 = A.job_description_code_1) AS job_name1,
    (SELECT z.job_description_name FROM hr_ms_job_description_2 z WHERE z.job_description_code_2 = A.job_description_code_2) AS job_name2,
    A.request_code AS request_action_code,
    (SELECT z.request_name FROM st_ms_request z WHERE z.request_code = A.request_code) AS request_action_name,
    (SELECT z.fname + ' ' + z.lname FROM hr_staff z WHERE z.staff_id = S.staff_id) AS staff_fullname,
    (SELECT z.resign_type_name FROM hr_ms_resign_type z WHERE z.resign_type_code = S.resign_type_code) AS reason_main_name,
    (SELECT z.fee_name FROM wg2_ms_fee z WHERE z.fee_codex = (C.withdraw_type_code + C.income1_code + C.income2_code + C.fee_code)) AS fee_name,
    C.payment_rate,
    C.draw_rate,
    B.work_date,
    B.work_time,
    B.age,
    B.sex,
    (SELECT z.abs_customer_fine FROM st_request_p3 z WHERE z.request_no = A.request_no) AS abs_customer_fine,
    (SELECT z.contact_name FROM st_request_p1 z WHERE z.request_no = A.request_no) AS contact_name,
    (SELECT z.phone FROM st_request_p1 z WHERE z.request_no = A.request_no) AS mobile_phone,
    ROW_NUMBER() OVER (
      PARTITION BY A.request_no
      ORDER BY CASE WHEN C.is_wage = 'Y' THEN 0 ELSE 1 END, C.payment_rate DESC
    ) AS rn
  FROM st_request_head A
  LEFT JOIN st_request_staff S ON S.request_no = A.request_no
  INNER JOIN st_request_p2 B ON A.request_no = B.request_no
  INNER JOIN st_request_p3_rate C ON B.request_no = C.request_no
  INNER JOIN ms_site SS ON A.site_code = SS.site_code
`;

const SELECT_COLUMNS = `
  external_id, request_no, act_saleco_datetime, want_date_from, resign_date,
  site_code, site_name, department_code, department_name, contract_type_code, contract_type_name,
  customer_name, status, staff_fullname, mobile_phone,
  job_description_code_1, job_description_code_2, staff_title_code, staff_title_name,
  job_name1, job_name2, requester_name, request_action_name, request_action_code,
  reason_main_name, work_addr, work_date, work_time, age, sex,
  payment_rate, draw_rate, fee_name, abs_customer_fine, contact_name
`;

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
  requestTimeout: 120000,
});

const limit = Number(process.argv[2] || 2000);
const clsExclude = `AND RTRIM(SS.contract_type_code) <> 'C'`;

try {
  const t0 = Date.now();
  const r = await pool
    .request()
    .input('limit', sql.Int, limit)
    .input('deptFrom', sql.NVarChar, '_')
    .input('deptTo', sql.NVarChar, 'Z')
    .input('siteFrom', sql.NVarChar, '_')
    .input('siteTo', sql.NVarChar, 'Z')
    .query(`
    WITH recent AS (
      SELECT TOP (@limit) A.request_no
      FROM st_request_head A
      INNER JOIN ms_site SS ON A.site_code = SS.site_code
      WHERE ${openStaffingRequestWhere()}
        AND SS.department_code BETWEEN @deptFrom AND @deptTo
        AND A.site_code BETWEEN @siteFrom AND @siteTo
        ${clsExclude}
      ORDER BY A.request_date DESC
    ),
    base AS (
      ${BASE_SQL}
      WHERE ${openStaffingRequestWhere()}
      AND A.request_no IN (SELECT request_no FROM recent)
    )
    SELECT ${SELECT_COLUMNS}
    FROM base
    WHERE rn = 1
    ORDER BY act_saleco_datetime DESC
  `);
  console.log('rows', r.recordset.length, 'ms', Date.now() - t0);
  const sample = r.recordset[0];
  console.log('sample resign_date type', Array.isArray(sample?.resign_date), sample?.resign_date);
} catch (e) {
  console.error('QUERY FAILED:', e.message);
}

await pool.close();
