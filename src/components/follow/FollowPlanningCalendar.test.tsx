/**
 * ปฏิทินติดตาม — **สองหน้าในผืนเดียว** (เจ้าของสั่ง 7 ก.ย. 2569 · ฉบับที่ 2)
 *
 * > *"หน้าแรก: บอกว่ามีกี่สายที่ต้องตาม · แยกผลของทุกสายตาม Filter · สายแรกจบเอาผลมาบอก
 * >  สีต้องบอกได้ว่า เขียวคือตกลง เหลืองติดต่อไม่ได้ แดงคือไม่ไป · บอกด้วยว่าเขาตอบว่ายังไง"*
 * > *"หน้าสอง: ภาพรวมทั้งเดือน นาย ก ข ค ทั้งเดือนติดตามกี่ครั้ง วันไหนไป วันไหนไม่ไป"*
 *
 * 🔴 ด่านที่ห้ามหลุด:
 * 1. เปิดมาเจอหน้า **รายวัน** ก่อน (เจ้าของเรียกว่า "หน้าแรก")
 * 2. หน้ารายวัน: เลข "สายที่ต้องตาม" ถูก · กรองสายที่ 1/2 แล้วลิสต์เปลี่ยนตาม
 * 3. สายที่ 1 ได้ผลแล้วเห็นคำตอบ + "เขาตอบ:" ทันที ทั้งที่สายที่ 2 ยังรอผล
 * 4. หน้ารายเดือน: ใต้ชื่อบอกทั้งเดือนกี่ครั้ง/ไป/ไม่ไป (ในคอลัมน์ที่ตรึง) และช่องวันยังอยู่
 * 5. เบอร์ฉุกเฉิน: ห้ามมีคำว่า "โทรแล้ว" (Lumos ไม่ส่งข้อมูลนี้กลับมา)
 */
