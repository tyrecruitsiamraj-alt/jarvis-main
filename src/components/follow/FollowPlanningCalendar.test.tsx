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
import type { FollowRoundFilter } from '@/lib/followPlanning';
import { TONE } from '@/lib/designTokens';

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

/**
 * ⚠️ ตัวเลือกรอบ (ทุกสาย/สายที่ 1-3) **ไม่ได้อยู่ในการ์ดนี้แล้ว** — ย้ายไปอยู่กับแผงรอบโทร
 * ที่หน้าแม่ส่งเข้ามาทาง `roundsSlot` (รวมสองการ์ดเป็นหนึ่ง 8 ก.ย. 2569)
 * เทสต์จึงคุมด้วย prop `roundFilter` ตรง ๆ แทนการกดชิป
 */
function renderCalendar(
  entries: FollowEntry[],
  opts: {
    selectedYmd?: string;
    onOpenCell?: () => void;
    roundFilter?: FollowRoundFilter;
    roundsSlot?: React.ReactNode;
    onEditRound?: (round: { entry: FollowEntry }) => void;
  } = {},
) {
  const rows = buildFollowPlanningRows(groupFollowEntries(entries, NOW), NOW);
  render(
    <FollowPlanningCalendar
      rows={rows}
      month="2026-09"
      onMonthChange={() => {}}
      selectedYmd={opts.selectedYmd ?? TODAY}
      onSelect={() => {}}
      onOpenCell={opts.onOpenCell ?? (() => {})}
      roundFilter={opts.roundFilter ?? 'all'}
      roundsSlot={opts.roundsSlot}
      onEditRound={opts.onEditRound}
    />,
  );
  return rows;
}

/** Radix Tabs สลับด้วย mousedown (ไม่ใช่ click) — กดจริงบนจอก็คือ mousedown ก่อนอยู่แล้ว */
const showMonthView = () =>
  fireEvent.mouseDown(screen.getByRole('tab', { name: /รายเดือน/ }), { button: 0 });

/** เลขใหญ่ในการ์ดสถิติใบที่มีป้ายนี้ (การ์ดติด `data-stat` ไว้ให้เล็ง) */
const statValue = (label: string) =>
  document.querySelector(`[data-stat="${label}"] p`)?.textContent;

/**
 * แถวของตารางรายวันเท่านั้น — แผงข้างขวาก็มีรายการเหมือนกัน ต้องกันไม่ให้ปน
 * (ตารางเปลี่ยนจาก `<ul><li>` เป็น `<table>` ตามแบบอ้างอิง 8 ก.ย. 2569)
 */
