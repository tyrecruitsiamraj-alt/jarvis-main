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

const needle = (process.argv[2] || '62crs0049').trim();
const needleUpper = needle.toUpperCase();

const env = { ...parseEnvFile('.env'), ...parseEnvFile('.env.local') };
if (!env.DB_HOST) {
  console.error('No DB_HOST in .env / .env.local');
  process.exit(1);
}

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

const like = `%${needleUpper}%`;

const queries = {
  ms_site: `
    SELECT site_code, site_name, department_code, contract_type_code
    FROM ms_site
    WHERE UPPER(RTRIM(site_code)) LIKE @like OR UPPER(site_name) LIKE @like
  `,
  st_request_by_site: `
    SELECT TOP 20
      A.request_no, A.request_date, A.status, A.is_stop, A.is_inform_all, A.inform_qty,
      A.stop_no, A.cancel_date, A.site_code,
      RTRIM(SS.site_name) AS site_name,
      RTRIM(SS.department_code) AS department_code,
      RTRIM(SS.contract_type_code) AS contract_type,
      (SELECT COUNT(*) FROM st_inform_head IH WHERE IH.request_no = A.request_no) AS inform_doc_count,
      (SELECT TOP 1 IH.inform_no FROM st_inform_head IH WHERE IH.request_no = A.request_no) AS inform_no
    FROM st_request_head A
    LEFT JOIN ms_site SS ON A.site_code = SS.site_code
    WHERE UPPER(RTRIM(A.site_code)) LIKE @like
       OR UPPER(RTRIM(A.request_no)) LIKE @like
    ORDER BY A.request_date DESC
  `,
  st_request_exact_site: `
    SELECT TOP 20
      A.request_no, A.request_date, A.status, A.is_stop, A.is_inform_all,
      A.stop_no, RTRIM(A.site_code) AS site_code
    FROM st_request_head A
    WHERE UPPER(RTRIM(A.site_code)) = @exact
    ORDER BY A.request_date DESC
  `,
};

for (const [key, q] of Object.entries(queries)) {
  const req = pool.request().input('like', sql.NVarChar, like);
  if (q.includes('@exact')) req.input('exact', sql.NVarChar, needleUpper);
  const r = await req.query(q);
  console.log(`=== ${key} (${r.recordset.length}) ===`);
  console.log(JSON.stringify(r.recordset, null, 2));
}

await pool.close();
