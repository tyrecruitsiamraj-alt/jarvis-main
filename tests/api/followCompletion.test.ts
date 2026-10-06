// @vitest-environment node
/**
 * Phase 7.1-7.2 — กอง "โทรครบแล้ว" + ปุ่มย้ายไปดูแลหลังเริ่มงาน
 *
 * 🔴 ด่านที่ห้ามหลุด:
 * 1. นับที่ระดับ **คน (กลุ่ม)** ไม่ใช่ระดับรอบ — 1 วัน = 1 แถว (092) ถ้านับเป็นรอบ
 *    คนเดียวจะโผล่หลายครั้งและเลขเฟ้อ
 * 2. **ยังมีนัดข้างหน้า = ยังไม่ครบ** (กล่องนี้ต้องเป็นงานที่พร้อมส่งต่อจริง)
 * 2.1 **สายเก่าที่ค้าง `pending` ไม่บล็อก** (แก้ 3 ก.ย. 2569) — ของจริง Lumos ตอบสายที่ 2
 *     แล้วปิดคนนั้น ส่วนสายที่ 1 ค้างตลอดกาลเพราะไม่เคยถูกยิง · กติกาเดิม (`every`)
 *     ทำให้ 14 คนที่ได้คำตอบแล้วไม่มีใครเข้ากองนี้ แถบส่งต่อหายทั้งแถบ
 * 2.2 **AI นัดโทรซ้ำ (`retry_scheduled`) = ยังตามอยู่** ห้ามนับว่าจบ
 * 3. `needs_human` เข้ากองด้วย (เจ้าของระบุมาในโจทย์)
 * 4. **ผลออกมาว่าไม่ไป = ไม่เข้ากอง** (ไม่มีอะไรให้ดูแลต่อ)
 * 5. ยกเลิกหมดทุกรอบ = ไม่ใช่ "โทรครบ"
 */
import { describe, expect, it } from 'vitest';
import {
  COMPLETION_REASON_LABEL,
  COMPLETION_REASON_SHORT,
  COMPLETION_REASON_TONE,
  completedFollowSummary,
  isRoundSettled,
  reasonBlocksAftercare,
  selectAwaitingDecision,
  selectCompletedFollowPeople,
} from '../../src/lib/followCompletion.js';
import type { FollowGroup } from '../../src/lib/followGrouping.js';

type RoundInput = {
  cancelled?: boolean;
  completed_at?: string | null;
  outcome_code?: string | null;
  call_outcome?: string | null;
  staff_call_outcome?: string | null;
  followup_state?: string | null;
};

const round = (over: RoundInput = {}) =>
  ({
    id: `r${Math.abs(JSON.stringify(over).length)}`,
    cancelled: false,
    completed_at: null,
    outcome_code: null,
    call_outcome: null,
    followup_state: null,
    ...over,
  }) as never;

const group = (name: string, rounds: unknown[], nextRound: unknown = null): FollowGroup =>
  ({
    key: `k-${name}`,
    name,
    phone: '0812345678',
    topic: 'แจ้งเข้างาน',
    unitName: 'หน่วยงาน ก',
    siteCode: 'S1',
    createdByName: null,
    rounds,
    activeCount: (rounds as RoundInput[]).filter((r) => !r.cancelled).length,
    nextRound,
    todayOrdinal: null,
    latestCreatedAt: null,
  }) as unknown as FollowGroup;

describe('isRoundSettled', () => {
  it('ยกเลิก = ไม่ต้องนับ (ถือว่าเดินจบ)', () => {
    expect(isRoundSettled({ cancelled: true })).toBe(true);
  });

  it('ปิดงานพร้อมผล / มีผลโทร / needs_human = จบ', () => {
    expect(isRoundSettled({ completed_at: '2026-08-20T00:00:00Z', outcome_code: 'went' })).toBe(true);
    expect(isRoundSettled({ call_outcome: 'confirmed' })).toBe(true);
    expect(isRoundSettled({ followup_state: 'needs_human' })).toBe(true);
  });

  it('ยังไม่มีอะไรเลย = ยังไม่จบ', () => {
    expect(isRoundSettled({})).toBe(false);
    expect(isRoundSettled({ followup_state: 'retry_scheduled' })).toBe(false);
  });
});

