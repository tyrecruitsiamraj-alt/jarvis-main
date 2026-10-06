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
      expect(words.has(head), r.result).toBe(true);
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
