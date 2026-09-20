// @vitest-environment node
/**
 * ═══ ช่องวันที่/เวลาของเบราว์เซอร์ = หน้าจอคนละแบบต่อคน (20 ก.ย. 2569) ═══
 *
 * เจ้าของทัก: *"หน้าการติดตาม บางคนยังขึ้น am pm อยู่เลย"*
 *
 * `<input type="time">` กับ `<input type="date">` **แสดงผลตามภาษาของเครื่องคนใช้**
 * ไม่ใช่ของหน้าเว็บ · เครื่องที่ตั้งเป็นอังกฤษ (สหรัฐ) เห็น `05:50 AM` และ `09/18/2026`
 * เครื่องไทยเห็น `05:50` และ `18/09/2026` — ข้อมูลชุดเดียวกันแต่คนละหน้าจอ
 * และสั่งด้วย `lang` ของหน้าไม่ได้ (ลองกับ Chrome แล้ว มันไม่สน)
 *
 * 🔴 เวลา: ใช้ `TimeSelect24` เท่านั้น (24 ชม. + "น." เหมือนกันทุกเครื่อง)
 * 🟡 วันที่: ยังเหลืออยู่ตามรายการข้างล่าง — เพิ่มใหม่ไม่ได้ ต้องใช้ `DayCalendarPicker`
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = new URL('../../src/', import.meta.url).pathname;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

/** ไฟล์ที่ยังใช้ `type="date"` / `type="datetime-local"` อยู่ — **ห้ามเพิ่มชื่อใหม่** */
const DATE_INPUT_DEBT = [
  'src/components/matching/CallHoldPanel.tsx',
  'src/components/recruit-rm/ApplicantContactDialog.tsx',
  'src/pages/aftercare/AftercarePage.tsx',
  'src/pages/follow/FollowPage.tsx',
  'src/pages/matching/MyCallsPage.tsx',
];

const files = walk(SRC);
const rel = (f: string) => `src/${f.slice(SRC.length)}`;

/**
 * อ่านไฟล์แบบ **ตัดคอมเมนต์ทิ้งก่อน** — คอมเมนต์ที่อธิบายว่า "ห้ามใช้ type=time"
 * มีคำนั้นอยู่ข้างใน ถ้าไม่ตัดจะจับตัวเองแล้วแดงทั้งที่โค้ดถูก
 * (บทเรียนเดียวกับ `typographyRules.test.ts`)
 */
const codeOf = (f: string) =>
  readFileSync(f, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('ช่องวันที่/เวลาต้องไม่ขึ้นกับภาษาของเครื่องคนใช้', () => {
  it('🔴 ห้ามมี <input type="time"> ที่ไหนอีก — ใช้ TimeSelect24 แทน', () => {
    const found = files.filter((f) => /type="time"/.test(codeOf(f))).map(rel);
    expect(found).toEqual([]);
  });

  it('🔴 หน้าติดตามต้องไม่เหลือ <input type="datetime-local"> — ใช้ DateTimeField24 แทน', () => {
    const found = files
      .filter((f) => /type="datetime-local"/.test(codeOf(f)))
      .map(rel)
      .sort();
    // เหลือได้เฉพาะหน้าโทรของฉัน (นอกขอบเขตที่เจ้าของสั่ง 20 ก.ย.) — เพิ่มที่ใหม่ไม่ได้
    expect(found).toEqual(['src/components/matching/CallHoldPanel.tsx']);
  });

  it('🟡 <input type="date"> มีได้เฉพาะไฟล์เดิมที่ค้างอยู่ — ที่ใหม่ต้องใช้ DayCalendarPicker', () => {
    const found = files
      .filter((f) => /type="date"/.test(codeOf(f)))
      .map(rel)
      .sort();
    expect(found).toEqual(DATE_INPUT_DEBT);
  });
});