describe('เลือกคนที่โทรครบแล้ว', () => {
  it('ทุกรอบจบ + ไม่มีนัดข้างหน้า + ปิดงานว่าไปแล้ว → เข้ากอง (closed_success)', () => {
    const people = selectCompletedFollowPeople([
      group('ก', [round({ completed_at: 'x', outcome_code: 'went' })]),
    ]);
    expect(people).toHaveLength(1);
    expect(people[0].reason).toBe('closed_success');
    expect(people[0].roundsDone).toBe(1);
  });

  it('🔴 ยังมีนัดข้างหน้า = ยังไม่ครบ', () => {
    const people = selectCompletedFollowPeople([
      group('ข', [round({ call_outcome: 'confirmed' })], round({})),
    ]);
    expect(people).toHaveLength(0);
  });

  /**
   * 🔴 เคสจริง 3 ก.ย. 2569 (เจ้าของแจ้ง: *"แดชบอร์ดโชว์การโทรสำเร็จแล้ว แต่ไม่ขึ้น
   * แถบที่ต้องย้ายไปดูแลหลังบ้าน"*) — Lumos ตอบสายที่ 2 แล้วปิดคนนั้น
   * ส่วนสายที่ 1 ค้าง `pending` ไม่มีวันได้ผล ⇒ ต้อง**ไม่บล็อก** กองนี้
   */
  it('🔴 สายเก่าค้างไม่มีผล แต่มีสายที่ได้คำตอบแล้ว = ครบ (สายที่ค้างถือว่าตกไป)', () => {
    const people = selectCompletedFollowPeople([
      group('ค', [round({ call_outcome: 'confirmed' }), round({})]),
    ]);
    expect(people).toHaveLength(1);
    expect(people[0].reason).toBe('ai_going');
    // นับแค่สายที่ได้คำตอบจริง ไม่นับสายที่ค้าง
    expect(people[0].roundsDone).toBe(1);
  });

  it('ไม่มีสายไหนได้คำตอบเลย = ยังไม่ครบ (ค้างอยู่ ไม่ใช่โทรครบ)', () => {
    const people = selectCompletedFollowPeople([group('ค2', [round({}), round({})])]);
    expect(people).toHaveLength(0);
  });

  it('🔴 AI นัดโทรซ้ำ (retry_scheduled) = ยังตามอยู่ ห้ามนับว่าจบ', () => {
    const people = selectCompletedFollowPeople([
      group('ค3', [
        round({ call_outcome: 'unresponsive', followup_state: 'retry_scheduled' }),
      ]),
    ]);
    expect(people).toHaveLength(0);
  });

  /**
   * 🔴 AI ได้คำตอบว่า "ไม่ไป" ต้องขึ้นกองนี้ (เดิมตกหายเงียบ ๆ เพราะเช็คแต่
   * `outcome_code` ที่คนกรอก) แต่ต้องติดป้ายว่า**ไม่ต้องส่งต่อ**
   */
  it('🔴 AI ได้คำตอบว่าไม่ไป = เข้ากองแต่ห้ามมีปุ่มย้ายไปดูแลหลังเริ่มงาน', () => {
    const people = selectCompletedFollowPeople([
      group('ค4', [round({ call_outcome: 'declined' })]),
    ]);
    expect(people).toHaveLength(1);
    expect(people[0].reason).toBe('ai_not_going');
    expect(reasonBlocksAftercare('ai_not_going')).toBe(true);
    expect(reasonBlocksAftercare('ai_going')).toBe(false);
  });

  it('คำตอบล่าสุดชนะ — สายแรกรับสาย สายสองบอกไม่ไป ⇒ ไม่ไป', () => {
    const people = selectCompletedFollowPeople([
      group('ค5', [round({ call_outcome: 'acknowledged' }), round({ call_outcome: 'declined' })]),
    ]);
    expect(people[0].reason).toBe('ai_not_going');
  });

  it('needs_human เข้ากอง (AI เอาไม่อยู่ ต้องคนตาม)', () => {
    const people = selectCompletedFollowPeople([
      group('ง', [round({ followup_state: 'needs_human' })]),
    ]);
    expect(people).toHaveLength(1);
    expect(people[0].reason).toBe('needs_human');
  });

  it('🔴 ผลว่าไม่ไป (ยกเลิก/ไม่ไปเริ่มงาน) = ไม่เข้ากอง', () => {
    for (const code of ['cancelled', 'job_cancelled', 'no_show_start']) {
      const people = selectCompletedFollowPeople([
        group('จ', [round({ completed_at: 'x', outcome_code: code })]),
      ]);
      expect(people).toHaveLength(0);
    }
  });

  it('ยกเลิกทุกรอบ = ไม่ใช่ "โทรครบ"', () => {
    const people = selectCompletedFollowPeople([group('ฉ', [round({ cancelled: true })])]);
    expect(people).toHaveLength(0);
  });

  it('โทรครบแต่ยังไม่ปิดงาน = เข้ากอง · ไม่รับสายทุกสาย = no_answer · คุยแต่ไม่บอก = called_no_close (6 ต.ค. 2569)', () => {
    const people = selectCompletedFollowPeople([
      group('ช', [round({ call_outcome: 'no_answer' })]),
    ]);
    expect(people).toHaveLength(1);
    expect(people[0].reason).toBe('no_answer');
    const unclear = selectCompletedFollowPeople([group('ซ', [round({ call_outcome: 'acknowledged' })])]);
    expect(unclear[0].reason).toBe('called_no_close');
  });

  it('เรียงจบดีขึ้นก่อน (พร้อมส่งต่อเลย)', () => {
    const people = selectCompletedFollowPeople([
      group('ต้องคนตาม', [round({ followup_state: 'needs_human' })]),
      group('จบดี', [round({ completed_at: 'x', outcome_code: 'arrived' })]),
    ]);
    expect(people.map((p) => p.reason)).toEqual(['closed_success', 'needs_human']);
  });
});

