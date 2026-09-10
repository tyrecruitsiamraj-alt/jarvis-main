import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REQUEST_LEAD_RULES,
  cleanRequestLeadRulesOverride,
  hasCustomLeadRules,
  requestLeadKindFromDays,
  requestLeadKindFromYmd,
  requestLeadKindHint,
  resolveRequestLeadRules,
  slaDaysForLeadKind,
} from '@/lib/requestLeadKind';
import { computeJobUrgency } from '@/lib/jobUrgency';
import { computeJobSla } from '@/lib/jobSla';
import type { JobRequest } from '@/types';

/**
 * เกณฑ์ความเร่งเฉพาะใบ (เจ้าของสั่ง 10 ก.ย. 2569)
 *
 * ด่านที่ต้องกัน:
 *   1. ใบที่**ไม่ได้ตั้ง**ต้องได้ผลเท่าเดิมเป๊ะ — ของใหม่ห้ามขยับเลขของใบเดิมแม้แต่ใบเดียว
 *   2. ใบที่ตั้งแล้วต้องเปลี่ยนทั้ง**ประเภท**และ**วันครบกำหนด**
 *   3. ตั้งบางช่อง ช่องที่เหลือต้องตกไปที่ค่ากลาง ไม่ใช่กลายเป็น 0
 */

const baseJob = (over: Partial<JobRequest> = {}): JobRequest =>
  ({
    id: 'siamraj-sql:TEST-1',
    request_no: 'TEST-1',
    request_date: '2026-09-01',
    required_date: '2026-09-05',
    position_units: 1,
    request_positions: 1,
    status: 'open',
    ...over,
  }) as unknown as JobRequest;

describe('ค่ากลาง (ของเดิมก่อน 10 ก.ย. 2569)', () => {
  it('🔴 ตรงกับ 04-sla-rules.md — ย้อนหลัง 7 · ฉุกเฉิน 15 · ล่วงหน้า 15 · เส้นแบ่ง 7', () => {
    expect(DEFAULT_REQUEST_LEAD_RULES).toEqual({
      urgentThresholdDays: 7,
      slaDays: { retroactive: 7, urgent: 15, advance: 15 },
    });
  });

  it('ไม่รู้ประเภท ⇒ ใช้เกณฑ์เดียวกับล่วงหน้า (พฤติกรรมเดิมของ slaDaysForKind)', () => {
    expect(slaDaysForLeadKind('unknown')).toBe(15);
  });
});

describe('cleanRequestLeadRulesOverride — กันค่าเพี้ยนเข้าฐาน', () => {
  it('ไม่มีอะไรตั้งจริง = null (ไม่เก็บ object ว่างไว้หลอกว่าใบนี้ตั้งเกณฑ์เอง)', () => {
    expect(cleanRequestLeadRulesOverride(null)).toBeNull();
    expect(cleanRequestLeadRulesOverride({})).toBeNull();
    expect(cleanRequestLeadRulesOverride({ sla_days: {} })).toBeNull();
    expect(cleanRequestLeadRulesOverride('7')).toBeNull();
    expect(
      cleanRequestLeadRulesOverride({ urgent_threshold_days: null, sla_days: { urgent: null } }),
    ).toBeNull();
  });

  it('ตัดค่าที่คำนวณไม่ได้ทิ้ง — ติดลบ · เกินปี · ไม่ใช่ตัวเลข', () => {
    expect(cleanRequestLeadRulesOverride({ urgent_threshold_days: -1 })).toBeNull();
    expect(cleanRequestLeadRulesOverride({ urgent_threshold_days: 366 })).toBeNull();
    expect(cleanRequestLeadRulesOverride({ urgent_threshold_days: 'สาม' })).toBeNull();
  });

  it('🔴 ให้เวลาหาคน 0 วันไม่นับว่าตั้ง (ครบกำหนดตั้งแต่วันแรก = ใบหลุด SLA ทันทีทั้งกอง)', () => {
    expect(cleanRequestLeadRulesOverride({ sla_days: { urgent: 0 } })).toBeNull();
  });

  it('เส้นแบ่ง 0 วันตั้งได้ (แปลว่าไม่มีช่วงล่วงหน้า) — ต่างจากให้เวลาหาคน 0', () => {
    expect(cleanRequestLeadRulesOverride({ urgent_threshold_days: 0 })).toEqual({
      urgent_threshold_days: 0,
    });
  });

  it('ทศนิยมถูกตัดเป็นจำนวนเต็ม', () => {
    expect(cleanRequestLeadRulesOverride({ urgent_threshold_days: 3.9 })).toEqual({
      urgent_threshold_days: 3,
    });
  });

  it('hasCustomLeadRules บอกได้ว่าใบนี้ตั้งเองหรือใช้ค่ากลาง', () => {
    expect(hasCustomLeadRules(null)).toBe(false);
    expect(hasCustomLeadRules({})).toBe(false);
    expect(hasCustomLeadRules({ urgent_threshold_days: 3 })).toBe(true);
  });
});

