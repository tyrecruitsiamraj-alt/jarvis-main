/**
 * ปฏิทินติดตาม — **หนึ่งสาย = หนึ่งคอลัมน์ พร้อมคำตอบและเหตุผล**
 *
 * เจ้าของสั่ง 7 ก.ย. 2569:
 * > *"แยกว่าสายแรก สาย 2 พอได้ผลก็แยกรอบ เอามารวมกันแบบนี้งงตาย
 * >  เช่น ตอนแรกบอก รอผลโทร ถ้ารอบแรกบอกไป ก็เปลี่ยนเป็น ตกลง และคำตอบเขาคือ ไป
 * >  ถ้าเขาไม่ไปก็บอก ไม่ไป เหตุผลที่เขาตอบ ไรงี้ ทั้ง 2 รอบ"*
 *
 * 🔴 ด่านที่ห้ามหลุด:
 * 1. มี 2 สาย ⇒ ต้องมี **คอลัมน์ "สายที่ 1" และ "สายที่ 2" แยกกัน** ไม่กองรวมช่องเดียว
 * 2. สายที่ 1 ได้ผลแล้ว ⇒ เห็นคำตอบ + เหตุผลทันที **โดยที่สายที่ 2 ยังรอผลอยู่**
 * 3. ไม่ไป ⇒ ต้องบอกเหตุผลที่เขาตอบ ไม่ใช่แค่บอกว่าไม่ไป
 */
import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';

import FollowPlanningCalendar from './FollowPlanningCalendar';
import { groupFollowEntries } from '@/lib/followGrouping';
import { buildFollowPlanningRows } from '@/lib/followPlanning';
import type { FollowEntry } from '@/lib/followApi';

const NOW = new Date('2026-09-07T09:00:00Z'); // 16:00 น. เวลาไทย

function entry(over: Partial<FollowEntry> = {}): FollowEntry {
  return {
    id: 'e1',
    recipient_name: 'สู้สู้ จ้าาา',
    recipient_phone: '0812345678',
    topic: 'ติดตามเริ่มงาน',
    note: null,
    scheduled_at: '2026-09-07T08:23:00Z',
    created_by_name: 'แอดมิน',
    created_at: '2026-09-07T07:00:00Z',
    cancelled: false,
    call_status: 'pending',
    call_outcome: null,
    call_summary: null,
    next_action: null,
    called_at: null,
    ...over,
  } as FollowEntry;
}

function renderCalendar(entries: FollowEntry[]) {
  const rows = buildFollowPlanningRows(groupFollowEntries(entries, NOW), NOW);
  const allCalls = new Map(rows.map((r) => [r.group.key, r.rounds]));
  render(
    <FollowPlanningCalendar
      rows={rows}
      month="2026-09"
      onMonthChange={() => {}}
      selectedYmd=""
      onSelect={() => {}}
      onOpenCell={() => {}}
      allCalls={allCalls}
    />,
  );
  return rows;
}

afterEach(cleanup);

describe('ปฏิทินติดตาม — คอลัมน์แยกตามสาย', () => {
  const twoRounds = (over1: Partial<FollowEntry> = {}, over2: Partial<FollowEntry> = {}) => [
    entry({ id: 'r1', call_round: 1, scheduled_at: '2026-09-07T08:23:00Z', ...over1 }),
    entry({ id: 'r2', call_round: 2, scheduled_at: '2026-09-07T08:30:00Z', ...over2 }),
  ];

  it('ตั้งไว้ 2 สาย ⇒ มีคอลัมน์ "สายที่ 1" และ "สายที่ 2" แยกกัน', () => {
    renderCalendar(twoRounds());
    expect(screen.getByRole('columnheader', { name: 'สายที่ 1' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'สายที่ 2' })).toBeTruthy();
  });

  it('🔴 สายที่ 1 ตอบว่าไป ⇒ เห็นคำตอบ + เหตุผลทันที ทั้งที่สายที่ 2 ยังรอผล', () => {
    renderCalendar(
      twoRounds({
        call_status: 'completed',
        call_outcome: 'confirmed',
        call_summary: 'ผู้รับสายบอกว่าไปแน่นอน เจอกันวันจันทร์เช้า',
      }),
    );

    const cells = screen.getAllByRole('cell');
    // ช่องที่ 2 ของแถว = สายที่ 1 · ช่องที่ 3 = สายที่ 2 (ช่องแรกคือชื่อคน)
    const call1 = cells[1];
    const call2 = cells[2];

    expect(within(call1).getByText('ยืนยันว่าไป')).toBeTruthy();
    expect(within(call1).getByText('ผู้รับสายบอกว่าไปแน่นอน เจอกันวันจันทร์เช้า')).toBeTruthy();

    // สายที่ 2 ยังไม่มีผล — ต้องไม่ถูกผลของสายที่ 1 กลบ และห้ามแต่งเหตุผลให้
    expect(within(call2).queryByText('ยืนยันว่าไป')).toBeNull();
    expect(within(call2).queryByText(/ไปแน่นอน/)).toBeNull();
  });

  it('ตอบว่าไม่ไป ⇒ บอกเหตุผลที่เขาตอบด้วย ไม่ใช่แค่บอกว่าไม่ไป', () => {
    renderCalendar(
      twoRounds({
        call_status: 'completed',
        call_outcome: 'declined',
        call_summary: 'ได้งานที่อื่นใกล้บ้านกว่าแล้ว',
      }),
    );
    const call1 = screen.getAllByRole('cell')[1];
    expect(within(call1).getByText('ยกเลิก — ไม่ไปแล้ว')).toBeTruthy();
    expect(within(call1).getByText('ได้งานที่อื่นใกล้บ้านกว่าแล้ว')).toBeTruthy();
  });

  it('มีผลแล้วแต่ AI ไม่ได้เขียนสรุป ⇒ บอกตรง ๆ ไม่ปล่อยว่างให้เดา', () => {
    renderCalendar(twoRounds({ call_status: 'completed', call_outcome: 'confirmed' }));
    const call1 = screen.getAllByRole('cell')[1];
    expect(within(call1).getByText('(ไม่มีสรุปจาก AI)')).toBeTruthy();
  });

  it('ไม่ได้ตั้งสายที่ 2 ไว้ ⇒ เขียนว่าไม่ได้ตั้ง (คนละเรื่องกับ "ตั้งแล้วรอผล")', () => {
    renderCalendar([entry({ id: 'r1', call_round: 1 })]);
    // มีสายเดียว ⇒ มีคอลัมน์เดียว
    expect(screen.queryByRole('columnheader', { name: 'สายที่ 2' })).toBeNull();
  });
});
