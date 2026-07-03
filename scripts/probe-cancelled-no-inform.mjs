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

const env = { ...parseEnvFile('.env'), ...parseEnvFile('.env.local') };
const { server, port } = parseSqlServerEndpoint(env.DB_HOST || '', env.DB_PORT);

const pool = await sql.connect({
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  server,
  database: env.DB_NAME,
  port,
  options: {
    encrypt: (env.DB_ENCRYPT || 'false').toLowerCase() === 'true',
    trustServerCertificate: (env.DB_TRUST_SERVER_CERTIFICATE || 'true').toLowerCase() !== 'false',
  },
});

const queries = {
  prefix_counts: `
    SELECT LEFT(request_no, 3) AS prefix, COUNT(*) AS cnt
    FROM st_request_head
    WHERE LEFT(request_no, 3) IN ('CRM', 'CRO', 'CLS', 'CLB', 'CLM', 'OPL', 'LBM', 'LAO')
    GROUP BY LEFT(request_no, 3)
    ORDER BY cnt DESC
  `,
  crm_samples: `
    SELECT TOP 15 A.request_no, A.status, A.is_inform_all, A.is_stop, A.cancel_date,
      (SELECT COUNT(*) FROM st_inform_head IH WHERE IH.request_no = A.request_no) AS inform_doc_count,
      RTRIM(SS.contract_type_code) AS contract_type_code
    FROM st_request_head A
    LEFT JOIN ms_site SS ON A.site_code = SS.site_code
    WHERE LEFT(A.request_no, 3) = 'CRM'
    ORDER BY A.request_date DESC
  `,
  cro_no_inform: `
    SELECT TOP 15 A.request_no, A.status, A.is_inform_all, A.is_stop,
      (SELECT COUNT(*) FROM st_inform_head IH WHERE IH.request_no = A.request_no) AS inform_doc_count
    FROM st_request_head A
    WHERE LEFT(A.request_no, 3) = 'CRO'
      AND NOT EXISTS (SELECT 1 FROM st_inform_head IH WHERE IH.request_no = A.request_no)
    ORDER BY A.request_date DESC
  `,
  totals: `
    SELECT
      (SELECT COUNT(*) FROM st_request_head A WHERE A.status = 'C' AND NOT EXISTS (SELECT 1 FROM st_inform_head IH WHERE IH.request_no = A.request_no)) AS cancelled_no_inform,
      (SELECT COUNT(*) FROM st_request_head A WHERE A.is_stop = 'Y' AND NOT EXISTS (SELECT 1 FROM st_inform_head IH WHERE IH.request_no = A.request_no)) AS stopped_no_inform,
      (SELECT COUNT(*) FROM st_request_head A WHERE A.status = 'A' AND A.is_stop = 'N' AND NOT EXISTS (SELECT 1 FROM st_inform_head IH WHERE IH.request_no = A.request_no)) AS active_open_no_inform
  `,
  stop_reasons: `SELECT TOP 20 * FROM st_ms_stop_by`,
  cr_site_codes: `
    SELECT TOP 15 site_code, site_name, department_code, contract_type_code
    FROM ms_site
    WHERE department_code LIKE 'CR%' OR site_code LIKE '%CR%'
    ORDER BY site_code
  `,
  cancelled_crm_cro: `
    SELECT LEFT(A.request_no, 3) AS prefix, COUNT(*) AS cnt
    FROM st_request_head A
    WHERE A.status = 'C'
      AND NOT EXISTS (SELECT 1 FROM st_inform_head IH WHERE IH.request_no = A.request_no)
      AND LEFT(A.request_no, 3) IN ('CRM', 'CRO')
    GROUP BY LEFT(A.request_no, 3)
  `,
  inform_no_prefix: `
    SELECT LEFT(inform_no, 3) AS prefix, COUNT(*) AS cnt
    FROM st_inform_head
    GROUP BY LEFT(inform_no, 3)
    ORDER BY cnt DESC
  `,
  inform_no_cls_like: `
    SELECT TOP 20 inform_no, request_no
    FROM st_inform_head
    WHERE inform_no LIKE 'Cls%' OR inform_no LIKE 'CLS%' OR inform_no LIKE 'CL%'
    ORDER BY inform_no DESC
  `,
  request_no_cl_prefix: `
    SELECT TOP 20 request_no, status, is_inform_all, is_stop, cancel_date
    FROM st_request_head
    WHERE request_no LIKE 'CL%'
    ORDER BY request_date DESC
  `,
  cancelled_prefix_top: `
    SELECT TOP 15 LEFT(A.request_no, 3) AS prefix, COUNT(*) AS cnt
    FROM st_request_head A
    WHERE A.status = 'C'
      AND NOT EXISTS (SELECT 1 FROM st_inform_head IH WHERE IH.request_no = A.request_no)
    GROUP BY LEFT(A.request_no, 3)
    ORDER BY cnt DESC
  `,
  cancelled_cro_samples: `
    SELECT TOP 10 A.request_no, A.status, A.is_inform_all, A.is_stop, A.cancel_date,
      RTRIM(SS.department_code) AS dept, RTRIM(SS.contract_type_code) AS contract_type
    FROM st_request_head A
    LEFT JOIN ms_site SS ON A.site_code = SS.site_code
    WHERE A.status = 'C'
      AND LEFT(A.request_no, 3) = 'CRO'
      AND NOT EXISTS (SELECT 1 FROM st_inform_head IH WHERE IH.request_no = A.request_no)
    ORDER BY A.cancel_date DESC
  `,
  request_head_columns: `
    SELECT COLUMN_NAME, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'st_request_head'
      AND (COLUMN_NAME LIKE '%cancel%' OR COLUMN_NAME LIKE '%close%' OR COLUMN_NAME LIKE '%inform%' OR COLUMN_NAME LIKE '%stop%')
    ORDER BY COLUMN_NAME
  `,
  cancelled_with_fields: `
    SELECT TOP 15
      A.request_no, A.status, A.is_inform_all, A.is_stop, A.is_close,
      A.cancel_date, A.inform_qty, A.stop_code, A.stop_no, A.stop_date,
      SB.stop_by_name,
      RTRIM(SS.contract_type_code) AS contract_type,
      RTRIM(SS.department_code) AS dept
    FROM st_request_head A
    LEFT JOIN ms_site SS ON A.site_code = SS.site_code
    LEFT JOIN st_ms_stop_by SB ON A.stop_code = SB.stop_by_code
    WHERE A.status = 'C'
      AND NOT EXISTS (SELECT 1 FROM st_inform_head IH WHERE IH.request_no = A.request_no)
    ORDER BY A.cancel_date DESC
  `,
  stop_no_patterns: `
    SELECT TOP 20 stop_no, request_no, status, is_stop, is_close
    FROM st_request_head
    WHERE stop_no IS NOT NULL AND RTRIM(stop_no) <> ''
    ORDER BY stop_date DESC
  `,
  stop_no_prefix: `
    SELECT LEFT(RTRIM(stop_no), 3) AS prefix, COUNT(*) AS cnt
    FROM st_request_head
    WHERE stop_no IS NOT NULL AND RTRIM(stop_no) <> ''
    GROUP BY LEFT(RTRIM(stop_no), 3)
    ORDER BY cnt DESC
  `,
  stopped_no_inform_with_cls: `
    SELECT COUNT(*) AS cnt
    FROM st_request_head A
    WHERE A.is_stop = 'Y'
      AND NOT EXISTS (SELECT 1 FROM st_inform_head IH WHERE IH.request_no = A.request_no)
      AND A.stop_no IS NOT NULL AND RTRIM(A.stop_no) <> ''
  `,
  stopped_no_inform_no_cls: `
    SELECT COUNT(*) AS cnt
    FROM st_request_head A
    WHERE A.is_stop = 'Y'
      AND NOT EXISTS (SELECT 1 FROM st_inform_head IH WHERE IH.request_no = A.request_no)
      AND (A.stop_no IS NULL OR RTRIM(A.stop_no) = '')
  `,
  cancelled_with_cls: `
    SELECT COUNT(*) AS cnt
    FROM st_request_head A
    WHERE A.status = 'C'
      AND A.stop_no IS NOT NULL AND RTRIM(A.stop_no) <> ''
  `,
  cls_samples_no_inform: `
    SELECT TOP 15
      A.request_no, A.status, A.is_stop, A.is_inform_all, A.stop_no, A.stop_code,
      SB.stop_by_name, A.inform_qty,
      (SELECT COUNT(*) FROM st_inform_head IH WHERE IH.request_no = A.request_no) AS inform_doc_count
    FROM st_request_head A
    LEFT JOIN st_ms_stop_by SB ON A.stop_code = SB.stop_by_code
    WHERE A.stop_no LIKE 'CLS%'
      AND NOT EXISTS (SELECT 1 FROM st_inform_head IH WHERE IH.request_no = A.request_no)
    ORDER BY A.stop_date DESC
  `,
  status_matrix_cls: `
    SELECT A.status, A.is_stop,
      COUNT(*) AS total,
      SUM(CASE WHEN A.stop_no LIKE 'CLS%' THEN 1 ELSE 0 END) AS with_cls,
      SUM(CASE WHEN NOT EXISTS (SELECT 1 FROM st_inform_head IH WHERE IH.request_no = A.request_no) THEN 1 ELSE 0 END) AS no_inform
    FROM st_request_head A
    GROUP BY A.status, A.is_stop
    ORDER BY total DESC
  `,
  cancelled_cls_samples: `
    SELECT TOP 10 A.request_no, A.status, A.is_stop, A.stop_no, A.cancel_date, A.is_inform_all
    FROM st_request_head A
    WHERE A.status = 'C' AND A.stop_no LIKE 'CLS%'
    ORDER BY A.cancel_date DESC
  `,
};

for (const [key, q] of Object.entries(queries)) {
  const r = await pool.request().query(q);
  console.log(`=== ${key} ===`);
  console.log(JSON.stringify(r.recordset, null, 2));
}

await pool.close();
