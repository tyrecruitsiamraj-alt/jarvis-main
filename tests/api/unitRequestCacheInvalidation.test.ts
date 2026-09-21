// @vitest-environment node
/**
 * ═══ บันทึกแล้วต้องเห็นทันที — ห้ามติดสำเนาเก่า (21 ก.ย. 2569) ═══
 *
 * เจ้าของแจ้งจากผู้ใช้จริง (หัวหน้า): *"บันทึกได้ แต่กลับออกมาข้อมูลมันหาย หมายเหตุก็เป็น"*
 *
 * ต้นเหตุที่วัดได้: `/api/siamraj/unit-requests` เก็บสำเนา **หลังแปะผู้รับผิดชอบ/หมายเหตุ
 * ลงไปแล้ว** (อายุ 90 วินาที · ตอบของเก่าระหว่างโหลดใหม่ได้ถึง 10 นาที) ⇒ บันทึกลงฐานจริง
 * แต่หน้าลิสต์ยังอ่านสำเนาเดิมที่ยังไม่มีค่าใหม่ คนใช้จึงเห็นว่า "ข้อมูลหาย"
 *
 * 🔴 ด่านที่ห้ามหลุด: **ทุกเส้นที่เขียนของซึ่งถูกแปะลงลิสต์ ต้องล้างสำเนา**
 * (ผู้รับผิดชอบ · หมายเหตุ/ตัวเลือกใบขอ · สถานะทำงาน · ราชการ/เอกชน)
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

/** เส้นเขียน → สิ่งที่มันแก้แล้วไปโผล่บนลิสต์ */
const WRITERS: Array<[string, string]> = [
  ['api/_handlers/siamraj-unit-assignments.ts', 'ผู้รับผิดชอบ'],
  ['api/_handlers/siamraj-unit-notes.ts', 'หมายเหตุ/ตัวเลือกใบขอ'],
  ['api/_handlers/siamraj-unit-work-status.ts', 'สถานะทำงาน'],
  ['api/_handlers/unit-sector.ts', 'ราชการ/เอกชน'],
];

describe('เส้นเขียนต้องล้างสำเนาลิสต์', () => {
  for (const [file, what] of WRITERS) {
    it(`${what} (${file.split('/').pop()})`, () => {
      const src = read(file);
      expect(src).toContain("from '../_lib/unitRequestCache.js'");
      expect(src).toMatch(/clearUnitRequestCache\(\);/);
    });
  }

  it('🔴 สำเนาลิสต์เก็บของที่แปะแล้วจริง — ถ้าเลิกแปะในนี้ เทสต์ชุดนี้ไม่จำเป็นอีก', () => {
    const src = read('api/_handlers/siamraj-unit-requests.ts');
    // เอาจุดที่ "เรียกใช้" ไม่ใช่บรรทัด import ด้านบนไฟล์
    const at = src.indexOf('return readThroughCache(');
    expect(at).toBeGreaterThan(0);
    const cacheBlock = src.slice(at, at + 900);
    expect(cacheBlock).toContain('attachAssignments');
    expect(cacheBlock).toContain('attachNotes');
  });
});
