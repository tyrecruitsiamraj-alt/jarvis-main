/**
 * ทดสอบ query recruit_register จาก iRecruit SQL Server
 * รัน: npx tsx scripts/probe-recruit-register.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { listRecruitRegistrations } from '../api/_lib/recruitRegisterSql.ts';
import { getIrecruitSqlServerConfig } from '../api/_lib/irecruitSqlServer.ts';

function parseEnvFile(filePath) {
  const out = {};
  if (!existsSync(filePath)) return out;
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

const merged = { ...parseEnvFile('.env'), ...parseEnvFile('.env.local') };
for (const [k, v] of Object.entries(merged)) {
  if (String(v).trim() !== '') process.env[k] = String(v).trim();
}

const owner = (process.env.RECRUIT_REGISTER_OWNER || 'RM').trim();
const cfg = getIrecruitSqlServerConfig();
if (!cfg) {
  console.error('Missing iRecruit SQL Server config (IRECRUIT_DB_HOST / IRECRUIT_DB_USER / IRECRUIT_DB_NAME)');
  process.exit(1);
}

console.log('Connecting to', cfg.server, '/', cfg.database, 'owner =', owner);

const rows = await listRecruitRegistrations({ owner, limit: 5 });
console.log('rows:', rows.length);
for (const row of rows) {
  console.log(row);
}
