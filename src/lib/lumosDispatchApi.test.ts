import { describe, it, expect } from 'vitest';
import {
  lumosCallBadge,
  canCancelLumosCall,
  indexLumosCallStatus,
  filterLumosPool,
  summarizeLumosCallStatus,
  boardPersonRef,
  irecruitPersonRef,
  type LumosCallStatus,
  type LumosPoolCandidate,
} from './lumosDispatchApi';

function row(over: Partial<LumosCallStatus> = {}): LumosCallStatus {
  return {
    channel: 'reminder',
    person_ref: 'card-1',
    status: 'pending',
    outcome: null,
    summary: null,
    delivery_count: 0,
    sent_at: '2026-08-03T01:00:00.000Z',
    updated_at: '2026-08-03T01:00:00.000Z',
    ...over,
  };
}

describe('lumosCallBadge', () => {
  it('ยังไม่มีผลกลับ → แสดงสถานะคิว', () => {
    expect(lumosCallBadge(row({ status: 'pending' })).label).toContain('รอ AI โทร');
    expect(lumosCallBadge(row({ status: 'delivered' })).label).toContain('AI รับไปโทรแล้ว');
  });

  it('ผลการโทรมาก่อนสถานะคิว — completed + confirmed ต้องอ่านว่า "สนใจงาน"', () => {
    const badge = lumosCallBadge(row({ status: 'completed', outcome: 'confirmed' }));
    expect(badge.label).toContain('สนใจงาน');
    expect(badge.tone).toBe('good');
  });

  it('แยก ปฏิเสธ / ไม่รับสาย / Lumos ยกเลิกสาย ออกจากกัน', () => {
    expect(lumosCallBadge(row({ status: 'completed', outcome: 'declined' })).tone).toBe('bad');
    expect(lumosCallBadge(row({ status: 'completed', outcome: 'no_answer' })).label).toContain('ไม่รับสาย');
    expect(lumosCallBadge(row({ status: 'cancelled', outcome: 'cancelled' })).tone).toBe('off');
  });

  it('outcome ที่ไม่รู้จักยังแสดงได้ ไม่ตกเป็นช่องว่าง', () => {
    expect(lumosCallBadge(row({ outcome: 'weird_state' })).label).toContain('weird_state');
  });
});

describe('canCancelLumosCall', () => {
  it('ยกเลิกได้เฉพาะที่ Lumos ยังไม่ส่งผลกลับ', () => {
    expect(canCancelLumosCall(row({ status: 'pending' }))).toBe(true);
    expect(canCancelLumosCall(row({ status: 'delivered' }))).toBe(true);
    expect(canCancelLumosCall(row({ status: 'delivered', outcome: 'confirmed' }))).toBe(false);
    expect(canCancelLumosCall(row({ status: 'completed', outcome: 'declined' }))).toBe(false);
    expect(canCancelLumosCall(row({ status: 'cancelled' }))).toBe(false);
  });
});

describe('indexLumosCallStatus', () => {
  it('คีย์ตาม person_ref และเก็บแถวที่อัปเดตล่าสุดเมื่อมีซ้ำ', () => {
    const map = indexLumosCallStatus([
      row({ person_ref: 'card-1', status: 'pending', updated_at: '2026-08-01T00:00:00.000Z' }),
      row({ person_ref: 'card-1', status: 'completed', outcome: 'confirmed', updated_at: '2026-08-02T00:00:00.000Z' }),
      row({ person_ref: 'ir-9', channel: 'interview' }),
    ]);
    expect(map['card-1'].status).toBe('completed');
    expect(map['ir-9'].channel).toBe('interview');
  });
});

