// @vitest-environment node
/**
 * 🔴 ตัวเลขหน้าติดตามต้องบวกลบกันลงตัว (เจ้าของ 6 ต.ค. 2569)
 * > *"ตัวเลขเช็คให้หมดนะมันต้องสอดคล้องกัน คือ บวกลบ กันแล้วต้องเท่ากัน แล้วไม่ต้องให้นั่งเดานะว่าค่านี้ตรงกับค่าอะไร
 * >  เอาคำให้ตรงกันไปเลย"*
 *
 * ชุดข้อมูลปนทุกแบบ: ไป · ไม่ไป · ไม่รับสาย · คุยแต่ไม่บอก · ขอเลื่อน · รอโทร · ไม่ได้ส่ง · ยกเลิก ·
 * ยกเลิกแต่โทรแล้วมีผล · คนโทรลงผลเอง · แถวเก่าไม่รู้ลำดับสาย
 */
import { describe, expect, it } from 'vitest';
import type { FollowEntry } from '../../src/lib/followApi';
import { buildFollowCallMatrix, FOLLOW_MATRIX_COL_LABEL, FOLLOW_MATRIX_ROWS } from '../../src/lib/followCallMatrix';
import { buildFollowDayReport } from '../../src/lib/followDayReport';
import { followCallerOf } from '../../src/lib/followListFilter';
import { FOLLOW_CALL_CATEGORY_LABEL } from '../../src/lib/followPlanning';
import { withFollowDayCalls } from '../../src/lib/followDayCall';

const NOW = new Date('2026-10-06T12:00:00+07:00');
let n = 0;
const e = (over: Partial<FollowEntry>): FollowEntry =>
  ({
    id: `e${++n}`,
    recipient_name: `คน ${n}`,
    recipient_phone: `08100000${String(n).padStart(2, '0')}`,
    topic: 'ติดตามเริ่มงาน',
    note: null,
    scheduled_at: '2026-10-06T02:00:00Z',
    created_by_name: null,
    created_at: '2026-10-05T02:00:00Z',
    cancelled: false,
    call_status: 'completed',
    call_outcome: null,
    call_summary: null,
    next_action: null,
    called_at: null,
    call_mode: 'ai',
    call_round: 1,
    ...over,
  }) as FollowEntry;

const ENTRIES = withFollowDayCalls([
  e({ call_outcome: 'confirmed' }),
  e({ call_outcome: 'acknowledged', call_reply: 'ไปครับ ออกจากบ้านแล้ว' }),
  e({ call_outcome: 'declined' }),
  e({ call_outcome: 'no_answer', call_status: 'failed' }),
  e({ call_outcome: 'acknowledged' }),
  e({ call_outcome: 'reschedule_requested' }),
  e({ call_status: 'pending', scheduled_at: '2026-10-06T08:00:00Z' }),
  e({ call_status: null, call_mode: 'manual' }),
  e({ cancelled: true, call_status: 'cancelled' }),
  e({ cancelled: true, call_outcome: 'confirmed' }), // ยกเลิกทีหลัง แต่โทรแล้วบอกว่าไป
  e({ call_status: null, call_mode: 'manual', staff_call_outcome: 'declined', staff_called_at: '2026-10-06T03:00:00Z' }),
  e({ call_round: null, call_status: null }), // แถวเก่าไม่รู้ลำดับ
] as FollowEntry[]);

describe('แผงขั้นตอนของสาย — ทุกช่องรวมกัน = ทั้งหมด', () => {
  const m = buildFollowCallMatrix(ENTRIES, NOW);
  it('ทุกสายมีที่อยู่ (ไม่มีสายหล่นหาย)', () => {
    expect(m.all.total).toHaveLength(ENTRIES.length);
  });
  it('ไป + ไม่ไป + ไม่รับสาย + สรุปไม่ได้ + รอโทร + ยกเลิก = ทั้งหมด · ทุกแถวสาย', () => {
    for (const r of FOLLOW_MATRIX_ROWS) {
      const row = m[r];
      const sum = row.went.length + row.notWent.length + row.noAnswer.length + row.unclear.length + row.waiting.length + row.cancelled.length;
      expect(sum, String(r)).toBe(row.total.length);
    }
  });
  it('สายที่ 1 + 2 + 3 ขึ้นไป = ทุกสาย', () => {
    expect(m[1].total.length + m[2].total.length + m[3].total.length).toBe(m.all.total.length);
  });
  it('AI โทร + คนโทร = ทั้งหมด', () => {
    const ai = m.all.total.filter((x) => followCallerOf(x) === 'ai').length;
    const manual = m.all.total.filter((x) => followCallerOf(x) === 'manual').length;
    expect(ai + manual).toBe(m.all.total.length);
  });
  it('นับตามนิยามเจ้าของ: ไป 3 (รวมยกเลิกทีหลังแต่บอกว่าไป) · ไม่ไป 2 · ไม่รับสาย 1 · สรุปไม่ได้ 2 · ยกเลิก 1', () => {
    expect(m.all.went).toHaveLength(3);
    expect(m.all.notWent).toHaveLength(2);
    expect(m.all.noAnswer).toHaveLength(1);
    expect(m.all.unclear).toHaveLength(2);
    expect(m.all.cancelled).toHaveLength(1);
  });
});

