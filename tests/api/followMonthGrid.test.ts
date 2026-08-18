import { describe, it, expect } from 'vitest';
import {
  buildFollowMonthGrid,
  combineTones,
  entryTone,
  monthDayColumns,
} from '../../src/lib/followMonthGrid';
import type { FollowEntry } from '../../src/lib/followApi';

/**
 * ตารางสรุปรายเดือนหน้า Follow — คน × วัน (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ-5)
 */

let seq = 0;
function entry(over: Partial<FollowEntry>): FollowEntry {
  seq += 1;
  return {
    id: `id-${seq}`,
    recipient_name: 'สมชาย ใจดี',
    recipient_phone: '0812345678',
    topic: 'ติดตามเริ่มงาน',
    note: null,
    scheduled_at: '2026-08-18T09:00:00+07:00',
    created_by_name: 'staff-a',
    created_at: '2026-08-17T09:00:00+07:00',
    cancelled: false,
    call_status: 'pending',
    call_outcome: null,
    call_summary: null,
    next_action: null,
    called_at: null,
    ...over,
  } as FollowEntry;
}

describe('entryTone — สีของรอบเดียว', () => {
  it('ปิดงานจบดี (ไปแล้ว/ถึงแล้ว/เสร็จสิ้นเก่า) = เขียว · หลุด = แดง · ลา/เลื่อน = เหลือง', () => {
    expect(entryTone(entry({ completed_at: 'x', outcome_code: 'went' }))).toBe('success');
    expect(entryTone(entry({ completed_at: 'x', outcome_code: 'arrived' }))).toBe('success');
    expect(entryTone(entry({ completed_at: 'x', outcome_code: 'done' }))).toBe('success');
    expect(entryTone(entry({ completed_at: 'x', outcome_code: 'cancelled' }))).toBe('danger');
    expect(entryTone(entry({ completed_at: 'x', outcome_code: 'no_show_start' }))).toBe('danger');
    expect(entryTone(entry({ completed_at: 'x', outcome_code: 'leave' }))).toBe('warn');
    expect(entryTone(entry({ completed_at: 'x', outcome_code: 'postponed' }))).toBe('warn');
  });

  it('ยังไม่ปิดงาน: โทรติด=เขียว · ไม่ติด=เหลือง · สายกำลังเดิน=ฟ้า · รอโทร=เทา', () => {
    expect(entryTone(entry({ call_status: 'completed' }))).toBe('success');
    expect(entryTone(entry({ call_status: 'failed' }))).toBe('warn');
    expect(entryTone(entry({ call_status: 'delivered' }))).toBe('info');
    expect(entryTone(entry({ call_status: 'pending' }))).toBe('neutral');
  });
});

describe('combineTones — วันเดียวหลายรอบ ของแรงสุดชนะ (ตารางมีไว้หาปัญหา)', () => {
  it('แดง > เหลือง > เขียว > ฟ้า > เทา', () => {
    expect(combineTones(['success', 'danger', 'info'])).toBe('danger');
    expect(combineTones(['success', 'warn'])).toBe('warn');
    expect(combineTones(['info', 'success'])).toBe('success');
    expect(combineTones(['neutral', 'info'])).toBe('info');
    expect(combineTones([])).toBe('neutral');
  });
});

describe('buildFollowMonthGrid', () => {
  it('แถว = คนเดียวกัน (เบอร์+เรื่อง) · ช่องอยู่ตามวันเวลาไทยของ scheduled_at', () => {
    const rows = buildFollowMonthGrid(
      [
        entry({ scheduled_at: '2026-08-18T09:00:00+07:00' }),
        entry({ scheduled_at: '2026-08-20T09:00:00+07:00' }),
      ],
      '2026-08',
    );
    expect(rows).toHaveLength(1);
    expect([...rows[0].cells.keys()].sort()).toEqual(['2026-08-18', '2026-08-20']);
  });

  it('🔴 เทียบวันแบบเวลาไทย — 23:30Z คือ "วันถัดไป" ของไทย ห้ามตกช่องผิดวัน', () => {
    const rows = buildFollowMonthGrid([entry({ scheduled_at: '2026-08-18T23:30:00Z' })], '2026-08');
    expect([...rows[0].cells.keys()]).toEqual(['2026-08-19']);
  });

  it('รอบนอกเดือนที่ดูอยู่ไม่ขึ้น · คนที่ไม่มีรอบในเดือนนี้ไม่มีแถว', () => {
    const rows = buildFollowMonthGrid(
      [
        entry({ scheduled_at: '2026-07-31T09:00:00+07:00' }),
        entry({ recipient_phone: '0899999999', scheduled_at: '2026-08-05T09:00:00+07:00' }),
      ],
      '2026-08',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].phone).toBe('0899999999');
  });

  it('วันเดียวหลายรอบ: นับเฉพาะที่ไม่ยกเลิก · สีของแรงสุดชนะ', () => {
    const rows = buildFollowMonthGrid(
      [
        entry({ scheduled_at: '2026-08-18T09:00:00+07:00', call_status: 'completed' }),
        entry({ scheduled_at: '2026-08-18T14:00:00+07:00', call_status: 'failed' }),
        entry({ scheduled_at: '2026-08-18T16:00:00+07:00', cancelled: true, call_status: 'cancelled' }),
      ],
      '2026-08',
    );
    const cell = rows[0].cells.get('2026-08-18')!;
    expect(cell.count).toBe(2); // ไม่นับที่ยกเลิก
    expect(cell.tone).toBe('warn'); // failed ชนะ completed
    expect(cell.entries).toHaveLength(3); // แต่รายละเอียดยังเห็นครบรวมที่ยกเลิก
  });

  it('วันที่มีแต่รอบยกเลิก = muted (จาง ๆ พอให้รู้ว่าเคยตั้งไว้)', () => {
    const rows = buildFollowMonthGrid(
      [entry({ scheduled_at: '2026-08-18T09:00:00+07:00', cancelled: true, call_status: 'cancelled' })],
      '2026-08',
    );
    const cell = rows[0].cells.get('2026-08-18')!;
    expect(cell.muted).toBe(true);
    expect(cell.count).toBe(0);
  });
});

describe('monthDayColumns', () => {
  it('ส.ค. 2569 มี 31 วัน · วันที่ 2/9/16/23/30 เป็นอาทิตย์ (ตรงกับตัวอย่างที่เจ้าของส่งมา)', () => {
    const cols = monthDayColumns('2026-08');
    expect(cols).toHaveLength(31);
    const sundays = cols.filter((c) => c.isSunday).map((c) => c.day);
    expect(sundays).toEqual([2, 9, 16, 23, 30]);
    expect(cols[0]).toMatchObject({ ymd: '2026-08-01', day: 1, weekday: 'ส' });
  });

  it('ก.พ. ปีอธิกสุรทินได้ 29 วัน · เดือนพัง ๆ ได้ []', () => {
    expect(monthDayColumns('2028-02')).toHaveLength(29);
    expect(monthDayColumns('2026-02')).toHaveLength(28);
    expect(monthDayColumns('มั่ว')).toEqual([]);
  });
});
