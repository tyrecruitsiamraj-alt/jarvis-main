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
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[t.slice(0, i).trim()] = val;
  }
  return out;
}

const env = { ...parseEnvFile('.env'), ...parseEnvFile('.env.local') };
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

const feeJoin = `
  OUTER APPLY (
    SELECT TOP 1 z.fee_name
    FROM wg2_ms_fee z
    WHERE z.fee_codex = (r.withdraw_type_code + r.income1_code + r.income2_code + r.fee_code)
  ) f
`;

const sample = await pool.request().query(`
  SELECT TOP 12
    r.request_no, r.seq, r.is_wage, r.is_wage_pr,
    r.payment_rate, r.draw_rate, r.draw_time, r.fee_divide, r.draw_divide,
    r.withdraw_type_code, r.income1_code, r.income2_code, r.fee_code, r.remark,
    f.fee_name
  FROM st_request_p3_rate r
  ${feeJoin}
  WHERE ISNULL(r.payment_rate, 0) > 0 OR ISNULL(r.draw_rate, 0) > 0
  ORDER BY r.request_no DESC
`);
console.log('=== sample ===');
console.log(JSON.stringify(sample.recordset, null, 2));

const multi = await pool.request().query(`
  SELECT TOP 8 request_no, COUNT(*) AS cnt,
    SUM(CASE WHEN is_wage = 'Y' THEN 1 ELSE 0 END) AS wage_rows,
    SUM(CASE WHEN is_wage <> 'Y' OR is_wage IS NULL THEN 1 ELSE 0 END) AS other_rows
  FROM st_request_p3_rate
  GROUP BY request_no
  HAVING COUNT(*) > 1
  ORDER BY COUNT(*) DESC
`);
console.log('=== multi-rate ===');
console.log(JSON.stringify(multi.recordset, null, 2));

for (const row of multi.recordset.slice(0, 3)) {
  const detail = await pool
    .request()
    .input('no', sql.VarChar, row.request_no)
    .query(`
      SELECT r.seq, r.is_wage, r.is_wage_pr, r.payment_rate, r.draw_rate, r.draw_time,
        r.fee_divide, r.draw_divide, r.withdraw_type_code, r.income1_code, r.income2_code,
        r.fee_code, r.remark, f.fee_name
      FROM st_request_p3_rate r
      ${feeJoin}
      WHERE r.request_no = @no
      ORDER BY CASE WHEN r.is_wage = 'Y' THEN 0 ELSE 1 END, r.seq
    `);
  console.log('=== detail', row.request_no, '===');
  console.log(JSON.stringify(detail.recordset, null, 2));
}

const feeDist = await pool.request().query(`
  SELECT TOP 25
    CASE WHEN r.is_wage = 'Y' THEN 'wage' ELSE 'other' END AS kind,
    ISNULL(f.fee_name, '(no name)') AS fee_name,
    COUNT(*) AS cnt,
    AVG(CAST(r.payment_rate AS float)) AS avg_pay,
    AVG(CAST(r.draw_rate AS float)) AS avg_draw,
    MIN(r.payment_rate) AS min_pay,
    MAX(r.payment_rate) AS max_pay,
    MIN(r.draw_rate) AS min_draw,
    MAX(r.draw_rate) AS max_draw
  FROM st_request_p3_rate r
  ${feeJoin}
  WHERE ISNULL(r.payment_rate, 0) > 0 OR ISNULL(r.draw_rate, 0) > 0
  GROUP BY CASE WHEN r.is_wage = 'Y' THEN 'wage' ELSE 'other' END, ISNULL(f.fee_name, '(no name)')
  ORDER BY COUNT(*) DESC
`);
console.log('=== fee distribution ===');
console.log(JSON.stringify(feeDist.recordset, null, 2));

const drawVsPay = await pool.request().query(`
  SELECT TOP 15
    CASE WHEN r.is_wage = 'Y' THEN 'wage' ELSE 'other' END AS kind,
    COUNT(*) AS cnt,
    SUM(CASE WHEN ISNULL(r.draw_rate,0) > 0 AND ISNULL(r.draw_rate,0) <> ISNULL(r.payment_rate,0) THEN 1 ELSE 0 END) AS draw_diff_from_pay,
    SUM(CASE WHEN ISNULL(r.draw_rate,0) > 0 THEN 1 ELSE 0 END) AS has_draw,
    SUM(CASE WHEN ISNULL(r.payment_rate,0) > 0 THEN 1 ELSE 0 END) AS has_pay
  FROM st_request_p3_rate r
  GROUP BY CASE WHEN r.is_wage = 'Y' THEN 'wage' ELSE 'other' END
`);
console.log('=== draw vs pay ===');
console.log(JSON.stringify(drawVsPay.recordset, null, 2));

await pool.close();
