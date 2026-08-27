// @vitest-environment node
/**
 * บทพูด AI แก้ได้จากหน้าตั้งค่า (เจ้าของสั่ง 27 ส.ค. 2569)
 *
 * ด่านที่ห้ามหลุด:
 * 1. ไม่มีฉบับแก้ = บทมาตรฐานเดิมเป๊ะ (เทสต์บทเดิมทั้งชุดต้องไม่รู้สึกอะไร)
 * 2. วางฉบับแก้แล้ว บทที่ประกอบออกมาเปลี่ยนจริง · ล้างแล้วกลับเป็นเดิม
 * 3. validate กันของเสีย: เกินเพดาน · ตัวเลขเงิน · ตัวแปรที่ไม่รู้จัก
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  EDITABLE_SCRIPT_DEFAULTS,
  MAX_QUESTIONS,
  buildFollowMessage,
  buildScreeningQuestions,
  setCallScriptOverrides,
} from '../../api/_lib/lumosCallScript.js';
import { validateScriptLines } from '../../api/_lib/callScriptStore.js';

const FACTS = {
  candidateName: 'สมชาย',
  position: 'พนักงานขับรถ',
  unitName: 'บริษัททดสอบ',
} as const;

afterEach(() => setCallScriptOverrides({}));

describe('ฉบับแก้ทับบทมาตรฐาน', () => {
  it('ไม่มีฉบับแก้ = ใช้บทในไฟล์เป๊ะ', () => {
    const q = buildScreeningQuestions(FACTS);
    expect(q[0]).toContain('สยามราชธานี');
  });

  it('วางฉบับแก้แล้ว บทเปลี่ยนทันที · ล้างแล้วกลับเป็นเดิม', () => {
    setCallScriptOverrides({ interview: ['สวัสดีครับ {ชื่อผู้รับ}นี่คือบททดสอบครับ'] });
    expect(buildScreeningQuestions(FACTS)).toEqual(['สวัสดีครับ คุณสมชาย นี่คือบททดสอบครับ']);

    setCallScriptOverrides({});
    expect(buildScreeningQuestions(FACTS)[0]).toContain('สยามราชธานี');
  });

  it('ฉบับแก้ของบทหนึ่ง ไม่กระทบบทอื่น', () => {
    setCallScriptOverrides({ interview: ['บททดสอบครับ'] });
    const msg = buildFollowMessage({
      recipientName: 'สมหญิง',
      topic: 'ยืนยันวันเริ่มงาน',
      note: null,
      staffPhone: null,
    });
    expect(msg).toContain('สยามราชธานี'); // บท follow ยังเป็นมาตรฐาน
  });

  it('ฉบับแก้ที่เป็นลิสต์ว่าง = ไม่ทับ (กันพลาดวางค่าว่างแล้วสายเงียบ)', () => {
    setCallScriptOverrides({ interview: [] });
    expect(buildScreeningQuestions(FACTS)[0]).toContain('สยามราชธานี');
  });

  it('บทมาตรฐานที่ export ไปให้หน้าตั้งค่า ตรงกับที่ระบบใช้จริง', () => {
    expect(EDITABLE_SCRIPT_DEFAULTS.interview.length).toBeGreaterThan(3);
    expect(EDITABLE_SCRIPT_DEFAULTS.offer.length).toBeGreaterThan(3);
    expect(EDITABLE_SCRIPT_DEFAULTS.follow.length).toBeGreaterThan(2);
  });
});

describe('validateScriptLines — กันของเสียก่อนถึง AI', () => {
  it('บทปกติผ่าน', () => {
    expect(validateScriptLines(['สวัสดีครับ {ชื่อผู้รับ}สนใจงานไหมครับ'])).toBeNull();
  });

  it('ว่าง/ไม่ใช่ลิสต์ = ไม่ผ่าน', () => {
    expect(validateScriptLines([])).toBeTruthy();
    expect(validateScriptLines('สวัสดี')).toBeTruthy();
    expect(validateScriptLines([''])).toBeTruthy();
  });

  it(`เกินเพดาน ${MAX_QUESTIONS} ข้อ = ไม่ผ่าน (Lumos ตัดข้อท้ายทิ้งเงียบ ๆ)`, () => {
    const lines = Array.from({ length: MAX_QUESTIONS + 1 }, (_, i) => `ข้อ ${i + 1} ครับ`);
    expect(validateScriptLines(lines)).toContain('ยาวเกิน');
  });

  it('🔴 ตัวเลขเงินในบท = ไม่ผ่าน — ค่าแรงมีทั้งรายวัน/รายเดือน ระบบต้องเป็นคนเติม', () => {
    expect(validateScriptLines(['งานนี้รายได้ 15,000 บาทครับ'])).toContain('ตัวเลขเงิน');
    // ใช้ตัวแปรแทน = ผ่าน
    expect(validateScriptLines(['รายได้ประมาณ {รายได้ต่อเดือน} บาทต่อเดือนครับ'])).toBeNull();
  });

  it('🔴 ตัวแปรที่ระบบไม่รู้จัก = ไม่ผ่าน — ทั้งบรรทัดจะหายตอนโทรจริง', () => {
    const err = validateScriptLines(['สวัสดีครับ {ชื่อคนรับสาย}ครับ']);
    expect(err).toContain('ไม่รู้จัก');
  });
});
