// @vitest-environment node
/**
 * ═══ "บันทึกใบขอแล้วหาย" — ด่านคุมสามช่องที่ทำให้เกิดจริง ═══
 *
 * เจ้าของแจ้ง 22 ก.ย. 2569: *"ใบขอเวลากรอก หรือ แก้ไขต่างๆมันไม่บันทึกอะ
 * บันทึกแล้วชอบหาย"* — เรื่องนี้เคยแก้มาแล้วสองรอบ (สำเนาลิสต์ · ใบขอชั่วคราว)
 * แต่ยังเกิด เพราะยังมีอีกสามช่องที่ไม่มีใครดู:
 *
 * 1. **คีย์ที่ใช้เขียนกับที่ใช้อ่านกลับเรียงสลับกัน** — ERP บางแถวเก็บ `request_no`
 *    เป็นเลขล้วน (`6907001`) แล้วเราเติม prefix ให้ตอนแสดงผล (`SQ6907001`)
 *    ⇒ เขียนด้วย `externalId` อ่านด้วย `request_no` ⇒ ลงฐานครบแต่จอไม่เห็น
 *    (หลักฐาน: ฐาน production มีทั้งสองคีย์ของใบเดียวกันอยู่จริง)
 * 2. **เส้นอ่านใบรายใบไม่ตั้ง `Cache-Control`** ทั้งฝั่ง server และ client
 *    ⇒ เบราว์เซอร์คืนคำตอบเก่าของตัวเองหลังบันทึก
 * 3. **ตัวแปะค่ากลืน error เงียบ** ⇒ PG อ่านไม่ได้ = ค่าหายจากจอโดยไม่มีใครรู้
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf-8');

const CLIENT = 'src/lib/siamrajUnitRequestsApi.ts';
const HANDLER = 'api/_handlers/siamraj-unit-requests.ts';

describe('① คีย์เขียนกับคีย์อ่านต้องเป็นตัวเดียวกัน', () => {
  it('🔴 ตัวเขียนต้องเอา request_no ก่อน externalId', () => {
    const src = read(CLIENT);
    const fn = src.slice(src.indexOf('export function unitRequestNoteKey'));
    const body = fn.slice(0, fn.indexOf('}') + 1);
    expect(body).toContain('job.request_no || job.externalId || job.id');
    // ของเดิมที่ทำให้พัง — ห้ามกลับไป
    expect(body).not.toContain('job.externalId || job.request_no');
  });

  it('🔴 ตัวอ่านกลับต้องลองทุกรูปคีย์ ไม่ใช่รูปเดียว (กู้ของเก่าที่เขียนไว้แล้ว)', () => {
    const src = read(HANDLER);
    expect(src).toContain('function readKeysOf');
    expect(src).toContain('function pickByKeys');
    // ทั้งสามตัวแปะต้องใช้ทางใหม่
    for (const fn of ['attachAssignments', 'attachNotes', 'attachWorkStatus']) {
      const at = src.indexOf(`export async function ${fn}`);
      expect(at, `${fn} ต้องมีอยู่`).toBeGreaterThan(-1);
      const block = src.slice(at, at + 1400);
      expect(block, `${fn} ต้องเรียก readKeysOf`).toContain('readKeysOf');
      expect(block, `${fn} ต้องเรียก pickByKeys`).toContain('pickByKeys');
      // ของเดิมที่จับคีย์รูปเดียว — ห้ามกลับมา
      expect(block, `${fn} ห้ามใช้ keyOf รูปเดียวอีก`).not.toContain(
        "String(it.request_no || it.externalId || it.id || '')",
      );
    }
  });
});

describe('② เส้นอ่านใบรายใบห้ามถูกแคชโดยเบราว์เซอร์', () => {
  it('🔴 ฝั่ง server ต้องตั้ง no-store ให้เส้น ?id=', () => {
    const src = read(HANDLER);
    const at = src.indexOf("const id = getQuery(req, 'id');");
    expect(at).toBeGreaterThan(-1);
    const block = src.slice(at, src.indexOf("if (getQuery(req, 'units') === '1')", at));
    expect(block).toContain("res.setHeader?.('Cache-Control', 'no-store");
  });

  it('🔴 ฝั่ง client ต้องส่ง cache: no-store', () => {
    const src = read(CLIENT);
    const at = src.indexOf('export async function fetchSiamrajUnitRequest(');
    expect(at).toBeGreaterThan(-1);
    const block = src.slice(at, at + 800);
    expect(block).toContain("cache: 'no-store'");
  });

  it('ทุกเส้นอ่านใบขอฝั่ง client ต้องมี no-store ครบ ไม่เว้นตัวใดตัวหนึ่ง', () => {
    const src = read(CLIENT);
    // ทุกจุดที่ยิงเส้นใบขอ — ตรวจ 400 ตัวอักษรถัดไปว่ามี no-store กำกับ
    const spots = [...src.matchAll(/apiFetch\([^\n]*\/api\/siamraj\/unit-requests/g)].map(
      (m) => m.index ?? 0,
    );
    expect(spots.length, 'ต้องเจอเส้นอ่านใบขออย่างน้อย 5 จุด').toBeGreaterThanOrEqual(5);
    for (const at of spots) {
      const block = src.slice(at, at + 400);
      const head = block.slice(0, 90).replace(/\s+/g, ' ');
      expect(block, `เส้นนี้ยังไม่มี no-store: ${head}`).toContain("cache: 'no-store'");
    }
  });
});

describe('③ ตัวแปะค่าห้ามกลืน error เงียบ', () => {
  it('🔴 catch ของทั้งสามตัวต้อง log ไม่ใช่เงียบ', () => {
    const src = read(HANDLER);
    for (const name of ['attachAssignments', 'attachNotes', 'attachWorkStatus']) {
      const at = src.indexOf(`export async function ${name}`);
      const block = src.slice(at, at + 4000);
      const catchAt = block.lastIndexOf('} catch');
      expect(catchAt, `${name} ต้องมี catch`).toBeGreaterThan(-1);
      const tail = block.slice(catchAt, catchAt + 500);
      expect(tail, `${name} ต้อง log เหตุที่ล้ม`).toContain('logWarn');
      expect(tail, `${name} ห้าม catch เปล่า`).not.toMatch(/\}\s*catch\s*\{\s*\/\*[^*]*\*\/\s*\}/);
    }
  });
});