describe('🔴 สายที่คนโทรลงผลเอง (130) นับเหมือนผลของ AI (1 ต.ค. 2569 · ปุ่มบนแถว)', () => {
  it('ลงผลแล้ว = เดินจบ · ชุดที่คนโทรทั้งชุดเข้ากองได้ (เดิมไม่มีวันเข้า)', () => {
    expect(isRoundSettled(round({ staff_call_outcome: 'no_answer' }))).toBe(true);
    const [p] = selectCompletedFollowPeople([
      group('คนโทร', [round({ staff_call_outcome: 'acknowledged' }), round({ staff_call_outcome: 'confirmed' })]),
    ]);
    expect(p?.reason).toBe('ai_going');
  });

  it('คนลง "ยกเลิก — ไม่ไปแล้ว" ⇒ บอกว่าไม่ไป (ปุ่มย้ายไม่ขึ้น) · "ติดต่อสำเร็จ" อย่างเดียว = ยังไม่ได้คำตอบว่าไปไหม', () => {
    const [notGoing] = selectCompletedFollowPeople([group('ไม่ไป', [round({ staff_call_outcome: 'declined' })])]);
    expect(notGoing?.reason).toBe('ai_not_going');
    const [reached] = selectCompletedFollowPeople([group('ติดต่อได้', [round({ staff_call_outcome: 'acknowledged' })])]);
    expect(reached?.reason).toBe('called_no_close');
  });
});

describe('สรุปใต้หัวกล่อง', () => {
  it('ไม่มีของ = null (กล่องซ่อนตัวเอง)', () => {
    expect(completedFollowSummary([])).toBeNull();
  });

  it('บอกจำนวนแยกตามเหตุผล ด้วยคำเดียวกับที่โชว์บนแถว', () => {
    const people = selectCompletedFollowPeople([
      group('a', [round({ completed_at: 'x', outcome_code: 'went' })]),
      group('b', [round({ followup_state: 'needs_human' })]),
    ]);
    const summary = completedFollowSummary(people) ?? '';
    expect(summary).toContain(COMPLETION_REASON_LABEL.closed_success);
    expect(summary).toContain(COMPLETION_REASON_LABEL.needs_human);
  });
});

/**
 * ═══ การ์ด "ติดตามครบ" (เจ้าของสั่ง 1 ต.ค. 2569) ═══
 * กอง = ตามครบรอบแล้ว + **ยังไม่มีใครตัดสิน** (ยังมีรอบที่เปิดอยู่)
 * 🔴 บั๊กของกล่องเดิม: ย้ายแล้ว (ปิดเป็น "ไปแล้ว") รีเฟรชแล้วโผล่กลับมาให้กดซ้ำ
 */
