import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { personRefToProposal, jobRefDisplay } from '../../api/_handlers/matching-flow-summary';
import {
  callBoxCount,
  callBoxTruncated,
  callResultsThisMonth,
  confirmedThisMonth,
  type FlowSummary,
} from '../../src/lib/flowSummaryApi';

describe('personRefToProposal — mapping ต้องตรงกับ unique key ของ candidate_proposals', () => {
  it('card-<id> → board', () => {
    expect(personRefToProposal('card-123')).toEqual({ source: 'board', ref: '123' });
  });
  it('ir-<id> → irecruit', () => {
    expect(personRefToProposal('ir-45')).toEqual({ source: 'irecruit', ref: '45' });
  });
  it('ref แปลก (เช่น follow-xxx) → null ไม่เดา', () => {
    expect(personRefToProposal('follow-abc')).toBeNull();
    expect(personRefToProposal('')).toBeNull();
  });
});

describe('jobRefDisplay', () => {
  it('ตัด prefix แหล่งข้อมูลออก เหลือเลขใบขอ', () => {
    expect(jobRefDisplay('siamraj-sql:OPL6907125')).toBe('OPL6907125');
    expect(jobRefDisplay('OPL6907125')).toBe('OPL6907125');
  });
});

describe('callResultsThisMonth — เลขใหญ่ของขั้น "ผลจากการโทร" บนหน้าหลัก', () => {
  const flowWith = (outcomes: Record<string, number>) =>
    ({ lumos: { outcomes_month: outcomes } }) as unknown as FlowSummary;

  it('รวมผลกลับทุกแบบ ไม่ใช่แค่คนสนใจ', () => {
    const flow = flowWith({ confirmed: 5, declined: 3, no_answer: 7, unresponsive: 2, wrong_person: 1 });
    expect(callResultsThisMonth(flow)).toBe(18);
    expect(confirmedThisMonth(flow)).toBe(5);
  });

  it('เดือนที่ยังไม่มีผลกลับเลย = 0 (ไม่ NaN)', () => {
    expect(callResultsThisMonth(flowWith({}))).toBe(0);
  });
});

/**
 * 🔴 ยอดของกล่องผลโทร — **ลิสต์ถูกตัดที่ 50 แถวใน SQL**
 * เจอจริง 7 ก.ย. 2569: หน้า `/work` โชว์ `.length` ของลิสต์เป็นยอด ⇒ ของจริงเกิน 50
 * เมื่อไหร่ จอจะบอก "50" ตลอดกาลโดยไม่มีใครรู้ (บั๊กตระกูลเดียวกับป๊อป "ส่ง AI โทร")
 */
describe('callBoxCount — ยอดจริงของกล่องผลโทร ไม่ใช่ความยาวลิสต์', () => {
  const items = (n: number) => Array.from({ length: n }, () => ({}) as never);
  const flow = (counts?: Record<string, number>) =>
    ({
      call_boxes: { confirmed: items(50), retry: items(2), needs_human: items(50), declined: [] },
      ...(counts ? { call_box_counts: counts } : {}),
    }) as unknown as FlowSummary;

  it('มีตัวนับ ⇒ ใช้ตัวนับ และบอกได้ว่าลิสต์ถูกตัด', () => {
    const f = flow({ confirmed: 137, retry: 2, needs_human: 51, declined: 0 });
    expect(callBoxCount(f, 'confirmed')).toBe(137);
    expect(callBoxCount(f, 'needs_human')).toBe(51);
    expect(callBoxTruncated(f, 'confirmed')).toBe(true);
    expect(callBoxTruncated(f, 'retry')).toBe(false);
  });

  it('API รุ่นเก่าไม่ส่งตัวนับ ⇒ ถอยไปใช้ความยาวลิสต์ (ไม่พัง ไม่ NaN)', () => {
    expect(callBoxCount(flow(), 'confirmed')).toBe(50);
    expect(callBoxTruncated(flow(), 'confirmed')).toBe(false);
  });
});

/**
 * ด่านฝั่ง SQL — นิยาม "ใครเข้าข่าย" ต้องเขียนที่เดียวแล้วใช้ทั้งลิสต์และตัวนับ
 * (ถ้าก๊อปไปสองที่ วันหนึ่งจะแก้ข้างเดียวแล้วเลขเพี้ยนเงียบ ๆ — กับดักเดิมของไฟล์นี้)
 */
describe('flow-summary ส่งตัวนับจริงมาคู่กับลิสต์', () => {
  const src = fs.readFileSync(
    path.resolve(__dirname, '../../api/_handlers/matching-flow-summary.ts'),
    'utf8',
  );

  it('มี call_box_counts ครบ 4 กล่อง', () => {
    expect(src).toContain('call_box_counts');
    for (const k of ['confirmed:', 'retry:', 'needs_human:', 'declined:']) {
      expect(src).toContain(k);
    }
  });

  it('🔴 เงื่อนไขของกล่อง "สนใจงาน" เขียนที่เดียว ใช้ทั้งลิสต์และตัวนับ', () => {
    expect(src).toContain('CALLS_AWAITING_ACTION_WHERE');
    expect((src.match(/CALLS_AWAITING_ACTION_WHERE/g) ?? []).length).toBeGreaterThanOrEqual(3);
    // นิยาม "ยังไม่มีใครรับช่วงต่อ" ต้องมีชุดเดียวในไฟล์
    expect((src.match(/p\.status in \('contacted', 'reserved', 'placed'\)/g) ?? []).length).toBe(1);
  });
});
