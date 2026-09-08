import { describe, it, expect } from 'vitest';
import type { FollowEntry } from '../../src/lib/followApi';
import { groupFollowEntries } from '../../src/lib/followGrouping';
import { FOLLOW_ROUND_BUCKET_LABEL } from '../../src/lib/followRoundBuckets';
import {
  buildFollowMonthRows,
  buildFollowPlanningRows,
  filterPlanningRowsByRound,
  monthDayColumns,
  roundResultLabel,
  roundTone,
  followRoundState,
  isRoundOpen,
  roundAiSummary,
  callCategory,
  FOLLOW_CALL_CATEGORY_TONE,
  buildFollowDayCalls,
  roundSlotsOfDay,
  summarizeFollowCalls,
  personMonthSummary,
  FOLLOW_CALL_CATEGORY_LABEL,
  callVerdict,
} from '../../src/lib/followPlanning';

const NOW = new Date('2026-09-01T05:00:00Z'); // 12:00 น. เวลาไทย

function entry(over: Partial<FollowEntry> = {}): FollowEntry {
  return {
    id: over.id ?? 'e1',
    recipient_name: 'สมชาย ใจดี',
    recipient_phone: '0812345678',
    topic: 'ยืนยันวันเริ่มงาน',
    note: null,
    scheduled_at: '2026-09-01T02:00:00Z',
    created_by_name: 'แอดมิน',
    created_at: '2026-08-30T02:00:00Z',
    cancelled: false,
    call_status: 'pending',
    call_outcome: null,
    call_summary: null,
    next_action: null,
    called_at: null,
    ...over,
  } as FollowEntry;
}

describe('followRoundState — สภาพของรอบต้องต่อสองที่ (เวลานัด + คิวโทร)', () => {
  it('ยกเลิกชนะทุกอย่าง', () => {
    expect(followRoundState(entry({ cancelled: true, call_outcome: 'answered' }), NOW)).toBe('cancelled');
  });

  it('ปิดงานแล้วชนะผลการโทร', () => {
    expect(
      followRoundState(entry({ completed_at: '2026-09-01T03:00:00Z', call_outcome: 'answered' }), NOW),
    ).toBe('closed');
  });

  it('🔴 มีผลกลับแล้ว = ไม่ใช่ "รอโทร" อีกต่อไป แม้ call_status ยังค้าง pending', () => {
    expect(followRoundState(entry({ call_status: 'pending', call_outcome: 'no_answer' }), NOW)).toBe('result');
  });

  it('เลยเวลานัดแล้วยังไม่มีผล = เลยเวลานัด', () => {
    expect(followRoundState(entry({ scheduled_at: '2026-09-01T02:00:00Z' }), NOW)).toBe('overdue');
  });

  it('ยังไม่ถึงเวลา + อยู่ในคิวแล้ว = ส่งแล้วรอผล', () => {
    expect(followRoundState(entry({ scheduled_at: '2026-09-01T09:00:00Z' }), NOW)).toBe('sent');
  });

  it('🔴 ไม่เคยเข้าคิวเลย = "ไม่ได้ส่ง" ไม่ใช่ "รอโทร/เลยเวลา"', () => {
    // เจ้าของถามเอง 1 ก.ย. 2569: *"แล้วทำไมไม่มีผล"* — เพราะสายไม่เคยออก
    // (เบอร์อยู่ในบัญชีห้ามโทร / มีคนจองโทรเอง ฯลฯ) จอต้องบอกตรง ๆ ไม่ใช่ให้นั่งรอ
    expect(followRoundState(entry({ scheduled_at: '2026-09-01T09:00:00Z', call_status: null }), NOW)).toBe(
      'notSent',
    );
    expect(followRoundState(entry({ scheduled_at: '2026-09-01T02:00:00Z', call_status: null }), NOW)).toBe(
      'notSent',
    );
  });

  it('ไม่มีเวลานัดแต่อยู่ในคิวแล้ว — ห้ามเดาว่าเลยเวลา', () => {
    expect(followRoundState(entry({ scheduled_at: null }), NOW)).toBe('sent');
  });

  it('รอบที่ยังต้องตามต่อ = เลยเวลา/ส่งแล้ว/ยังไม่ถึงเวลา', () => {
    expect(isRoundOpen('overdue')).toBe(true);
    expect(isRoundOpen('sent')).toBe(true);
    expect(isRoundOpen('waiting')).toBe(true);
    expect(isRoundOpen('result')).toBe(false);
    expect(isRoundOpen('closed')).toBe(false);
    expect(isRoundOpen('cancelled')).toBe(false);
  });
});

