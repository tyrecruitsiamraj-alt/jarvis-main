/**
 * Import เจ้าหน้าที่ OPL จาก Excel (site_code → ผู้รับผิดชอบ) ลง PostgreSQL
 * ใบขอดึงจาก MSSQL ตาม DB จริง แล้วจับคู่ด้วย site_code
 *
 * Usage:
 *   node scripts/import-opl-assignments.mjs "C:\path\Site update 16 พ.ค. 69.xls"
 *   node scripts/import-opl-assignments.mjs --dry-run "C:\path\file.xls"
 *
 * ต้องมี: DATABASE_URL, DB_HOST/DB_USER/DB_PASSWORD/DB_NAME (MSSQL)
 * รัน migration 034 ก่อน: npm run db:migrate
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import sql from 'mssql';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function loadEnvFromFiles() {
  const merged = { ...process.env };
  for (const name of ['.env', '.env.local']) {
    const p = path.join(root, name);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i <= 0) continue;
      const key = t.slice(0, i).trim();
      let val = t.slice(i + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      merged[key] = val;
    }
  }
  return merged;
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

function pgTable(env) {
  const schema = String(env.PGSCHEMA || env.DATABASE_SCHEMA || 'jarvis_rm').trim();
  return `"${schema}".siamraj_unit_assignments`;
}

function pgRosterTable(env) {
  const schema = String(env.PGSCHEMA || env.DATABASE_SCHEMA || 'jarvis_rm').trim();
  return `"${schema}".job_staff_roster`;
}

async function seedOplRoster(client, rosterTable, names) {
  for (const name of names) {
    const t = String(name).trim();
    if (!t) continue;
    await client.query(
      `insert into ${rosterTable} (role, display_name)
       select 'opl', $1
       where not exists (
         select 1 from ${rosterTable} r
         where r.role = 'opl' and lower(trim(r.display_name)) = lower(trim($1::text))
       )`,
      [t],
    );
  }
}

function parseExcel(filePath) {
  const pyScript = path.join(__dirname, 'parse-opl-xls.py');
  const r = spawnSync('python', [pyScript, filePath], { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(r.stderr || r.stdout || 'parse-opl-xls.py failed');
  }
  const data = JSON.parse(r.stdout);
  if (!data.siteOpl || typeof data.siteOpl !== 'object') {
    throw new Error('Excel parser returned no siteOpl map');
  }
  return data;
}

async function fetchOpenRequests(pool) {
  const result = await pool.request().query(`
    SELECT
      RTRIM(A.request_no) AS request_no,
      RTRIM(A.site_code) AS site_code
    FROM st_request_head A
    WHERE A.status = 'A'
      AND A.is_stop = 'N'
      AND (A.stop_no IS NULL OR RTRIM(A.stop_no) = '')
      AND NOT EXISTS (SELECT 1 FROM st_inform_head IH WHERE IH.request_no = A.request_no)
      AND A.site_code IS NOT NULL
      AND RTRIM(A.site_code) <> ''
    ORDER BY A.request_no
  `);
  return result.recordset.map((row) => ({
    request_no: String(row.request_no || '').trim(),
    site_code: String(row.site_code || '').trim(),
  }));
}

async function upsertOpl(client, table, requestNo, oplName) {
  const { rows: existing } = await client.query(
    `select request_no, recruiter_name, screener_name, opl_name from ${table} where request_no = $1`,
    [requestNo],
  );
  if (!existing[0]) {
    await client.query(
      `insert into ${table} (request_no, recruiter_name, screener_name, opl_name, updated_at)
       values ($1, null, null, $2, now())`,
      [requestNo, oplName],
    );
    return 'inserted';
  }
  await client.query(
    `update ${table} set opl_name = $2, updated_at = now() where request_no = $1`,
    [requestNo, oplName],
  );
  return 'updated';
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const filePath = args.find((a) => !a.startsWith('--'));
  if (!filePath) {
    console.error('Usage: node scripts/import-opl-assignments.mjs [--dry-run] <file.xls>');
    process.exit(1);
  }
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }

  const env = loadEnvFromFiles();
  const databaseUrl = (env.DATABASE_URL || env.POSTGRES_URL || '').trim();
  if (!databaseUrl) {
    console.error('Missing DATABASE_URL / POSTGRES_URL');
    process.exit(1);
  }

  const { server, port } = parseSqlServerEndpoint(env.DB_HOST || '', env.DB_PORT);
  const mssqlConfig = {
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    server,
    database: env.DB_NAME,
    port,
    options: {
      encrypt: (env.DB_ENCRYPT || 'false').toLowerCase() === 'true',
      trustServerCertificate: (env.DB_TRUST_SERVER_CERTIFICATE || 'true').toLowerCase() !== 'false',
    },
  };

  console.log('Parsing Excel:', filePath);
  const parsed = parseExcel(filePath);
  const siteOpl = parsed.siteOpl;
  console.log('Sheets used:', parsed.sheets?.join(', ') || '(auto)');
  console.log('Site → OPL rows in Excel:', parsed.count ?? Object.keys(siteOpl).length);

  console.log('Connecting MSSQL…');
  const mssqlPool = await sql.connect(mssqlConfig);
  const requests = await fetchOpenRequests(mssqlPool);
  await mssqlPool.close();
  console.log('Open requests in DB:', requests.length);

  const assignments = [];
  const unmatchedSites = new Set();
  const matchedSites = new Set();

  for (const req of requests) {
    const opl = siteOpl[req.site_code];
    if (!opl) {
      unmatchedSites.add(req.site_code);
      continue;
    }
    matchedSites.add(req.site_code);
    assignments.push({ request_no: req.request_no, site_code: req.site_code, opl_name: opl });
  }

  const excelSites = new Set(Object.keys(siteOpl));
  const dbSites = new Set(requests.map((r) => r.site_code));
  const excelOnly = [...excelSites].filter((s) => !dbSites.has(s));
  const sampleAssignees = [...new Set(Object.values(siteOpl))].sort((a, b) => a.localeCompare(b, 'th'));

  console.log('\n--- Summary ---');
  console.log('Requests to assign:', assignments.length);
  console.log('Matched sites:', matchedSites.size);
  console.log('Requests with site not in Excel:', requests.length - assignments.length);
  console.log('Excel sites with no open request:', excelOnly.length);
  console.log('Unique OPL names:', sampleAssignees.join(', '));

  if (dryRun) {
    console.log('\n[dry-run] Sample (first 10):');
    for (const row of assignments.slice(0, 10)) {
      console.log(`  ${row.request_no} | ${row.site_code} → ${row.opl_name}`);
    }
    process.exit(0);
  }

  const pgSsl = ['true', '1', 'yes'].includes(String(env.PG_SSL || '').toLowerCase());
  const pgPool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: pgSsl ? { rejectUnauthorized: false } : undefined,
    max: 1,
  });
  const table = pgTable(env);
  const rosterTable = pgRosterTable(env);
  const client = await pgPool.connect();

  let inserted = 0;
  let updated = 0;
  try {
    await client.query('BEGIN');
    for (const row of assignments) {
      const result = await upsertOpl(client, table, row.request_no, row.opl_name);
      if (result === 'inserted') inserted += 1;
      else updated += 1;
    }
    await client.query('COMMIT');
    await seedOplRoster(client, rosterTable, sampleAssignees);
    console.log(`\nDone — inserted ${inserted}, updated ${updated} (opl_name only)`);
    console.log(`Roster — ensured ${sampleAssignees.length} OPL name(s) in job_staff_roster`);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pgPool.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
