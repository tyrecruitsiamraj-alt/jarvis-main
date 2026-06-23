import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const envDir =
  typeof import.meta.url === 'string'
    ? path.dirname(fileURLToPath(import.meta.url))
    : /* cjs fallback */ typeof __dirname !== 'undefined'
      ? __dirname
      : process.cwd();

/** โฟลเดอร์ที่มี .env.local (มักเป็น root โปรเจกต์) */
function getProjectRoot(): string {
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, '.env.local'))) return cwd;
  if (fs.existsSync(path.join(cwd, '.env'))) return cwd;
  const fromApiLib = path.resolve(envDir, '..', '..');
  if (fs.existsSync(path.join(fromApiLib, '.env.local'))) return fromApiLib;
  if (fs.existsSync(path.join(fromApiLib, '.env'))) return fromApiLib;
  return cwd;
}

const DB_ENV_KEYS = [
  'DATABASE_URL',
  'POSTGRES_URL',
  'PGSCHEMA',
  'DATABASE_SCHEMA',
  'PG_SSL',
] as const;

let localDbEnvApplied = false;

function parseEnvFile(filePath: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(filePath)) return out;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
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
    out[key] = val;
  }
  return out;
}

/**
 * vercel dev อาจใส่ DATABASE_URL จาก Project Settings ที่ผิด/ว่าง ทับ .env.local
 * โหลด .env แล้ว .env.local จากโฟลเดอร์โปรเจกต์ ให้คีย์ DB จากไฟล์ชนะ (เหมือน db:ping)
 */
function applyLocalDbEnvFromFiles(): void {
  if (localDbEnvApplied) return;
  localDbEnvApplied = true;

  if (process.env.JARVIS_SKIP_LOCAL_ENV === '1') return;
  if (process.env.VERCEL === '1' && process.env.VERCEL_ENV === 'production') return;

  const root = getProjectRoot();
  const merged: Record<string, string> = {};
  for (const name of ['.env', '.env.local']) {
    const vars = parseEnvFile(path.join(root, name));
    for (const k of DB_ENV_KEYS) {
      const v = vars[k];
      if (v !== undefined && String(v).trim() !== '') {
        merged[k] = String(v).trim();
      }
    }
  }
  for (const k of DB_ENV_KEYS) {
    const v = merged[k];
    if (v !== undefined) process.env[k] = v;
  }
}

applyLocalDbEnvFromFiles();

export function getDatabaseUrl(): string | null {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
  return url.trim() ? url.trim() : null;
}

export function isPgSslEnabled(): boolean {
  const v = (process.env.PG_SSL || '').toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

/**
 * Schema ใน PostgreSQL (เช่น jarvis_rm) — ตั้ง search_path ทุกครั้งที่ได้ connection จาก pool
 * ใช้ PGSCHEMA หรือ DATABASE_SCHEMA
 */
export function getPgSchema(): string | null {
  const s = (process.env.PGSCHEMA || process.env.DATABASE_SCHEMA || '').trim();
  if (!s) return null;
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)) return null;
  return s;
}
