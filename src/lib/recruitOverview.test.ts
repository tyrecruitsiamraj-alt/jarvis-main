/**
 * ตัวคิดหน้า "ภาพรวมงานสรรหา" (30 ก.ย. 2569) — 🔴 ด่าน:
 * วันต้องครบ 24 ชม. (เจ้าของ) · เทียบเดือนก่อนถึงวันที่เดียวกัน · AI+คน แยกบรรทัดล่างรวมกันไม่เกินยอด ·
 * คนโทรต่อ = หลังเวลาที่ AI ได้คำตอบเท่านั้น · อ่านไม่ได้/ยังไม่เคยบันทึก = null ไม่ใช่ 0 · รายวันรวมกันเท่ายอดเดือน
 */
import { describe, expect, it } from 'vitest';
import {
  channelOf,
  channelRows,
  cohortOf,
  dailyRows,
  dailySummary,
  delayOf,
  delayRows,
  fullDaysBetween,
  funnelSteps,
  isStaffFollowed,
  latestSignal,
  positionRows,
  reasonGroups,
  staffTableRows,
  totalsOf,
} from './recruitOverview';
import { monthLabel, monthOptions, monthWindow, shiftMonth } from './recruitOverviewWindow';
import type { RecruitAppFact } from './recruitOverviewTypes';

const fact = (over: Partial<RecruitAppFact> = {}): RecruitAppFact => ({
  createdAt: '2026-09-10T03:00:00.000Z',
  jobId: 'siamraj-sql:R1',
  channelLabel: null,
  referralSource: 'facebook',
  position: 'พนักงานขับรถ',
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
  onBoard: false,
  ...over,
});

describe('วันต้องครบ 24 ชม. ถึงนับเป็น 1 วัน (กติกาเจ้าของ)', () => {
  it('ขาด 24 ชม. ไปนิดเดียว = 0 วัน · ครบพอดี = 1 วัน · ย้อนหลัง/อ่านไม่ได้ = null', () => {
    expect(fullDaysBetween('2026-09-01T00:00:00Z', '2026-09-01T23:59:59Z')).toBe(0);
    expect(fullDaysBetween('2026-09-01T00:00:00Z', '2026-09-02T00:00:00Z')).toBe(1);
    expect(fullDaysBetween('2026-09-01T00:00:00Z', '2026-09-02T23:00:00Z')).toBe(1);
    expect(fullDaysBetween('2026-09-02T00:00:00Z', '2026-09-01T00:00:00Z')).toBeNull();
    expect(fullDaysBetween(null, '2026-09-01T00:00:00Z')).toBeNull();
  });

  it('🔴 กรอกสามทุ่ม โทรแปดโมงเช้าวันถัดไป = ภายใน 24 ชม. (ไม่ใช่ "1 วัน" แบบนับปฏิทิน)', () => {
    // 21:00 และ 08:00 เวลาไทย
    expect(delayOf({ createdAt: '2026-09-10T14:00:00Z', firstCalledAt: '2026-09-11T01:00:00Z' })).toBe('d0');
  });

  it('แบ่งถังตามวันเต็ม: 3 วัน 23 ชม. = 3 วัน · 4 วัน = 4–7 · 8 วัน = เกิน 7 · ไม่มีผลโทร = ยังไม่ได้โทร', () => {
    const at = (h: number) => new Date(Date.parse('2026-09-01T00:00:00Z') + h * 3_600_000).toISOString();
    const c = '2026-09-01T00:00:00Z';
    expect(delayOf({ createdAt: c, firstCalledAt: at(24) })).toBe('d1');
    expect(delayOf({ createdAt: c, firstCalledAt: at(71) })).toBe('d2');
    expect(delayOf({ createdAt: c, firstCalledAt: at(95) })).toBe('d3');
    expect(delayOf({ createdAt: c, firstCalledAt: at(96) })).toBe('d4_7');
    expect(delayOf({ createdAt: c, firstCalledAt: at(191) })).toBe('d4_7');
    expect(delayOf({ createdAt: c, firstCalledAt: at(192) })).toBe('over7');
    expect(delayOf({ createdAt: c, firstCalledAt: null })).toBe('none');
  });

  it('ตารางกรอกแล้วโทรวันไหน รวมทุกถัง = รายชื่อทั้งหมด', () => {
    const cohort = [
      fact({ firstCalledAt: '2026-09-10T03:05:00.000Z' }),
      fact({ firstCalledAt: '2026-09-12T04:00:00.000Z' }),
      fact(),
    ];
    const rows = delayRows(cohort);
    expect(rows.reduce((s, r) => s + r.count, 0)).toBe(3);
    expect(rows.find((r) => r.key === 'd0')?.count).toBe(1);
    expect(rows.find((r) => r.key === 'd2')?.count).toBe(1);
    expect(rows.find((r) => r.key === 'none')?.count).toBe(1);
  });
});