describe('สรุปแผน = แผง (ข้อมูลชุดเดียวกัน วันเดียวกัน)', () => {
  const m = buildFollowCallMatrix(ENTRIES, NOW);
  const report = buildFollowDayReport(ENTRIES, '2026-10-06', NOW);
  it('สาย + ยกเลิก = ทั้งหมดของแผง · ยกเลิก = ช่องยกเลิกของแผง', () => {
    expect(report.calls + report.cancelled).toBe(m.all.total.length);
    expect(report.cancelled).toBe(m.all.cancelled.length);
    expect(report.ai + report.manual).toBe(report.calls);
  });
  it('คอลัมน์ผลใช้คำของหมวดเดียวกับแผง', () => {
    const words = new Set(Object.values(FOLLOW_CALL_CATEGORY_LABEL));
    for (const r of report.rows) {
      const head = r.result.split(/ — | · คนโทร/)[0];
      // ข้อยกเว้นเดียว (7 ต.ค. 2569 เจ้าของ "ให้บอกว่า นาย ก เลื่อน"): ขอเลื่อน = หมวดสรุปไม่ได้ แต่ป้ายบอกตรง ๆ
      expect(words.has(head) || head === 'ขอเลื่อน', r.result).toBe(true);
    }
  });
});

describe('คำเดียวกันทุกที่', () => {
  it('ช่องของแผงกับป้ายในตารางใช้คำเดียวกัน', () => {
    expect(FOLLOW_MATRIX_COL_LABEL.went).toBe(FOLLOW_CALL_CATEGORY_LABEL.agreed);
    expect(FOLLOW_MATRIX_COL_LABEL.notWent).toBe(FOLLOW_CALL_CATEGORY_LABEL.lost);
    expect(FOLLOW_MATRIX_COL_LABEL.noAnswer).toBe(FOLLOW_CALL_CATEGORY_LABEL.unreachable);
    expect(FOLLOW_MATRIX_COL_LABEL.unclear).toBe(FOLLOW_CALL_CATEGORY_LABEL.other);
    expect(FOLLOW_MATRIX_COL_LABEL.cancelled).toBe(FOLLOW_CALL_CATEGORY_LABEL.cancelled);
    for (const c of ['waiting', 'overdue', 'notSent'] as const) {
      expect(FOLLOW_CALL_CATEGORY_LABEL[c].startsWith(FOLLOW_MATRIX_COL_LABEL.waiting), c).toBe(true);
    }
  });
});

describe('Dashboard ติดตาม — ช่องเดียวกับแผง และบวกลงตัว (6 ต.ค. 2569)', () => {
  it('ทั้งหมด = ไป + ไม่ไป + ไม่รับสาย + สรุปไม่ได้ + รอโทร + ยกเลิก · AI + คน = โทรแล้ว', async () => {
    const { followMatrixInRange, followCallerStats, followEventYmd } = await import('../../src/lib/trends/followTrends');
    const cats = ['agreed', 'lost', 'unreachable', 'other', 'waiting', 'overdue', 'notSent', 'cancelled'] as const;
    const rows = cats.flatMap((category, i) =>
      [0, 1].map((k) => ({
        id: `${category}-${k}`,
        team: 'main' as const,
        category,
        slot: 1 as const,
        createdAt: '2026-10-01T02:00:00Z',
        scheduledAt: '2026-10-06T02:00:00Z',
        resultAt: null,
        completedAt: null,
        cancelledAt: null,
        outcomeCode: null,
        callStatus: null,
        callOutcome: null,
        attempt: null,
        callRound: 1,
        callMode: (k === 0 ? 'ai' : 'manual') as 'ai' | 'manual',
        phoneKey: `8${i}${k}`,
        staffCallOutcome: null,
        staffCalledAt: null,
        topic: 'ติดตามเริ่มงาน',
        unitName: null,
        siteCode: null,
        staffId: null,
        staffName: null,
        bu: null,
      })),
    );
    const range = { from: '2026-10-01', to: '2026-10-31' };
    const m = followMatrixInRange(rows, range);
    expect(m.went + m.notWent + m.noAnswer + m.unclear + m.waiting + m.cancelled).toBe(m.total);
    expect(m.total).toBe(rows.length);
    const called = rows.filter((r) => followEventYmd(r, 'called')).length;
    expect(called).toBe(m.went + m.notWent + m.noAnswer + m.unclear);
    const c = followCallerStats(rows, range);
    expect(c.ai.calls + c.manual.calls).toBe(called);
  });
});

