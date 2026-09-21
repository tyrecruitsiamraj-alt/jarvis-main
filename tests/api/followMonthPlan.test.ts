// @vitest-environment node
/**
 * ═══ แผนการโทรทั้งเดือน (เจ้าของสั่ง 21 ก.ย. 2569) ═══
 *
 * > *"เห็นเลยว่า เดือนนี้วันที่ 1-สิ้นเดือน นาย ก โทรวันไหนบ้าง วันละกี่รอบ รอบไหนกี่โมง"*
 *
 * 🔴 ด่านที่ห้ามหลุด:
 * 1. คอลัมน์ต้องครบ **ทั้งเดือน** ไม่ใช่เฉพาะวันที่มีของ (ไม่งั้นดูไม่ออกว่าวันไหนว่าง)
 * 2. **วันตามเวลาไทย** — สาย 06:50 ต้องอยู่วันเดียวกับที่คนเห็นบนนาฬิกา ไม่ใช่วัน UTC
 * 3. รอบของวันอ่านจาก `call_times` (วันละหลายรอบ) ไม่ใช่นับแถวละรอบ
 * 4. ยกเลิกแล้วไม่นับเป็นรอบ แต่ช่องยังต้องอยู่
 */
import { describe, expect, it } from 'vitest';
import type { FollowEntry } from '../../src/lib/followApi.js';
import {
  bangkokYmd,
  buildMonthPlan,
  currentMonth,
  daysOfMonth,
  shiftMonth,
} from '../../src/lib/followMonthPlan.js';

let seq = 0;
function entry(over: Partial<FollowEntry> = {}): FollowEntry {
  seq += 1;
  return {
    id: `e${seq}`,
    recipient_name: 'นาย ก ทดสอบ',
    recipient_phone: '0812345678',
    topic: 'ติดตามเริ่มงาน',
    note: null,
    scheduled_at: '2026-09-03T05:50:00+07:00',
    created_by_name: 'คุณเมย์',
    created_at: '2026-09-01T09:00:00+07:00',
    cancelled: false,
    call_status: 'pending',
    call_outcome: null,
    call_summary: null,
    call_reply: null,
    ...over,
  } as FollowEntry;
}

describe('ปฏิทินของเดือน', () => {
  it('กันยายน 30 วัน · กุมภาพันธ์ปีอธิกสุรทิน 29 วัน', () => {
    expect(daysOfMonth('2026-09')).toHaveLength(30);
    expect(daysOfMonth('2024-02')).toHaveLength(29);
    expect(daysOfMonth('2026-02')).toHaveLength(28);
  });

  it('วันแรก/วันสุดท้ายถูกต้อง', () => {
    const d = daysOfMonth('2026-09');
    expect(d[0]).toBe('2026-09-01');
    expect(d[d.length - 1]).toBe('2026-09-30');
  });

  it('เลื่อนเดือนข้ามปีได้', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });

  it('เดือนปัจจุบันอ่านตามเวลาไทย', () => {
    // 1 ต.ค. 06:00 ไทย = 30 ก.ย. 23:00 UTC — ต้องได้ ต.ค. ไม่ใช่ ก.ย.
    expect(currentMonth(new Date('2026-09-30T23:00:00Z'))).toBe('2026-10');
  });

  it('🔴 สายเช้ามืดต้องอยู่วันเดียวกับที่คนเห็น ไม่ใช่วัน UTC', () => {
    // 05:50 ไทย ของวันที่ 3 = 22:50 UTC ของวันที่ 2
    expect(bangkokYmd('2026-09-02T22:50:00Z')).toBe('2026-09-03');
  });
});

