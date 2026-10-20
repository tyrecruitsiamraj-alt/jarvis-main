import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseFollowInput } from '../../api/_handlers/follow';

/**
 * ฟอร์มเพิ่มคนติดตาม 4 ขั้น (เจ้าของสั่ง 14 ต.ค. 2569 · 145)
 * ขั้น 1 วันที่เริ่มงาน (เก็บไว้ดู) · ขั้น 4 ประกัน + ผู้ติดต่อลูกค้า
 * 🔴 16 ต.ค. 2569 เจ้าของ "ไม่เอาดึงจากเงื่อนไซด์แล้ว" — ประกัน = dropdown (149) · ลูกค้าพิมพ์เอง · ถอดเส้นดึงจาก ERP
 */
const NOW = new Date('2026-10-14T10:00:00+07:00');
const base = { recipient_name: 'ทดสอบ ระบบ', recipient_phone: '0800000000', topic: 'ตามเริ่มงาน' };

describe('parseFollowInput — วันเริ่มงาน + ประกัน/ลูกค้า', () => {
  it('ไม่ส่งช่องใหม่เลย = extra ว่าง (ของเดิมไม่เปลี่ยน)', () => {
    const r = parseFollowInput(base, NOW);
    expect(r.error).toBeNull();
    expect(r.value!.extra).toBeUndefined();
  });

  it('ส่งครบ = เก็บครบ · ตัดความยาวตามเพดาน', () => {
    const r = parseFollowInput(
      {
        ...base,
        start_date: '2026-10-20',
        insurance_type: 'P/A · งบ 300 บาท/คน/ปี',
        customer_name: 'บริษัท ทดสอบ',
        customer_contact: 'ฝ่ายบุคคล',
        customer_phone: '020000000',
      },
      NOW,
    );
    expect(r.error).toBeNull();
    expect(r.value!.extra).toEqual({
      startDate: '2026-10-20',
      insuranceType: 'P/A · งบ 300 บาท/คน/ปี',
      customerName: 'บริษัท ทดสอบ',
      customerContact: 'ฝ่ายบุคคล',
      customerPhone: '020000000',
    });
    // 1500 (16 ต.ค. 2569) — บรรทัดประกันแบบใบขอ + ความคุ้มครอง P/A ยาวเกิน 300
    const long = parseFollowInput({ ...base, insurance_type: 'ก'.repeat(2000) }, NOW);
    expect(long.value!.extra!.insuranceType).toHaveLength(1500);
  });

  it('วันเริ่มงานรูปผิด = ไม่ผ่าน (กันปี/รูปแบบมั่วเข้าฐาน)', () => {
    expect(parseFollowInput({ ...base, start_date: '20/10/2569' }, NOW).error).toBeTruthy();
  });
});

describe('ต่อสายครบ', () => {
  const read = (p: string) => readFileSync(p, 'utf8');
  it('เส้นประเภทประกันลงทะเบียนแล้ว · เส้นดึงจาก ERP (/api/follow-unit-info) ถอดออกทั้งเส้น', () => {
    const registry = read('api/_handlers/registry.ts');
    expect(registry).toContain("'/api/follow-insurance-types'");
    expect(registry).not.toContain("'/api/follow-unit-info'");
    expect(read('src/pages/follow/FollowPage.tsx')).not.toContain('fetchFollowUnitInfo');
  });
  it('ทุกเส้นบันทึกของฟอร์มส่งช่องใหม่ (ทั่วไป · ตารางหลายวัน · ส่งคนแทน · แก้ไขทั้งชุด · แก้ไขส่งคนแทน 20 ต.ค. 2569)', () => {
    const page = read('src/pages/follow/FollowPage.tsx');
    expect(page.match(/\.\.\.extraPayload\(\)/g)?.length).toBe(5);
    // ปุ่มบันทึก/ด่านคลิกซ้อนผูกกับขั้นสุดท้าย ไม่ใช่เลข 3 ตายตัว
    expect(page).toContain('step !== FOLLOW_WIZARD_LAST_STEP');
    expect(page).not.toMatch(/step !== 3\)/);
  });
});

describe('ปรับคำ 15 ต.ค. 2569', () => {
  const read = (p: string) => readFileSync(p, 'utf8');
  it('วันที่เริ่มงานไม่มีตัวย่อวัน ("16 ต.ค. 2569") · ช่องวันที่อื่นยังมี', () => {
    const page = read('src/pages/follow/FollowPage.tsx');
    expect(page).toMatch(/value=\{startDate\}[^>]*withWeekday=\{false\}/);
    expect(read('src/components/shared/DateSelectDmyBe.tsx')).toContain('withWeekday = true');
  });
  it('ชื่อเจ้าหน้าที่แยกตามแท็บ: คนเริ่มงาน = คัดสรร · ส่งคนแทน = ทีมรายวัน · ไม่มีคำ "เจ้าหน้าที่ส่งคนแทน" บนจอ', () => {
    const field = read('src/components/follow/StaffContactField.tsx');
    expect(field).toContain("replacement: 'ทีมรายวัน'");
    expect(field).not.toMatch(/group: 'เจ้าหน้าที่ส่งคนแทน'/);
    const page = read('src/pages/follow/FollowPage.tsx');
    expect(page).toMatch(/id="followStaffPhoneReplace"\s+group="replacement"/);
    expect(page.match(/group="screener"/g)?.length).toBe(3);
    expect(read('src/components/follow/FollowEditDialog.tsx')).toContain("entry?.follow_team === 'replacement' ? 'replacement' : 'screener'");
  });
});
