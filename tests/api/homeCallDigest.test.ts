// @vitest-environment node
/**
 * ═══ สรุปผลโทรบนกล่องทีมหน้าแรก (เจ้าของสั่ง 7 ก.ย. 2569) ═══
 *
 * *"หน้าหลัก ตามกล่องทีม บอกด้วยว่าโทรไปแล้วเท่าไหร่ สนใจลงงานอะไรยังไง
 *   ไม่เอาแค่คำว่า ผลการโทร แบบนั้นก็ต้องกดเข้าไปเพื่อดูอีก"*
 *
 * ด่านที่ต้องคุม:
 * 1. ยอดมาจาก `call_box_counts` **ไม่ใช่ `.length`** (ลิสต์ตันที่ 50)
 * 2. บอร์ดทีมกับป๊อป "ผลจากการโทร" อ่านป้าย/ตัวสร้างชุดเดียวกัน
 * 3. ของใหม่อยู่หลังสวิตช์ `uiV2` — v1 ต้องไม่ขยับ และป๊อปเดิมต้องไม่หาย
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildCallDigest,
  CALL_BOX_META,
  FOLLOW_UP_TONE,
  interestedJobLine,
} from '../../src/lib/homeCallDigest';
import type { FlowFollowUpItem, FlowSummary } from '../../src/lib/flowSummaryApi';

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

const person = (n: number, over: Partial<FlowFollowUpItem> = {}): FlowFollowUpItem => ({
  job_ref: `job-${n}`,
  request_no: `OPL69071${n}`,
  person_ref: `card-${n}`,
  channel: 'lumos',
  name: `คนที่ ${n}`,
  phone: '0800000000',
  summary: null,
  outcome: 'confirmed',
  updated_at: '2026-09-07T03:00:00.000Z',
  job_position: 'พนักงานขับรถ',
  job_unit: 'ฝ่ายบริการ',
  ...over,
});

const flowOf = (opts: {
  confirmed: number;
  counts?: Record<string, number>;
  outcomes?: Record<string, number>;
}): FlowSummary =>
  ({
    lumos: { outcomes_month: opts.outcomes ?? { confirmed: 12, declined: 4, no_answer: 9 } },
    call_boxes: {
      confirmed: Array.from({ length: opts.confirmed }, (_, i) => person(i + 1)),
      retry: [person(90)],
      needs_human: [],
      declined: [],
    },
    ...(opts.counts ? { call_box_counts: opts.counts } : {}),
  }) as unknown as FlowSummary;

describe('buildCallDigest — เลขทุกตัวมาจากนิยามกลาง ไม่ใช่ความยาวลิสต์', () => {
  it('🔴 ยอด "สนใจงาน" ใช้ call_box_counts ไม่ใช่ลิสต์ที่ SQL ตัดที่ 50', () => {
    const d = buildCallDigest(
      flowOf({ confirmed: 50, counts: { confirmed: 137, retry: 1, needs_human: 0, declined: 0 } }),
    )!;
    const confirmed = d.boxes.find((b) => b.key === 'confirmed')!;
    expect(confirmed.count).toBe(137);
    expect(confirmed.truncated).toBe(true);
    expect(d.interestedTotal).toBe(137);
  });

  it('โชว์ชื่อได้เท่าที่กำหนด · ที่เหลือยุบเป็น "อีก N ราย" โดยอิงยอดจริง', () => {
    const d = buildCallDigest(
      flowOf({ confirmed: 50, counts: { confirmed: 137, retry: 1, needs_human: 0, declined: 0 } }),
      4,
    )!;
    expect(d.interested).toHaveLength(4);
    // 137 - 4 = 133 (ไม่ใช่ 50 - 4 = 46 ซึ่งเป็นคำโกหกจากลิสต์ที่ถูกตัด)
    expect(d.interestedMore).toBe(133);
  });

  it('ของจริงน้อยกว่าเพดานชื่อ ⇒ ไม่มี "อีก N ราย"', () => {
    const d = buildCallDigest(
      flowOf({ confirmed: 2, counts: { confirmed: 2, retry: 1, needs_human: 0, declined: 0 } }),
      4,
    )!;
    expect(d.interested).toHaveLength(2);
    expect(d.interestedMore).toBe(0);
  });

  it('API รุ่นเก่าไม่ส่งตัวนับ ⇒ ถอยไปใช้ความยาวลิสต์ ไม่พัง ไม่ NaN', () => {
    const d = buildCallDigest(flowOf({ confirmed: 3 }))!;
    expect(d.interestedTotal).toBe(3);
    expect(d.boxes.every((b) => Number.isFinite(b.count))).toBe(true);
  });

  it('"โทรไปแล้วเท่าไหร่" = ผลกลับทุกแบบของเดือนนี้ (ชุดเดียวกับ callResultsThisMonth)', () => {
    const d = buildCallDigest(flowOf({ confirmed: 1, outcomes: { confirmed: 5, declined: 3, no_answer: 7 } }))!;
    expect(d.resultsMonth).toBe(15);
  });

  it('ยังไม่มีข้อมูล (flow = null) ⇒ null — จอต้องไม่วาดกล่องเลข 0 ปลอม', () => {
    expect(buildCallDigest(null)).toBeNull();
  });

  it('ครบ 4 กล่องตามลำดับเดียวกับป๊อป', () => {
    const d = buildCallDigest(flowOf({ confirmed: 1 }))!;
    expect(d.boxes.map((b) => b.key)).toEqual(['confirmed', 'retry', 'needs_human', 'declined']);
  });
});

describe('interestedJobLine — "สนใจลงงานอะไร" ห้ามเดา', () => {
  it('มีตำแหน่ง+หน่วยงาน ⇒ ต่อกันด้วยจุดกลาง', () => {
    expect(interestedJobLine(person(1))).toBe('พนักงานขับรถ · ฝ่ายบริการ');
  });

  it('มีแค่ตำแหน่ง ⇒ ไม่มีจุดกลางห้อย', () => {
    expect(interestedJobLine(person(1, { job_unit: null }))).toBe('พนักงานขับรถ');
  });

  it('ไม่มีทั้งคู่ ⇒ ถอยไปบอกเลขที่ใบขอ ไม่ใช่แต่งชื่องานเอง', () => {
    expect(interestedJobLine(person(1, { job_position: null, job_unit: '  ' }))).toBe(
      'ใบขอ OPL690711',
    );
  });

  it('ไม่มีอะไรเลย ⇒ บอกตรง ๆ ว่ายังไม่รู้', () => {
    expect(
      interestedJobLine(person(1, { job_position: null, job_unit: null, request_no: '' })),
    ).toBe('ยังไม่รู้ว่าแมทกับใบขอไหน');
  });
});

describe('ป้าย 4 กล่องมีชุดเดียว — บอร์ดทีมกับป๊อปห้ามพิมพ์เอง', () => {
  const home = read('src/pages/HomePage.tsx');
  const panel = read('src/components/home/TeamBoardPanel.tsx');

  it('ทุกคีย์ใน CALL_BOX_META มีโทนอยู่จริง', () => {
    for (const m of CALL_BOX_META) expect(FOLLOW_UP_TONE[m.tone]).toBeTruthy();
  });

  it('🔴 หน้าแรกไม่พิมพ์ป้ายกล่องเอง — อ่านจาก CALL_BOX_META', () => {
    expect(home).toContain('CALL_BOX_META');
    expect(home).not.toContain("label: 'ไม่สะดวก — รอ AI โทรซ้ำ'");
  });

  it('🔴 ป๊อปใช้ยอดจริง ไม่ใช่ items.length', () => {
    expect(home).toContain('callBoxCount(flow, key)');
    expect(home).not.toMatch(/\{label\} \(\{items\.length\}\)/);
  });

  it('บอร์ดทีมอ่านโทน/บรรทัดงานจาก lib กลาง ไม่ประกาศเอง', () => {
    expect(panel).toContain("from '@/lib/homeCallDigest'");
    expect(panel).toContain('interestedJobLine');
  });
});

describe('ของใหม่อยู่หลังสวิตช์ · ของเดิมยังอยู่ครบ', () => {
  const home = read('src/pages/HomePage.tsx');
  const panel = read('src/components/home/TeamBoardPanel.tsx');

  it('🔴 หน้าแรกส่ง callDigest ให้เฉพาะตอน uiV2 เปิด', () => {
    expect(home).toMatch(/callDigest=\{uiV2 \? callDigest : null\}/);
  });

  it('🔴 v1 ยังได้ปุ่ม "ผลโทรวันนี้ … เปิดดูรายชื่อ" ของเดิม', () => {
    expect(panel).toContain('ผลโทรวันนี้');
  });

  it('🔴 ป๊อป "ผลจากการโทร" (มีปุ่มจองตัว) ยังเปิดได้จากบล็อกใหม่', () => {
    expect(panel).toContain('onOpenAll');
    expect(panel).toContain('มีปุ่มจองตัว');
  });

  it('กล่องทีมโชว์ชื่อคนที่สนใจ + งานที่สนใจ โดยไม่ต้องกดเข้าไป', () => {
    expect(panel).toContain('สนใจลงงาน');
    expect(panel).toContain('onOpenPerson');
  });
});
