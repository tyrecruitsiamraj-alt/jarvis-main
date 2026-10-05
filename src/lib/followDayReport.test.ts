/**
 * สรุปแผนติดตามทั้งวัน (เจ้าของสั่ง 2 ต.ค. 2569 · Choice "หน้าสรุปบนจอ")
 * 🔴 ด่าน: เฉพาะวันนั้น ชื่อเดียวกันติดกัน (คนเรียงตามสายแรก · ในคนเรียงตามเวลา) · ป้ายสาย "วันที่ D · สายที่ N" ตัวเดียวกับตาราง · ใครโทร · ยกเลิกอยู่ในรายงานแต่ไม่นับเป็นสาย ·
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
    // ชื่อเดียวกันติดกัน (4 ต.ค. 2569): นายทดสอบ 08:00 + 12:00 มาก่อน แล้วค่อยนางอีกคน 10:00
    expect(r.rows.map((x) => [x.time, x.call, x.caller, x.cancelled])).toEqual([
      ['08:00', 'วันที่ 1 · สายที่ 1', 'AI โทร', false],
      ['12:00', 'วันที่ 1 · สายที่ 2', 'คนโทร', false],
      ['10:00', 'สายที่ 1', 'AI โทร', true],
    ]);
    expect(r.rows[2].result).toBe('ยกเลิก');
    expect(r).toMatchObject({ people: 1, calls: 2, ai: 1, manual: 1, cancelled: 1 });
  });

  it('🔴 ชื่อเดียวกันต้องอยู่ติดกัน — คนเรียงตามสายแรกของวัน · ในคนเดียวกันเรียงตามเวลา · สองเบอร์ชื่อเดียวก็ติดกัน', () => {
    const rows = [
      entry({ recipient_name: 'นายก', recipient_phone: '0811111111', scheduled_at: '2026-10-02T05:00:00+07:00' }),
      entry({ recipient_name: 'นายข', recipient_phone: '0822222222', scheduled_at: '2026-10-02T05:00:00+07:00' }),
      entry({ recipient_name: 'นายค', recipient_phone: '0833333333', scheduled_at: '2026-10-02T05:30:00+07:00' }),
      entry({ recipient_name: 'นายก', recipient_phone: '0811111111', scheduled_at: '2026-10-02T06:00:00+07:00' }),
      entry({ recipient_name: 'นายข', recipient_phone: '0822222222', scheduled_at: '2026-10-02T06:00:00+07:00' }),
      entry({ recipient_name: 'นายค', recipient_phone: '0844444444', scheduled_at: '2026-10-02T06:00:00+07:00' }),
    ];
    const r = buildFollowDayReport(rows, '2026-10-02', NOW);
    expect(r.rows.map((x) => `${x.time} ${x.name}`)).toEqual([
      '05:00 นายก',
      '06:00 นายก',
      '05:00 นายข',
      '06:00 นายข',
      '05:30 นายค',
      '06:00 นายค',
    ]);
  });

  it('วันที่ไม่มีสาย = ไม่มีแถว เลขเป็น 0', () => {
    expect(buildFollowDayReport([entry({})], '2026-10-09', NOW)).toMatchObject({ rows: [], people: 0, calls: 0, ai: 0, manual: 0, cancelled: 0 });
  });

  /**
   * ตัวกรองก่อนโหลดรูป (เจ้าของสั่ง 3 ต.ค. 2569: "เลือกวัน เลือกสายได้ เลือกว่าจะดูแค่คนหรือ AI")
   * 🔴 ตัวเลขสรุปต้องมาจากชุดที่กรองแล้วชุดเดียวกับตาราง · callNos มาจากก่อนกรอง (ไว้ทำตัวเลือก)
   */
  it('กรองใครโทร/สายที่ — แถวและเลขสรุปตามตัวกรอง · scope บอกขอบเขต · callNos ครบก่อนกรอง', () => {
    const rows = [
      entry({ scheduled_at: '2026-10-02T08:00:00+07:00', call_day: 1, call_of_day: 1 }),
      entry({ scheduled_at: '2026-10-02T12:00:00+07:00', call_mode: 'manual', call_day: 1, call_of_day: 2 }),
    ];
    const manualOnly = buildFollowDayReport(rows, '2026-10-02', NOW, { caller: 'manual', call: 'all' });
    expect(manualOnly.rows).toHaveLength(1);
    expect(manualOnly).toMatchObject({ calls: 1, ai: 0, manual: 1, scope: 'เฉพาะคนโทร' });
    expect(manualOnly.callNos).toEqual([1, 2]);

    const call1 = buildFollowDayReport(rows, '2026-10-02', NOW, { caller: 'all', call: 1 });
    expect(call1.rows.map((x) => x.call)).toEqual(['วันที่ 1 · สายที่ 1']);
    expect(call1.scope).toBe('สายที่ 1');

    const both = buildFollowDayReport(rows, '2026-10-02', NOW, { caller: 'ai', call: 2 });
    expect(both.rows).toHaveLength(0);
    expect(both.scope).toBe('เฉพาะ AI โทร · สายที่ 2');

    // ไม่ส่ง filter = พฤติกรรมเดิมทุกตัว และ scope ว่าง (รูปไม่ขึ้นคำขอบเขต)
    expect(buildFollowDayReport(rows, '2026-10-02', NOW).scope).toBe('');
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

describe('สรุปแผนเลือกช่วงวัน + วันที่ของแผน (เจ้าของ Choice 5 ต.ค. 2569)', () => {
  it('🔴 ช่วงหลายวัน = รวมทุกวัน เรียงวัน ติดวันหน้าเวลา · วันเดียว = แบบเดิม', () => {
    const rows = [
      entry({ id: 'a', scheduled_at: '2026-10-02T01:00:00Z', group_id: 'g1' }),
      entry({ id: 'b', scheduled_at: '2026-10-03T01:00:00Z', group_id: 'g1' }),
    ];
    const one = buildFollowDayReport(rows, '2026-10-02', NOW);
    expect(one.rows.map((r) => r.time)).toEqual(['08:00']);
    expect(one.toYmd).toBe('2026-10-02');
    const two = buildFollowDayReport(rows, { from: '2026-10-02', to: '2026-10-03' }, NOW);
    expect(two.rows.map((r) => r.time)).toEqual(['2/10 08:00', '3/10 08:00']);
    expect(two.toYmd).toBe('2026-10-03');
  });

  it('กรองวันที่ของแผน = ครั้งที่ติดตาม · ชุดวันเดียวนับเป็นวันที่ 1', () => {
    const rows = [
      entry({ id: 'a', scheduled_at: '2026-10-02T01:00:00Z', group_id: 'g1', call_day: 1 }),
      entry({ id: 'b', scheduled_at: '2026-10-03T01:00:00Z', group_id: 'g1', call_day: 2 }),
      entry({ id: 'c', recipient_phone: '0890000099', scheduled_at: '2026-10-03T02:00:00Z', call_day: null }),
    ];
    const r = buildFollowDayReport(rows, { from: '2026-10-02', to: '2026-10-03' }, NOW, { caller: 'all', call: 'all', planDay: 2 });
    expect(r.planDays).toEqual([1, 2]);
    expect(r.rows.map((x) => x.id)).toEqual(['b']);
    expect(r.scope).toBe('วันที่ 2 ของแผน');
  });
});
