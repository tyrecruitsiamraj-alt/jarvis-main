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
const base = `
  FROM st_request_head A
  INNER JOIN ms_site SS ON A.site_code = SS.site_code
  WHERE ${openWhere}
    AND SS.department_code BETWEEN '_' AND 'Z'
    AND A.site_code BETWEEN '_' AND 'Z'
    AND RTRIM(SS.contract_type_code) <> 'C'
`;

const filters = {
  all: '',
  staffing_queue: `
    AND (
      EXISTS (SELECT 1 FROM st_ms_request mr WHERE mr.request_code = A.request_code AND mr.request_name LIKE N'%ลาออก%')
      OR EXISTS (SELECT 1 FROM st_ms_request mr WHERE mr.request_code = A.request_code AND mr.request_name LIKE N'%เปลี่ยน%')
    )`,
  resign_only: `
    AND EXISTS (SELECT 1 FROM st_ms_request mr WHERE mr.request_code = A.request_code AND mr.request_name LIKE N'%ลาออก%')`,
  exclude_substitute_types: `
    AND NOT EXISTS (
      SELECT 1 FROM st_ms_request mr
      WHERE mr.request_code = A.request_code
        AND (
          mr.request_name LIKE N'%เปิดไซด์%'
          OR mr.request_name LIKE N'%เพิ่มอัตรา%'
          OR mr.request_name LIKE N'%เพิ่มตำแหน่ง%'
          OR mr.request_name LIKE N'%ตำแหน่งว่าง%'
          OR mr.request_name LIKE N'%ทีมเสริม%'
          OR mr.request_name LIKE N'%spare%'
          OR mr.request_name LIKE N'%ชดแรง%'
          OR mr.request_name LIKE N'%ย้าย%'
        )
    )`,
  exclude_change_person: `
    AND NOT EXISTS (
      SELECT 1 FROM st_ms_request mr
      WHERE mr.request_code = A.request_code
        AND mr.request_name LIKE N'%เปลี่ยน%'
    )`,
  by_request_code: `
    AND A.request_code IN ('005', '006', '013', '014')`,
};

for (const [name, extra] of Object.entries(filters)) {
  const r = await pool.request().query(`SELECT COUNT(*) AS cnt ${base} ${extra}`);
  console.log(name, r.recordset[0].cnt);
}

await pool.close();