describe('หน้าหลัก + Dashboard ใช้ตัวจัดหมวดฝั่งเซิร์ฟเวอร์ตัวเดียว = แผงหน้าติดตาม (6 ต.ค. 2569)', () => {
  /** แถวดิบแบบที่ SQL ส่งมา (ยกเลิก = cancelled_at · คิว = call_status/call_outcome) */
  const RAW = ENTRIES.map((x) => ({
    id: x.id,
    recipient_name: x.recipient_name,
    recipient_phone: x.recipient_phone,
    topic: x.topic,
    scheduled_at: x.scheduled_at,
    cancelled_at: x.cancelled ? '2026-10-06T01:00:00Z' : null,
    call_status: x.call_status,
    call_outcome: x.call_outcome,
    call_reply: x.call_reply ?? null,
    call_summary: x.call_summary ?? null,
    call_round: x.call_round ?? null,
    call_mode: x.call_mode,
    staff_call_outcome: x.staff_call_outcome ?? null,
    staff_called_at: x.staff_called_at ?? null,
  }));

  it('ช่องของทุกสาย = แผงขั้นตอนของสาย · AI/คน = ตัวกรองใครโทร', async () => {
    const { categorizeFollowRows } = await import('../../api/_lib/followCategory');
    const { followMatrixColOfCategory } = await import('../../src/lib/followCallMatrix');
    const derived = categorizeFollowRows(RAW, NOW);
    const m = buildFollowCallMatrix(withFollowDayCalls(ENTRIES.map((x) => ({ ...x, call_status: x.cancelled ? 'cancelled' : x.call_status }))), NOW);
    const count = { went: 0, notWent: 0, noAnswer: 0, unclear: 0, waiting: 0, cancelled: 0 };
    for (const d of derived.values()) count[followMatrixColOfCategory(d.category)] += 1;
    expect(derived.size).toBe(m.all.total.length);
    for (const k of Object.keys(count) as (keyof typeof count)[]) expect(count[k], k).toBe(m.all[k].length);
    const manual = [...derived.values()].filter((d) => d.caller === 'manual').length;
    expect(manual).toBe(m.all.total.filter((x) => followCallerOf(x) === 'manual').length);
  });

  it('แผงผลโทรของหน้าหลัก: ทุกช่องรวมกัน = ทั้งหมด · สองแท็บรวมกัน = ทั้งหมด', async () => {
    const { followResultRows, emptyFollowResultsSplit } = await import('../../src/lib/homeCallResults');
    const split = emptyFollowResultsSplit();
    split.main.ai.went = 145;
    split.main.staff.went = 32;
    split.main.ai.cancelled = 10;
    split.replacement.ai.noAnswer = 3;
    split.replacement.staff.waiting = 12;
    const t = followResultRows(split);
    expect(t.total).toBe(202);
    expect(t.byTeam.main + t.byTeam.replacement).toBe(t.total);
    expect(t.rows.reduce((s, r) => s + r.total, 0)).toBe(t.total);
    for (const r of t.rows) {
      expect(r.main + r.replacement, r.key).toBe(r.total);
      expect(r.ai + r.staff, r.key).toBe(r.total);
    }
    expect(t.rows.reduce((s, r) => s + r.pct, 0)).toBe(100);
    expect(t.byCaller.ai + t.byCaller.staff).toBe(t.total);
    // แท็บแยก (7 ต.ค. 2569 ตาราง รวม/AI/คนโทร): สองแท็บรวมกัน = รวม ทุกแถวทุกคอลัมน์
    const main = followResultRows(split, 'main');
    const rep = followResultRows(split, 'replacement');
    expect(main.total).toBe(187);
    expect(main.byCaller).toEqual({ ai: 155, staff: 32 });
    expect(rep.total).toBe(15);
    for (const [i, r] of t.rows.entries()) {
      expect(main.rows[i].ai + rep.rows[i].ai, r.key).toBe(r.ai);
      expect(main.rows[i].staff + rep.rows[i].staff, r.key).toBe(r.staff);
    }
    for (const x of [main, rep]) {
      for (const r of x.rows) expect(r.ai + r.staff, r.key).toBe(r.total);
      expect(x.rows.reduce((s, r) => s + r.total, 0)).toBe(x.total);
    }
  });

  it('ต้นทางเดียว: Dashboard + หน้าหลักเรียก categorizeFollowRows · หน้าหลักใช้ช่วงเดียวกับกล่องทั้งหมด', async () => {
    const { readFileSync } = await import('node:fs');
    const dash = readFileSync('api/_handlers/dashboard-trends.ts', 'utf8');
    const home = readFileSync('api/_handlers/home-ai-share.ts', 'utf8');
    expect(dash).toContain('categorizeFollowRows(rows)');
    expect(dash).not.toMatch(/callCategory\(/);
    expect(home).toContain('categorizeFollowRows(rows)');
    expect(home).toContain('loadFollowResultsSplit(followPlanParams(win, bu))');
  });

  it('กราฟหน้าหลัก: แบ่งแท่งเป็นตัวเลือกเดียว (ใครโทร · BU · ทีม) ไม่มีสวิตช์สองตัวแล้ว', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('src/components/home-ai-share/AiShareDetail.tsx', 'utf8');
    expect(src).not.toContain('<Switch');
    expect(src).toContain('aria-label="แบ่งแท่งตาม"');
    for (const v of ['caller', 'bu', 'team']) expect(src).toMatch(new RegExp(`<TabsTrigger value="${v}"`));
  });
});