describe('resolveRequestLeadRules — ช่องที่ไม่ได้ตั้งต้องตกไปที่ค่ากลาง', () => {
  it('ไม่ตั้งเลย = ค่ากลางทั้งชุด', () => {
    expect(resolveRequestLeadRules(null)).toEqual(DEFAULT_REQUEST_LEAD_RULES);
  });

  it('🔴 ตั้งช่องเดียว ช่องอื่นต้องเป็นค่ากลาง ไม่ใช่ 0 หรือ undefined', () => {
    const r = resolveRequestLeadRules({ sla_days: { urgent: 30 } });
    expect(r.slaDays.urgent).toBe(30);
    expect(r.slaDays.advance).toBe(DEFAULT_REQUEST_LEAD_RULES.slaDays.advance);
    expect(r.slaDays.retroactive).toBe(DEFAULT_REQUEST_LEAD_RULES.slaDays.retroactive);
    expect(r.urgentThresholdDays).toBe(DEFAULT_REQUEST_LEAD_RULES.urgentThresholdDays);
  });
});

describe('เส้นแบ่งของใบเปลี่ยนประเภทของใบจริง', () => {
  it('ห่าง 4 วัน: ค่ากลาง(7) = ฉุกเฉิน · ตั้งเส้นแบ่ง 3 = ล่วงหน้า', () => {
    expect(requestLeadKindFromDays(4)).toBe('urgent');
    expect(requestLeadKindFromDays(4, resolveRequestLeadRules({ urgent_threshold_days: 3 }))).toBe(
      'advance',
    );
  });

  it('ฝั่ง API (จาก YMD) ใช้เกณฑ์เดียวกัน — แดชบอร์ดจึงจัดกลุ่มตรงกับหน้าใบขอ', () => {
    const rules = resolveRequestLeadRules({ urgent_threshold_days: 30 });
    expect(requestLeadKindFromYmd('2026-09-01', '2026-09-20')).toBe('advance');
    expect(requestLeadKindFromYmd('2026-09-01', '2026-09-20', rules)).toBe('urgent');
  });

  it('🔴 ย้อนหลังยังเป็นย้อนหลังเสมอ ไม่ว่าตั้งเส้นแบ่งเท่าไร (วันที่ต้องการอยู่ก่อนวันกรอก)', () => {
    for (const t of [0, 3, 30, 365]) {
      expect(requestLeadKindFromDays(-1, resolveRequestLeadRules({ urgent_threshold_days: t }))).toBe(
        'retroactive',
      );
    }
  });

  it('คำอธิบายพูดเลขของใบ ไม่ใช่เลขกลาง', () => {
    expect(requestLeadKindHint('urgent')).toContain('7');
    expect(requestLeadKindHint('urgent', resolveRequestLeadRules({ urgent_threshold_days: 3 }))).toContain(
      '3',
    );
  });
});

describe('ใบขอทั้งใบ — computeJobUrgency / computeJobSla ต้องเดินตามเกณฑ์ของใบ', () => {
  const today = new Date('2026-09-03T09:00:00+07:00');

  it('🔴 ใบที่ไม่ได้ตั้ง ต้องได้ผลเท่าเดิมเป๊ะ (ของใหม่ห้ามขยับใบเดิม)', () => {
    const job = baseJob(); // ห่าง 4 วัน
    expect(computeJobUrgency(job, today).kind).toBe('urgent');
    const sla = computeJobSla(job, 'open', today);
    expect(sla.slaDays).toBe(15);
    expect(sla.slaStartDate).toBe('2026-09-05');
    expect(sla.slaDueDate).toBe('2026-09-20');
  });

  it('ตั้งเส้นแบ่ง 3 วัน ⇒ ใบเดียวกันกลายเป็นล่วงหน้า', () => {
    const job = baseJob({ lead_rules: { urgent_threshold_days: 3 } });
    expect(computeJobUrgency(job, today).kind).toBe('advance');
  });

  it('ตั้งให้เวลาหาคน 30 วัน ⇒ วันครบกำหนดเลื่อนตาม', () => {
    const job = baseJob({ lead_rules: { sla_days: { urgent: 30 } } });
    const sla = computeJobSla(job, 'open', today);
    expect(sla.slaDays).toBe(30);
    expect(sla.slaDueDate).toBe('2026-10-05');
  });

  it('ใบย้อนหลังตั้งเองได้ และยังนับจาก**วันที่ยื่น** ไม่ใช่วันที่ต้องการ', () => {
    const job = baseJob({
      required_date: '2026-08-25',
      lead_rules: { sla_days: { retroactive: 3 } },
    });
    const sla = computeJobSla(job, 'open', today);
    expect(sla.requestKind).toBe('retroactive');
    expect(sla.slaStartDate).toBe('2026-09-01');
    expect(sla.slaDueDate).toBe('2026-09-04');
  });

  it('🔴 ค่าขยะบนใบ (ติดลบ) ต้องตกไปใช้ค่ากลาง ไม่ใช่ทำให้ใบครบกำหนดย้อนอดีต', () => {
    const job = baseJob({ lead_rules: { sla_days: { urgent: -5 } } });
    const sla = computeJobSla(job, 'open', today);
    expect(sla.slaDays).toBe(15);
    expect(sla.slaDueDate).toBe('2026-09-20');
  });

  it('ตั้งเกณฑ์แล้วสถานะ SLA เปลี่ยนตามจริง — จาก "เกินแล้ว" กลับมา "ทันกำหนด"', () => {
    const late = new Date('2026-09-25T09:00:00+07:00');
    const plain = baseJob();
    expect(computeJobSla(plain, 'open', late).slaStatus).toBe('breached');
    const relaxed = baseJob({ lead_rules: { sla_days: { urgent: 40 } } });
    expect(computeJobSla(relaxed, 'open', late).slaStatus).toBe('on_track');
  });
});
