/**
 * สรุปแผนติดตามทั้งวัน (เจ้าของสั่ง 2 ต.ค. 2569 · Choice "หน้าสรุปบนจอ")
 * 🔴 ด่าน: เฉพาะวันนั้น เรียงตามเวลา · ป้ายสาย "วันที่ D · สายที่ N" ตัวเดียวกับตาราง · ใครโทร · ยกเลิกอยู่ในรายงานแต่ไม่นับเป็นสาย ·
 *    ข้อความคัดลอกคั่นแท็บ หัวตาราง + แถวละสาย
 */
import { describe, expect, it } from 'vitest';
import type { FollowEntry } from '@/lib/followApi';
import { buildFollowDayReport, followDayReportTsv } from '@/lib/followDayReport';

let seq = 0;
const entry = (over: Partial<FollowEntry>): FollowEntry =>
  ({
    id: `id-${(seq += 1)}`,
    recipient_name: 'นายทดสอบ ระบบ',
    recipient_phone: '0812345678',
    topic: 'ติดตามเริ่มงาน',
    note: null,
    scheduled_at: '2026-10-02T09:00:00+07:00',
    created_by_name: 'คิว',
    created_at: '2026-10-01T09:00:00+07:00',
    cancelled: false,
    call_status: null,
    call_outcome: null,
    call_summary: null,
    next_action: null,
    called_at: null,
    ...over,
  }) as FollowEntry;

const NOW = new Date('2026-10-02T06:00:00+07:00');

describe('buildFollowDayReport', () => {
  it('เฉพาะวันนั้น เรียงตามเวลา · ป้ายสาย · ใครโทร · ยกเลิกไม่นับ', () => {
    const rows = [
      entry({ scheduled_at: '2026-10-02T12:00:00+07:00', call_mode: 'manual', call_day: 1, call_of_day: 2, unit_name: 'ไซต์ A' }),
      entry({ scheduled_at: '2026-10-02T08:00:00+07:00', call_day: 1, call_of_day: 1, unit_name: 'ไซต์ A' }),
      entry({ scheduled_at: '2026-10-03T08:00:00+07:00' }),
      entry({ scheduled_at: '2026-10-02T10:00:00+07:00', recipient_name: 'นางอีกคน', recipient_phone: '0899999999', cancelled: true }),
    ];
    const r = buildFollowDayReport(rows, '2026-10-02', NOW);
    expect(r.rows.map((x) => [x.time, x.call, x.caller, x.cancelled])).toEqual([
      ['08:00', 'วันที่ 1 · สายที่ 1', 'AI โทร', false],
      ['10:00', 'สายที่ 1', 'AI โทร', true],
      ['12:00', 'วันที่ 1 · สายที่ 2', 'คนโทร', false],
    ]);
    expect(r.rows[1].result).toBe('ยกเลิก');
    expect(r).toMatchObject({ people: 1, calls: 2, ai: 1, manual: 1, cancelled: 1 });
  });

  it('วันที่ไม่มีสาย = ไม่มีแถว เลขเป็น 0', () => {
    expect(buildFollowDayReport([entry({})], '2026-10-09', NOW)).toMatchObject({ rows: [], people: 0, calls: 0, ai: 0, manual: 0, cancelled: 0 });
  });

  it('ข้อความคัดลอก: หัวตาราง + แถวละสาย คั่นแท็บ · แท็บในค่ากลายเป็นเว้นวรรค', () => {
    const r = buildFollowDayReport([entry({ unit_name: 'ไซต์\tA' })], '2026-10-02', NOW);
    const lines = followDayReportTsv(r).split('\n');
    expect(lines[0]).toBe('เวลา\tชื่อ\tเบอร์\tหน่วยงาน\tสาย\tใครโทร\tผล');
    expect(lines).toHaveLength(2);
    expect(lines[1].split('\t')).toHaveLength(7);
    expect(lines[1]).toContain('ไซต์ A');
    expect(lines[1].split('\t')[2]).toBe('0812345678');
  });
});
