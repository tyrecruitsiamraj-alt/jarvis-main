import pg from 'pg';
import fs from 'fs';

function parseEnv(p) {
  const o = {};
  if (!fs.existsSync(p)) return o;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    o[t.slice(0, i).trim()] = v;
  }
  return o;
}

const env = { ...parseEnv('.env'), ...parseEnv('.env.local') };
const url = env.DATABASE_URL || env.POSTGRES_URL;
if (!url) {
  console.log('NO_DB_URL');
  process.exit(0);
}

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

const r = await pool.query(`
  SELECT 'public' AS schema, count(*)::int AS cnt FROM public.users
  UNION ALL
  SELECT 'jarvis_rm', count(*)::int FROM jarvis_rm.users
`);
console.log('counts', JSON.stringify(r.rows, null, 2));

const orphans = await pool.query(`
  SELECT p.email, p.role, p.is_active, p.department_code, p.created_at
  FROM public.users p
  LEFT JOIN jarvis_rm.users j ON lower(j.email) = lower(p.email)
  WHERE j.id IS NULL
  ORDER BY p.created_at DESC
  LIMIT 30
`);
console.log('orphans_in_public_not_in_jarvis_rm', orphans.rows.length);
console.log(JSON.stringify(orphans.rows, null, 2));

await pool.end();
