import { describe, expect, it } from 'vitest';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';
import {
  AGE_UNKNOWN,
  HOME_UNKNOWN,
  ageBucketOf,
  ageStats,
  applyAudience,
  audienceRows,
  buCompare,
  countOf,
  outcomeSetsOf,
  pageOf,
  trendOf,
} from '@/lib/recruitAudience';

const NOW = new Date('2026-11-17T08:55:00+07:00');
let seq = 0;
/** ใบสมัครหน้าตาเหมือนของจริง (id uuid · เวลา ISO · ช่องทางแบบ "Facebook · Facebook Group · <กลุ่ม>") */
function app(p: Partial<RecruitAppFact>): RecruitAppFact {
  seq += 1;
  const n = String(seq).padStart(12, '0');
  return {
    id: `4495d242-96cf-41f0-9187-${n}`,
    createdAt: '2026-11-03T02:15:00.000Z',
    jobId: 'siamraj-sql:OPL6911056',
    bu: 'LBD',
    channelLabel: 'Facebook · Facebook Group · พนักงานขับรถมืออาชีพ (หางานขับรถ,หาคนขับรถ)',
    referralSource: null,
    position: null,
    phoneOk: true,
    calledByAi: false,
    calledByStaff: false,
    firstCalledAt: null,
    aiAnswer: null,
    aiAnswerAt: null,
    staffAnswer: null,
    staffAnswerAt: null,
    staffLastAt: null,
    contact: null,
    contactBy: null,
    logOk: null,
    logReason: null,
    logAt: null,
    appointmentAt: null,
    attendance: null,
    onBoard: null,
    informed: false,
    age: 38,
    homeProvince: 'กรุงเทพมหานคร',
    ...p,
  };
}
const interested = { calledByAi: true, aiAnswer: 'said_yes' as const, aiAnswerAt: '2026-11-03T03:00:00.000Z' };
const booked = { ...interested, calledByStaff: true, logOk: true, contact: 'success' as const, contactBy: 'staff' as const, appointmentAt: '2026-11-10T02:00:00.000Z' };

