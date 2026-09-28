import { describe, expect, it } from 'vitest';
import { LUMOS_SENT_ROUTES, LUMOS_SENT_STATES, lumosSentBuOptions, summarizeLumosSent } from './lumosSentSummary';
import type { LumosSentRow } from './officeTeam';

const row = (over: Partial<LumosSentRow>): LumosSentRow => ({
  day: '2026-09-28',
  bu: 'LBD',
  route: 'public',
  state: 'done',
  n: 1,
  ...over,
});

const ROWS: LumosSentRow[] = [
  row({ day: '2026-09-28', n: 5, state: 'pending' }), // วันนี้
  row({ day: '2026-09-28', bu: 'LML', route: 'follow', n: 2, state: 'waiting' }), // วันนี้
  row({ day: '2026-09-10', route: 'match', n: 30 }), // เดือนนี้
  row({ day: '2026-09-01', bu: null, route: 'match', n: 4, state: 'cancelled' }), // เดือนนี้ · ไม่รู้ BU
  row({ day: '2026-08-31', n: 100 }), // เดือนก่อน
  row({ day: '2026-07-15', bu: 'LBA', route: 'other', n: 7, state: 'other' }),
];

const sum = (r: Record<string, number>) => Object.values(r).reduce((s, v) => s + v, 0);

describe('ส่งให้ Lumos ทั้งระบบ — วันนี้ · เดือนนี้ · ทั้งหมด (นับสาย)', () => {
  const s = summarizeLumosSent(ROWS, { today: '2026-09-28', bu: null, range: null });

  it('วันนี้/เดือนนี้/ทั้งหมด ตามวันที่ส่งเข้าคิว', () => {
    expect(s.today).toBe(7);
    expect(s.month).toBe(41);
    expect(s.all).toBe(148);
    expect(s.range).toBeNull();
    expect(s.unknownBu).toBeNull();
  });

  it('🔴 แจกสถานะ/เส้นทาง บวกกันได้ยอดทั้งหมดเป๊ะ (รวมยกเลิก · สถานะอื่นไม่หาย)', () => {
    expect(sum(s.states)).toBe(s.all);
    expect(sum(s.routes)).toBe(s.all);
    expect(s.states).toEqual({ pending: 5, waiting: 2, done: 130, cancelled: 4, other: 7 });
    expect(s.routes).toEqual({ public: 105, match: 34, follow: 2, other: 7 });
    expect(new Set(Object.keys(s.states))).toEqual(new Set(LUMOS_SENT_STATES));
    expect(new Set(Object.keys(s.routes))).toEqual(new Set(LUMOS_SENT_ROUTES));
  });
});

describe('เลือกช่วงได้', () => {
  it('ยอดช่วง + แจกสถานะของช่วงนั้น (วันนี้/เดือนนี้/ทั้งหมดไม่เปลี่ยน)', () => {
    const s = summarizeLumosSent(ROWS, { today: '2026-09-28', bu: null, range: { from: '2026-08-31', to: '2026-09-10' } });
    expect(s.range).toBe(134); // 31 ส.ค. 100 + 1 ก.ย. 4 (ยกเลิก) + 10 ก.ย. 30
    expect(sum(s.states)).toBe(134);
    expect(sum(s.routes)).toBe(134);
    expect(s.today).toBe(7);
    expect(s.all).toBe(148);
  });
});

describe('แยก BU ได้', () => {
  it('กรอง BU แล้วทุกตัวเลขเหลือเฉพาะ BU นั้น · สายที่ไม่รู้ BU บอกจำนวน', () => {
    const s = summarizeLumosSent(ROWS, { today: '2026-09-28', bu: 'LBD', range: null });
    expect(s.today).toBe(5);
    expect(s.month).toBe(35);
    expect(s.all).toBe(135);
    expect(s.unknownBu).toBe(4);
    expect(sum(s.states)).toBe(s.all);
  });
  it('ไม่รู้ BU นับเฉพาะช่วงที่ดูอยู่', () => {
    const s = summarizeLumosSent(ROWS, { today: '2026-09-28', bu: 'LBD', range: { from: '2026-09-05', to: '2026-09-28' } });
    expect(s.range).toBe(35);
    expect(s.unknownBu).toBe(0);
  });
  it('ตัวเลือก BU มาจากสายที่มีจริง เรียงมากไปน้อย · ไม่รู้ BU ไม่เป็นตัวเลือก', () => {
    expect(lumosSentBuOptions(ROWS)).toEqual([
      { bu: 'LBD', count: 135 },
      { bu: 'LBA', count: 7 },
      { bu: 'LML', count: 2 },
    ]);
  });
});