describe('เลือกเดือนแบบ iRecruit', () => {
  it('เดือนนี้ = 1 ถึงวันนี้ เทียบเดือนก่อนถึงวันที่เดียวกัน', () => {
    expect(monthWindow('2026-09', '2026-09-30')).toEqual({
      month: '2026-09',
      from: '2026-09-01',
      to: '2026-09-30',
      prevFrom: '2026-08-01',
      prevTo: '2026-08-30',
      isCurrent: true,
    });
  });

  it('เดือนก่อนสั้นกว่า = ถึงวันสุดท้ายของเดือนก่อน (ก.พ. 28/29)', () => {
    expect(monthWindow(undefined, '2026-03-31').prevTo).toBe('2026-02-28');
    expect(monthWindow(undefined, '2028-03-31').prevTo).toBe('2028-02-29');
  });

  it('เดือนที่จบแล้ว = ทั้งเดือน เทียบทั้งเดือนก่อน · มกราคมเทียบธันวาคมปีก่อน', () => {
    const w = monthWindow('2026-08', '2026-09-30');
    expect([w.from, w.to, w.prevFrom, w.prevTo, w.isCurrent]).toEqual(['2026-08-01', '2026-08-31', '2026-07-01', '2026-07-31', false]);
    const j = monthWindow('2026-01', '2026-09-30');
    expect([j.prevFrom, j.prevTo]).toEqual(['2025-12-01', '2025-12-31']);
  });

  it('ค่าผิด / เดือนในอนาคต = เดือนนี้', () => {
    expect(monthWindow('2026-13', '2026-09-30').month).toBe('2026-09');
    expect(monthWindow('2026-10', '2026-09-30').month).toBe('2026-09');
    expect(monthWindow("1=1'", '2026-09-30').month).toBe('2026-09');
  });

  it('ป้ายเดือนเป็น พ.ศ. · ตัวเลือกเดือนใหม่สุดก่อน หยุดที่เดือนแรกที่มีข้อมูล', () => {
    expect(monthLabel('2026-09')).toBe('กันยายน 2569');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(monthOptions('2026-08', '2026-09')).toEqual(['2026-09', '2026-08']);
    expect(monthOptions(null, '2026-09')).toEqual(['2026-09']);
  });
});

describe('ยอดของเดือน — รายชื่อที่กรอกเข้ามาในเดือน (วันไทย)', () => {
  it('ตัดเดือนด้วยวันไทย (00:30 วันที่ 1 ก.ย. เวลาไทย = เดือน ก.ย.)', () => {
    const apps = [fact({ createdAt: '2026-08-31T17:30:00.000Z' }), fact({ createdAt: '2026-08-31T16:30:00.000Z' })];
    expect(cohortOf(apps, '2026-09-01', '2026-09-30')).toHaveLength(1);
  });

  it('🔴 โทรแล้ว/ติดต่อสำเร็จ นับ AI + คน · แยก AI/คน ได้ · ติดต่อสำเร็จแยกตามผู้ได้ผลล่าสุดรวมเท่ายอด', () => {
    const apps = [
      fact({ calledByAi: true, contact: 'success', contactBy: 'ai' }),
      fact({ calledByAi: true, calledByStaff: true, contact: 'success', contactBy: 'staff' }),
      fact({ calledByStaff: true, contact: 'failed', contactBy: 'staff' }),
      fact(),
    ];
    const t = totalsOf(apps, '2026-09-01', '2026-09-30');
    expect([t.names, t.called, t.calledByAi, t.calledByStaff]).toEqual([4, 3, 2, 2]);
    expect([t.reached, t.reachedByAi, t.reachedByStaff]).toEqual([2, 1, 1]);
    expect(t.reachedByAi + t.reachedByStaff).toBe(t.reached);
  });

  it('🔴 คนโทรต่อแล้ว = ตอบ AI ว่าสนใจ แล้วเจ้าหน้าที่ลงมือ "หลัง" เวลาที่ AI ได้คำตอบ', () => {
    const yes = { aiAnswer: 'said_yes' as const, aiAnswerAt: '2026-09-10T04:00:00.000Z', calledByAi: true };
    expect(isStaffFollowed(fact({ ...yes, staffLastAt: '2026-09-10T05:00:00.000Z' }))).toBe(true);
    expect(isStaffFollowed(fact({ ...yes, staffLastAt: '2026-09-10T03:00:00.000Z' }))).toBe(false);
    expect(isStaffFollowed(fact({ ...yes }))).toBe(false);
    expect(isStaffFollowed(fact({ aiAnswer: 'said_no', aiAnswerAt: yes.aiAnswerAt, staffLastAt: '2026-09-11T00:00:00.000Z' }))).toBe(false);
  });

  it('ได้ใบสมัคร: อ่านบอร์ด ERP ไม่ได้ (null) = ยอดเป็น null ไม่ใช่ 0', () => {
    expect(totalsOf([fact({ onBoard: true }), fact({ onBoard: null })], '2026-09-01', '2026-09-30').onBoard).toBeNull();
    expect(totalsOf([fact({ onBoard: true }), fact({ onBoard: false })], '2026-09-01', '2026-09-30').onBoard).toBe(1);
  });

  it('ใบขอ = ใบไม่ซ้ำที่มีรายชื่อเข้ามา (ใบสมัครไม่ผูกใบขอไม่นับ)', () => {
    const t = totalsOf([fact(), fact(), fact({ jobId: 'siamraj-sql:R2' }), fact({ jobId: null })], '2026-09-01', '2026-09-30');
    expect(t.jobs).toBe(2);
  });
});

