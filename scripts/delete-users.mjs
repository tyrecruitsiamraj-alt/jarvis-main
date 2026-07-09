/**
 * ลบผู้ใช้ตามอีเมล — อ่าน DATABASE_URL จาก .env / .env.local
 * รัน: node scripts/delete-users.mjs email1@x.com email2@x.com
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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

const emails = process.argv.slice(2).map((e) => e.trim().toLowerCase()).filter(Boolean);
if (emails.length === 0) {
  console.error('Usage: node scripts/delete-users.mjs email@example.com ...');
  process.exit(1);
}

const env = loadEnvFromFiles();
const databaseUrl = (env.DATABASE_URL || env.POSTGRES_URL || '').trim();
const schema = (env.PGSCHEMA || 'jarvis_rm').trim();
const pgSsl = ['true', '1', 'yes'].includes(String(env.PG_SSL || '').toLowerCase());

if (!databaseUrl) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: pgSsl ? { rejectUnauthorized: false } : false,
});

await client.connect();
await client.query(`set search_path to ${schema}, public`);

const before = await client.query(
  `select id, email, role, full_name from users where lower(email) = any($1::text[])`,
  [emails],
);
console.log(`Found ${before.rowCount} user(s):`);
for (const r of before.rows) {
  console.log(`  - ${r.email} (${r.role}) ${r.id}`);
}

if (before.rowCount === 0) {
  await client.end();
  process.exit(0);
}

const del = await client.query(
  `delete from users where lower(email) = any($1::text[]) returning email`,
  [emails],
);
console.log(`Deleted ${del.rowCount} user(s):`);
for (const r of del.rows) {
  console.log(`  - ${r.email}`);
}

await client.end();
