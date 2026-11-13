/**
 * ═══ สารบัญคำสั่ง (API) ของ Jarvis ให้ผู้ช่วย AI → api/_lib/aiAssistant/apiCatalog.generated.ts (13 พ.ย. 2569) ═══
 *
 * ทำไมสร้างจากไฟล์จริง ไม่เขียนรายการมือ (บทเรียน KNOWA): รายการมือตกรุ่นทันทีที่มีคนเพิ่ม/แก้เส้น
 * AI ที่ถือรายการเก่าจะยิงคำสั่งที่ไม่มีแล้ว · ตัวนี้อ่าน `api/_handlers/registry.ts` (เส้นที่เปิดจริง) แล้วเปิดไฟล์ handler แต่ละตัว
 *
 * ต่อเส้นเก็บ: methods (คำ GET/POST/… ที่ handler ตรวจจริง · ไม่ตรวจเลย = GET) · doc = หัวคอมเมนต์ก้อนแรกเต็ม ๆ
 * (⚠️ ห้ามตัดสั้น — KNOWA เคยตัดแล้วคำสั่งท้าย ๆ หาย) · query / body = ชื่อช่องที่โค้ดอ่าน
 * · reachesPeople = โค้ดของเส้นนี้ (ไล่ import ทุกชั้น) ไปถึงตัวส่ง Lumos / ตัวเข้าคิวโทร / ตัวสั่ง So Scraping / ตัวส่งข้อความออก
 *   ⇒ ผู้ช่วยห้ามสั่งงานเขียนของเส้นนี้ (เจ้าของ 13 พ.ย. 2569 Choice "ไม่ให้สั่งเลย") · หยาบแบบตั้งใจ: ไม่รู้ = กันไว้ก่อน
 *
 * ⚠️ ด่านสิทธิ์ไม่ได้มาจากไฟล์นี้ — ผู้ช่วยยิงด้วยคุกกี้ของคนที่สั่ง ทุกเส้นตรวจสิทธิ์เองเหมือนกดจากหน้าจอ
 * ⚠️ เพิ่ม/แก้เส้นแล้วรัน `npm run ai:catalog` แล้ว commit ผลลัพธ์ (เทสต์ `aiAssistant` จับรายการเส้นที่ไม่ตรง registry)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HANDLERS = join(ROOT, 'api', '_handlers');
const OUT = join(ROOT, 'api', '_lib', 'aiAssistant', 'apiCatalog.generated.ts');

/** โค้ดที่ทำให้คนจริงได้รับผล — ส่ง Lumos โทร · เข้าคิวโทร · สั่ง So Scraping · ส่งข้อความออกนอกระบบ */
const REACHES_PEOPLE = /\b(insertQueueItems|pushLumos\w*|lumosPush\w*|LumosClient|startSoRequest|sendLineMessage|nodemailer|sendMail)\b/;

/** ถอดคอมเมนต์ (รู้จักสตริง ไม่งั้น `https://` ในสตริงถูกตัด) */
function stripComments(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '/' && n === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end < 0 ? src.length : end + 2;
      continue;
    }
    if (c === '/' && n === '/') {
      const end = src.indexOf('\n', i);
      i = end < 0 ? src.length : end;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j += src[j] === '\\' ? 2 : 1;
      out += src.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** หัวคอมเมนต์ก้อนแรกของไฟล์ — ทั้งก้อน (เส้นส่วนใหญ่เขียนวิธีใช้ GET/POST + ช่องที่รับไว้ตรงนี้) */
function docOf(src: string): string {
  const m = src.match(/\/\*\*([\s\S]*?)\*\//);
  if (!m) return '';
  return m[1]
    .split('\n')
    .map((l) => l.replace(/^\s*\*\s?/, '').trimEnd())
    .filter((l, i, a) => l.trim() || (i > 0 && a[i - 1].trim()))
    .join('\n')
    .trim();
}

/** ไฟล์ที่ไฟล์นี้ import (ทั้งชั้น `api/` และ `src/lib/`) — ไว้ไล่ว่าไปถึงโค้ดที่ทำให้คนจริงได้รับผลไหม */
function importsOf(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  const out: string[] = [];
  for (const m of src.matchAll(/from\s+'(\.{1,2}\/[^']+?)(?:\.js)?'/g)) {
    const base = normalize(join(dirname(file), m[1]));
    for (const cand of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
      if (existsSync(cand)) {
        out.push(cand);
        break;
      }
    }
  }
  return out;
}

const closureCache = new Map<string, boolean>();
function reachesPeople(file: string, seen = new Set<string>()): boolean {
  if (closureCache.has(file)) return closureCache.get(file)!;
  if (seen.has(file)) return false;
  seen.add(file);
  const hit = REACHES_PEOPLE.test(stripComments(readFileSync(file, 'utf8'))) || importsOf(file).some((f) => reachesPeople(f, seen));
  closureCache.set(file, hit);
  return hit;
}

const registry = readFileSync(join(HANDLERS, 'registry.ts'), 'utf8');
// import แบบ default (`import x from './a.js'`) และแบบมีชื่อ (`import { a, b } from './c.js'`)
const importOf = new Map<string, string>([
  ...[...registry.matchAll(/import\s+(\w+)\s+from\s+'(\.\/[^']+?)\.js';/g)].map((m) => [m[1], m[2]] as [string, string]),
  ...[...registry.matchAll(/import\s*\{([^}]+)\}\s*from\s+'(\.\/[^']+?)\.js';/g)].flatMap((m) =>
    m[1].split(',').map((n) => [n.trim().split(/\s+as\s+/).pop()!.trim(), m[2]] as [string, string]).filter(([n]) => n),
  ),
]);
const entries = [...registry.matchAll(/^\s*'(\/api\/[^']+)':\s*(\w+)/gm)]
  .map(([, path, handler]) => {
    const rel = importOf.get(handler);
    if (!rel) throw new Error(`ไม่เจอ import ของ ${handler} (${path}) ใน registry`);
    const file = join(HANDLERS, `${rel}.ts`);
    const src = readFileSync(file, 'utf8');
    const code = stripComments(src);
    const found = [...new Set([...code.matchAll(/'(GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]))];
    const methods = found.length ? ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].filter((x) => found.includes(x)) : ['GET'];
    const query = [...new Set([...code.matchAll(/query\??\.(\w+)/g), ...code.matchAll(/getQuery\(\s*req\s*,\s*'(\w+)'/g)].map((m) => m[1]))].filter(
      (q) => !['path', 'length'].includes(q),
    );
    const body = [...new Set([...code.matchAll(/\bbody\??\.(\w+)/g)].map((m) => m[1]))].filter((k) => !['length', 'map', 'filter'].includes(k));
    return {
      path,
      file: relative(ROOT, file).split('\\').join('/'),
      methods,
      doc: docOf(src),
      query,
      body,
      reachesPeople: reachesPeople(file),
    };
  })
  .sort((a, b) => a.path.localeCompare(b.path));

writeFileSync(
  OUT,
  `/* eslint-disable */\n// สร้างจาก scripts/ai-build-api-catalog.ts — ห้ามแก้มือ · รัน \`npm run ai:catalog\`\n` +
    `export type ApiCatalogEntry = { path: string; file: string; methods: string[]; doc: string; query: string[]; body: string[]; reachesPeople: boolean };\n` +
    `export const API_CATALOG: ApiCatalogEntry[] = ${JSON.stringify(entries, null, 1)};\n`,
);
console.log(`เขียน ${entries.length} เส้น (ไปถึงคนจริง ${entries.filter((e) => e.reachesPeople).length}) → ${relative(ROOT, OUT)}`);
