// @vitest-environment node
/**
 * ═══ 🔴 ด่าน "ข้อมูลต้องครบ" ของหน้าแรกโฉมใหม่ ═══
 *
 * เจ้าของย้ำ 5 ก.ย. 2569: *"ฉันไม่ได้อนุญาตให้เอาข้อมูลออกนะ อนุญาตแค่ปรับ style"*
 * และ *"ฉัน Production แล้วนะ ... ถ้าข้อมูลไม่ครบก็ตายกันพอดี"*
 *
 * ด่านนี้เทียบว่า `HomeDeckV2` (โฉมใหม่) แสดง **ข้อมูลชุดเดียวกับ `CommandDeck`** (ของเดิม)
 * ครบทุกชิ้น · เป็นการเทียบระดับ "ชิ้นข้อมูลถูกอ้างถึงไหม" ไม่ใช่เทียบหน้าตา
 * (หน้าตาต่างกันคือความตั้งใจ — ที่ห้ามต่างคือข้อมูล)
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
const v2 = read('src/components/home/HomeDeckV2.tsx');
const v1 = read('src/pages/HomePage.tsx');

describe('หน้าแรกโฉมใหม่ต้องมีข้อมูลครบเท่าของเดิม', () => {
  /** ทุกชิ้นที่ deck เดิมแสดง — ถ้าลบชิ้นไหนออกจากโฉมใหม่ เทสต์ต้องแดง */
  const MUST_SHOW: Array<[string, RegExp]> = [
    ['คำทักทาย', /\{greeting\}/],
    ['ชื่อผู้ใช้', /userName/],
    ['จำนวนเรื่องที่ต้องลงมือ', /tasks\.length/],
    ['บรรทัดสถานะ', /status\.text/],
    ['หัวข้องานถัดไป', /head\.title/],
    ['เหตุผลของงาน', /head\.reason/],
    ['ป้ายสถานะของงาน', /head\.badge/],
    ['ปุ่มไปทำงาน', /head\.action/],
    ['ปลายทางของปุ่ม', /head\.path/],
    ['จำนวนที่รอต่อคิว', /\+\{rest\.length\} เรื่องรอต่อคิว/],
    ['ข้อความตอนไม่มีงานค้าง', /ไม่มีงานค้างที่ต้องลงมือตอนนี้/],
    ['บรรทัดบอกว่างานอยู่หน้าไหน', /งานข้างบนอยู่ที่หน้า/],
    ['ชื่อหน้าของงาน', /\{headLabel\}/],
    ['แผนที่สายพาน', /CONVEYOR_STEPS\.map/],
    ['หัวข้อคิววันนี้', /คิวของคุณวันนี้/],
    ['จำนวนคิวที่เหลือ', /เหลือ \{rest\.length\}/],
    ['ชื่อเรื่องในคิว', /\{t\.title\}/],
    ['เหตุผลในคิว', /\{t\.reason\}/],
    ['ป้ายสถานะในคิว', /\{t\.badge\}/],
    ['ปลายทางของแถวคิว', /to=\{t\.path\}/],
    ['วันที่', /DATE_FMT\.format/],
    ['นาฬิกา', /CLOCK_FMT\.format/],
  ];

  for (const [label, re] of MUST_SHOW) {
    it(`แสดง ${label}`, () => {
      expect(re.test(v2), `หายไปจาก HomeDeckV2: ${label}`).toBe(true);
    });
  }

  it('🔴 ป้อนข้อมูลชุดเดียวกันให้ทั้งสองโฉม (props ตรงกันทุกตัว)', () => {
    // ทั้งสอง branch ในหน้า HomePage ต้องรับ props ชุดเดียวกัน
    for (const prop of ['greeting=', 'userName=', 'tasks={nextTasks}', 'statusInput=']) {
      const hits = v1.split(prop).length - 1;
      expect(hits, prop).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('สวิตช์โฉมใหม่ต้องปลอดภัยกับ production', () => {
  const flag = read('src/lib/uiV2.ts');

  it('🔴 ค่าตั้งต้นคือ "ปิด" — คนที่ไม่เคยกดสวิตช์เห็นของเดิม', () => {
    // ไม่มีที่ไหนตั้งค่าเริ่มต้นเป็นเปิด
    expect(flag).toMatch(/return false;/);
    expect(flag).not.toMatch(/return true;\s*\/\/ default/);
  });

  it('เปิด/ปิดได้จาก URL และจำไว้ในเครื่องคนที่กดเท่านั้น', () => {
    expect(flag).toContain("get('ui')");
    expect(flag).toContain('localStorage');
  });

  it('ของเดิมยังอยู่เป็นทางถอย — HomePage ยังเรียก CommandDeck', () => {
    expect(v1).toContain('<CommandDeck');
    expect(v1).toContain('<HomeDeckV2');
  });
});