describe('เส้นทางของรายชื่อ', () => {
  const t = totalsOf(
    [
      fact({ calledByAi: true, aiAnswer: 'said_yes', aiAnswerAt: '2026-09-10T04:00:00.000Z', staffLastAt: '2026-09-11T00:00:00.000Z', appointmentAt: '2026-09-15T02:00:00.000Z', onBoard: true }),
      fact({ calledByAi: true, aiAnswer: 'said_yes', aiAnswerAt: '2026-09-10T04:00:00.000Z' }),
      fact({ calledByAi: true, aiAnswer: 'no_pickup', aiAnswerAt: '2026-09-10T04:00:00.000Z' }),
      fact(),
    ],
    '2026-09-01',
    '2026-09-30',
  );

  it('ลำดับตามที่เจ้าของไล่ + คิดเพิ่ม (นัด · มาตามนัด · ได้ใบสมัคร) · % ของรายชื่อที่เข้ามา', () => {
    const steps = funnelSteps(t, { attendanceEverRecorded: true });
    expect(steps.map((s) => s.label)).toEqual(['รายชื่อเข้ามา', 'AI โทรแล้ว', 'ตอบ AI ว่าสนใจ', 'คนโทรต่อแล้ว', 'นัดได้', 'มาตามนัด', 'ได้ใบสมัคร']);
    expect(steps.map((s) => s.value)).toEqual([4, 3, 2, 1, 1, 0, 1]);
    expect(steps.map((s) => s.pct)).toEqual([100, 75, 50, 25, 25, 0, 25]);
  });

  it('🔴 ยังไม่เคยมีใครบันทึกมา/ไม่มา = ขั้นมาตามนัดเป็น null พร้อมเหตุ (ห้ามโชว์ 0)', () => {
    const showed = funnelSteps(t, { attendanceEverRecorded: false }).find((s) => s.key === 'showed');
    expect(showed).toMatchObject({ value: null, pct: null, note: 'ยังไม่มีใครบันทึกมา/ไม่มา' });
  });
});

describe('รายวัน · ช่องทาง · ตำแหน่ง', () => {
  const apps = [
    fact({ createdAt: '2026-09-01T03:00:00.000Z', calledByAi: true, firstCalledAt: '2026-09-01T03:06:00.000Z', aiAnswer: 'said_yes', aiAnswerAt: '2026-09-01T03:06:00.000Z' }),
    fact({ createdAt: '2026-09-01T05:00:00.000Z', calledByAi: true, firstCalledAt: '2026-09-02T06:00:00.000Z' }),
    fact({ createdAt: '2026-09-03T05:00:00.000Z', referralSource: null, channelLabel: 'Facebook Group', position: null }),
  ];

  it('ทุกวันในช่วงมีแถว (วันไม่มีรายชื่อ = 0) · ผลรวมรายวัน = ยอดเดือน · ถังโทรรวมกัน = รายชื่อของวันนั้น', () => {
    const rows = dailyRows(apps, '2026-09-01', '2026-09-05');
    expect(rows.map((r) => r.day)).toEqual([1, 2, 3, 4, 5]);
    expect(rows.reduce((s, r) => s + r.names, 0)).toBe(3);
    for (const r of rows) expect(r.d0 + r.d1 + r.d2plus + r.none).toBe(r.names);
    expect(rows[0]).toMatchObject({ names: 2, called: 2, aiSaidYes: 1, d0: 1, d1: 1 });
    expect(dailySummary(rows, 'names')).toEqual({ total: 3, peak: { ymd: '2026-09-01', value: 2 }, avg: 1 });
  });

  it('ช่องทาง: ตารางช่องทางของลิงก์ก่อน แล้วค่อยที่ผู้สมัครเลือก · ไม่มีทั้งคู่ = ไม่ระบุ · แถวรวมเท่าทุกแถว', () => {
    expect(channelOf({ channelLabel: 'Facebook Group', referralSource: 'facebook' })).toBe('Facebook Group');
    expect(channelOf({ channelLabel: null, referralSource: 'flyer' })).toBe('ใบปลิว');
    expect(channelOf({ channelLabel: null, referralSource: null })).toBe('ไม่ระบุ');
    const { rows, total } = channelRows(apps);
    expect(rows.map((r) => [r.channel, r.names])).toEqual([['Facebook', 2], ['Facebook Group', 1]]);
    expect(total.names).toBe(rows.reduce((s, r) => s + r.names, 0));
    expect(rows[0].interestRate).toBe(50);
  });

  it('ตำแหน่ง: 10 อันดับแรก + ตำแหน่งอื่นๆ รวมที่เหลือ', () => {
    const many = Array.from({ length: 12 }, (_, i) => fact({ position: `ตำแหน่ง ${i}` }));
    const rows = positionRows(many, 10);
    expect(rows).toHaveLength(11);
    expect(rows[10]).toMatchObject({ position: 'ตำแหน่งอื่นๆ', names: 2, other: true });
    expect(positionRows(apps).find((r) => r.position === 'ไม่ระบุ')?.names).toBe(1);
  });
});

