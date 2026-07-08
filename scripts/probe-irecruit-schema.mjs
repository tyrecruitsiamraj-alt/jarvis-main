/**
 * ดู schema ตาราง recruit_register / recruit_master_job ใน iRecruit
 * รัน: npx tsx scripts/probe-irecruit-schema.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { irecruitSqlQuery } from '../api/_lib/irecruitSqlServer.ts';

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

const ADDR_RE = /addr|address|location|lat|lng|province|district|subdistrict|sub_district|postal|zip|geo|place|work|home|tambol|amphur/i;

for (const table of ['recruit_register', 'recruit_master_job']) {
  const cols = await irecruitSqlQuery(`
    SELECT COLUMN_NAME, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = '${table}'
    ORDER BY ORDINAL_POSITION
  `);
  const addrLike = cols.filter((c) => ADDR_RE.test(c.COLUMN_NAME));
  console.log(`\n=== ${table} (${cols.length} columns) ===`);
  console.log('All columns:', cols.map((c) => c.COLUMN_NAME).join(', '));
  console.log('Address-like:', addrLike.length ? addrLike.map((c) => c.COLUMN_NAME).join(', ') : '(none)');
}

const locTables = await irecruitSqlQuery(`
  SELECT TABLE_NAME
  FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_TYPE = 'BASE TABLE'
    AND (
      TABLE_NAME LIKE '%province%'
      OR TABLE_NAME LIKE '%district%'
      OR TABLE_NAME LIKE '%address%'
      OR TABLE_NAME LIKE '%location%'
    )
  ORDER BY TABLE_NAME
`);
console.log('\n=== location-related tables ===');
console.log(locTables.map((t) => t.TABLE_NAME).join(', ') || '(none)');

const sample = await irecruitSqlQuery(`
  SELECT TOP 5
    province_cerrently_id,
    district_cerrently_id,
    specific_information,
    comment
  FROM recruit_register
  WHERE deleted_at IS NULL
    AND (province_cerrently_id IS NOT NULL OR specific_information IS NOT NULL)
  ORDER BY created_at DESC
`);
console.log('\n=== sample location fields ===');
for (const r of sample) console.log(r);

for (const table of ['z_ms_province', 'z_ms_district', 'recruit_master_location', 'ir_register_ms_location']) {
  const cols = await irecruitSqlQuery(`
    SELECT COLUMN_NAME, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = '${table}'
    ORDER BY ORDINAL_POSITION
  `);
  if (!cols.length) {
    console.log(`\n=== ${table} === (not found)`);
    continue;
  }
  const addrLike = cols.filter((c) => ADDR_RE.test(c.COLUMN_NAME));
  console.log(`\n=== ${table} ===`);
  console.log('columns:', cols.map((c) => c.COLUMN_NAME).join(', '));
  if (addrLike.length) console.log('geo-like:', addrLike.map((c) => c.COLUMN_NAME).join(', '));
  const top = await irecruitSqlQuery(`SELECT TOP 2 * FROM ${table}`);
  console.log('sample:', top);
}