describe('คนที่จบแล้วของวัน (7 ต.ค. 2569 Journey ข้อ 5 · Choice "เหลือแค่ที่ยังไม่จบ")', () => {
  const call = (category: string, over: Partial<FollowEntry> = {}) => ({ round: { entry: e(over) }, category }) as never;
  it('🔴 ไม่ไป > ไป > ยกเลิกหมด · คนปิดครบ (ลา/เลื่อน) = สรุปไม่ได้ที่จบแล้ว · สรุปไม่ได้/ไม่รับสาย/รอโทร ที่ยังไม่มีใครปิด = อยู่ในตาราง', async () => {
    const { followDayPersonDone } = await import('../../src/lib/followPlanning');
    // 🔴 8 ต.ค. 2569: สายแรกตอบแล้วแต่สายของวันนั้นยังไม่มีผล = ยังไม่จบ (สาย 2 ของคนโทรต้องโทรต่อได้)
    expect(followDayPersonDone({ calls: [call('agreed'), call('waiting')] })).toBeNull();
    expect(followDayPersonDone({ calls: [call('agreed'), call('overdue')] })).toBeNull();
    expect(followDayPersonDone({ calls: [call('lost'), call('notSent')] })).toBeNull();
    expect(followDayPersonDone({ calls: [call('agreed'), call('unreachable')] })).toBe('agreed');
    expect(followDayPersonDone({ calls: [call('agreed'), call('lost')] })).toBe('lost');
    expect(followDayPersonDone({ calls: [call('cancelled', { cancelled: true }), call('cancelled', { cancelled: true })] })).toBe('cancelled');
    expect(followDayPersonDone({ calls: [call('other', { completed_at: '2026-10-06T03:00:00Z', outcome_code: 'leave' })] })).toBe('other');
    expect(followDayPersonDone({ calls: [call('other')] })).toBeNull();
    expect(followDayPersonDone({ calls: [call('unreachable'), call('waiting')] })).toBeNull();
    expect(followDayPersonDone({ calls: [call('cancelled', { cancelled: true }), call('overdue')] })).toBeNull();
    expect(followDayPersonDone({ calls: [] })).toBeNull();
  });
});

describe('API "ติดตามครั้งที่" (137)', () => {
  it('รับ 1–99 · 1 = ไม่เก็บ · นอกช่วง = แจ้งผิด', async () => {
    const { parseFollowInput } = await import('../../api/_handlers/follow');
    const base = { recipient_name: 'ทดสอบ ระบบ', recipient_phone: '0812345678', topic: 'ติดตามเริ่มงาน', scheduled_at: '2026-12-01T02:00:00Z' };
    const now = new Date('2026-10-06T00:00:00Z');
    expect(parseFollowInput({ ...base, plan_day_start: 3 }, now).value?.planDayStart).toBe(3);
    expect(parseFollowInput({ ...base, plan_day_start: 1 }, now).value?.planDayStart).toBeNull();
    expect(parseFollowInput(base, now).value?.planDayStart).toBeNull();
    expect(parseFollowInput({ ...base, plan_day_start: 0 }, now).error).toContain('plan_day_start');
    expect(parseFollowInput({ ...base, plan_day_start: 120 }, now).error).toContain('plan_day_start');
  });
});