describe('buildFollowPlanningRows', () => {
  const rows = (list: FollowEntry[]) => buildFollowPlanningRows(groupFollowEntries(list, NOW), NOW);

  it('หนึ่งแถวหนึ่งคน · บอกวัน · จำนวนรอบ · เวลาแต่ละรอบ', () => {
    const r = rows([
      entry({ id: 'a1', scheduled_at: '2026-09-01T02:00:00Z' }),
      entry({ id: 'a2', scheduled_at: '2026-09-01T09:00:00Z' }),
      entry({ id: 'a3', scheduled_at: '2026-09-02T02:00:00Z' }),
    ]);
    expect(r).toHaveLength(1);
    expect(r[0].roundCount).toBe(3);
    expect(r[0].days).toEqual(['2026-09-01', '2026-09-02']);
    expect(r[0].rounds.map((x) => x.state)).toEqual(['overdue', 'sent', 'sent']);
    expect(r[0].rounds[0].time).toBeTruthy();
  });

  it('รอบที่ยกเลิกไม่นับเป็นรอบ และไม่ทำให้วันนั้นโผล่', () => {
    const r = rows([
      entry({ id: 'b1', scheduled_at: '2026-09-05T02:00:00Z', cancelled: true }),
      entry({ id: 'b2', scheduled_at: '2026-09-06T02:00:00Z' }),
    ]);
    expect(r[0].roundCount).toBe(1);
    expect(r[0].days).toEqual(['2026-09-06']);
  });

  it('🔴 คนที่ต้องโทรก่อนอยู่บนสุด — ของค้าง (เลยเวลา) ลอยขึ้นเหนือนัดล่วงหน้า', () => {
    const r = rows([
      entry({ id: 'c1', recipient_phone: '0800000001', scheduled_at: '2026-09-03T02:00:00Z' }),
      entry({ id: 'c2', recipient_phone: '0800000002', scheduled_at: '2026-09-01T01:00:00Z' }),
      entry({ id: 'c3', recipient_phone: '0800000003', scheduled_at: '2026-09-01T09:00:00Z' }),
    ]);
    expect(r.map((x) => x.group.phone)).toEqual(['0800000002', '0800000003', '0800000001']);
  });

  it('คนที่ไม่เหลือรอบต้องตามแล้วไปอยู่ท้ายสุด', () => {
    const r = rows([
      entry({
        id: 'd1',
        recipient_phone: '0800000001',
        scheduled_at: '2026-09-01T02:00:00Z',
        call_outcome: 'answered',
      }),
      entry({ id: 'd2', recipient_phone: '0800000002', scheduled_at: '2026-09-04T02:00:00Z' }),
    ]);
    expect(r.map((x) => x.group.phone)).toEqual(['0800000002', '0800000001']);
    expect(r[1].openCount).toBe(0);
    expect(r[1].dueAtMs).toBeNull();
  });
});