describe('แถวของแต่ละคน', () => {
  it('วันละหลายรอบ — เก็บเวลาครบทุกรอบ เรียงแล้ว', () => {
    const plan = buildMonthPlan(
      [entry({ scheduled_at: '2026-09-03T05:50:00+07:00', call_times: ['06:50', '05:50'] })],
      '2026-09',
    );
    const cell = plan.rows[0].cells['2026-09-03'];
    expect(cell.times).toEqual(['05:50', '06:50']);
    expect(cell.rounds).toBe(2);
  });

  it('หลายวันของคนเดียว = แถวเดียว ช่องแยกตามวัน', () => {
    const plan = buildMonthPlan(
      [
        entry({ scheduled_at: '2026-09-03T05:50:00+07:00', call_times: ['05:50'] }),
        entry({ scheduled_at: '2026-09-04T05:50:00+07:00', call_times: ['05:50', '06:50'] }),
      ],
      '2026-09',
    );
    expect(plan.rows).toHaveLength(1);
    expect(Object.keys(plan.rows[0].cells).sort()).toEqual(['2026-09-03', '2026-09-04']);
    expect(plan.rows[0].totals).toMatchObject({ days: 2, rounds: 3 });
    expect(plan.rows[0].firstYmd).toBe('2026-09-03');
    expect(plan.rows[0].lastYmd).toBe('2026-09-04');
  });

  it('ไม่มี call_times ⇒ ถอยไปใช้เวลาใน scheduled_at', () => {
    const plan = buildMonthPlan([entry({ scheduled_at: '2026-09-05T13:20:00+07:00' })], '2026-09');
    expect(plan.rows[0].cells['2026-09-05'].times).toEqual(['13:20']);
  });

  it('ใครโทร: AI · เราโทรเอง · วันผสม', () => {
    const plan = buildMonthPlan(
      [
        entry({ recipient_phone: '0811111111', scheduled_at: '2026-09-03T08:00:00+07:00' }),
        entry({
          recipient_phone: '0822222222',
          scheduled_at: '2026-09-03T08:00:00+07:00',
          call_mode: 'manual',
        }),
        entry({ recipient_phone: '0833333333', scheduled_at: '2026-09-03T08:00:00+07:00' }),
        entry({
          recipient_phone: '0833333333',
          scheduled_at: '2026-09-03T18:00:00+07:00',
          call_mode: 'manual',
        }),
      ],
      '2026-09',
    );
    const modeOf = (phone: string) =>
      plan.rows.find((r) => r.phone === phone)!.cells['2026-09-03'].mode;
    expect(modeOf('0811111111')).toBe('ai');
    expect(modeOf('0822222222')).toBe('manual');
    expect(modeOf('0833333333')).toBe('mixed');
  });

  it('🔴 วันผสมต้องแยกยอด AI กับเราโทรตามรอบจริง ไม่ปัดไปข้างเดียว', () => {
    const plan = buildMonthPlan(
      [
        entry({ scheduled_at: '2026-09-03T08:00:00+07:00', call_times: ['08:00', '09:00'] }),
        entry({ scheduled_at: '2026-09-03T18:00:00+07:00', call_mode: 'manual' }),
      ],
      '2026-09',
    );
    expect(plan.rows[0].totals).toMatchObject({ rounds: 3, aiRounds: 2, manualRounds: 1 });
  });

  it('มีผลกลับแล้ว ⇒ ช่องนั้นเป็น done · ยกเลิกหมด ⇒ cancelled และไม่นับรอบ', () => {
    const plan = buildMonthPlan(
      [
        entry({
          recipient_phone: '0811111111',
          scheduled_at: '2026-09-03T08:00:00+07:00',
          call_outcome: 'acknowledged',
        }),
        entry({
          recipient_phone: '0822222222',
          scheduled_at: '2026-09-04T08:00:00+07:00',
          cancelled: true,
        }),
      ],
      '2026-09',
    );
    expect(plan.rows.find((r) => r.phone === '0811111111')!.cells['2026-09-03'].state).toBe('done');
    const cancelled = plan.rows.find((r) => r.phone === '0822222222')!.cells['2026-09-04'];
    expect(cancelled.state).toBe('cancelled');
    expect(cancelled.rounds).toBe(0);
  });

  it('ของเดือนอื่นไม่หลุดเข้ามา', () => {
    const plan = buildMonthPlan(
      [
        entry({ scheduled_at: '2026-08-31T08:00:00+07:00' }),
        entry({ scheduled_at: '2026-10-01T08:00:00+07:00' }),
      ],
      '2026-09',
    );
    expect(plan.rows).toHaveLength(0);
  });
});

describe('สรุปหัวตาราง', () => {
  it('คน · รอบรวม · แยก AI/เราโทร · จำนวนวันที่มีสาย', () => {
    const plan = buildMonthPlan(
      [
        entry({ recipient_phone: '0811111111', scheduled_at: '2026-09-03T08:00:00+07:00', call_times: ['08:00', '09:00'] }),
        entry({ recipient_phone: '0822222222', scheduled_at: '2026-09-03T08:00:00+07:00', call_mode: 'manual' }),
        entry({ recipient_phone: '0822222222', scheduled_at: '2026-09-07T08:00:00+07:00', call_mode: 'manual' }),
      ],
      '2026-09',
    );
    expect(plan.summary).toMatchObject({
      people: 2,
      rounds: 4,
      aiRounds: 2,
      manualRounds: 2,
      activeDays: 2,
    });
  });
});
