import { describe, it, expect } from 'vitest';
import type { AftercarePerson } from '../../src/lib/aftercareApi';
import type { FollowEntry } from '../../src/lib/followApi';
import { AFTERCARE_TOPIC } from '../../src/lib/aftercareRounds';
import {
  aftercareMissingStartDate,
  buildAftercareMonthRows,
} from '../../src/lib/aftercarePlanning';

const NOW = new Date('2026-09-10T05:00:00Z'); // 12:00 น. เวลาไทย

function person(over: Partial<AftercarePerson> = {}): AftercarePerson {
  return {
    phone_e164: '+66811111111',
    full_name: 'ทดสอบ ระบบ',
    unit_name: null,
    site_code: null,
    start_date: '2026-09-01',
    source: 'manual',
    from_follow_id: null,
    note: null,
    moved_by_name: null,
    closed_at: null,
    closed_reason: null,
    created_at: null,
    ...over,
  };
}

function call(over: Partial<FollowEntry> = {}): FollowEntry {
  return {
    id: 'c1',
    recipient_name: 'ทดสอบ ระบบ',
    recipient_phone: '+66811111111',
    topic: AFTERCARE_TOPIC,
    note: null,
    scheduled_at: '2026-09-04T02:00:00Z',
    created_by_name: null,
    created_at: null,
    cancelled: false,
    call_status: 'pending',
    call_outcome: null,
    call_summary: null,
    next_action: null,
    called_at: null,
    ...over,
  } as FollowEntry;
}

describe('ปฏิทินดูแลหลังเริ่มงาน', () => {
  it('รอบ 3/7/30 วันตกวันไหน ช่องวันนั้นมีของ', () => {
    const rows = buildAftercareMonthRows([person()], [], '2026-09', NOW);
    expect(rows).toHaveLength(1);
    expect([...rows[0].byDay.keys()].sort()).toEqual(['2026-09-04', '2026-09-08']);
    expect(rows[0].byDay.get('2026-09-04')?.round?.days).toBe(3);
    // ครบ 30 วันตกเดือนหน้า — ไม่โผล่ในเดือนนี้
    expect(rows[0].byDay.has('2026-10-01')).toBe(false);
  });

  it('🔴 "ถึงกำหนด" กับ "สายจริง" อยู่คนละชั้น — ถึงกำหนดแล้วไม่ได้แปลว่าโทรแล้ว', () => {
    const rows = buildAftercareMonthRows([person()], [call()], '2026-09', NOW);
    const cell = rows[0].byDay.get('2026-09-04');
    expect(cell?.round?.days).toBe(3);
    expect(cell?.calls).toHaveLength(1);
    // วันครบ 7 วันยังไม่มีใครตั้งสาย — ช่องต้องบอกว่าค้าง
    expect(rows[0].byDay.get('2026-09-08')?.calls).toHaveLength(0);
  });

  it('จับคู่สายด้วยเลข 9 ตัวท้าย — เบอร์คนละรูปแบบก็ต้องเจอ', () => {
    const rows = buildAftercareMonthRows(
      [person()],
      [call({ recipient_phone: '0811111111' })],
      '2026-09',
      NOW,
    );
    expect(rows[0].byDay.get('2026-09-04')?.calls).toHaveLength(1);
  });

  it('ไม่รู้วันเริ่มงาน = ไม่มีแถวในปฏิทิน แต่ต้องนับไว้บอกคน', () => {
    const people = [person({ start_date: null })];
    expect(buildAftercareMonthRows(people, [], '2026-09', NOW)).toHaveLength(0);
    expect(aftercareMissingStartDate(people)).toHaveLength(1);
  });

  it('คนที่มีของเร็วสุดในเดือนอยู่แถวบน', () => {
    const rows = buildAftercareMonthRows(
      [
        person({ phone_e164: '+66822222222', start_date: '2026-09-20' }),
        person({ phone_e164: '+66833333333', start_date: '2026-09-01' }),
      ],
      [],
      '2026-09',
      NOW,
    );
    expect(rows.map((r) => r.person.phone_e164)).toEqual(['+66833333333', '+66822222222']);
  });
});
