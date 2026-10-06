import { readFileSync } from 'node:fs';
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
import { render, screen, cleanup, within, fireEvent, waitFor } from '@testing-library/react';

import FollowPlanningCalendar from './FollowPlanningCalendar';
import { groupFollowEntries } from '@/lib/followGrouping';
import { buildFollowPlanningRows } from '@/lib/followPlanning';
import { withFollowDayCalls } from '@/lib/followDayCall';
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
    lastLoadedAt?: Date | null;
    onSelect?: (ymd: string) => void;
    onStaffResult?: (round: { entry: FollowEntry }, outcome: string) => unknown;
    onCancelRound?: (round: { entry: FollowEntry }) => void;
    onFinishRound?: (round: { entry: FollowEntry }, outcome: string) => void;
  } = {},
) {
  const rows = buildFollowPlanningRows(groupFollowEntries(entries, NOW), NOW);
  render(
    <FollowPlanningCalendar
      rows={rows}
      month="2026-09"
      onMonthChange={() => {}}
      selectedYmd={opts.selectedYmd ?? TODAY}
      onSelect={opts.onSelect ?? (() => {})}
      onOpenCell={opts.onOpenCell ?? (() => {})}
      roundFilter={opts.roundFilter ?? 'all'}
      roundsSlot={opts.roundsSlot}
      onEditRound={opts.onEditRound}
      lastLoadedAt={opts.lastLoadedAt ?? null}
      onStaffResult={opts.onStaffResult as never}
      onCancelRound={opts.onCancelRound}
      onFinishRound={opts.onFinishRound}
    />,
  );
  return rows;
}

/** Radix Tabs สลับด้วย mousedown (ไม่ใช่ click) — กดจริงบนจอก็คือ mousedown ก่อนอยู่แล้ว */
const showMonthView = () =>
  fireEvent.mouseDown(screen.getByRole('tab', { name: /รายเดือน/ }), { button: 0 });

/**
 * 🔴 การ์ดตัวเลข 4 ใบถูกถอด (เจ้าของเคาะ 3 ต.ค. 2569 — รวมเข้าตารางสายของแผงขั้นตอน)
 * เลขที่เคยเช็คบนการ์ด ย้ายไปคุมที่ `src/lib/followCallMatrix.test.ts` (บวกกันได้พอดีทุกแถว)
 */