describe('filterLumosPool', () => {
  const pool: LumosPoolCandidate[] = [
    { card_id: 1, full_name: 'สมชาย ใจดี', skills: 'ขับรถ / รถผู้บริหาร', area: 'บางนา กรุงเทพมหานคร', mobile: '0812345678', age: 40, required_salary: 15000, last_activity_at: null, already_sent: false },
    { card_id: 2, full_name: 'สมหญิง รักงาน', skills: 'ธุรการ', area: 'เมืองสมุทรปราการ สมุทรปราการ', mobile: null, age: 30, required_salary: null, last_activity_at: null, already_sent: true },
  ];

  it('ไม่มีคำค้น = คืนทั้ง pool', () => {
    expect(filterLumosPool(pool, '   ')).toHaveLength(2);
  });

  it('ค้นได้จากชื่อ สกิล พื้นที่ และเบอร์', () => {
    expect(filterLumosPool(pool, 'สมชาย').map((c) => c.card_id)).toEqual([1]);
    expect(filterLumosPool(pool, 'ธุรการ').map((c) => c.card_id)).toEqual([2]);
    expect(filterLumosPool(pool, 'สมุทรปราการ').map((c) => c.card_id)).toEqual([2]);
    expect(filterLumosPool(pool, '0812345678').map((c) => c.card_id)).toEqual([1]);
  });

  it('หลายคำต้องเจอครบทุกคำ', () => {
    expect(filterLumosPool(pool, 'ขับรถ บางนา').map((c) => c.card_id)).toEqual([1]);
    expect(filterLumosPool(pool, 'ขับรถ สมุทรปราการ')).toHaveLength(0);
  });
});

describe('summarizeLumosCallStatus — เลขสรุปข้างการ์ดใบขอ', () => {
  it('นับ ส่ง/โทรแล้ว/สนใจ/ไม่สนใจ/ไม่รับสาย ตามนิยามเดียวกับฝั่ง server', () => {
    const s = summarizeLumosCallStatus([
      row({ person_ref: 'card-1', status: 'pending' }), // ส่งแล้ว ยังไม่โทร
      row({ person_ref: 'card-2', status: 'delivered' }), // Lumos รับไปแล้ว
      row({ person_ref: 'card-3', status: 'completed', outcome: 'confirmed' }),
      row({ person_ref: 'card-4', status: 'completed', outcome: 'declined' }),
      row({ person_ref: 'card-5', status: 'completed', outcome: 'no_answer' }),
      row({ person_ref: 'card-6', status: 'completed', outcome: 'unresponsive' }),
      row({ person_ref: 'card-7', status: 'completed', outcome: 'acknowledged' }), // โทรแล้ว แต่ไม่เข้าช่องสนใจ/ไม่สนใจ
      // Lumos ยกเลิกสายเอง — นับเป็น "ส่ง" แต่ไม่นับ "โทรแล้ว"
      row({ person_ref: 'card-8', status: 'completed', outcome: 'cancelled' }),
      // เรายกเลิกก่อนส่ง — ไม่นับอะไรเลย
      row({ person_ref: 'card-9', status: 'cancelled' }),
      // ขอให้โทรกลับ — นับเป็นโทรแล้ว และมีช่องของตัวเอง
      row({ person_ref: 'card-10', status: 'completed', outcome: 'reschedule_requested' }),
    ]);
    expect(s).toEqual({
      pendingApproval: 0,
      sent: 9,
      called: 6,
      confirmed: 1,
      declined: 1,
      no_answer: 2,
      reschedule: 1,
      needsHuman: 0,
    });
  });

  it('ใบที่ไม่เคยส่งเลย → ทุกช่องเป็น 0', () => {
    expect(summarizeLumosCallStatus([])).toEqual({
      pendingApproval: 0,
      sent: 0,
      called: 0,
      confirmed: 0,
      declined: 0,
      no_answer: 0,
      reschedule: 0,
      needsHuman: 0,
    });
  });

  it('รออนุมัติ/ต้องคนตาม คิดจากสถานะรายคนไม่ได้ — ต้องเป็น 0 เสมอ ไม่ใช่เดาเอา', () => {
    // สองช่องนี้อยู่คนละตาราง (ชุดส่ง) และคนละคอลัมน์ (followup_state)
    // endpoint รายคนไม่ได้ส่งมา ถ้าวันไหนมีคนไปเดาค่าจากตรงนี้ ตัวเลขบนการ์ดจะขัดกับของจริง
    const s = summarizeLumosCallStatus([
      row({ person_ref: 'card-1', status: 'completed', outcome: 'no_answer' }),
    ]);
    expect(s.pendingApproval).toBe(0);
    expect(s.needsHuman).toBe(0);
  });
});

describe('person ref', () => {
  it('ตรงกับรูปแบบที่ฝั่ง server ใช้เป็น unique key ในคิว', () => {
    expect(boardPersonRef(42)).toBe('card-42');
    expect(irecruitPersonRef(7)).toBe('ir-7');
  });
});