describe('ตาราง Planning แบบชื่ออยู่ซ้าย (เจ้าของสั่ง: "เอาชื่อคนไปไว้ด้านซ้าย")', () => {
  const monthRows = (list: FollowEntry[], month: string) =>
    buildFollowMonthRows(buildFollowPlanningRows(groupFollowEntries(list, NOW), NOW), month);

  it('คอลัมน์ = ทุกวันของเดือน พร้อมตัวย่อวันไทยและธงวันอาทิตย์', () => {
    const cols = monthDayColumns('2026-09');
    expect(cols).toHaveLength(30);
    expect(cols[0]).toEqual({ ymd: '2026-09-01', day: 1, weekday: 'อ', isSunday: false });
    expect(cols.filter((c) => c.isSunday).map((c) => c.day)).toEqual([6, 13, 20, 27]);
    expect(monthDayColumns('พัง')).toEqual([]);
  });

  it('แถว = คนที่มีนัดในเดือนนั้นเท่านั้น · ช่องเก็บรอบของวันนั้นเรียงตามเวลา', () => {
    const rows = monthRows(
      [
        entry({ id: 'm1', recipient_phone: '0800000001', scheduled_at: '2026-09-01T09:00:00Z' }),
        entry({ id: 'm2', recipient_phone: '0800000001', scheduled_at: '2026-09-01T02:00:00Z' }),
        entry({ id: 'm3', recipient_phone: '0800000002', scheduled_at: '2026-08-20T02:00:00Z' }),
      ],
      '2026-09',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].row.group.phone).toBe('0800000001');
    const cell = rows[0].byDay.get('2026-09-01');
    expect(cell?.map((r) => r.time)).toEqual(['09:00', '16:00']);
  });

  it('🔴 รอบที่ยกเลิกต้องยังอยู่ในตาราง — Lumos โชว์ว่ายกเลิก จอเราต้องโชว์ด้วย', () => {
    // เจ้าของทัก 1 ก.ย. 2569: *"ในระบบ Lumos บอกยกเลิก งี้จะเชื่อนายได้ไง"*
    // สายที่ถูกยกเลิกเคยหายจากปฏิทินเงียบ ๆ ⇒ สองระบบเล่าคนละเรื่อง
    const rows = monthRows(
      [entry({ id: 'm4', scheduled_at: '2026-09-03T02:00:00Z', cancelled: true })],
      '2026-09',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].byDay.get('2026-09-03')?.[0].state).toBe('cancelled');
    // แต่ยังไม่นับเป็น "รอบที่ต้องตาม" — เลขสรุปต้องไม่โป่งด้วยสายที่ตายแล้ว
    expect(rows[0].row.roundCount).toBe(0);
  });

  it('วันเดียวมีทั้งสายที่ยกเลิกและสายที่ได้ผล — ต้องเห็นทั้งคู่ (เคสนายวิศิษฐ์ 1 ก.ย. 2569)', () => {
    const rows = monthRows(
      [
        entry({ id: 'v1', scheduled_at: '2026-09-01T04:00:00Z', cancelled: true }),
        entry({ id: 'v2', scheduled_at: '2026-09-01T04:00:00Z', call_outcome: 'acknowledged' }),
        entry({ id: 'v3', scheduled_at: '2026-09-01T04:15:00Z', call_outcome: 'declined' }),
      ],
      '2026-09',
    );
    const day = rows[0].byDay.get('2026-09-01');
    expect(day?.map((r) => r.state).sort()).toEqual(['cancelled', 'result', 'result']);
  });
});

describe('roundResultLabel — ช่องปฏิทินต้องบอกผลด้วย ไม่ใช่มีแต่เวลา', () => {
  // เจ้าของทัก 1 ก.ย. 2569: *"ทำไมไม่มีบอกผลด้วยเลยอะว่าผลเป็นยังไง"*
  const label = (over: Partial<FollowEntry>) => {
    const rows = buildFollowPlanningRows(groupFollowEntries([entry(over)], NOW), NOW);
    return roundResultLabel(rows[0].rounds[0]);
  };

  it('ผลการโทรเป็นคำไทย (ชุดคำของงานติดตาม — ดู describe ท้ายไฟล์)', () => {
    expect(label({ call_outcome: 'acknowledged' })).toBe('รับสายแล้ว');
    expect(label({ call_outcome: 'declined' })).toBe('ยกเลิก — ไม่ไปแล้ว');
    expect(label({ call_outcome: 'wrong_person' })).toBe('เบอร์ผิด');
  });

  it('ปิดงานแล้วโชว์คำปิดงาน · ยกเลิกโชว์ว่ายกเลิก', () => {
    expect(label({ completed_at: '2026-09-01T03:00:00Z', outcome_code: 'went' })).toBe('ไปแล้ว');
    expect(label({ cancelled: true })).toBe('ยกเลิก');
  });

  it('🔴 ยังไม่มีผลต้องเขียนว่าอะไร — แยก "ยังไม่มีผล" กับ "ไม่ได้ส่ง" ออกจากกัน', () => {
    expect(label({ scheduled_at: '2026-09-01T02:00:00Z' })).toBe('ยังไม่มีผล');
    expect(label({ scheduled_at: '2026-09-01T09:00:00Z' })).toBe('รอผล');
    expect(label({ scheduled_at: '2026-09-01T09:00:00Z', call_status: null })).toBe('ไม่ได้ส่ง');
  });

  it('รหัสผลที่ไม่มีคำแปล = โชว์รหัสไปตามตรง ห้ามซ่อน', () => {
    expect(label({ call_outcome: 'weird_code' })).toBe('weird_code');
  });
});