describe('ผู้สมัครกลุ่มไหน ได้ผลแค่ไหน (ภาพรวม v2 · 17 พ.ย. 2569)', () => {
  it('ช่วงอายุตามแบบ · ไม่ระบุ = ช่องของตัวเอง (ไม่ใช่ 0 ปี)', () => {
    expect([17, 18, 25, 26, 35, 36, 45, 46, 57, 58, null].map((a) => ageBucketOf(a))).toEqual([
      'ต่ำกว่า 18 ปี', '18–25 ปี', '18–25 ปี', '26–35 ปี', '26–35 ปี', '36–45 ปี', '36–45 ปี', '46–57 ปี', '46–57 ปี', '58 ปีขึ้นไป', AGE_UNKNOWN,
    ]);
  });

  it('อายุเฉลี่ย = ผลรวม / จำนวนที่มีอายุ · ไม่ระบุไม่นับเป็น 0', () => {
    const list = [app({ age: 30 }), app({ age: 40 }), app({ age: null })];
    expect(ageStats(list)).toEqual({ average: 35, known: 2, missing: 1, sum: 70 });
  });

  it('🔴 Facebook + อายุ 36–45 + กรุงเทพ = intersection จริงทุกชั้น (AND) · กดผลต่อ = AND ไม่ทิ้งของเดิม', () => {
    const list = [
      app({ age: 40, homeProvince: 'กรุงเทพมหานคร', ...booked }),
      app({ age: 40, homeProvince: 'สมุทรปราการ', ...booked }),
      app({ age: 30, homeProvince: 'กรุงเทพมหานคร', ...booked }),
      app({ age: 40, homeProvince: 'กรุงเทพมหานคร', channelLabel: 'Tiktok · Tiktok Live' }),
      app({ age: 40, homeProvince: 'กรุงเทพมหานคร', ...interested }),
    ];
    const sets = outcomeSetsOf(list, NOW);
    const pick = applyAudience(list, { dims: { ch: 'Facebook', age: '36–45 ปี', home: 'กรุงเทพมหานคร' }, results: [] }, sets);
    expect(pick.map((f) => f.id)).toEqual([list[0].id, list[4].id]);
    const bookedOnly = applyAudience(list, { dims: { ch: 'Facebook', age: '36–45 ปี', home: 'กรุงเทพมหานคร' }, results: ['follow', 'allBooked'] }, sets);
    expect(bookedOnly.map((f) => f.id)).toEqual([list[0].id]);
  });

  it('🔴 % รวม = ผลรวมตัวตั้ง / ผลรวมตัวหาร (ไม่บวก/เฉลี่ย % ของ BU) · ตัวหาร 0 = —', () => {
    const list = [
      ...Array.from({ length: 9 }, () => app({ bu: 'LBD' })),
      app({ bu: 'LBD', ...booked }),
      app({ bu: 'LBA', ...booked }),
    ];
    const sets = outcomeSetsOf(list, NOW);
    const r = buCompare(list, ['LBD', 'LBA', 'LM'], 'allBooked', 'rate', sets);
    expect(r.bars.map((b) => [b.bu, b.result, b.sample, b.value])).toEqual([
      ['LBD', 1, 10, 10],
      ['LBA', 1, 1, 100],
      ['LM', 0, 0, null],
    ]);
    expect(r.total).toBeCloseTo((2 / 11) * 100);
    // จำนวน: แท่ง BU รวม = ทั้งก้อน
    const c = buCompare(list, ['LBD', 'LBA', 'LM'], 'apps', 'count', sets);
    expect(c.bars.reduce((s, b) => s + (b.value ?? 0), 0)).toBe(c.total);
  });

  it('🔴 ERP อ่านไม่ได้ = — (ไม่ใช่ 0) ทั้งตาราง BU และกราฟเวลา · กติกาเดียวกับ informedOf', () => {
    const unread = [app({ informed: null }), app({ informed: null })];
    const sets = outcomeSetsOf(unread, NOW);
    expect(countOf(unread, 'erp', sets)).toBeNull();
    expect(buCompare(unread, ['LBD'], 'erp', 'count', sets).bars[0].value).toBeNull();
    expect([...trendOf(unread, 'erp', sets, 'day').values()][0].n).toBeNull();
    const read = [app({ informed: false }), app({ informed: true })];
    expect(countOf(read, 'erp', outcomeSetsOf(read, NOW))).toBe(1);
  });

  it('เรียงตามยอดที่เลือกก่อนแบ่งหน้า · ไม่ระบุอยู่ท้ายเสมอ · ยอดอื่นในแถวยังถูก', () => {
    const list = [
      ...Array.from({ length: 5 }, () => app({ homeProvince: null })),
      app({ homeProvince: 'ชลบุรี', ...booked }),
      app({ homeProvince: 'ชลบุรี', ...booked }),
      ...Array.from({ length: 3 }, () => app({ homeProvince: 'กรุงเทพมหานคร' })),
    ];
    const sets = outcomeSetsOf(list, NOW);
    const byApps = audienceRows(list, 'home', sets, 'apps', 'count').map((r) => r.key);
    expect(byApps).toEqual(['กรุงเทพมหานคร', 'ชลบุรี', HOME_UNKNOWN]);
    const byBooked = audienceRows(list, 'home', sets, 'allBooked', 'rate');
    expect(byBooked.map((r) => r.key)).toEqual(['ชลบุรี', 'กรุงเทพมหานคร', HOME_UNKNOWN]);
    expect(byBooked[0].counts).toMatchObject({ apps: 2, follow: 2, allBooked: 2, showed: 0, erp: 0 });
    expect(byBooked[0].rates.allBooked).toBe(100);
  });

  it('🔴 แบ่งหน้า 10 — รวม id ทุกหน้า = ชุดต้นทาง ไม่ซ้ำ ไม่หาย (0/1/10/11/21)', () => {
    for (const n of [0, 1, 10, 11, 21, 105]) {
      const items = Array.from({ length: n }, (_, i) => `id-${i}`);
      const first = pageOf(items, 1);
      const seen: string[] = [];
      for (let p = 1; p <= first.pages; p += 1) seen.push(...pageOf(items, p).slice);
      expect(seen).toEqual(items);
      expect(new Set(seen).size).toBe(n);
      expect(first.pages).toBe(Math.max(1, Math.ceil(n / 10)));
    }
    expect(pageOf(['a'], 9).page).toBe(1);
  });

  it('กราฟเวลา = จำนวนผลตาม cohort วันที่สมัคร · รวมทุกช่อง = ยอดทั้งก้อน', () => {
    const list = [app({ createdAt: '2026-11-01T01:00:00.000Z', ...booked }), app({ createdAt: '2026-11-02T20:00:00.000Z', ...booked }), app({ createdAt: '2026-11-02T01:00:00.000Z' })];
    const sets = outcomeSetsOf(list, NOW);
    const t = trendOf(list, 'allBooked', sets, 'day');
    // 2 พ.ย. 20:00 UTC = 3 พ.ย. ไทย
    expect([...t.entries()].map(([k, v]) => [k, v.n])).toEqual([['2026-11-01', 1], ['2026-11-02', 0], ['2026-11-03', 1]]);
    expect([...t.values()].reduce((s, v) => s + (v.n ?? 0), 0)).toBe(countOf(list, 'allBooked', sets));
  });
});