const dayRows = () => within(screen.getByTestId('day-calls')).getAllByRole('row');

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
    // ทั้งคู่ยังไม่มีผล ⇒ ไปกองที่ช่อง "ยังไม่รู้ผล" ช่องเดียว (เดิมแยก 6 ช่องจนอ่านไม่ออก)
    expect(statValue('ยังไม่รู้ผล')).toBe('2');
    expect(statValue('ตอบว่าไป')).toBe('0');
    expect(statValue('ตอบว่าไม่ไป')).toBe('0');
  });

  it('🔴 สายที่ 1 ตกลงแล้ว ⇒ เห็นเขียว + "เขาตอบ:" ทันที ทั้งที่สายที่ 2 ยังรอผล', () => {
    renderCalendar(
      twoRounds({
        call_status: 'completed',
        call_outcome: 'confirmed',
        call_summary: 'ผู้รับสายบอกว่าไปแน่นอน เจอกันวันจันทร์เช้า',
      }),
    );
    // คนเดียวกัน = แถวเดียว (11 ก.ย. 2569) · สองรอบอยู่ในแถวนั้น เรียงตามเวลา
    const items = dayRows();
    expect(items).toHaveLength(1);
    const cells = items[0].querySelectorAll('td');
    expect(within(items[0]).getByText('รอบโทรที่ 1')).toBeTruthy();
    expect(within(items[0]).getByText('รอบโทรที่ 2')).toBeTruthy();
    // 🔴 ผลของสาย 1 ต้องไม่ลามไปทับสาย 2 — ช่องคำตอบมีข้อความของสาย 1 ช่องเดียว
    expect(within(items[0]).getByText('ตอบว่าไป')).toBeTruthy();
    expect(within(items[0]).getByText('เลยเวลานัด')).toBeTruthy();
    expect(within(items[0]).getAllByText(/ผู้รับสายบอกว่าไปแน่นอน/)).toHaveLength(1);
    // บรรทัดของทั้งสามคอลัมน์ต้องเท่ากัน (บรรทัดที่ N = สายเดียวกัน)
    expect(cells[2].querySelectorAll(':scope > span > span').length).toBe(2);
    expect(statValue('ตอบว่าไป')).toBe('1');
  });

  it('ไม่ไป ⇒ แดง + เหตุผลที่เขาตอบ', () => {
    renderCalendar(
      twoRounds({ call_status: 'completed', call_outcome: 'declined', call_summary: 'ได้งานที่อื่นใกล้บ้านกว่าแล้ว' }),
    );
    const first = dayRows()[0];
    expect(within(first).getByText('ตอบว่าไม่ไป')).toBeTruthy();
    expect(within(first).getByText(/ได้งานที่อื่นใกล้บ้านกว่าแล้ว/)).toBeTruthy();
    expect(statValue('ตอบว่าไม่ไป')).toBe('1');
  });

  it('ไม่รับสาย ⇒ ชิปบอก "ไม่ได้คำตอบ" (คนละคำกับช่อง "โทรไม่ติด" ของ Pipeline) และนับใน "ยังไม่รู้ผล"', () => {
    renderCalendar(twoRounds({ call_status: 'completed', call_outcome: 'no_answer' }));
    const first = dayRows()[0];
    expect(within(first).getByText(/ไม่ได้คำตอบ/)).toBeTruthy();
    // โทรไม่ติด (สาย 1) + เลยเวลานัด (สาย 2) = ยังไม่รู้ผลทั้งคู่
    expect(statValue('ยังไม่รู้ผล')).toBe('2');
  });

  it('🔴 เลือก "สายที่ 2" ⇒ ลิสต์เหลือสายเดียว และเลขหัวคิดใหม่ตามที่เลือก', () => {
    renderCalendar(twoRounds({ call_status: 'completed', call_outcome: 'confirmed' }), { roundFilter: 2 });
    const items = dayRows();
    expect(items).toHaveLength(1);
    expect(within(items[0]).getByText('รอบโทรที่ 2')).toBeTruthy();
    expect(statValue('สายที่ต้องตาม')).toBe('1');
    expect(statValue('ตอบว่าไป')).toBe('0');
  });

  it('เลือกสายที่วันนั้นไม่มี ⇒ บอกให้กลับไปกด "ทุกสาย" ไม่ใช่ปล่อยจอว่าง', () => {
    renderCalendar([entry({ id: 'r1', call_round: 1 })], { roundFilter: 2 });
    expect(screen.getByText(/วันนี้ไม่มีรอบโทรที่ 2/)).toBeTruthy();
  });

  it('🔴 แผงรอบโทรที่หน้าแม่ส่งมา ต้องอยู่ในผืนเดียวกัน (ยุบสองการ์ดเป็นหนึ่ง)', () => {
    renderCalendar(twoRounds(), {
      roundsSlot: <div data-testid="rounds-slot">แผงรอบโทร</div>,
    });
    expect(screen.getByTestId('rounds-slot')).toBeTruthy();
  });

  it('กดแถวสาย ⇒ เปิดรายละเอียดของสายนั้น', () => {
    const onOpenCell = vi.fn();
    renderCalendar(twoRounds(), { onOpenCell });
    fireEvent.click(within(dayRows()[0]).getByRole('button', { name: 'จัดการ' }));
    expect(onOpenCell).toHaveBeenCalledTimes(1);
    // แถวเดียว = คนเดียว ⇒ ส่ง **ทุกรอบของวันนั้น** ไปให้ป๊อป ไม่ใช่รอบเดียว
    const rounds = onOpenCell.mock.calls[0][2] as Array<{ entry: FollowEntry }>;
    expect(rounds.map((r) => r.entry.id)).toEqual(['r1', 'r2']);
  });

  it('วันที่เลือกไม่มีสาย ⇒ บอกทางไปต่อ ไม่ใช่ตารางว่าง', () => {
    renderCalendar(twoRounds(), { selectedYmd: '2026-09-08' });
    expect(screen.getByText(/ไม่มีสายที่ต้องตาม/)).toBeTruthy();
  });

  it('ยกเลิกแล้วยังเห็น (จาง) แต่ไม่นับเป็นสายที่ต้องตาม', () => {
    renderCalendar([entry({ id: 'r1', call_round: 1, cancelled: true })]);
    expect(dayRows()).toHaveLength(1);
    expect(statValue('สายที่ต้องตาม')).toBe('0');
  });
});