describe('คำผลโทรฉบับงานติดตาม (เจ้าของทัก 1 ก.ย. 2569)', () => {
  // *"ระบบเขาบอกยกเลิก ทำไมระบบเราไม่บอกยกเลิกด้วย"* — เคสนายวิศิษฐ์:
  // Lumos สรุป declined + "ผู้รับสายแจ้งว่าไม่ไปทำงานแล้ว" แต่จอเราเขียนว่า "ไม่สนใจ"
  const label = (over: Partial<FollowEntry>) => {
    const rows = buildFollowPlanningRows(groupFollowEntries([entry(over)], NOW), NOW);
    return roundResultLabel(rows[0].rounds[0]);
  };

  it('🔴 declined ในงานติดตาม = ยกเลิก ไม่ใช่ "ไม่สนใจ" (คำของงานหาคน)', () => {
    expect(label({ call_outcome: 'declined' })).toBe('ยกเลิก — ไม่ไปแล้ว');
  });

  it('confirmed = ยืนยันว่าไป · acknowledged = รับสายแล้ว (ไม่เขียนให้ดูจบดีเกินจริง)', () => {
    expect(label({ call_outcome: 'confirmed' })).toBe('ยืนยันว่าไป');
    expect(label({ call_outcome: 'acknowledged' })).toBe('รับสายแล้ว');
  });

  it('คำที่ไม่ได้ทับ ใช้ของตารางกลางเหมือนเดิม', () => {
    expect(label({ call_outcome: 'wrong_person' })).toBe('เบอร์ผิด');
    expect(label({ call_outcome: 'no_answer' })).toBe('ไม่รับสาย');
  });
});

describe('สีของรอบ — ต้องแปลว่า "ดี/ร้าย" ไม่ใช่ "มีผลหรือยัง"', () => {
  // เจ้าของทัก 1 ก.ย. 2569: *"ไม่ไปแล้วแต่เป็นเขียวเนี่ยนะ · ไม่มีผลเป็นสีแดงเพราะอะไร"*
  const tone = (over: Partial<FollowEntry>) => {
    const rows = buildFollowPlanningRows(groupFollowEntries([entry(over)], NOW), NOW);
    return roundTone(rows[0].rounds[0]);
  };

  it('🔴 ไม่ไปแล้ว = แดง ไม่ใช่เขียว', () => {
    expect(tone({ call_outcome: 'declined' })).toBe('danger');
  });

  it('🔴 เลยเวลายังไม่มีผล = เหลือง (ยังไม่จบ) ไม่ใช่แดง', () => {
    expect(tone({ scheduled_at: '2026-09-01T02:00:00Z' })).toBe('warn');
  });

  it('ยืนยันว่าไป/ปิดงานว่าไปแล้ว = เขียว', () => {
    expect(tone({ call_outcome: 'confirmed' })).toBe('success');
    expect(tone({ completed_at: '2026-09-01T03:00:00Z', outcome_code: 'went' })).toBe('success');
  });

  it('ปิดงานว่ายกเลิก = แดง · ลา/เลื่อน = เหลือง', () => {
    expect(tone({ completed_at: '2026-09-01T03:00:00Z', outcome_code: 'cancelled' })).toBe('danger');
    expect(tone({ completed_at: '2026-09-01T03:00:00Z', outcome_code: 'postponed' })).toBe('warn');
  });

  it('ไม่ได้ส่งให้ AI = ส้ม (ต้องคนจัดการ) · ยกเลิกทิ้ง = เทา', () => {
    expect(tone({ call_status: null })).toBe('orange');
    expect(tone({ cancelled: true })).toBe('neutral');
  });
});

describe('เลือก "การโทรครั้งที่ N" — ต้องกรองทั้งแถวและช่อง', () => {
  // เจ้าของทัก 1 ก.ย. 2569: *"เลือกการโทรครั้งที่เท่าไหร่ ก็โชว์ข้อมูลของรอบนั้น ๆ พอสิ"*
  const rows = () =>
    buildFollowPlanningRows(
      groupFollowEntries(
        [
          entry({ id: 'r1', call_attempt: 1, call_outcome: 'no_answer' }),
          entry({ id: 'r2', call_attempt: 2, call_outcome: 'acknowledged' }),
          entry({ id: 'r3', recipient_phone: '0899999999', call_attempt: 2, call_outcome: 'declined' }),
        ],
        NOW,
      ),
      NOW,
    );

  it('ครั้งที่ 1 เหลือเฉพาะสายของครั้งที่ 1 — สายครั้งที่ 2 ของคนเดียวกันต้องไม่ปน', () => {
    const out = filterPlanningRowsByRound(rows(), 1);
    expect(out).toHaveLength(1);
    expect(out[0].rounds.map((r) => r.entry.id)).toEqual(['r1']);
  });

  it('ครั้งที่ 2 ได้สองคน คนละหนึ่งสาย', () => {
    const out = filterPlanningRowsByRound(rows(), 2);
    expect(out).toHaveLength(2);
    expect(out.flatMap((r) => r.rounds.map((x) => x.entry.id)).sort()).toEqual(['r2', 'r3']);
  });

  it('เลขสรุปของแถวคิดใหม่จากสายที่เหลือ ไม่ใช่ยกของเดิมมา', () => {
    const out = filterPlanningRowsByRound(rows(), 1);
    expect(out[0].roundCount).toBe(1);
    expect(out[0].days).toHaveLength(1);
  });

  it('ครั้งที่ไม่มีใครอยู่ = ไม่มีแถว', () => {
    expect(filterPlanningRowsByRound(rows(), 3)).toHaveLength(0);
  });
});

