// @vitest-environment node
/**
 * 🔴 ทุกคิวรีที่ใช้ชุดคอลัมน์ `{{cols}}` ต้องตั้ง alias `a` ให้ตาราง
 *
 * ที่มา (เจอจริง 16 ส.ค. 2569): เพิ่มคอลัมน์ derived `origin` ที่อ้าง `a.job_id`
 * เข้า LIST_COLUMNS แล้วลืมว่าคิวรีอื่นที่ใช้ชุดเดียวกันไม่ได้ตั้ง alias
 * → `missing FROM-clause entry for table "a"` แล้ว **ทั้ง endpoint ตาย 500**
 * ไม่ใช่แค่คอลัมน์นั้นหาย · claim / คืน / แก้เบอร์ / เก็บ Lead / เปลี่ยนสถานะ พังพร้อมกันหมด
 *
 * เทสต์นี้อ่านซอร์สตรง ๆ เพราะบั๊กอยู่ที่ "ข้อความ SQL" ไม่ใช่ตรรกะ TS
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const src = fs.readFileSync(
  path.join(import.meta.dirname, '../../api/_handlers/job-applications.ts'),
  'utf8',
);

/** ทุกบรรทัดที่มี {{cols}} พร้อมบริบทรอบ ๆ ที่พอจะเห็น FROM/UPDATE */
function statementsUsingCols(): string[] {
  const out: string[] = [];
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    if (!line.includes('{{cols}}')) return;
    // ดูย้อนขึ้น 6 บรรทัดและลง 4 — พอครอบ from/update/where ของ statement นั้น
    out.push(lines.slice(Math.max(0, i - 6), i + 5).join('\n'));
  });
  return out;
}

describe('ชุดคอลัมน์ {{cols}} ต้องมี alias a เสมอ', () => {
  const statements = statementsUsingCols();

  it('มีคิวรีที่ใช้ {{cols}} อยู่จริง (กันเทสต์ผ่านเพราะหาไม่เจอ)', () => {
    expect(statements.length).toBeGreaterThanOrEqual(5);
  });

  it('ทุก SELECT ที่ใช้ {{cols}} ตั้ง alias a ให้ตาราง', () => {
    for (const st of statements) {
      if (!/select \{\{cols\}\}/.test(st)) continue;
      expect(st, `SELECT นี้ลืม alias:\n${st}`).toMatch(/from \$\{tbl\} a\b/);
    }
  });

  it('ทุก UPDATE ... RETURNING {{cols}} ตั้ง alias a ให้ตาราง', () => {
    for (const st of statements) {
      if (!/returning \{\{cols\}\}/.test(st)) continue;
      expect(st, `UPDATE นี้ลืม alias:\n${st}`).toMatch(/update \$\{tbl\} a\b/);
    }
  });

  it('คอลัมน์ derived ในชุดยังอ้าง alias a อยู่ (ถ้าเลิกอ้างแล้ว เทสต์นี้หมดหน้าที่)', () => {
    expect(src).toContain("applicationOriginColumn('a')");
  });
});
