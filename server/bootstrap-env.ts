/**
 * โหลด .env / .env.local ก่อน import handler ใน api/ (รันเฉพาะ server ท้องถิ่น ไม่ขึ้นกับ Vercel)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseEnvFile(filePath: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
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

const merged: Record<string, string> = {};
for (const name of ['.env', '.env.local']) {
  Object.assign(merged, parseEnvFile(path.join(root, name)));
}
for (const [k, v] of Object.entries(merged)) {
  if (v.trim() !== '') process.env[k] = v.trim();
}