describe('🔴 สายที่คนเลือกไว้ชนะ attempt_count (เจ้าของทัก 1 ก.ย. 2569)', () => {
  // *"ปฏิทินติดตามต้องโชว์ช่องละ 1 สายสิ เช่นรอบแรกโทรตอน 16:30 ก็โชว์แค่นั้น"*
  // เหตุ: หนึ่งรอบ = หนึ่งแถว = หนึ่งคิว ⇒ attempt_count เป็น 1 หมดทุกแถว
  const twoRounds = () =>
    buildFollowPlanningRows(
      groupFollowEntries(
        [
          entry({ id: 'a', call_round: 1, call_attempt: 1, scheduled_at: '2026-09-01T09:30:00Z' }),
          entry({ id: 'b', call_round: 2, call_attempt: 1, scheduled_at: '2026-09-01T09:40:00Z' }),
        ] as FollowEntry[],
        NOW,
      ),
      NOW,
    );

  it('เลือกครั้งที่ 1 ได้สายเดียว ไม่ใช่ทั้งสองสาย', () => {
    const out = filterPlanningRowsByRound(twoRounds(), 1);
    expect(out).toHaveLength(1);
    expect(out[0].rounds.map((r) => r.entry.id)).toEqual(['a']);
  });

  it('เลือกครั้งที่ 2 ได้อีกสายหนึ่ง', () => {
    const out = filterPlanningRowsByRound(twoRounds(), 2);
    expect(out[0].rounds.map((r) => r.entry.id)).toEqual(['b']);
  });
});

/**
 * 🔴 เจ้าของสั่ง 7 ก.ย. 2569
 * *"เวลาได้ผลจาก Lumos ถ้าตกลงไปให้ขึ้นสีเขียว และบอกว่าเขาตอบว่าอะไร
 *   ... และเอาสรุปผลโดย AI มาด้วย"*
 * *"ถ้าเพิ่มไว้ 2 สาย ช่วยเอาผลมาทั้ง 2 สาย ตอนนี้ต้องรอสายที่ 2 ถึงจะรายงานผลมา"*
 */
describe('ผลการโทรทุกสาย + สรุปจาก AI', () => {
  it('ตกลงไป (confirmed) = เขียว และคำบนจอต้องบอกว่าเขาตอบว่าอะไร', () => {
    const r = buildFollowPlanningRows(
      groupFollowEntries([entry({ call_status: 'completed', call_outcome: 'confirmed' })], NOW),
      NOW,
    )[0].rounds[0];
    expect(roundTone(r)).toBe('success');
    expect(roundResultLabel(r)).toBe('ยืนยันว่าไป');
  });

  it('ไม่ไปแล้ว (declined) = แดง ห้ามเขียวเพราะแค่ "มีผลแล้ว"', () => {
    const r = buildFollowPlanningRows(
      groupFollowEntries([entry({ call_status: 'completed', call_outcome: 'declined' })], NOW),
      NOW,
    )[0].rounds[0];
    expect(roundTone(r)).toBe('danger');
    expect(roundResultLabel(r)).toBe('ยกเลิก — ไม่ไปแล้ว');
  });

  it('roundAiSummary คืนสรุปที่ AI เขียน · ว่าง/ช่องว่างล้วน = null (ห้ามขึ้นกล่องเปล่า)', () => {
    const withSummary = buildFollowPlanningRows(
      groupFollowEntries(
        [entry({ call_status: 'completed', call_outcome: 'confirmed', call_summary: 'ผู้รับสายยืนยันว่าจะไปเริ่มงานวันจันทร์' })],
        NOW,
      ),
      NOW,
    )[0].rounds[0];
    expect(roundAiSummary(withSummary)).toBe('ผู้รับสายยืนยันว่าจะไปเริ่มงานวันจันทร์');

    const blank = buildFollowPlanningRows(
      groupFollowEntries([entry({ call_status: 'completed', call_outcome: 'confirmed', call_summary: '   ' })], NOW),
      NOW,
    )[0].rounds[0];
    expect(roundAiSummary(blank)).toBeNull();
  });

  it('🔴 สายที่ 1 ได้ผลแล้วต้องอ่านได้ทันที ไม่ต้องรอสายที่ 2', () => {
    const row = buildFollowPlanningRows(
      groupFollowEntries(
        [
          entry({
            id: 'r1',
            call_round: 1,
            scheduled_at: '2026-09-01T02:00:00Z',
            call_status: 'completed',
            call_outcome: 'confirmed',
            call_summary: 'ตอบว่าไปแน่นอน',
          }),
          entry({
            id: 'r2',
            call_round: 2,
            scheduled_at: '2026-09-01T04:00:00Z',
            call_status: 'pending',
            call_outcome: null,
          }),
        ],
        NOW,
      ),
      NOW,
    )[0];

    // ทั้งสองสายอยู่ในแถวเดียวกัน เรียงตามเวลานัด
    expect(row.rounds).toHaveLength(2);
    expect(roundTone(row.rounds[0])).toBe('success');
    expect(roundAiSummary(row.rounds[0])).toBe('ตอบว่าไปแน่นอน');
    // สายที่ 2 ยังไม่มีผล — ต้องไม่ลบผลของสายที่ 1 ทิ้ง และต้องไม่แต่งสรุปให้
    expect(roundAiSummary(row.rounds[1])).toBeNull();
    expect(roundTone(row.rounds[1])).not.toBe('success');
  });
});

