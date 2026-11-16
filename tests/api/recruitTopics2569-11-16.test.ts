import { describe, it, expect } from 'vitest';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';
import { buildPersonJourney } from '@/lib/recruitPersonJourney';
import { buBarsOf, channelParts, daysOf, groupByDay, notSentReasonOf, peopleParts, peopleSteps, staffParts, whyParts } from '@/lib/recruitTopics';
import { aiBlockOf } from '../../api/_handlers/recruit-overview';

/** ภาพรวม 8 เรื่อง (16 พ.ย. 2569) — ทุกสมการบวกลงตัว · เลขแกนตรงกับ buildPersonJourney (หน้าเดิม) */
const f = (id: string, p: Partial<RecruitAppFact> = {}): RecruitAppFact =>
  ({ id, createdAt: '2026-11-03T03:00:00.000Z', jobId: 'siamraj-sql:OPL6911001', bu: 'LBD', channelLabel: 'Facebook · Facebook Group', referralSource: null, phoneOk: true, calledByAi: false, calledByStaff: false, ...p }) as RecruitAppFact;
const LIST = [
  f('1', { calledByAi: true, aiAnswer: 'said_yes', logOk: true, appointmentAt: '2026-11-05T03:00:00.000Z', attendance: 'showed' }),
  f('2', { calledByAi: true, aiAnswer: 'said_yes', logOk: false }),
  f('3', { calledByAi: true, aiAnswer: 'no_pickup' }),
  f('4', { calledByStaff: true, claimedBy: 'อ้น', appointmentAt: '2026-11-06T03:00:00.000Z' }),
  f('5', { aiQueued: true }),
  f('6', { phoneOk: false }),
  f('7', { claimedBy: 'ไอซ์' }),
  f('8', { aiBlock: 'income' }),
  f('9', { aiBlock: 'paused' }),
  f('10', { channelLabel: 'iRecruit · Facebook', bu: 'LBA' }),
  f('11', {}),
];

describe('ภาพรวม 8 เรื่อง — ตัวคำนวณ', () => {
  it('ทุกขั้นของรายชื่อบวกลงตัว · ขั้นแรกเท่ากับเส้นเดิม (buildPersonJourney)', () => {
    const steps = peopleSteps(LIST);
    for (const s of steps) expect(s.parts.reduce((a, p) => a + p.value, 0), s.key).toBe(s.total);
    expect(steps[0].total).toBe(buildPersonJourney(LIST)[0].total);
    expect(steps[0].parts.map((p) => p.value)).toEqual(buildPersonJourney(LIST)[0].parts.map((p) => p.ids.length));
  });

  it('ยังไม่มีใครโทร แตกเหตุ: เบอร์ผิด · iRecruit · มีคนเก็บไปยังไม่โทร · ยังไม่ตั้งรายได้ · พัก · ไม่รู้เหตุ', () => {
    const nq = peopleSteps(LIST).find((s) => s.key === 'noQueue')!;
    const v = Object.fromEntries(nq.parts.map((p) => [p.key, p.value]));
    expect(v).toMatchObject({ bad: 1, irecruit: 1, keptNot: 1, noIncome: 1, paused: 1, unknown: 1 });
    expect(nq.total).toBe(6);
    expect(notSentReasonOf(f('x', { claimedBy: 'อ้น', calledByStaff: false }))).toBe('keptNot');
  });

  it('นัดได้ทุกทาง = สาย AI + คนโทรเอง + ทางอื่น · มาไหมของนัดทุกทาง', () => {
    const steps = peopleSteps(LIST);
    const all = steps.find((s) => s.key === 'allBooked')!;
    expect(all.total).toBe(2);
    expect(Object.fromEntries(all.parts.map((p) => [p.key, p.value]))).toEqual({ viaAi: 1, viaStaff: 1, viaOther: 0 });
    const att = steps.find((s) => s.key === 'allAttend')!;
    expect(Object.fromEntries(att.parts.map((p) => [p.key, p.value]))).toEqual({ showed: 1, noShow: 0, pending: 1 });
  });

  it('แท่ง BU: ทุก BU ขึ้นเสมอ (ไม่มีข้อมูล = 0) · รวมทุกแท่ง = ทั้งหมด', () => {
    const bars = buBarsOf(['LBD', 'LBA', 'LM'], LIST, (x) => x.bu, peopleParts);
    expect(bars.map((b) => [b.bu, b.total])).toEqual([['LBD', 10], ['LBA', 1], ['LM', 0]]);
    for (const partsOf of [staffParts, channelParts, whyParts]) for (const b of buBarsOf(["LBD"], LIST, (x) => x.bu, partsOf)) expect(b.parts.reduce((a, p) => a + p.value, 0)).toBe(b.total);
  });

  it('รายวัน: ทุกวันของช่วงมีถัง · วันกรุงเทพ', () => {
    expect(daysOf('2026-11-01', '2026-11-03')).toEqual(['2026-11-01', '2026-11-02', '2026-11-03']);
    const m = groupByDay([f('a', { createdAt: '2026-11-01T18:00:00.000Z' })], (x) => new Date(Date.parse(x.createdAt) + 7 * 3_600_000).toISOString().slice(0, 10), '2026-11-01', '2026-11-03');
    expect([...m].map(([d, l]) => [d, l.length])).toEqual([['2026-11-01', 0], ['2026-11-02', 1], ['2026-11-03', 0]]);
  });

  it('server: เหตุไม่ส่ง AI → กอง · ไม่มีเหตุ = ไม่ใส่ช่อง', () => {
    expect(aiBlockOf('ใบขอนี้ยังไม่ได้ตั้งรายได้')).toEqual({ aiBlock: 'income' });
    expect(aiBlockOf('เบอร์นี้ถูกพักโทร')).toEqual({ aiBlock: 'paused' });
    expect(aiBlockOf('อื่น ๆ')).toEqual({ aiBlock: 'other' });
    expect(aiBlockOf(null)).toEqual({});
  });
});