describe('การ์ดติดตามครบ — เฉพาะคนที่ยังไม่มีใครตัดสิน', () => {
  it('ตามครบ + ยังไม่ปิดงานสักรอบ ⇒ อยู่ในกอง', () => {
    const people = selectAwaitingDecision([
      group('a', [round({ call_outcome: 'no_answer' }), round({ call_outcome: 'confirmed' })]),
    ]);
    expect(people.map((p) => p.group.name)).toEqual(['a']);
    expect(people[0].reason).toBe('ai_going');
  });

  it('🔴 บอกว่าไปแล้ว รอบหลังไม่รับสาย ⇒ ยังนับว่าบอกว่าไป (สายที่ไม่ได้คุยไม่ลบคำตอบเก่า)', () => {
    const going = selectAwaitingDecision([
      group('g', [round({ call_outcome: 'confirmed' }), round({ call_outcome: 'no_answer' })]),
    ]);
    expect(going[0].reason).toBe('ai_going');
    const notGoing = selectAwaitingDecision([
      group('n', [round({ call_outcome: 'declined' }), round({ call_outcome: 'busy' })]),
    ]);
    expect(notGoing[0].reason).toBe('ai_not_going');
    const none = selectAwaitingDecision([group('x', [round({ call_outcome: 'no_answer' })])]);
    expect(none[0].reason).toBe('no_answer');
  });

  it('🔴 ย้าย/ไม่ย้ายแล้ว (ปิดงานครบทุกรอบที่ไม่ยกเลิก) ⇒ ออกจากกองทันที ไม่โผล่ซ้ำหลังรีเฟรช', () => {
    const decided = group('done', [
      round({ call_outcome: 'confirmed', completed_at: 'x', outcome_code: 'went' }),
      round({ cancelled: true }),
    ]);
    expect(selectCompletedFollowPeople([decided])).toHaveLength(1); // กองเดิมยังนับ (closed_success)
    expect(selectAwaitingDecision([decided])).toEqual([]);
  });

  it('ปิดไปบางรอบ แต่ยังมีรอบเปิด ⇒ ยังรอตัดสิน', () => {
    const people = selectAwaitingDecision([
      group('half', [round({ completed_at: 'x', outcome_code: 'went' }), round({ call_outcome: 'confirmed' })]),
    ]);
    expect(people).toHaveLength(1);
    expect(people[0].reason).toBe('closed_success');
  });

  it('ยังมีนัดข้างหน้า ⇒ ยังไม่ครบ ไม่เข้าการ์ด', () => {
    expect(
      selectAwaitingDecision([group('later', [round({ call_outcome: 'confirmed' })], round())]),
    ).toEqual([]);
  });

  it('บอกว่าไม่ไป ⇒ อยู่ในกองได้ แต่ปุ่มย้ายต้องไม่ขึ้น (เหลือแต่ไม่ย้าย)', () => {
    const people = selectAwaitingDecision([group('no', [round({ call_outcome: 'declined' })])]);
    expect(people[0].reason).toBe('ai_not_going');
    expect(reasonBlocksAftercare(people[0].reason)).toBe(true);
  });

  it('ป้ายสั้นใช้คำชุดเดียวกับถังผลโทร + มีสีครบทุกเหตุผล', () => {
    // คำเดียวกับช่องของแผงขั้นตอน (6 ต.ค. 2569)
    expect(COMPLETION_REASON_SHORT.ai_going).toBe('ตอบว่าไป');
    expect(COMPLETION_REASON_SHORT.ai_not_going).toBe('ตอบว่าไม่ไป');
    expect(COMPLETION_REASON_SHORT.no_answer).toBe('ไม่รับสาย');
    expect(COMPLETION_REASON_SHORT.called_no_close).toBe('สรุปไม่ได้');
    for (const k of Object.keys(COMPLETION_REASON_LABEL)) {
      expect(COMPLETION_REASON_SHORT[k as keyof typeof COMPLETION_REASON_SHORT]).toBeTruthy();
      expect(COMPLETION_REASON_TONE[k as keyof typeof COMPLETION_REASON_TONE]).toBeTruthy();
    }
  });
});
