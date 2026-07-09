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
if (!host) {
  console.error('No DB_HOST in .env / .env.local');
  process.exit(1);
}

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

const legacyWhere = `
  A.status = 'A'
  AND A.is_stop = 'N'
  AND (A.stop_no IS NULL OR RTRIM(A.stop_no) = '')
  AND NOT EXISTS (SELECT 1 FROM st_inform_head IH WHERE IH.request_no = A.request_no)
`;

const remainingWhere = legacyWhere;

const sumRemaining = `
  SELECT
    COUNT(*) AS request_count,
    SUM(
      CASE
        WHEN NOT EXISTS (SELECT 1 FROM st_inform_head IH WHERE IH.request_no = A.request_no)
          THEN ISNULL(NULLIF(A.request_qty, 0), 1)
        ELSE ISNULL(NULLIF(A.request_qty, 0), 1) - ISNULL(A.inform_qty, 0)
      END
    ) AS remaining_positions
  FROM st_request_head A
  WHERE ${remainingWhere}
`;

const [legacy, feed, remainingTotals] = await Promise.all([
  pool.request().query(`SELECT COUNT(*) AS cnt FROM st_request_head A WHERE ${legacyWhere}`),
  pool.request().query(`SELECT COUNT(*) AS cnt FROM st_request_head A WHERE ${remainingWhere}`),
  pool.request().query(sumRemaining),
]);

console.log(
  JSON.stringify(
    {
      legacy_no_inform: legacy.recordset[0].cnt,
      feed_open: feed.recordset[0].cnt,
      feed_positions_sum: remainingTotals.recordset[0].remaining_positions,
    },
    null,
    2,
  ),
);

await pool.close();