describe('เหตุผลที่ไม่สำเร็จ — หนึ่งรายชื่อหนึ่งผล (ผลล่าสุด)', () => {
  it('ผลล่าสุดชนะ · เวลาเท่ากัน = ฝั่งคนชนะ', () => {
    const at = '2026-09-10T04:00:00.000Z';
    expect(latestSignal(fact({ aiAnswer: 'said_yes', aiAnswerAt: at, staffAnswer: 'said_no', staffAnswerAt: at }))).toMatchObject({ kind: 'staff' });
    expect(latestSignal(fact({ aiAnswer: 'no_pickup', aiAnswerAt: '2026-09-11T00:00:00.000Z', logOk: false, logAt: at }))).toMatchObject({ kind: 'ai' });
  });

  it('แยกขั้น: ติดต่อไม่สำเร็จ (ไม่รับสาย/บันทึกไม่สำเร็จ+เหตุผล) · คุยแล้วยังนัดไม่ได้ · ไม่มาตามนัด · มีนัดแล้วไม่นับ', () => {
    const at = '2026-09-10T04:00:00.000Z';
    const groups = reasonGroups([
      fact({ aiAnswer: 'no_pickup', aiAnswerAt: at }),
      fact({ aiAnswer: 'no_pickup', aiAnswerAt: at }),
      fact({ logOk: false, logReason: 'ปิดเครื่อง', logAt: at }),
      fact({ aiAnswer: 'said_no', aiAnswerAt: at }),
      fact({ aiAnswer: 'said_no', aiAnswerAt: at, appointmentAt: '2026-09-20T02:00:00.000Z' }),
      fact({ appointmentAt: '2026-09-20T02:00:00.000Z', attendance: 'no_show' }),
      fact({ aiAnswer: 'said_yes', aiAnswerAt: at }),
    ]);
    const by = Object.fromEntries(groups.map((g) => [g.key, g]));
    expect(by.contact.total).toBe(3);
    expect(by.contact.reasons[0]).toEqual({ label: 'ไม่รับสาย', count: 2 });
    expect(by.contact.reasons).toContainEqual({ label: 'ปิดเครื่อง', count: 1 });
    expect(by.appoint).toMatchObject({ total: 1 });
    expect(by.attend.reasons).toEqual([{ label: 'ไม่มาตามนัด', count: 1 }]);
  });
});

describe('ผลงานรายคน', () => {
  it('เรียงตามคอลัมน์ที่กด · อัตรามาตามนัด = มา ÷ นัดได้ (นัด 0 = null)', () => {
    const { rows, ai } = staffTableRows(
      [
        { name: 'แบงค์', claimed: 5, called: 4, reached: 3, appointed: 1, showed: 1 },
        { name: 'คิว', claimed: 1, called: 6, reached: 2, appointed: 0, showed: 0 },
      ],
      { called: 99, reached: 72, saidYes: 64 },
      'called',
    );
    expect(rows.map((r) => r.name)).toEqual(['คิว', 'แบงค์']);
    expect(rows.find((r) => r.name === 'แบงค์')?.showRate).toBe(100);
    expect(rows.find((r) => r.name === 'คิว')?.showRate).toBeNull();
    expect(ai).toMatchObject({ called: 99, reached: 72, saidYes: 64 });
  });
});