/**
 * ═══ ปฏิทินสองหน้า ฉบับที่ 2 (เจ้าของสั่ง 7 ก.ย. 2569) — หมวดผลชุดเดียวใช้ทั้งสองหน้า ═══
 * *"เขียวคือตกลง เหลืองติดต่อไม่ได้ แดงคือไม่ไป"* · *"ทั้งเดือนติดตามกี่ครั้ง วันไหนไป วันไหนไม่ไป"*
 */
describe('callCategory — หมวดผลของสาย', () => {
  const cat = (over: Partial<FollowEntry>) =>
    callCategory(buildFollowPlanningRows(groupFollowEntries([entry(over)], NOW), NOW)[0].rounds[0]);

  it('ตกลง: confirmed/acknowledged และปิดงานว่าไป', () => {
    expect(cat({ call_status: 'completed', call_outcome: 'confirmed' })).toBe('agreed');
    expect(cat({ call_status: 'completed', call_outcome: 'acknowledged' })).toBe('agreed');
    expect(cat({ completed_at: '2026-09-01T03:00:00Z', outcome_code: 'went' })).toBe('agreed');
  });

  it('ไม่ไป: declined และปิดงานว่าไม่ไป/ยกเลิก', () => {
    expect(cat({ call_status: 'completed', call_outcome: 'declined' })).toBe('lost');
    expect(cat({ completed_at: '2026-09-01T03:00:00Z', outcome_code: 'cancelled' })).toBe('lost');
  });

  it('ติดต่อไม่ได้: ไม่รับ/ไม่ว่าง/ไม่ตอบ/โทรไม่สำเร็จ/เบอร์ผิด — เป็นสีเหลืองทั้งชุด', () => {
    for (const o of ['no_answer', 'busy', 'unresponsive', 'failed', 'wrong_person'] as const) {
      expect(cat({ call_status: 'completed', call_outcome: o })).toBe('unreachable');
    }
  });

  it('🔴 เลยเวลายังไม่มีผล ≠ ติดต่อไม่ได้ — คนละงานที่ต้องทำต่อ', () => {
    // นัด 09:00 · NOW = 12:00 · ยังไม่มีผล · อยู่ในคิว
    expect(cat({ scheduled_at: '2026-09-01T02:00:00Z', call_status: 'pending' })).toBe('overdue');
    // ยังไม่ถึงเวลา
    expect(cat({ scheduled_at: '2026-09-01T09:00:00Z', call_status: 'pending' })).toBe('waiting');
    // ไม่เคยเข้าคิว
    expect(cat({ scheduled_at: '2026-09-01T09:00:00Z', call_status: null })).toBe('notSent');
  });

  it('สีของหมวดต้องเท่ากับสีของชิป (roundTone) เสมอ — ไม่งั้นเลขกับสีคนละเรื่อง', () => {
    const cases: Array<Partial<FollowEntry>> = [
      { call_status: 'completed', call_outcome: 'confirmed' },
      { call_status: 'completed', call_outcome: 'declined' },
      { call_status: 'completed', call_outcome: 'no_answer' },
      { scheduled_at: '2026-09-01T02:00:00Z', call_status: 'pending' },
      { scheduled_at: '2026-09-01T09:00:00Z', call_status: 'pending' },
      { scheduled_at: '2026-09-01T09:00:00Z', call_status: null },
      { cancelled: true },
    ];
    for (const c of cases) {
      const r = buildFollowPlanningRows(groupFollowEntries([entry(c)], NOW), NOW)[0].rounds[0];
      expect(FOLLOW_CALL_CATEGORY_TONE[callCategory(r)]).toBe(roundTone(r));
    }
  });
});