import { describe, expect, it, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';

import FollowPlanningCalendar from './FollowPlanningCalendar';
import { groupFollowEntries } from '@/lib/followGrouping';
import { buildFollowPlanningRows } from '@/lib/followPlanning';
import type { FollowEntry } from '@/lib/followApi';

/** 16:00 น. เวลาไทย ของวันที่ 7 ก.ย. 2569 — เทสต์นี้ยึด "วันนี้" เป็นวันนั้น */
const NOW = new Date('2026-09-07T09:00:00Z');
const TODAY = '2026-09-07';

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

function renderCalendar(entries: FollowEntry[], opts: { selectedYmd?: string; onOpenCell?: () => void } = {}) {
  const rows = buildFollowPlanningRows(groupFollowEntries(entries, NOW), NOW);
  render(
    <FollowPlanningCalendar
      rows={rows}
      month="2026-09"
      onMonthChange={() => {}}
      selectedYmd={opts.selectedYmd ?? TODAY}
      onSelect={() => {}}
      onOpenCell={opts.onOpenCell ?? (() => {})}
    />,
  );
  return rows;
}

/** Radix Tabs สลับด้วย mousedown (ไม่ใช่ click) — กดจริงบนจอก็คือ mousedown ก่อนอยู่แล้ว */
const showMonthView = () =>
  fireEvent.mouseDown(screen.getByRole('tab', { name: /รายเดือน/ }), { button: 0 });

/** เลขใหญ่ในช่องสถิติที่มีป้ายนี้ */
const statValue = (label: string) =>
  screen.getByText(label, { selector: 'div' }).previousElementSibling?.textContent;

const twoRounds = (over1: Partial<FollowEntry> = {}, over2: Partial<FollowEntry> = {}) => [
  entry({ id: 'r1', call_round: 1, scheduled_at: '2026-09-07T08:23:00Z', ...over1 }),
  entry({ id: 'r2', call_round: 2, scheduled_at: '2026-09-07T08:30:00Z', ...over2 }),
];

afterEach(cleanup);
vi.useFakeTimers({ now: NOW, toFake: ['Date'] });

describe('หน้ารายวัน — สายที่ต้องตาม', () => {
  it('เปิดมาเจอหน้ารายวันก่อน · บอกว่ามีกี่สายที่ต้องตาม', () => {
    renderCalendar(twoRounds());
    expect(screen.getByRole('tab', { name: /รายวัน/ }).getAttribute('aria-selected')).toBe('true');
    // 2 สาย ยังไม่มีผล ทั้งคู่เลยเวลา (16:00 > 15:23/15:30)
    expect(statValue('สายที่ต้องตาม')).toBe('2');
    expect(statValue('เลยเวลา ยังไม่มีผล')).toBe('2');
  });

  it('🔴 สายที่ 1 ตกลงแล้ว ⇒ เห็นเขียว + "เขาตอบ:" ทันที ทั้งที่สายที่ 2 ยังรอผล', () => {
    renderCalendar(
      twoRounds({
        call_status: 'completed',
        call_outcome: 'confirmed',
        call_summary: 'ผู้รับสายบอกว่าไปแน่นอน เจอกันวันจันทร์เช้า',
      }),
    );
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    // เรียงตามเวลา — 15:23 (สาย 1) มาก่อน 15:30 (สาย 2)
    expect(within(items[0]).getByText('ตกลง · ไป')).toBeTruthy();
    expect(within(items[0]).getByText(/ผู้รับสายบอกว่าไปแน่นอน/)).toBeTruthy();
    expect(within(items[0]).getByText('สายที่ 1')).toBeTruthy();
    // สาย 2 ยังไม่มีผล — ต้องไม่โดนผลของสาย 1 กลบ
    expect(within(items[1]).getByText('สายที่ 2')).toBeTruthy();
    expect(within(items[1]).queryByText(/ไปแน่นอน/)).toBeNull();
    expect(within(items[1]).queryByText(/ตกลง/)).toBeNull();
    expect(statValue('ตกลง · ไป')).toBe('1');
  });

  it('ไม่ไป ⇒ แดง + เหตุผลที่เขาตอบ', () => {
    renderCalendar(
      twoRounds({ call_status: 'completed', call_outcome: 'declined', call_summary: 'ได้งานที่อื่นใกล้บ้านกว่าแล้ว' }),
    );
    const first = screen.getAllByRole('listitem')[0];
    expect(within(first).getByText('ไม่ไป')).toBeTruthy();
    expect(within(first).getByText(/ได้งานที่อื่นใกล้บ้านกว่าแล้ว/)).toBeTruthy();
    expect(statValue('ไม่ไป')).toBe('1');
  });

  it('ติดต่อไม่ได้ (ไม่รับสาย) ⇒ นับในช่องเหลือง "ติดต่อไม่ได้"', () => {
    renderCalendar(twoRounds({ call_status: 'completed', call_outcome: 'no_answer' }));
    expect(statValue('ติดต่อไม่ได้')).toBe('1');
  });

  it('🔴 กรอง "สายที่ 2" ⇒ ลิสต์เหลือสายเดียว และเลขหัวคิดใหม่ตามที่กรอง', () => {
    renderCalendar(twoRounds({ call_status: 'completed', call_outcome: 'confirmed' }));
    fireEvent.click(screen.getByRole('button', { name: 'สายที่ 2', pressed: false }));
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(within(items[0]).getByText('สายที่ 2')).toBeTruthy();
    expect(statValue('สายที่ต้องตาม')).toBe('1');
    expect(statValue('ตกลง · ไป')).toBe('0');
  });

  it('ชิปกรองขึ้นเฉพาะสายที่มีจริงในวันนั้น', () => {
    renderCalendar([entry({ id: 'r1', call_round: 1 })]);
    expect(screen.getByRole('button', { name: 'สายที่ 1' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'สายที่ 2' })).toBeNull();
  });

  it('กดแถวสาย ⇒ เปิดรายละเอียดของสายนั้น', () => {
    const onOpenCell = vi.fn();
    renderCalendar(twoRounds(), { onOpenCell });
    fireEvent.click(screen.getAllByRole('listitem')[1].querySelector('button')!);
    expect(onOpenCell).toHaveBeenCalledTimes(1);
    expect(onOpenCell.mock.calls[0][2][0].entry.id).toBe('r2');
  });

  it('วันที่เลือกไม่มีสาย ⇒ บอกทางไปต่อ ไม่ใช่ตารางว่าง', () => {
    renderCalendar(twoRounds(), { selectedYmd: '2026-09-08' });
    expect(screen.getByText(/ไม่มีสายที่ต้องตาม/)).toBeTruthy();
  });

  it('ยกเลิกแล้วยังเห็น (จาง) แต่ไม่นับเป็นสายที่ต้องตาม', () => {
    renderCalendar([entry({ id: 'r1', call_round: 1, cancelled: true })]);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(statValue('สายที่ต้องตาม')).toBe('0');
  });
});

describe('เบอร์ฉุกเฉินบนหน้ารายวัน', () => {
  it('มีเบอร์ + ได้ผลแล้ว ⇒ บอกเบอร์ และบอกตรง ๆ ว่ายังไม่รู้ว่าโทรหรือยัง · ห้ามมีคำว่า "โทรแล้ว"', () => {
    renderCalendar([
      entry({ id: 'r1', call_round: 1, call_status: 'completed', call_outcome: 'no_answer', emergency_phone: '+66898143230' }),
    ]);
    const li = screen.getAllByRole('listitem')[0];
    expect(within(li).getByText(/ฉุกเฉิน \+66898143230 · ยังไม่รู้ว่าโทรหรือยัง/)).toBeTruthy();
    expect(within(li).queryByText(/โทรเบอร์ฉุกเฉินแล้ว/)).toBeNull();
  });

  it('🔴 ไม่ได้แนบเบอร์ฉุกเฉิน ⇒ ต้องเตือน', () => {
    renderCalendar([entry({ id: 'r1', call_round: 1 })]);
    expect(within(screen.getAllByRole('listitem')[0]).getByText('ไม่ได้แนบเบอร์ฉุกเฉิน')).toBeTruthy();
  });
});

describe('หน้ารายเดือน — ภาพรวม', () => {
  it('สลับไปรายเดือน ⇒ มีคอลัมน์ "เดือนนี้" + ช่องวันครบเดือน', () => {
    renderCalendar(twoRounds({ call_status: 'completed', call_outcome: 'confirmed' }));
    showMonthView();
    expect(screen.getByRole('columnheader', { name: /คนที่ต้องติดตาม/ })).toBeTruthy();
    // กันยายนมี 30 วัน → หัวคอลัมน์วัน 30 ตัว (+1 คอลัมน์ชื่อที่ตรึงไว้)
    expect(screen.getAllByRole('columnheader')).toHaveLength(31);
  });

  it('🔴 สรุปทั้งเดือนอยู่ใต้ชื่อในคอลัมน์ที่ตรึงไว้ — กี่ครั้ง และแยก ไป/ไม่ไป/ติดต่อไม่ได้', () => {
    renderCalendar([
      entry({ id: 'r1', call_round: 1, scheduled_at: '2026-09-01T02:00:00Z', call_status: 'completed', call_outcome: 'confirmed' }),
      entry({ id: 'r2', call_round: 2, scheduled_at: '2026-09-03T02:00:00Z', call_status: 'completed', call_outcome: 'no_answer' }),
      entry({ id: 'r3', call_round: 3, scheduled_at: '2026-09-05T02:00:00Z', call_status: 'completed', call_outcome: 'declined' }),
    ]);
    showMonthView();
    const monthCell = screen.getAllByRole('cell')[0];
    expect(within(monthCell).getByText('3 ครั้ง')).toBeTruthy();
    expect(within(monthCell).getByText('ตกลง · ไป 1')).toBeTruthy();
    expect(within(monthCell).getByText('ติดต่อไม่ได้ 1')).toBeTruthy();
    expect(within(monthCell).getByText('ไม่ไป 1')).toBeTruthy();
  });

  it('ช่องวันบอกผลด้วยคำสั้นของหมวด (ไม่ใช่คำยาวที่ล้นช่อง)', () => {
    renderCalendar([
      entry({ id: 'r1', call_round: 1, scheduled_at: '2026-09-01T02:00:00Z', call_status: 'completed', call_outcome: 'declined' }),
    ]);
    showMonthView();
    const dayCells = screen.getAllByRole('cell').slice(1);
    expect(dayCells.some((c) => within(c).queryByText('ไม่ไป'))).toBe(true);
    expect(dayCells.some((c) => within(c).queryByText(/ยกเลิก — ไม่ไปแล้ว/))).toBe(false);
  });

  it('คำอธิบายสีใช้คำของเจ้าของ: เขียวตกลง เหลืองติดต่อไม่ได้ แดงไม่ไป', () => {
    renderCalendar(twoRounds());
    showMonthView();
    expect(screen.getByText('เขียว = ตกลง · ไป')).toBeTruthy();
    expect(screen.getByText(/เหลือง = ติดต่อไม่ได้/)).toBeTruthy();
    expect(screen.getByText('แดง = ไม่ไป')).toBeTruthy();
  });
});
