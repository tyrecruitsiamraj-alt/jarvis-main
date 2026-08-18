import { describe, it, expect } from 'vitest';
import { groupFollowEntries } from '../../src/lib/followGrouping';
import type { FollowEntry } from '../../src/lib/followApi';

/**
 * จัดกลุ่มลิสต์หน้า Follow เป็นการ์ดเดียวต่อคน (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ)
 * กลุ่ม = เบอร์ (เลข 9 ตัวท้าย) + เรื่อง — แพตเทิร์นเดียวกับ siblings ของกล่องแก้ไข
 */

const NOW = new Date('2026-08-18T10:00:00+07:00');

let seq = 0;
function entry(over: Partial<FollowEntry>): FollowEntry {
  seq += 1;
  return {
    id: `id-${seq}`,
    recipient_name: 'สมชาย ใจดี',
    recipient_phone: '0812345678',
    topic: 'ยืนยันวันเริ่มงาน',
    note: null,
    scheduled_at: '2026-08-18T09:00:00+07:00',
    created_by_name: 'staff-a',
    created_at: `2026-08-17T0${(seq % 9) + 1}:00:00+07:00`,
    cancelled: false,
    call_status: 'pending',
    call_outcome: null,
    call_summary: null,
    next_action: null,
    called_at: null,
    ...over,
  } as FollowEntry;
}

describe('groupFollowEntries', () => {
  it('เบอร์เดิม+เรื่องเดิม = การ์ดเดียว · เรื่องต่างแยกการ์ด (คนเดียวถูกตามหลายเรื่องได้)', () => {
    const groups = groupFollowEntries(
      [
        entry({}),
        entry({ scheduled_at: '2026-08-19T09:00:00+07:00' }),
        entry({ topic: 'ตามเอกสาร' }),
      ],
      NOW,
    );
    expect(groups).toHaveLength(2);
    const same = groups.find((g) => g.topic === 'ยืนยันวันเริ่มงาน');
    expect(same?.rounds).toHaveLength(2);
  });

  it('🔴 เบอร์ 08x กับ +668x คือคนเดียวกัน — เทียบเลข 9 ตัวท้าย', () => {
    const groups = groupFollowEntries(
      [entry({ recipient_phone: '0812345678' }), entry({ recipient_phone: '+66812345678' })],
      NOW,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].rounds).toHaveLength(2);
  });

  it('rounds เรียงตามเวลานัดโทร ไม่ใช่ลำดับที่ส่งเข้ามา', () => {
    const g = groupFollowEntries(
      [
        entry({ id: 'late', scheduled_at: '2026-08-20T09:00:00+07:00' }),
        entry({ id: 'early', scheduled_at: '2026-08-16T09:00:00+07:00' }),
      ],
      NOW,
    )[0];
    expect(g.rounds.map((r) => r.id)).toEqual(['early', 'late']);
  });

  it('nextRound = รอบ pending ที่เวลายังไม่ผ่าน ใกล้สุด — ข้ามรอบที่เลยมาแล้ว/ปิดแล้ว/ยกเลิก', () => {
    const g = groupFollowEntries(
      [
        entry({ id: 'past', scheduled_at: '2026-08-18T08:00:00+07:00' }),
        entry({ id: 'cancelled', scheduled_at: '2026-08-18T18:00:00+07:00', cancelled: true, call_status: 'cancelled' }),
        entry({ id: 'done', scheduled_at: '2026-08-18T17:00:00+07:00', completed_at: '2026-08-18T09:00:00+07:00' }),
        entry({ id: 'next', scheduled_at: '2026-08-18T19:00:00+07:00' }),
      ],
      NOW,
    )[0];
    expect(g.nextRound?.id).toBe('next');
  });

  it('ไม่มีนัดข้างหน้า = nextRound null (ไม่เอารอบที่เลยเวลามาหลอกว่ายังมีนัด)', () => {
    const g = groupFollowEntries([entry({ scheduled_at: '2026-08-18T08:00:00+07:00' })], NOW)[0];
    expect(g.nextRound).toBeNull();
  });

  it('todayOrdinal = วันนี้เป็นครั้งที่เท่าไหร่ นับเฉพาะรอบที่ไม่ถูกยกเลิก (เทียบวันแบบเวลาไทย)', () => {
    const g = groupFollowEntries(
      [
        entry({ scheduled_at: '2026-08-16T09:00:00+07:00' }),
        entry({ scheduled_at: '2026-08-17T09:00:00+07:00', cancelled: true, call_status: 'cancelled' }),
        entry({ scheduled_at: '2026-08-17T15:00:00+07:00' }),
        entry({ scheduled_at: '2026-08-18T09:00:00+07:00' }),
      ],
      NOW,
    )[0];
    // ไม่นับรอบยกเลิก: 16 ส.ค. = ครั้งที่ 1 · 17 ส.ค. = ครั้งที่ 2 · วันนี้ (18) = ครั้งที่ 3
    expect(g.todayOrdinal).toBe(3);
  });

  it('วันนี้ไม่มีรอบ = todayOrdinal null', () => {
    const g = groupFollowEntries([entry({ scheduled_at: '2026-08-20T09:00:00+07:00' })], NOW)[0];
    expect(g.todayOrdinal).toBeNull();
  });

  it('ชื่อ/หน่วยงานใช้ของรอบล่าสุด · เจ้าของข้อมูลใช้ของรอบแรกสุด', () => {
    const g = groupFollowEntries(
      [
        entry({
          recipient_name: 'สมชาย (สะกดเก่า)',
          created_at: '2026-08-15T09:00:00+07:00',
          created_by_name: 'คนคีย์คนแรก',
        }),
        entry({
          recipient_name: 'สมชาย ใจดี',
          created_at: '2026-08-17T09:00:00+07:00',
          created_by_name: 'คนแก้ทีหลัง',
          unit_name: 'ฮอนด้า',
          site_code: '67LBDL0208',
        }),
      ],
      NOW,
    )[0];
    expect(g.name).toBe('สมชาย ใจดี');
    expect(g.createdByName).toBe('คนคีย์คนแรก');
    expect(g.unitName).toBe('ฮอนด้า');
    expect(g.siteCode).toBe('67LBDL0208');
  });

  it('กลุ่มที่ลงล่าสุดขึ้นก่อน — ความรู้สึกเดียวกับลิสต์เดิม', () => {
    const groups = groupFollowEntries(
      [
        entry({ topic: 'เรื่องเก่า', created_at: '2026-08-10T09:00:00+07:00' }),
        entry({ topic: 'เรื่องใหม่', created_at: '2026-08-18T09:00:00+07:00' }),
      ],
      NOW,
    );
    expect(groups.map((g) => g.topic)).toEqual(['เรื่องใหม่', 'เรื่องเก่า']);
  });

  it('activeCount ไม่นับรอบที่ยกเลิก แต่ rounds ยังเก็บครบ (ต้องเห็นประวัติ)', () => {
    const g = groupFollowEntries(
      [entry({}), entry({ cancelled: true, call_status: 'cancelled' })],
      NOW,
    )[0];
    expect(g.activeCount).toBe(1);
    expect(g.rounds).toHaveLength(2);
  });
});