describe('หน้ารายวัน — buildFollowDayCalls / summarizeFollowCalls', () => {
  const rows = () =>
    buildFollowPlanningRows(
      groupFollowEntries(
        [
          // สมชาย: สาย 1 ตกลง · สาย 2 รอผล (วันเดียวกัน)
          entry({ id: 'a1', call_round: 1, scheduled_at: '2026-09-01T01:00:00Z', call_status: 'completed', call_outcome: 'confirmed', call_summary: 'ไปแน่' }),
          entry({ id: 'a2', call_round: 2, scheduled_at: '2026-09-01T08:00:00Z' }),
          // สมหญิง: สาย 1 ไม่ไป
          entry({ id: 'b1', recipient_name: 'สมหญิง', recipient_phone: '0899999999', call_round: 1, scheduled_at: '2026-09-01T00:30:00Z', call_status: 'completed', call_outcome: 'declined' }),
          // คนละวัน — ต้องไม่โผล่
          entry({ id: 'c1', recipient_name: 'คนพรุ่งนี้', recipient_phone: '0877777777', call_round: 1, scheduled_at: '2026-09-02T01:00:00Z' }),
          // ยกเลิก — โชว์แต่ไม่นับเป็น "ต้องตาม"
          entry({ id: 'd1', recipient_name: 'คนยกเลิก', recipient_phone: '0866666666', call_round: 1, scheduled_at: '2026-09-01T03:00:00Z', cancelled: true }),
        ],
        NOW,
      ),
      NOW,
    );

  it('หนึ่งแถว = หนึ่งสาย เรียงตามเวลา เฉพาะวันนั้น (รวมที่ยกเลิก)', () => {
    const calls = buildFollowDayCalls(rows(), '2026-09-01');
    expect(calls.map((c) => c.round.entry.id)).toEqual(['b1', 'a1', 'd1', 'a2']);
    expect(calls.every((c) => c.round.ymd === '2026-09-01')).toBe(true);
  });

  it('🔴 กรอง "สายที่ 1" แล้วต้องไม่มีสายที่ 2 ปน — และกลับกัน', () => {
    expect(buildFollowDayCalls(rows(), '2026-09-01', 1).map((c) => c.round.entry.id)).toEqual(['b1', 'a1', 'd1']);
    expect(buildFollowDayCalls(rows(), '2026-09-01', 2).map((c) => c.round.entry.id)).toEqual(['a2']);
    expect(roundSlotsOfDay(rows(), '2026-09-01')).toEqual([1, 2]);
  });

  it('หัวสรุป: ต้องตามไม่นับที่ยกเลิก · แยกตกลง/ไม่ไป/รอผล', () => {
    const s = summarizeFollowCalls(buildFollowDayCalls(rows(), '2026-09-01').map((c) => c.round));
    expect(s.total).toBe(3); // a1 a2 b1 (d1 ยกเลิก)
    expect(s.agreed).toBe(1);
    expect(s.lost).toBe(1);
    expect(s.waiting).toBe(1);
    expect(s.cancelled).toBe(1);
  });

  it('สรุปรายคนทั้งเดือน (หน้ารายเดือน) — นับเฉพาะสายในเดือนนั้น', () => {
    const somchai = rows().find((r) => r.group.name === 'สมชาย ใจดี')!;
    const s = personMonthSummary(somchai, '2026-09');
    expect(s.total).toBe(2);
    expect(s.agreed).toBe(1);
    expect(personMonthSummary(somchai, '2026-10').total).toBe(0);
  });
});

describe('buildFollowDayCalls — "ไม่ไป" ขึ้นบนสุดก่อนเวลา (เจ้าของสั่ง 8 ก.ย. 2569)', () => {
  it('lost มาก่อนทุกหมวด แล้วในหมวดเดียวกันค่อยเรียงเวลา', () => {
    const rows = buildFollowPlanningRows(
      groupFollowEntries(
        [
          entry({ id: 'ok', recipient_phone: '0800000001', scheduled_at: '2026-09-01T01:00:00Z', call_status: 'completed', call_outcome: 'confirmed' }),
          entry({ id: 'lost-late', recipient_phone: '0800000002', scheduled_at: '2026-09-01T08:00:00Z', call_status: 'completed', call_outcome: 'declined' }),
          entry({ id: 'lost-early', recipient_phone: '0800000003', scheduled_at: '2026-09-01T02:00:00Z', call_status: 'completed', call_outcome: 'declined' }),
          entry({ id: 'wait', recipient_phone: '0800000004', scheduled_at: '2026-09-01T00:30:00Z' }),
        ],
        NOW,
      ),
      NOW,
    );
    expect(buildFollowDayCalls(rows, '2026-09-01').map((c) => c.round.entry.id)).toEqual([
      'lost-early',
      'lost-late',
      'wait',
      'ok',
    ]);
  });
});

