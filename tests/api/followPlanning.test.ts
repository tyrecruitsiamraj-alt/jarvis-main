import { describe, it, expect } from 'vitest';
import type { FollowEntry } from '../../src/lib/followApi';
import { groupFollowEntries } from '../../src/lib/followGrouping';
import {
  buildFollowMonthRows,
  buildFollowPlanningRows,
  monthDayColumns,
  followRoundState,
  isRoundOpen,
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

  it('ยังไม่ถึงเวลา + ไม่เคยเข้าคิว = ยังไม่ถึงเวลา', () => {
    expect(followRoundState(entry({ scheduled_at: '2026-09-01T09:00:00Z', call_status: null }), NOW)).toBe(
      'waiting',
    );
  });

  it('ไม่มีเวลานัด — ห้ามเดาว่าเลยเวลา', () => {
    expect(followRoundState(entry({ scheduled_at: null, call_status: null }), NOW)).toBe('waiting');
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

  it('รอบที่ยกเลิกไม่โผล่ในตาราง — คนที่ยกเลิกหมดก็ไม่มีแถว', () => {
    const rows = monthRows(
      [entry({ id: 'm4', scheduled_at: '2026-09-03T02:00:00Z', cancelled: true })],
      '2026-09',
    );
    expect(rows).toHaveLength(0);
  });
});