const noStatCards = () => expect(document.querySelector('[data-stat]')).toBeNull();

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
    // 🔴 การ์ดตัวเลข 4 ใบถอดแล้ว (3 ต.ค. 2569) — เลขอยู่ในตารางสายของแผงขั้นตอนที่เดียว
    noStatCards();
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
    expect(within(items[0]).getByText('สายที่ 1')).toBeTruthy();
    expect(within(items[0]).getByText('สายที่ 2')).toBeTruthy();
    // 🔴 ผลของสาย 1 ต้องไม่ลามไปทับสาย 2 — ช่องคำตอบมีข้อความของสาย 1 ช่องเดียว
    expect(within(items[0]).getByText('ตอบว่าไป')).toBeTruthy();
    expect(within(items[0]).getByText('รอโทร · เลยเวลานัด')).toBeTruthy();
    expect(within(items[0]).getAllByText(/ผู้รับสายบอกว่าไปแน่นอน/)).toHaveLength(1);
    // บรรทัดของทั้งสามคอลัมน์ต้องเท่ากัน (บรรทัดที่ N = สายเดียวกัน)
    expect(cells[2].querySelectorAll(':scope > span > span').length).toBe(2);
  });

  it('ไม่ไป ⇒ แดง + เหตุผลที่เขาตอบ', () => {
    renderCalendar(
      twoRounds({ call_status: 'completed', call_outcome: 'declined', call_summary: 'ได้งานที่อื่นใกล้บ้านกว่าแล้ว' }),
    );
    const first = dayRows()[0];
    expect(within(first).getByText('ตอบว่าไม่ไป')).toBeTruthy();
    expect(within(first).getByText(/ได้งานที่อื่นใกล้บ้านกว่าแล้ว/)).toBeTruthy();
  });

  it('ไม่รับสาย ⇒ ชิปบอก "ไม่รับสาย" คำเดียวกับช่องของแผงขั้นตอน (6 ต.ค. 2569)', () => {
    renderCalendar(twoRounds({ call_status: 'completed', call_outcome: 'no_answer' }));
    const first = dayRows()[0];
    expect(within(first).getAllByText(/ไม่รับสาย/).length).toBeGreaterThan(0);
    // โทรไม่ติด (สาย 1) + เลยเวลานัด (สาย 2) = ยังไม่รู้ผลทั้งคู่
  });

  it('🔴 เลือก "สายที่ 2" ⇒ ลิสต์เหลือสายเดียว และเลขหัวคิดใหม่ตามที่เลือก', () => {
    renderCalendar(twoRounds({ call_status: 'completed', call_outcome: 'confirmed' }), { roundFilter: 2 });
    const items = dayRows();
    expect(items).toHaveLength(1);
    expect(within(items[0]).getByText('สายที่ 2')).toBeTruthy();
  });

  it('เลือกสายที่วันนั้นไม่มี ⇒ บอกให้กลับไปกด "ทุกสาย" ไม่ใช่ปล่อยจอว่าง', () => {
    renderCalendar([entry({ id: 'r1', call_round: 1 })], { roundFilter: 2 });
    expect(screen.getByText(/วันที่ .+ ไม่มีสายที่ 2/)).toBeTruthy();
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
    // QA 5 ต.ค. 2569: ย่อเหลือสถานะสั้น · ยังห้ามเขียนว่าโทรแล้ว
    expect(within(li).getByText('ยังไม่รู้ว่าโทรหรือยัง')).toBeTruthy();
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

  it('🔴 สรุปทั้งเดือนใต้ชื่อ — กี่สาย และแยกช่องเดียวกับแผง (ไป/ไม่ไป/ไม่รับสาย · 6 ต.ค. 2569)', () => {
    renderCalendar([
      entry({ id: 'r1', call_round: 1, scheduled_at: '2026-09-01T02:00:00Z', call_status: 'completed', call_outcome: 'confirmed' }),
      entry({ id: 'r2', call_round: 2, scheduled_at: '2026-09-03T02:00:00Z', call_status: 'completed', call_outcome: 'no_answer' }),
      entry({ id: 'r3', call_round: 3, scheduled_at: '2026-09-05T02:00:00Z', call_status: 'completed', call_outcome: 'declined' }),
    ]);
    showMonthView();
    const monthCell = screen.getAllByRole('cell')[0];
    expect(within(monthCell).getByText('3 สาย')).toBeTruthy();
    expect(within(monthCell).getByText('ตอบว่าไป 1')).toBeTruthy();
    expect(within(monthCell).getByText('ตอบว่าไม่ไป 1')).toBeTruthy();
    expect(within(monthCell).getByText('ไม่รับสาย 1')).toBeTruthy();
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

  it('คำอธิบายสีเป็นชุดเดียวกับป้ายและแผง — ไป / ไม่ไป / ไม่รับสาย / สรุปไม่ได้ / รอโทร… / ยกเลิก', () => {
    renderCalendar(twoRounds());
    showMonthView();
    const legend = within(screen.getByRole('group', { name: 'ความหมายของสี' }));
    for (const w of ['ตอบว่าไป', 'ตอบว่าไม่ไป', 'ไม่รับสาย', 'สรุปไม่ได้', 'รอโทร · เลยเวลานัด', 'ยกเลิก']) {
      expect(legend.getByText(w)).toBeTruthy();
    }
  });

  /** 🔴 เจ้าของสั่ง 1 ต.ค. 2569: *"พวกอักษรที่เขียนว่า เขียว แดง ฯลฯ เอาออก เหลือแค่สีกับคำตอบก็พอ มันรก"* */
  it('🔴 คำอธิบายสีเหลือแค่จุดสี + คำตอบ — ไม่มีชื่อสี ไม่มีวงเล็บ', () => {
    renderCalendar(twoRounds());
    showMonthView();
    const legend = screen.getByRole('group', { name: 'ความหมายของสี' });
    const text = legend.textContent ?? '';
    for (const word of ['เขียว', 'แดง', 'เหลือง', 'น้ำเงิน', 'ส้ม', 'เทา', '=', '(']) {
      expect(text).not.toContain(word);
    }
    expect(within(legend).getAllByText(/./).length).toBe(8);
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
    renderCalendar(twoRounds({ call_status: 'completed', call_outcome: 'confirmed' }));
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
    // QA 5 ต.ค. 2569: สรุปของ AI ไม่ขึ้นเป็นร้อยแก้วทุกแถวแล้ว — อยู่ตอนชี้ (title) พร้อมคำกำกับว่าเป็นของ AI
    expect(row.textContent).not.toContain('ผู้รับสายแจ้งว่ารถยางแตก');
    expect(row.querySelector('[title*="AI สรุป: ผู้รับสายแจ้งว่ารถยางแตก"]')).toBeTruthy();
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
    expect(text).toContain('ยังไม่รู้ว่าโทรหรือยัง');
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
    for (const n of [1, 2, 3]) expect(within(row).getByText(`สายที่ ${n}`)).toBeTruthy();
  });

  it('บอกใต้ชื่อว่าวันนี้กี่สาย — กันคนอ่านว่าแถวนี้มีสายเดียว', () => {
    renderCalendar(threeRounds());
    expect(within(dayRows()[0]).getByText('3 สาย')).toBeTruthy();
    // มีสายเดียวไม่ต้องบอก (รกเปล่า ๆ)
    cleanup();
    renderCalendar([entry({ id: 'r1', call_round: 1 })]);
    expect(within(dayRows()[0]).queryByText(/^\d+ สาย$/)).toBeNull();
  });

  it('🔴 ตัวเลขบนการ์ดยังนับเป็น "สาย" เหมือนเดิม — รวมแถวห้ามทำเลขเปลี่ยน', () => {
    renderCalendar(threeRounds());
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
    expect(within(row).getByText('สายที่ 2')).toBeTruthy();
    expect(within(row).queryByText('สายที่ 1')).toBeNull();
  });
});

/**
 * ═══ ส่งไม่ถึง Lumos ต้องเห็นบนแถว (11 ก.ย. 2569) ═══
 *
 * เจ้าของถามถึงเคส "ลูกชาย สองคน" ว่าสายแรกทำไมไม่ปรับสถานะ · ตรวจฐานวันนั้นเจอว่า
 * **12 จาก 42 สายเป็น `push_failed` ไม่ได้ผลสักสาย** แต่จอขึ้นว่า "เลยเวลานัด"
 * เหมือนสายที่ Lumos รับไปแล้วแต่เงียบ — คนละปัญหา แก้คนละทาง
 */
describe('ส่งไม่ถึง Lumos (push_failed)', () => {
  const failed = (over: Partial<FollowEntry> = {}) =>
    entry({ id: 'f1', call_round: 1, dispatch_state: 'push_failed', ...over });

  it('🔴 ขึ้นป้าย "ส่งไม่ถึง Lumos" — ไม่ใช่ปล่อยให้อ่านว่าเลยเวลานัดเฉย ๆ', () => {
    renderCalendar([failed()]);
    const row = dayRows()[0];
    expect(within(row).getByText('ส่งไม่ถึง Lumos')).toBeTruthy();
    // ป้ายเดิมยังอยู่ — บอกทั้งสองเรื่อง ไม่ใช่เอาอันใหม่ไปทับ
    expect(within(row).getByText('รอโทร · เลยเวลานัด')).toBeTruthy();
  });

  it('บอกเหตุจริงที่ Lumos ตอบกลับ แทนที่จะเป็นขีดกลางว่าง ๆ', () => {
    renderCalendar([failed({ dispatch_error: 'Lumos push reminders ล้มเหลว: 429 Too Many Requests' })]);
    expect(within(dayRows()[0]).getByText(/429 Too Many Requests/)).toBeTruthy();
  });

  it('ไม่มีเหตุจดไว้ (ฐานยังไม่ migrate) ⇒ ยังขึ้นป้าย แต่ไม่แต่งเหตุขึ้นเอง', () => {
    renderCalendar([failed({ dispatch_error: null })]);
    const row = dayRows()[0];
    expect(within(row).getByText('ส่งไม่ถึง Lumos')).toBeTruthy();
    expect(within(row).queryByText(/ส่งไม่สำเร็จ:/)).toBeNull();
  });

  it('🔴 ได้ผลกลับมาแล้วห้ามเตือนย้อนหลัง (ส่งซ้ำแล้วสำเร็จก็มี)', () => {
    renderCalendar([failed({ call_status: 'completed', call_outcome: 'confirmed' })]);
    expect(within(dayRows()[0]).queryByText('ส่งไม่ถึง Lumos')).toBeNull();
  });

  it('🔴 ไม่ไปแตะตัวเลขบนการ์ด — push_failed เป็นป้ายเสริม ไม่ใช่หมวดใหม่', () => {
    renderCalendar([failed()]);
    expect(dayRows()[0].getAttribute('data-category')).toBe('overdue');
  });
});

/**
 * ═══ แผนดัน 20/20 รอบ 1–3 (12 ก.ย. 2569) ═══
 *
 * ฐาน: ผู้ทดสอบตาใหม่ให้ 62/100 · ทุกข้อที่เพิ่มคือ "คำถามในหัวคนใหม่ที่ไม่มีคำตอบบนจอ"
 */
describe('แผน 20/20 — คำตอบต้องอยู่บนจอ', () => {
  /** 🔴 เจ้าของสั่งถอดการ์ด "เริ่มใช้งานหน้านี้" 1 ต.ค. 2569 (*"เอาออกไปสิ"*) — ว่างทั้งระบบก็ไม่ขึ้น */
  it('🔴 ไม่มีการ์ด "เริ่มใช้งานหน้านี้" แม้ยังไม่มีข้อมูลสักแถว', () => {
    renderCalendar([]);
    expect(screen.queryByText('เริ่มใช้งานหน้านี้')).toBeNull();
    expect(screen.queryByText(/AI โทรเองตามเวลา/)).toBeNull();
    expect(screen.queryByText(/ผลกลับช้าได้ถึงราว 2 ชั่วโมง/)).toBeNull();
  });

  /** 🔴 เจ้าของสั่ง 1 ต.ค. 2569: "ถ้าไม่มีข้อมูลก็เป็น 0 ไป" — การ์ดห้ามเปลี่ยนทรงตอนสลับแท็บ (แทนกติกา 12 ก.ย. ที่ซ่อนวงกลม) */
  it('🔴 ยังไม่มีผลเดือนนี้ ⇒ วงกลมยังอยู่ ขึ้น 0% · ไม่มีกล่อง "ยังไม่มีผลเดือนนี้"', () => {
    renderCalendar([entry({ id: 'a', call_round: 1 })]);
    expect(screen.queryByText('ยังไม่มีผลเดือนนี้')).toBeNull();
    expect(screen.getByRole('img', { name: 'ตอบว่าไป' })).toBeTruthy();
    expect(screen.getByText('0.0%')).toBeTruthy();
  });

  it('🔴 ไม่มีสายเลย ⇒ ตารางรายวันยังมีหัวคอลัมน์ + แถว "ไม่มีสายที่ต้องตาม" + แถบแบ่งหน้าเป็น 0', () => {
    renderCalendar([]);
    expect(screen.getByText('ผู้ที่ต้องติดตาม / ติดต่อ')).toBeTruthy();
    expect(screen.getByText('ไม่มีสายที่ต้องตาม')).toBeTruthy();
    expect(screen.getByText(/แสดง 0 ถึง 0 จากทั้งหมด/)).toBeTruthy();
  });

  it('มีผลแล้ว ⇒ วงกลมกลับมา', () => {
    renderCalendar([entry({ id: 'a', call_round: 1, call_status: 'completed', call_outcome: 'confirmed' })]);
    expect(screen.getByRole('img', { name: 'ตอบว่าไป' })).toBeTruthy();
    expect(screen.queryByText('ยังไม่มีผลเดือนนี้')).toBeNull();
  });

  it('"ต้องตามด่วน" บอกขอบเขตบนหัว · ประโยคสอนวิธีใช้ถอดแล้ว (QA 5 ต.ค. 2569)', () => {
    renderCalendar([entry({ id: 'a', call_round: 1 })]);
    expect(screen.getByText('ต้องตามด่วน · ทั้งเดือน')).toBeTruthy();
    expect(screen.queryByText(/กดปุ่มโทรข้างชื่อ/)).toBeNull();
  });

  /** 🔴 เจ้าของสั่ง 1 ต.ค. 2569 (Choice "เอาออกทั้ง 2 จุด") — บรรทัดอัปเดตเหลือแค่เวลา */
  it('🔴 ท้ายตารางเหลือแค่เวลาอัปเดต ไม่มีประโยคอธิบาย', () => {
    renderCalendar([entry({ id: 'a', call_round: 1 })], {
      lastLoadedAt: new Date('2026-09-07T09:05:00Z'),
    });
    const foot = screen.getByText(/อัปเดตล่าสุด/);
    expect(foot.textContent?.replace(/\s+/g, ' ').trim()).toBe('อัปเดตล่าสุด 16:05 น.');
    expect(foot.textContent).not.toContain('รีเฟรช');
    expect(foot.textContent).not.toContain('ชั่วโมง');
  });

  it('ไม่รู้เวลาอัปเดต ⇒ ไม่แต่งเวลาขึ้นเอง', () => {
    renderCalendar([entry({ id: 'a', call_round: 1 })]);
    expect(screen.queryByText(/อัปเดตล่าสุด/)).toBeNull();
  });
});

/**
 * วัดรอบที่มีข้อมูลจริง (13 ก.ย. 2569) ได้ 97/100 — เหลือสองจุดที่เป็นเรื่องของ "คำ"
 */
describe('ช่องว่างที่เหลือจากรอบวัดที่มีข้อมูล', () => {
  it('🔴 "เลยเวลานัด" ต้องบอกด้วยว่า **ส่งให้ AI แล้ว** — คนละเรื่องกับ "ไม่ได้ส่งให้ AI"', () => {
    renderCalendar([entry({ id: 'a', call_round: 1, call_status: 'delivered' })]);
    const row = dayRows()[0];
    expect(within(row).getByText('รอโทร · เลยเวลานัด')).toBeTruthy();
    expect(within(row).getByText(/ส่งให้ AI แล้ว ยังไม่มีผลกลับ/)).toBeTruthy();
    // 🔴 1 ต.ค. 2569: ถอดท่อนผลกลับช้าออกแล้ว — เหลือแค่ข้อเท็จจริงว่าส่งแล้ว
    expect(row.textContent).not.toContain('ชั่วโมง');
  });

  it('ไม่ได้ส่งให้ AI ⇒ ต้องไม่ขึ้นข้อความว่าส่งแล้ว', () => {
    renderCalendar([entry({ id: 'a', call_round: 1, call_status: null, dispatch_state: 'suppressed' })]);
    expect(within(dayRows()[0]).queryByText(/ส่งให้ AI แล้ว/)).toBeNull();
  });
});


/**
 * ═══ ผลละเอียด (micro) + Success Rate — เจ้าของสั่ง 13 ก.ย. 2569 ═══
 * ของเดิมนับ `acknowledged` เป็น "ตอบว่าไป" ทั้งกอง ⇒ วงโกหก
 */
describe('ผลของเดือน = นิยามเดียวกับกล่องขั้นตอนของสาย (เจ้าของ 6 ต.ค. 2569)', () => {
  it('🔴 4 ช่อง ตอบว่าไป / ตอบว่าไม่ไป / ไม่รับสาย / สรุปไม่ได้ · ไม่มีถังละเอียด 7 ถัง', () => {
    renderCalendar([
      entry({ id: 'a', call_round: 1, call_status: 'completed', call_outcome: 'confirmed' }),
      entry({ id: 'b', call_round: 1, recipient_phone: '0899999998', recipient_name: 'คนที่สอง', call_status: 'failed', call_outcome: 'no_answer' }),
    ]);
    const box = screen.getByTestId('month-result-boxes');
    expect(within(box).getByText('ตอบว่าไป').closest('div')!.textContent).toContain('1');
    expect(within(box).getByText('ไม่รับสาย').closest('div')!.textContent).toContain('1');
    expect(within(box).getByText('สรุปไม่ได้').closest('div')!.textContent).toContain('0');
    expect(screen.getByText('จาก 2 สายที่มีผล')).toBeTruthy();
    for (const gone of ['คุยแล้ว บอกว่าไป', 'มีคนรับสาย', 'ได้คุยเรื่องของเรา', 'ไม่ใช่เจ้าตัว']) {
      expect(screen.queryByText(gone)).toBeNull();
    }
  });

  it('🔴 แยก AI โทร / คนโทร (เจ้าของ 6 ต.ค. 2569 "รวม AI กับคนโทร") — AI + คน = รวม ทุกแถว', () => {
    renderCalendar([
      entry({ id: 'a', call_round: 1, call_status: 'completed', call_outcome: 'confirmed' }),
      entry({ id: 'b', call_round: 1, recipient_phone: '0899999998', recipient_name: 'คนที่สอง', call_status: 'completed', call_outcome: 'confirmed' }),
      entry({
        id: 'c',
        call_round: 1,
        recipient_phone: '0899999997',
        recipient_name: 'คนที่สาม',
        call_mode: 'manual',
        call_status: null,
        staff_call_outcome: 'confirmed',
        staff_called_at: '2026-10-06T03:00:00Z',
      }),
    ]);
    const box = screen.getByTestId('month-result-boxes');
    expect(within(box).getByText('AI โทร')).toBeTruthy();
    expect(within(box).getByText('คนโทร')).toBeTruthy();
    expect(screen.getByTestId('month-went-ai').textContent).toBe('2');
    expect(screen.getByTestId('month-went-manual').textContent).toBe('1');
    for (const k of ['went', 'notWent', 'noAnswer', 'unclear']) {
      const ai = Number(screen.getByTestId(`month-${k}-ai`).textContent);
      const manual = Number(screen.getByTestId(`month-${k}-manual`).textContent);
      expect(ai + manual, k).toBe(k === 'went' ? 3 : 0);
    }
  });

  /** 🔴 เจ้าของสั่ง 1 ต.ค. 2569 (Choice "เอาออกทั้งสองอย่าง") — แถว "ยังไม่มีผลกลับ" + ประโยคใต้ถังถอดแล้ว */
  it('🔴 การ์ดผลของเดือนไม่มีแถว "ยังไม่มีผลกลับ" และไม่มีประโยค "ถังพวกนี้อ่านจาก…"', () => {
    renderCalendar([entry({ id: 'a', call_round: 1 })]);
    expect(screen.queryByText('ยังไม่มีผลกลับ')).toBeNull();
    expect(screen.queryByText(/ถังพวกนี้อ่านจากคำที่เขาพูด/)).toBeNull();
  });
});

/** 🔴 เจ้าของ Choice 1 ต.ค. 2569 — ใต้เวลาของแต่ละสายโชว์เลขจริง ไม่ใช่กองที่ 3 */
describe('เลขของสายเดียว = เลขจริง', () => {
  it('แถวเก่าไม่มีชุด สายที่ 5 ขึ้นว่า "สายที่ 5" (ไม่ใช่สายที่ 3) · ข้อความตัวกรองกอง 3 = "สายที่ 3 ขึ้นไป"', () => {
    renderCalendar([entry({ id: 'r5', call_round: 5 })], { roundFilter: 3 });
    expect(screen.getByText('สายที่ 5')).toBeTruthy();
    expect(screen.queryByText('สายที่ 3')).toBeNull();
    expect(screen.getAllByText(/สายที่ 3 ขึ้นไป/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/รอบโทรที่/)).toBeNull();
  });
});

/**
 * 🔴 เจ้าของสั่ง 1 ต.ค. 2569: *"ตัวเลขที่ลงยาวอะมันต้อง วันที่ 1 สายที่ 1 2 วันที่ 2 สายที่ 1 2 ไม่ใช่ 1 2 3 4 5 6"*
 * ตารางหลายวันนับ call_round ต่อทั้งชุด (บทของ AI) — จอต้องนับใหม่ทุกวัน · แท็บ "สายที่ 1" = สายแรกของวันนั้น
 */
describe('ตารางหลายวัน — "วันที่ D · สายที่ N"', () => {
  const twoDays = () =>
    withFollowDayCalls([
      entry({ id: 'd1a', group_id: 'g', call_round: 1, scheduled_at: '2026-09-06T02:00:00Z' }),
      entry({ id: 'd1b', group_id: 'g', call_round: 2, scheduled_at: '2026-09-06T08:00:00Z' }),
      entry({ id: 'd2a', group_id: 'g', call_round: 3, scheduled_at: '2026-09-07T02:00:00Z' }),
      entry({ id: 'd2b', group_id: 'g', call_round: 4, scheduled_at: '2026-09-07T08:00:00Z' }),
    ]);

  it('วันที่ 2 ของชุด ⇒ "วันที่ 2 · สายที่ 1" "วันที่ 2 · สายที่ 2" — ไม่ใช่ 3 กับ 4', () => {
    renderCalendar(twoDays());
    const row = dayRows()[0];
    expect(within(row).getByText('วันที่ 2 · สายที่ 1')).toBeTruthy();
    expect(within(row).getByText('วันที่ 2 · สายที่ 2')).toBeTruthy();
    expect(within(row).queryByText(/สายที่ [34]/)).toBeNull();
  });

  it('🔴 แท็บ "สายที่ 1" ⇒ สายแรกของวันที่ 2 (เดิมทั้งวันไปกอง "3 ขึ้นไป" แล้วแท็บ 1 ว่าง)', () => {
    renderCalendar(twoDays(), { roundFilter: 1 });
    const row = dayRows()[0];
    expect(row.getAttribute('data-rounds')).toBe('1');
    expect(within(row).getByText('วันที่ 2 · สายที่ 1')).toBeTruthy();
  });
});

/** 🔴 เจ้าของสั่ง 1 ต.ค. 2569: *"มันต้องโชว์วันนั้นๆไม่ใช่โชว์แค่คำว่า วันนี้"* */
describe('ปุ่มวันที่ของมุมมองรายวัน', () => {
  it('ปุ่มโชว์วันที่เลือกอยู่ (ไม่ใช่คำว่า "วันนี้") · กดแล้วเลือกจากปฏิทินได้ · "วันนี้" อยู่ในปฏิทิน', async () => {
    const onSelect = vi.fn();
    renderCalendar(twoRounds(), { selectedYmd: '2026-09-08', onSelect });
    const pill = screen.getByTestId('day-pill');
    expect(pill.textContent).toMatch(/8 ก\.ย\. 2569/);
    expect(screen.queryByRole('button', { name: 'วันนี้' })).toBeNull();
    fireEvent.click(pill);
    fireEvent.click(await screen.findByRole('button', { name: 'วันนี้' }));
    expect(onSelect).toHaveBeenCalledWith(TODAY);
  });

  it('วันนี้อยู่แล้ว ⇒ ปุ่มยังโชว์วันที่ของวันนี้ · ทางลัด "วันนี้" ในปฏิทินกดไม่ได้', async () => {
    renderCalendar(twoRounds());
    const pill = screen.getByTestId('day-pill');
    expect(pill.textContent).toMatch(/7 ก\.ย\. 2569/);
    fireEvent.click(pill);
    expect(((await screen.findByRole('button', { name: 'วันนี้' })) as HTMLButtonElement).disabled).toBe(true);
  });
});

/** 🔴 เจ้าของ Choice 1 ต.ค. 2569 — "ติดต่อสำเร็จ / ไม่สำเร็จ / ยกเลิก" บนแถว ไม่ต้องเปิดป๊อป */
describe('ปุ่มลงผลของสายที่คนโทร (บนแถว)', () => {
  const manual = (over: Partial<FollowEntry> = {}) =>
    entry({ id: 'm1', call_round: 1, call_mode: 'manual', call_status: null, dispatch_state: 'manual', ...over });

  it('🔴 สายคนโทรที่ยังไม่ลงผล ⇒ ช่อง "เขาตอบว่าอะไร" มี ไป / ไม่ไป / ขอเลื่อน / ติดต่อไม่ได้ (6 ต.ค. 2569)', async () => {
    const onStaffResult = vi.fn().mockResolvedValue(false);
    renderCalendar([manual()], { onStaffResult, onCancelRound: vi.fn() });
    const row = dayRows()[0];
    for (const label of ['ไป', 'ไม่ไป', 'ขอเลื่อน', 'ติดต่อไม่ได้']) {
      fireEvent.click(within(row).getByRole('button', { name: label }));
    }
    await waitFor(() => expect(onStaffResult).toHaveBeenCalledTimes(4));
    expect(onStaffResult.mock.calls.map((c) => [(c[0] as { entry: FollowEntry }).entry.id, c[1]])).toEqual([
      ['m1', 'confirmed'],
      ['m1', 'declined'],
      ['m1', 'reschedule_requested'],
      ['m1', 'no_answer'],
    ]);
  });

  it('🔴 กด ไม่ไป แล้วถามจบเรื่องในที่เดิม · กดจบ = ปิดงานว่าไม่ไป', async () => {
    const onFinishRound = vi.fn();
    renderCalendar([manual()], { onStaffResult: vi.fn().mockResolvedValue(true), onCancelRound: vi.fn(), onFinishRound });
    const row = dayRows()[0];
    fireEvent.click(within(row).getByRole('button', { name: 'ไม่ไป' }));
    fireEvent.click(await within(row).findByRole('button', { name: 'จบ · ไม่ไป' }));
    await waitFor(() => expect(onFinishRound).toHaveBeenCalled());
    expect((onFinishRound.mock.calls[0][0] as { entry: FollowEntry }).entry.id).toBe('m1');
    expect(onFinishRound.mock.calls[0][1]).toBe('no_show_start');
  });

  it('🔴 ยกเลิก ต้องยืนยันในที่เดิมก่อน (ย้อนไม่ได้)', () => {
    const onCancelRound = vi.fn();
    renderCalendar([manual()], { onStaffResult: vi.fn(), onCancelRound });
    const row = dayRows()[0];
    fireEvent.click(within(row).getByRole('button', { name: 'ยกเลิก' }));
    expect(onCancelRound).not.toHaveBeenCalled();
    expect(within(row).getByText('ยกเลิกสายนี้ไหม')).toBeTruthy();
    fireEvent.click(within(row).getByRole('button', { name: 'ยกเลิกเลย' }));
    expect((onCancelRound.mock.calls[0][0] as { entry: FollowEntry }).entry.id).toBe('m1');
  });

  it('สายของ AI ไม่มีปุ่ม · ลงผลแล้วขึ้นคำของปุ่ม ("คนโทร: ไป") ปุ่มหาย เหลือ แก้', () => {
    renderCalendar(
      [
        entry({ id: 'ai1', call_round: 1 }),
        manual({
          id: 'm2',
          recipient_phone: '0899999999',
          recipient_name: 'คนที่สอง',
          staff_call_outcome: 'confirmed',
          staff_called_at: '2026-09-07T08:40:00Z',
          staff_called_by_name: 'staff@example.com',
        }),
      ],
      { onStaffResult: vi.fn(), onCancelRound: vi.fn() },
    );
    expect(screen.queryByTestId('staff-quick')).toBeNull();
    // ป้ายตัวเดียวกับแผง + "· คนโทร" (6 ต.ค. 2569)
    expect(screen.getByText('ตอบว่าไป · คนโทร')).toBeTruthy();
    expect(screen.getByText(/staff@example\.com · .*15:40 น\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'แก้' })).toBeTruthy();
  });

  it('ไม่ได้ส่งตัวจัดการมา (จออ่านอย่างเดียว) ⇒ ไม่มีปุ่ม', () => {
    renderCalendar([manual()]);
    expect(screen.queryByTestId('staff-quick')).toBeNull();
  });
});

describe('รายเดือนแบ่งหน้า หน้าละ 10 คน (เจ้าของสั่ง 5 ต.ค. 2569)', () => {
  it('12 คน ⇒ หน้าแรก 10 · หน้าถัดไป 2 · ตัวเปลี่ยนหน้าบอกช่วงถูก', () => {
    renderCalendar(
      Array.from({ length: 12 }, (_, i) =>
        entry({
          id: `m${i}`,
          recipient_name: `คนที่ ${String(i + 1).padStart(2, '0')}`,
          recipient_phone: `08100000${String(i).padStart(2, '0')}`,
          scheduled_at: '2026-09-03T02:00:00Z',
        }),
      ),
    );
    showMonthView();
    const pager = screen.getByTestId('month-pager');
    const bodyRows = () => document.querySelectorAll('table tbody tr').length;
    expect(bodyRows()).toBe(10);
    expect(pager.textContent).toContain('แสดง 1 ถึง 10 จากทั้งหมด 12 คน');
    expect(pager.textContent).toContain('1/2');
    fireEvent.click(within(pager).getByRole('button', { name: 'หน้าถัดไป (รายเดือน)' }));
    expect(bodyRows()).toBe(2);
    expect(screen.getByTestId('month-pager').textContent).toContain('2/2');
  });
});

describe('แถบหน้ารายวันเป็น "1/N" (เจ้าของ 5 ต.ค. 2569: "แถบหน้า 1 2 3 4 มันเยอะไป")', () => {
  it('ไม่มีปุ่มเลขทุกหน้าแล้ว — เหลือ ก่อนหน้า · 1/N · ถัดไป', () => {
    const src = readFileSync('src/components/follow/FollowPlanningCalendar.tsx', 'utf8');
    expect(src).not.toContain('Array.from({ length: pageCount }');
    expect(src).toContain('data-testid="day-page-indicator"');
  });
});