describe('เบอร์ฉุกเฉินบนหน้ารายวัน', () => {
  it('มีเบอร์ + ได้ผลแล้ว ⇒ บอกเบอร์ และบอกตรง ๆ ว่ายังไม่รู้ว่าโทรหรือยัง · ห้ามมีคำว่า "โทรแล้ว"', () => {
    renderCalendar([
      entry({ id: 'r1', call_round: 1, call_status: 'completed', call_outcome: 'no_answer', emergency_phone: '+66898143230' }),
    ]);
    const li = dayRows()[0];
    // คอลัมน์ "เบอร์ฉุกเฉิน" ของตาราง — เบอร์บรรทัดบน สถานะบรรทัดล่าง (ไม่มีคำว่า "ฉุกเฉิน" นำแล้ว
    // เพราะหัวคอลัมน์บอกอยู่)
    expect(within(li).getByText(/\+66898143230/)).toBeTruthy();
    // ถ้อยคำชัดขึ้น 10 ก.ย. 2569 — แยก "แนบเบอร์ไปแล้ว" (เรารู้) ออกจาก "โทรหรือยัง" (เราไม่รู้)
    expect(within(li).getByText(/แนบไปกับสายแล้ว · Lumos ไม่ได้บอกว่าโทรหรือยัง/)).toBeTruthy();
    expect(within(li).queryByText(/โทรเบอร์ฉุกเฉินแล้ว/)).toBeNull();
  });

  it('🔴 ไม่ได้แนบเบอร์ฉุกเฉิน ⇒ ต้องเตือน', () => {
    renderCalendar([entry({ id: 'r1', call_round: 1 })]);
    expect(within(dayRows()[0]).getByText('ไม่ได้แนบเบอร์ฉุกเฉิน')).toBeTruthy();
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

  it('🔴 สรุปทั้งเดือนใต้ชื่อ — กี่ครั้ง และแยกสามคำตอบ ไป/ไม่ไป/ยังไม่รู้ผล', () => {
    renderCalendar([
      entry({ id: 'r1', call_round: 1, scheduled_at: '2026-09-01T02:00:00Z', call_status: 'completed', call_outcome: 'confirmed' }),
      entry({ id: 'r2', call_round: 2, scheduled_at: '2026-09-03T02:00:00Z', call_status: 'completed', call_outcome: 'no_answer' }),
      entry({ id: 'r3', call_round: 3, scheduled_at: '2026-09-05T02:00:00Z', call_status: 'completed', call_outcome: 'declined' }),
    ]);
    showMonthView();
    const monthCell = screen.getAllByRole('cell')[0];
    expect(within(monthCell).getByText('3 ครั้ง')).toBeTruthy();
    expect(within(monthCell).getByText('ตอบว่าไป 1')).toBeTruthy();
    expect(within(monthCell).getByText('ตอบว่าไม่ไป 1')).toBeTruthy();
    expect(within(monthCell).getByText('ยังไม่รู้ผล 1')).toBeTruthy();
  });

  it('ช่องวันบอกผลด้วยคำสั้นของหมวด (ไม่ใช่คำยาวที่ล้นช่อง)', () => {
    renderCalendar([
      entry({ id: 'r1', call_round: 1, scheduled_at: '2026-09-01T02:00:00Z', call_status: 'completed', call_outcome: 'declined' }),
    ]);
    showMonthView();
    const dayCells = screen.getAllByRole('cell').slice(1);
    expect(dayCells.some((c) => within(c).queryByText('ตอบว่าไม่ไป'))).toBe(true);
    expect(dayCells.some((c) => within(c).queryByText(/ยกเลิก — ไม่ไปแล้ว/))).toBe(false);
  });

  it('คำอธิบายสีเป็นชุดเดียวกับหน้ารายวัน — เขียวไป เหลืองยังไม่รู้ผล แดงไม่ไป', () => {
    renderCalendar(twoRounds());
    showMonthView();
    expect(screen.getByText('เขียว = ตอบว่าไป')).toBeTruthy();
    expect(screen.getByText(/เหลือง = ยังไม่รู้ผล/)).toBeTruthy();
    expect(screen.getByText('แดง = ตอบว่าไม่ไป')).toBeTruthy();
  });
});

/**
 * 🔴 เจ้าของสั่ง 8 ก.ย. 2569: *"คนไหนไม่ไปขอสีแดงอ่อน ๆ ในช่องนั้นไปเลย เปิดมารู้เลยว่านี่แหละไม่ไป
 * และเรียงให้สีแดงอยู่บน ๆ"*
 */
describe('แถว "ไม่ไป" — พื้นแดงอ่อนทั้งแถว และอยู่บนสุด', () => {
  it('ไม่ไปตอน 15:30 ต้องอยู่เหนือ ตกลงตอน 15:23 — ไม่ใช่เรียงตามเวลาอย่างเดียว', () => {
    // 🔴 ต้องเป็น **คนละคน** — คนเดียวกันรวมเป็นแถวเดียวแล้ว (11 ก.ย. 2569)
    renderCalendar([
      entry({ id: 'ok', call_round: 1, call_status: 'completed', call_outcome: 'confirmed' }),
      entry({
        id: 'no',
        recipient_name: 'อีกคน',
        recipient_phone: '0899999999',
        call_round: 1,
        scheduled_at: '2026-09-07T08:30:00Z',
        call_status: 'completed',
        call_outcome: 'declined',
      }),
    ]);
    const items = dayRows();
    expect(items[0].getAttribute('data-category')).toBe('lost');
    expect(within(items[0]).getByText('15:30')).toBeTruthy();
    expect(items[1].getAttribute('data-category')).toBe('agreed');
  });

  it('แถวไม่ไปมีพื้นสี · แถวอื่นไม่มี', () => {
    renderCalendar([
      entry({ id: 'no', call_round: 1, call_status: 'completed', call_outcome: 'declined' }),
      entry({
        id: 'ok',
        recipient_name: 'อีกคน',
        recipient_phone: '0899999999',
        call_round: 1,
        scheduled_at: '2026-09-07T08:30:00Z',
        call_status: 'completed',
        call_outcome: 'confirmed',
      }),
    ]);
    const [lost, agreed] = dayRows();
    // พื้นย้อมมาจาก token `TONE.danger.wash` ตัวเดียว — ไม่ใช่สีที่พิมพ์เองในไฟล์จอ
    const washBg = TONE.danger.wash.split(' ')[0];
    expect(lost.className).toContain(washBg);
    expect(agreed.className).not.toContain(washBg);
  });
});

/**
 * ═══ ตำหนิของเจ้าของ 10 ก.ย. 2569 (ตรวจกับข้อมูลจริงในฐานก่อนแก้) ═══
 *
 * > *"1. ไม่แสดงการโทรติดต่อเบอร์ฉุกเฉิน คือ ไม่ยอมบอกว่าโทรหาหรือยัง
 * >  2. บันทึกการโทรติดตามแล้ว แต่ไม่มีให้กดแก้ไขหากต้องการเปลี่ยนวัน/เวลาที่ติดตาม
 * >  3. สายที่ 1 โทรสำเร็จ ไม่แสดงสีเขียว และไม่แสดงข้อความที่ตอบ
 * >  4. สายที่ 2 โทรแล้ว ไม่แสดงข้อความที่ตอบ"*
 */
describe('ตำหนิ 10 ก.ย. 2569', () => {
  it('🔴 สายที่ 1 มีผลว่าไป ต้องได้ **สีเขียวทั้งแถว** ไม่ใช่แค่ชิปเล็ก ๆ', () => {
    renderCalendar(twoRounds({ call_status: 'completed', call_outcome: 'acknowledged' }));
    const row = dayRows().find((r) => r.getAttribute('data-category') === 'agreed');
    expect(row).toBeTruthy();
    expect(row!.className).toContain(TONE.success.wash.split(' ')[0]);
  });

  it('สามสีตามที่เจ้าของเคาะ: เขียว=ไป · เหลือง=ไม่ได้คำตอบ · แดง=ไม่ไป · ยังไม่มีผล=ขาว', () => {
    // คนละเบอร์ = คนละแถว (คนเดียวกันจะถูกรวมเป็นแถวเดียว)
    renderCalendar([
      entry({ id: 'a', recipient_phone: '0811111111', call_round: 1, call_status: 'completed', call_outcome: 'confirmed' }),
      entry({ id: 'b', recipient_phone: '0822222222', call_round: 1, call_status: 'completed', call_outcome: 'declined' }),
      entry({ id: 'c', recipient_phone: '0833333333', call_round: 1, call_status: 'completed', call_outcome: 'no_answer' }),
      entry({ id: 'd', recipient_phone: '0899999999', call_round: 1 }),
    ]);
    const washOf = (cat: string) =>
      dayRows().find((r) => r.getAttribute('data-category') === cat)?.className ?? '';
    expect(washOf('agreed')).toContain(TONE.success.wash.split(' ')[0]);
    expect(washOf('lost')).toContain(TONE.danger.wash.split(' ')[0]);
    expect(washOf('unreachable')).toContain(TONE.warn.wash.split(' ')[0]);
    // ยังไม่มีผล = ขาว — ถ้าระบายหมดทุกแถว สีจะเลิกบอกอะไร
    expect(washOf('overdue')).not.toContain('bg-amber-50');
  });

  it('🔴 ช่อง "เขาตอบว่าอะไร" ต้องโชว์ **คำที่เขาพูดเอง** ไม่ใช่คำบรรยายของ AI', () => {
    renderCalendar([
      entry({
        id: 'a',
        call_round: 1,
        call_status: 'completed',
        call_outcome: 'declined',
        call_reply: 'ใช่ค่ะ · ไม่ไปแล้ว รถยางแตก',
        call_summary: 'ผู้รับสายแจ้งว่ารถยางแตก จึงไม่ได้ไปหน่วยงาน',
      }),
    ]);
    const row = dayRows()[0];
    expect(row.textContent).toContain('ไม่ไปแล้ว รถยางแตก');
    // สรุปของ AI ยังอยู่ แต่เป็นตัวรอง — ต้องมีคำกำกับว่าเป็นของ AI ไม่ใช่คำของเขา
    expect(row.textContent).toContain('สรุปโดย AI:');
  });

  it('ไม่มีคำพูดแต่มีสรุป ⇒ ใช้สรุปแทน · ไม่มีทั้งคู่ ⇒ บอกตรง ๆ ห้ามเดาว่าเขาไม่พูด', () => {
    renderCalendar([
      entry({ id: 'a', call_round: 1, call_status: 'completed', call_outcome: 'declined', call_summary: 'สรุปล้วน' }),
      entry({
        id: 'b',
        recipient_phone: '0899999999',
        call_round: 1,
        call_status: 'completed',
        call_outcome: 'unresponsive',
      }),
    ]);
    const text = screen.getByTestId('day-calls').textContent ?? '';
    expect(text).toContain('สรุปล้วน');
    expect(text).toContain('ไม่มีคำตอบและไม่มีสรุปจาก AI');
  });

  it('🔴 ช่องเบอร์ฉุกเฉิน **ห้ามถูกซ่อนด้วย CSS** — เดิมเห็นเฉพาะจอกว้างกว่า 1280px', () => {
    renderCalendar([entry({ id: 'a', call_round: 1, emergency_phone: '+66632138466' })]);
    const head = screen.getByText('เบอร์ฉุกเฉิน');
    expect(head.className).not.toContain('hidden');
    expect(head.className).not.toContain('xl:table-cell');
    expect(dayRows()[0].textContent).toContain('+66632138466');
  });

  it('เบอร์ฉุกเฉินบอกได้แค่ "แนบไปแล้ว" — Lumos ไม่ส่งกลับว่าโทรหรือยัง ห้ามเขียนว่าโทรแล้ว', () => {
    renderCalendar([
      entry({
        id: 'a',
        call_round: 1,
        call_status: 'completed',
        call_outcome: 'declined',
        emergency_phone: '+66632138466',
      }),
    ]);
    const text = dayRows()[0].textContent ?? '';
    expect(text).toContain('แนบไปกับสายแล้ว');
    expect(text).toContain('ไม่ได้บอกว่าโทรหรือยัง');
    expect(text).not.toContain('โทรแล้ว');
  });

  it('🔴 มีปุ่มแก้ไขวัน/เวลา **บนแถว** ไม่ต้องเข้าป๊อปก่อน', () => {
    const onEditRound = vi.fn();
    renderCalendar([entry({ id: 'a', call_round: 1 })], { onEditRound });
    const btn = screen.getByRole('button', { name: /แก้ไขวันเวลาของ/ });
    fireEvent.click(btn);
    expect(onEditRound).toHaveBeenCalledTimes(1);
    expect((onEditRound.mock.calls[0][0] as { entry: FollowEntry }).entry.id).toBe('a');
  });

  it('สายที่ยกเลิก/ปิดงานแล้วไม่มีปุ่มแก้ไข (แก้ไปก็ไม่มีผล)', () => {
    renderCalendar([entry({ id: 'a', call_round: 1, cancelled: true })], { onEditRound: vi.fn() });
    expect(screen.queryByRole('button', { name: /แก้ไขวันเวลาของ/ })).toBeNull();
  });
});

/**
 * ═══ ตำหนิ 11 ก.ย. 2569 — หลายรอบขึ้นหลายบรรทัด ═══
 *
 * > *"หน้าติดตามพอเพิ่มโทรหลายรอบ มันขึ้นหลายบรรทัดอะ คนดูเขางง"*
 *
 * 🔴 หนึ่งแถว = หนึ่ง**คน** · ทุกรอบอยู่ในแถวนั้น **ห้ามมีข้อมูลหาย**
 */
describe('ตำหนิ 11 ก.ย. 2569 — รวมสายของคนเดียวกันเป็นแถวเดียว', () => {
  const threeRounds = () => [
    entry({ id: 'r1', call_round: 1, scheduled_at: '2026-09-07T08:23:00Z' }),
    entry({ id: 'r2', call_round: 2, scheduled_at: '2026-09-07T08:30:00Z' }),
    entry({ id: 'r3', call_round: 3, scheduled_at: '2026-09-07T09:30:00Z' }),
  ];

  it('🔴 คนเดียวตั้ง 3 รอบ = 1 แถว ไม่ใช่ 3 แถว · ชื่อขึ้นครั้งเดียว', () => {
    renderCalendar(threeRounds());
    const items = dayRows();
    expect(items).toHaveLength(1);
    expect(items[0].getAttribute('data-rounds')).toBe('3');
    expect(within(items[0]).getAllByText('สู้สู้ จ้าาา')).toHaveLength(1);
  });

  it('ทุกรอบยังอยู่ครบในแถวนั้น — เวลาและป้ายรอบไม่หาย', () => {
    renderCalendar(threeRounds());
    const row = dayRows()[0];
    for (const t of ['15:23', '15:30', '16:30']) expect(within(row).getByText(t)).toBeTruthy();
    for (const n of [1, 2, 3]) expect(within(row).getByText(`รอบโทรที่ ${n}`)).toBeTruthy();
  });

  it('บอกใต้ชื่อว่าวันนี้กี่สาย — กันคนอ่านว่าแถวนี้มีสายเดียว', () => {
    renderCalendar(threeRounds());
    expect(within(dayRows()[0]).getByText('วันนี้ 3 สาย')).toBeTruthy();
    // มีสายเดียวไม่ต้องบอก (รกเปล่า ๆ)
    cleanup();
    renderCalendar([entry({ id: 'r1', call_round: 1 })]);
    expect(within(dayRows()[0]).queryByText(/วันนี้ .* สาย/)).toBeNull();
  });

  it('🔴 ตัวเลขบนการ์ดยังนับเป็น "สาย" เหมือนเดิม — รวมแถวห้ามทำเลขเปลี่ยน', () => {
    renderCalendar(threeRounds());
    expect(statValue('สายที่ต้องตาม')).toBe('3');
    expect(dayRows()).toHaveLength(1);
  });

  it('ท้ายตารางบอกทั้งจำนวนคนและจำนวนสาย', () => {
    renderCalendar(threeRounds());
    expect(screen.getByText(/จากทั้งหมด/).textContent?.replace(/\s+/g, ' ')).toContain(
      '1 คน · 3 สาย',
    );
  });

  it('ปุ่มแก้ไขมีทีละรอบ — แก้เวลารอบไหนก็กดดินสอของรอบนั้น', () => {
    const onEditRound = vi.fn();
    renderCalendar(threeRounds(), { onEditRound });
    const pencils = screen.getAllByRole('button', { name: /แก้ไขวันเวลาของ/ });
    expect(pencils).toHaveLength(3);
    fireEvent.click(pencils[2]);
    expect((onEditRound.mock.calls[0][0] as { entry: FollowEntry }).entry.id).toBe('r3');
  });

  it('สีทั้งแถวใช้เรื่องด่วนที่สุดของคนนั้น — ไม่ไปชนะไป', () => {
    renderCalendar([
      entry({ id: 'r1', call_round: 1, call_status: 'completed', call_outcome: 'confirmed' }),
      entry({
        id: 'r2',
        call_round: 2,
        scheduled_at: '2026-09-07T08:30:00Z',
        call_status: 'completed',
        call_outcome: 'declined',
      }),
    ]);
    const row = dayRows()[0];
    expect(row.getAttribute('data-category')).toBe('lost');
    expect(row.className).toContain(TONE.danger.wash.split(' ')[0]);
    // แต่ผลของทั้งสองรอบยังอ่านได้ในแถว
    expect(within(row).getByText('ตอบว่าไป')).toBeTruthy();
    expect(within(row).getByText('ตอบว่าไม่ไป')).toBeTruthy();
  });

  it('กรองรอบแล้วแถวเหลือเฉพาะรอบนั้น', () => {
    renderCalendar(threeRounds(), { roundFilter: 2 });
    const row = dayRows()[0];
    expect(row.getAttribute('data-rounds')).toBe('1');
    expect(within(row).getByText('รอบโทรที่ 2')).toBeTruthy();
    expect(within(row).queryByText('รอบโทรที่ 1')).toBeNull();
  });
});
