#!/usr/bin/env node
/**
 * ออก key ให้ระบบภายนอก (22 ต.ค. 2569 · So Scraping) — เก็บแค่ sha256 ใน `app_integration_keys` · พิมพ์ key จริงครั้งเดียว
 * ใช้: node scripts/create-integration-key.mjs so-scraping
 * ออกซ้ำชื่อเดิม = key ใหม่แทนตัวเก่าทันที (ตัวเก่าใช้ไม่ได้)
 * ⚠️ ต้องรัน migration 160 ก่อน
 */
import fs from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import pg from 'pg';

const name = (process.argv[2] || '').trim();
if (!/^[a-z0-9-]{3,40}$/.test(name)) {
  console.error('ใช้: node scripts/create-integration-key.mjs <ชื่อ เช่น so-scraping>');
  process.exit(1);
}
for (const f of ['.env', '.env.local']) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const schema = (process.env.PGSCHEMA || process.env.DATABASE_SCHEMA || 'jarvis_rm').trim();
const key = `jv_${name.replace(/-/g, '')}_${randomBytes(24).toString('hex')}`;
const hash = createHash('sha256').update(key, 'utf8').digest('hex');
const c = new pg.Client({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });
await c.connect();
await c.query(
  `insert into "${schema}".app_integration_keys (name, key_sha256) values ($1, $2)
   on conflict (name) do update set key_sha256 = excluded.key_sha256, created_at = now(), revoked_at = null`,
  [name, hash],
);
await c.end();
console.log(key);
