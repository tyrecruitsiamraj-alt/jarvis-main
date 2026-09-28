import { describe, expect, it } from 'vitest';
import {
  applyHeatmap,
  bangkokDowHour,
  INTEREST_MICRO_LABEL,
  INTEREST_MICRO_ORDER,
  lumosPipeline,
  pipelineByDim,
  pipelineRates,
  reachByCallHour,
} from './lumosPipeline';
import { CALL_MICRO_KEYS } from '@/lib/callMicroOutcome';
import { METRICS } from '@/lib/metricDictionary';
import type { ApplicantLumos, ApplicantTrendRow } from './types';

const lumos = (over: Partial<ApplicantLumos>): ApplicantLumos => ({
  state: 'called',
  sends: 1,
  attempt: 1,
  queuedAt: '2026-09-24T03:00:00Z',
  waitingSince: null,
  resultAt: '2026-09-24T04:00:00Z',
  outcome: 'confirmed',
  micro: 'said_yes',
  ...over,
});

const a = (over: Partial<ApplicantTrendRow>): ApplicantTrendRow => ({
  id: Math.random().toString(36).slice(2),
  createdAt: '2026-09-24T03:00:00Z',
  channel: 'facebook',
  position: 'พนักงานขับรถ',
  province: 'ลพบุรี',
  bu: 'LBD',
  jobId: null,
  isLead: false,
  claimed: false,
  appointmentAt: null,
  attendance: null,
  phoneOk: true,
  lumos: null,
  ...over,
});

const range = { from: '2026-09-22', to: '2026-09-28' };

describe('เส้นทาง รายชื่อ → Lumos → ผลโทร (cohort)', () => {
  const rows = [
    a({ lumos: lumos({ micro: 'said_yes' }), appointmentAt: '2026-09-26T03:00:00Z', attendance: 'showed' }),
    a({ lumos: lumos({ micro: 'said_no', outcome: 'declined' }) }),
    a({ lumos: lumos({ micro: 'picked_silent', outcome: 'unresponsive' }) }), // รับแล้ววาง
    a({ lumos: lumos({ micro: 'no_pickup', outcome: 'no_answer', attempt: 3 }) }),
    a({ lumos: lumos({ state: 'pending', outcome: null, micro: null, resultAt: null, waitingSince: '2026-09-27T00:00:00Z' }) }),
    a({ lumos: lumos({ state: 'waiting', outcome: null, micro: null, resultAt: null, waitingSince: '2026-09-26T00:00:00Z' }) }),
    // ตั้งโทรไว้พรุ่งนี้ (พ้นช่วงห้ามโทร) — ยังไม่ถึงเวลา ไม่ใช่งานค้าง
    a({ lumos: lumos({ state: 'pending', outcome: null, micro: null, resultAt: null, waitingSince: '2026-09-29T01:00:00Z' }) }),
    a({ lumos: lumos({ state: 'cancelled', outcome: null, micro: null, resultAt: null }) }),
    a({ claimed: true }), // เก็บไปโทรเอง
    a({ phoneOk: false }), // เบอร์ใช้โทรไม่ได้
    a({ jobId: null }), // ไม่ได้เลือกงาน — ตัวส่งอัตโนมัติข้าม
    a({ jobId: 'J1', isLead: true }), // ย้ายไป Lead
    a({ jobId: 'J1' }), // ยังไม่ส่ง (เหตุอื่น)
    a({ createdAt: '2026-08-01T03:00:00Z', lumos: lumos({}) }), // นอกช่วง
  ];
  const now = new Date('2026-09-28T00:00:00Z');
  const p = lumosPipeline(rows, range, now);

  it('ขั้นทั้งหมดนับกลุ่มเดียวกัน และไม่มีขั้นไหนเกินขั้นก่อน', () => {
    expect(p.steps.map((s) => [s.key, s.count])).toEqual([
      ['names', 13],
      ['sent', 8],
      ['called', 4],
      ['pickedUp', 3],
      ['talked', 2],
      ['interested', 1],
    ]);
    for (let i = 1; i < p.steps.length; i++) expect(p.steps[i].count).toBeLessThanOrEqual(p.steps[i - 1].count);
  });

  it('ยังไม่ส่ง = เก็บไปโทรเอง · เบอร์ใช้ไม่ได้ · ไม่ได้เลือกงาน · ย้ายไป Lead · อื่น ๆ (รวมเท่ายอดที่ยังไม่ส่ง)', () => {
    expect(p.notSent).toEqual({ total: 5, claimed: 1, badPhone: 1, noJob: 1, lead: 1, other: 1 });
  });

  it('ส่งแล้วยังไม่มีผล แยก ยังไม่ถึงมือ Lumos / รอผล / ยกเลิก · ค้างนานสุดกี่ชั่วโมง', () => {
    expect(p.notCalled).toMatchObject({ total: 4, pending: 2, waiting: 1, cancelled: 1 });
    expect(p.notCalled.oldestHours).toBe(48); // ส่งออก 26 ก.ย. 00:00 UTC ถึง 28 ก.ย. 00:00 UTC
  });

  it('"รับแล้ววาง" แยกจาก "ไม่รับสาย" และไม่นับเป็นได้คุย', () => {
    expect(p.micro.picked_silent).toBe(1);
    expect(p.micro.no_pickup).toBe(1);
    const r = pipelineRates(p);
    expect(r.coverage).toBeCloseTo(4 / 8);
    expect(r.reach).toBeCloseTo(3 / 4);
    expect(r.talk).toBeCloseTo(2 / 4);
    expect(r.interest).toBeCloseTo(1 / 2);
  });

  it('รอบที่โทรจนได้ผล · ได้นัด/มาตามนัด', () => {
    expect(p.attempts.find((x) => x.slot === 3)).toEqual({ slot: 3, called: 1, pickedUp: 0 });
    expect(p.appointment).toBe(1);
    expect(p.showed).toBe(1);
  });

  it('ป้ายครบทุกถังของตัวกลาง (ถังใหม่ต้องมาเติมป้าย)', () => {
    expect(new Set(INTEREST_MICRO_ORDER)).toEqual(new Set(CALL_MICRO_KEYS));
    for (const k of CALL_MICRO_KEYS) expect(INTEREST_MICRO_LABEL[k]).toBeTruthy();
  });

  it('ป้ายถังผลมาจากพจนานุกรมเมตริก (คำเดียวกับหน้าแรก) — ไม่ตั้งคำเอง', () => {
    expect(INTEREST_MICRO_LABEL.picked_silent).toBe(METRICS['lumos.result.silent'].label);
    expect(INTEREST_MICRO_LABEL.said_yes).toBe(METRICS['lumos.result.interested'].label);
    expect(INTEREST_MICRO_LABEL.talked_unclear).toBe(METRICS['lumos.result.unclear'].label);
    expect(p.steps.at(-1)?.label).toBe(METRICS['lumos.result.interested'].label);
  });
});