/**
 * 🔴 **ด่านกันจอพูดสองภาษา** (แก้ 8 ก.ย. 2569)
 * ผู้ทดสอบตาใหม่ถามว่า *"โทรไม่ติด กับ ติดต่อไม่ได้ คือเรื่องเดียวกันไหม"* เพราะการ์ดปฏิทิน
 * เคยประดิษฐ์ศัพท์ชุดที่สาม ทั้งที่แผง "การโทรของงาน Follow" ข้างบนมีคำอยู่แล้ว
 */
describe('คำของการ์ดปฏิทินต้องยืมจากแผงข้างบน ไม่ประดิษฐ์ใหม่', () => {
  it('ไป / ไม่ไป / โทรไม่ติด / รอโทร ต้องเป็นคำเดียวกับ FOLLOW_ROUND_BUCKET_LABEL เป๊ะ', () => {
    expect(FOLLOW_CALL_CATEGORY_LABEL.agreed).toBe(FOLLOW_ROUND_BUCKET_LABEL.went);
    expect(FOLLOW_CALL_CATEGORY_LABEL.lost).toBe(FOLLOW_ROUND_BUCKET_LABEL.not_went);
    expect(FOLLOW_CALL_CATEGORY_LABEL.unreachable).toBe(FOLLOW_ROUND_BUCKET_LABEL.unreached);
    expect(FOLLOW_CALL_CATEGORY_LABEL.waiting).toBe(FOLLOW_ROUND_BUCKET_LABEL.waiting);
  });

  it('ห้ามใช้คำที่เคยทำให้สับสนกลับมาอีก', () => {
    const banned = ['ติดต่อไม่ได้', 'ตกลง · ไป', 'รอผล'];
    for (const word of Object.values(FOLLOW_CALL_CATEGORY_LABEL)) {
      expect(banned, `"${word}" เคยทำให้ผู้ใช้งงมาแล้ว`).not.toContain(word);
    }
  });
});

describe('callVerdict / summarize — สามคำตอบบนหัวหน้ารายวัน', () => {
  const sum = (list: Partial<FollowEntry>[]) =>
    summarizeFollowCalls(
      buildFollowPlanningRows(
        groupFollowEntries(
          list.map((o, i) => entry({ id: `v${i}`, recipient_phone: `08000000${i}`, ...o })),
          NOW,
        ),
        NOW,
      ).flatMap((r) => r.rounds),
    );

  it('ไป = agreed · ไม่ไป = lost · ที่เหลือทั้งหมด = ยังไม่รู้ผล · ยกเลิกไม่นับ', () => {
    const s = sum([
      { call_status: 'completed', call_outcome: 'confirmed' }, // ไป
      { call_status: 'completed', call_outcome: 'acknowledged' }, // ไป
      { call_status: 'completed', call_outcome: 'declined' }, // ไม่ไป
      { call_status: 'completed', call_outcome: 'no_answer' }, // โทรไม่ติด → ยังไม่รู้ผล
      { scheduled_at: '2026-09-01T02:00:00Z' }, // เลยเวลานัด → ยังไม่รู้ผล
      { scheduled_at: '2026-09-01T09:00:00Z', call_status: null }, // ไม่ได้ส่ง → ยังไม่รู้ผล
      { cancelled: true }, // ยกเลิก → ไม่นับเลย
    ]);
    expect(s.went).toBe(2);
    expect(s.notWent).toBe(1);
    expect(s.unknown).toBe(3);
    expect(s.total).toBe(6);
    expect(s.went + s.notWent + s.unknown).toBe(s.total);
  });

  it('callVerdict คืน null เฉพาะที่ยกเลิก (ไม่ใช่สายที่ต้องตาม)', () => {
    expect(callVerdict('cancelled')).toBeNull();
    expect(callVerdict('agreed')).toBe('went');
    expect(callVerdict('lost')).toBe('notWent');
    for (const c of ['unreachable', 'waiting', 'overdue', 'notSent', 'other'] as const) {
      expect(callVerdict(c)).toBe('unknown');
    }
  });
});
