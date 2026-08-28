import { describe, expect, it } from 'vitest';

import { ORIGIN_LABELS, backLabelFor, originFromReturnTo } from '@/lib/stageOrigin';

/**
 * 🔴 เจ้าของทัก 27 ส.ค. 2569: *"หน้ากล่องงาน พอกดแล้วทำไมไปหน้าใบงาน มันงงนะ"*
 *
 * เหตุ: หน้ารายละเอียดใบขอถูกจับเป็น "ขั้นที่ 1/6 ใบขอ" ตามกฎ prefix ของสายพาน
 * แต่คนกดมาจาก **กล่องงาน** ซึ่งไม่ใช่ขั้นไหนของสายพาน ⇒ อ่านเหมือนถูกดีดถอยไปอีกแผนก
 * เจ้าของเคาะ: *"ไปหน้าเดิม แต่เลิกหลอกว่าอยู่ขั้น 1"*
 *
 * เทสต์นี้คุมตัวตัดสินว่า "มาจากไหน" — พลาดที่นี่ = หัวจอกลับไปโกหกว่าอยู่ขั้น 1 อีก
 */
describe('originFromReturnTo', () => {
  it('มาจากกล่องงาน — ทั้งแบบมีและไม่มีคิวรีสตริง', () => {
    expect(originFromReturnTo('/jobs/board')).toBe('board');
    expect(originFromReturnTo('/jobs/board?lane=toRelease&step=publish')).toBe('board');
  });

  it('มาจากหน้าสมัครสาธารณะ', () => {
    expect(originFromReturnTo('/apply')).toBe('applyPublic');
    expect(originFromReturnTo('/apply?pos=ขับรถ')).toBe('applyPublic');
  });

  /** 🔴 หน้าที่อยู่บนสายพานจริง ต้องไม่ถูกจับ — แถบเลขขั้นต้องทำงานเหมือนเดิม */
  it('มาจากหน้าที่อยู่บนสายพาน = ไม่จับ (ปล่อยให้แถบเลขขั้นทำงาน)', () => {
    expect(originFromReturnTo('/jobs/list')).toBeNull();
    expect(originFromReturnTo('/matching/match')).toBeNull();
    expect(originFromReturnTo('/follow')).toBeNull();
  });

  it('ไม่มี returnTo = ไม่จับ', () => {
    expect(originFromReturnTo(null)).toBeNull();
    expect(originFromReturnTo(undefined)).toBeNull();
    expect(originFromReturnTo('   ')).toBeNull();
  });

  /** ⚠️ กันจับผิดด้วย prefix หลวม — `/jobs/boardroom` ไม่ใช่กล่องงาน */
  it('ห้ามจับ path ที่แค่ขึ้นต้นคล้ายกัน', () => {
    expect(originFromReturnTo('/jobs/boardroom')).toBeNull();
    expect(originFromReturnTo('/applyx')).toBeNull();
  });
});

describe('backLabelFor', () => {
  it('ได้คำที่มีชื่อหน้าต้นทาง ไม่ใช่ลูกศรเปล่า', () => {
    expect(backLabelFor('/jobs/board?lane=released')).toBe('กลับไปกล่องงาน');
    expect(backLabelFor('/apply')).toBe('กลับไปหน้าสมัครงาน');
  });

  it('ไม่รู้ว่ามาจากไหน = ไม่ใส่คำ (ปุ่มเป็นลูกศรเปล่าเหมือนเดิม)', () => {
    expect(backLabelFor('/jobs/list')).toBeUndefined();
    expect(backLabelFor(null)).toBeUndefined();
  });
});

describe('ป้ายหน้าต้นทาง', () => {
  it('ทุกหน้าต้นทางมีป้าย/path/คำอธิบาย ครบ ไม่ว่าง', () => {
    for (const [key, t] of Object.entries(ORIGIN_LABELS)) {
      expect(t.label.trim().length, `${key}.label`).toBeGreaterThan(0);
      expect(t.path.startsWith('/'), `${key}.path`).toBe(true);
      expect(t.blurb.trim().length, `${key}.blurb`).toBeGreaterThan(0);
    }
  });
});