describe('ช่วงเวลา (เวลาไทย)', () => {
  it('ตีสองไทยของวันจันทร์ = 19:00 UTC วันอาทิตย์', () => {
    expect(bangkokDowHour('2026-09-27T19:00:00Z')).toEqual({ dow: 0, hour: 2 });
    expect(bangkokDowHour(null)).toBeNull();
  });
  it('ตารางวัน × ชั่วโมง นับตามเวลาที่กรอก', () => {
    const m = applyHeatmap(
      [a({ createdAt: '2026-09-28T13:30:00Z' }), a({ createdAt: '2026-09-28T13:59:00Z' }), a({ createdAt: '2026-08-01T13:00:00Z' })],
      range,
    );
    expect(m[0][20]).toBe(2); // จันทร์ 20:xx ไทย
    expect(m.flat().reduce((s, v) => s + v, 0)).toBe(2);
  });
  it('โทรติดตามชั่วโมงที่ได้ผล — ชั่วโมงที่ไม่มีสาย = null (ห้ามโชว์ 0%)', () => {
    const rows = [
      a({ lumos: lumos({ resultAt: '2026-09-24T03:00:00Z', micro: 'said_yes' }) }), // 10 โมงไทย
      a({ lumos: lumos({ resultAt: '2026-09-24T03:20:00Z', micro: 'no_pickup' }) }),
    ];
    const byHour = reachByCallHour(rows, range);
    expect(byHour[10]).toEqual({ hour: 10, called: 2, pickedUp: 1, rate: 0.5 });
    expect(byHour[11].rate).toBeNull();
  });
});

describe('เส้นทางแยกมิติ', () => {
  it('นับทุกขั้นต่อช่องทาง · % สนใจ ÷ ที่ Lumos โทรแล้ว', () => {
    const rows = [
      a({ channel: 'facebook', lumos: lumos({ micro: 'said_yes' }) }),
      a({ channel: 'facebook', lumos: lumos({ micro: 'no_pickup' }) }),
      a({ channel: 'flyer' }),
    ];
    const t = pipelineByDim(rows, range, (r) => r.channel ?? '');
    expect(t[0]).toMatchObject({ dim: 'facebook', names: 2, sent: 2, called: 2, pickedUp: 1, interested: 1, interestOfCalled: 0.5 });
    expect(t[1]).toMatchObject({ dim: 'flyer', names: 1, sent: 0, interestOfCalled: null });
  });
  it('ช่วงก่อนต่อมิติ · เกินอันดับรวบเป็น "อื่น ๆ" ทั้งช่วงนี้และช่วงก่อน', () => {
    const before = { from: '2026-09-15', to: '2026-09-21' };
    const old = (channel: string) => a({ channel, createdAt: '2026-09-16T03:00:00Z' });
    const rows = [
      a({ channel: 'facebook' }),
      a({ channel: 'facebook' }),
      a({ channel: 'flyer' }),
      a({ channel: 'tiktok' }),
      old('facebook'),
      old('tiktok'),
      old('line'),
    ];
    const t = pipelineByDim(rows, range, (r) => r.channel ?? '', { top: 1, previous: before });
    expect(t.map((r) => [r.dim, r.names, r.namesPrev])).toEqual([
      ['facebook', 2, 1],
      ['อื่น ๆ', 2, 2], // flyer + tiktok ช่วงนี้ · tiktok + line ช่วงก่อน
    ]);
  });
});
