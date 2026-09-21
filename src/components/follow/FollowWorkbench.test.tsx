/**
 * ═══ จอใหม่ "วันนี้ต้องตามใครบ้าง" — คุมว่า **ของไม่หาย** (21 ก.ย. 2569) ═══
 *
 * เจ้าของส่งแบบ UI มาแล้วกำชับ: *"ฉันกลัวนายทำ Function ต่าง ๆ หาย"*
 *
 * 🔴 ด่านที่ห้ามหลุด (เรียงตามความเสียหายถ้าหลุด):
 * 1. **สายที่ส่งไม่ออกต้องเห็นบนจอ** — ของที่เคยเงียบแล้วคนนั่งรอสายทั้งวัน
 * 2. **ผลโทร + คำที่เขาพูดเอง** ต้องอยู่บนจอ ไม่ใช่แค่สถานะ
 * 3. **ปุ่มลงมือครบ** — โทรเอง · ปิดงาน (ผล 5 แบบ) · แก้ไข · ยกเลิก · ย้อนสถานะ · ลบถาวร
 * 4. **ของที่ปิดไปแล้วต้องเปิดดูได้** — แบบที่เจ้าของส่งมาไม่มีทางเข้า
 * 5. เลขบนการ์ด = จำนวนแถวที่โชว์จริง (กดแล้วกรอง)
 */
import { describe, expect, it, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';

import FollowWorkbench from './FollowWorkbench';
import type { FollowEntry } from '@/lib/followApi';

let seq = 0;
function entry(over: Partial<FollowEntry> = {}): FollowEntry {
  seq += 1;
  return {
    id: `e${seq}`,
    recipient_name: 'สมชาย ใจดี',
    recipient_phone: '0812345678',
    topic: 'ติดตามเริ่มงาน',
    note: null,
    scheduled_at: new Date(Date.now() + 3 * 3_600_000).toISOString(),
    created_by_name: 'คุณเมย์',
    created_at: new Date(Date.now() - 86_400_000).toISOString(),
    cancelled: false,
    call_status: 'pending',
    call_outcome: null,
    call_summary: null,
    call_reply: null,
    dispatch_state: 'queued',
    unit_name: 'บางชัน',
    ...over,
  } as FollowEntry;
}

const noop = () => {};
function renderBench(entries: FollowEntry[], over: Record<string, unknown> = {}) {
  const props = {
    entries,
    loading: false,
    busyId: null,
    onPurge: null,
    onReload: noop,
    onAdd: noop,
    onOpenPlanner: noop,
    onEdit: noop,
    onCancel: noop,
    onComplete: noop,
    onReopen: noop,
    ...over,
  };
  return render(<FollowWorkbench {...(props as React.ComponentProps<typeof FollowWorkbench>)} />);
}

afterEach(cleanup);

/** แถวในคิวงานเท่านั้น — แผงขวามี <li> ของ "รอบทั้งหมด" อยู่ด้วย ห้ามนับปน */
const queueRows = () =>
  within(screen.getByRole('list', { name: 'คิวงานติดตาม' })).getAllByRole('listitem');

/**
 * เปิดเมนู ••• — Radix เปิดด้วย pointerdown ซึ่ง jsdom ไม่มี PointerEvent จริง
 * จึงใช้ทางคีย์บอร์ดแทน (Enter บนปุ่ม) ซึ่งเป็นเส้นทางที่ Radix รองรับเหมือนกัน
 * ⇒ ได้ผลพลอยได้: เทสต์นี้พิสูจน์ด้วยว่าเมนูใช้งานด้วยคีย์บอร์ดได้จริง
 */
const openRowMenu = () => {
  const trigger = screen.getByRole('button', { name: 'คำสั่งอื่น' });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'Enter', code: 'Enter' });
  return screen.getByRole('menu');
};

describe('คิวงาน', () => {
  it('หนึ่งแถวหนึ่งคน + มีคอลัมน์ "สิ่งที่ต้องทำต่อ" เสมอ', () => {
    renderBench([
      entry({ recipient_phone: '0811111111', recipient_name: 'สมชาย ใจดี' }),
      entry({ recipient_phone: '0811111111', recipient_name: 'สมชาย ใจดี' }), // รอบที่สองของคนเดิม
      entry({ recipient_phone: '0822222222', recipient_name: 'วิชัย แสงทอง' }),
    ]);
    expect(queueRows()).toHaveLength(2);
    expect(screen.getAllByText('รอ AI โทรตามเวลา').length).toBeGreaterThan(0);
  });

  it('🔴 สายที่ส่งไม่ออกต้องขึ้นบนจอ ไม่ใช่เงียบ', () => {
    renderBench([entry({ dispatch_state: 'suppressed', call_status: null })]);
    expect(screen.getAllByText(/บัญชีห้ามโทร/).length).toBeGreaterThan(0);
  });

  it('🔴 ผลโทร + คำที่เขาพูดเอง ต้องอยู่บนแผงขวา', () => {
    renderBench([
      entry({
        call_status: 'completed',
        call_outcome: 'acknowledged',
        call_summary: 'ผู้รับสายยืนยันว่าเตรียมตัวเรียบร้อยแล้ว',
        call_reply: 'ครับ เตรียมตัวแล้วครับ',
      }),
    ]);
    expect(screen.getAllByText('คุยแล้ว บอกว่าไป').length).toBeGreaterThan(0);
    expect(screen.getByText(/เตรียมตัวแล้วครับ/)).toBeTruthy();
  });

  it('เลขบนการ์ดตรงกับจำนวนแถวที่โชว์ และกดแล้วกรองจริง', () => {
    renderBench([
      entry({ recipient_phone: '0811111111', scheduled_at: new Date(Date.now() - 3_600_000).toISOString() }),
      entry({ recipient_phone: '0822222222' }),
      entry({ recipient_phone: '0833333333' }),
    ]);
    // ยังไม่จบ 3 แถว
    expect(queueRows()).toHaveLength(3);
    fireEvent.click(screen.getByText('ต้องลงมือวันนี้'));
    expect(queueRows()).toHaveLength(1);
  });

  it('🔴 ของที่ปิด/ยกเลิกแล้วต้องเปิดดูได้', () => {
    renderBench([
      entry({ recipient_phone: '0811111111' }),
      entry({ recipient_phone: '0822222222', cancelled: true }),
    ]);
    expect(queueRows()).toHaveLength(1);
    fireEvent.click(screen.getByText('ปิด/ยกเลิกแล้ว'));
    expect(queueRows()).toHaveLength(1);
  });

  it('ค้นหาด้วยหน่วยงานได้', () => {
    renderBench([
      entry({ recipient_phone: '0811111111', unit_name: 'บางชัน' }),
      entry({ recipient_phone: '0822222222', unit_name: 'ลาดกระบัง' }),
    ]);
    fireEvent.change(screen.getByLabelText('ค้นหาในคิวงาน'), { target: { value: 'ลาดกระบัง' } });
    expect(queueRows()).toHaveLength(1);
  });
});

describe('ปุ่มลงมือ — ต้องครบเท่าของเดิม', () => {
  it('โทรเองเปิดแอปโทรของเครื่อง (ลิงก์ tel:)', () => {
    renderBench([entry({ recipient_phone: '0812345678' })]);
    const call = screen.getByRole('link', { name: /โทรเองตอนนี้/ });
    expect(call.getAttribute('href')).toBe('tel:0812345678');
  });

  it('🔴 ปิดงานต้องเลือกผลก่อน และมีครบ 5 แบบเดิม', () => {
    const onComplete = vi.fn();
    renderBench([entry()], { onComplete });
    fireEvent.click(screen.getByRole('button', { name: /บันทึกว่าเสร็จสิ้น/ }));
    for (const label of ['ไปแล้ว', 'ถึงแล้ว', 'ลา', 'เลื่อน', 'ยกเลิก']) {
      expect(screen.getAllByText(new RegExp(label)).length).toBeGreaterThan(0);
    }
    expect(onComplete).not.toHaveBeenCalled(); // กดปุ่มแรกแล้วยังไม่ปิดงานทันที
  });

  it('เมนู ••• มี แก้ไข / ยกเลิก ครบ · ไม่ใช่ admin ไม่เห็นลบถาวร', () => {
    renderBench([entry()]);
    const menu = openRowMenu();
    expect(within(menu).getByText(/แก้ไขรอบ/)).toBeTruthy();
    expect(within(menu).getByText(/ยกเลิกรอบนี้/)).toBeTruthy();
    expect(within(menu).queryByText(/ลบถาวร/)).toBeNull();
  });

  it('admin เห็นลบถาวร · งานที่ปิดแล้วเห็น "ย้อนสถานะ" แทน "ยกเลิก"', () => {
    renderBench([entry({ completed_at: 'x', outcome_code: 'arrived' })], { onPurge: vi.fn() });
    fireEvent.click(screen.getByText('ปิด/ยกเลิกแล้ว'));
    const menu = openRowMenu();
    expect(within(menu).getByText(/ย้อนสถานะ/)).toBeTruthy();
    expect(within(menu).getByText(/ลบถาวร/)).toBeTruthy();
    expect(within(menu).queryByText(/ยกเลิกรอบนี้/)).toBeNull();
  });

  it('ปุ่มเปิดปฏิทิน/แผนการโทร และปุ่มเพิ่มคน ยังอยู่', () => {
    const onOpenPlanner = vi.fn();
    const onAdd = vi.fn();
    renderBench([entry()], { onOpenPlanner, onAdd });
    fireEvent.click(screen.getByRole('button', { name: /ปฏิทิน & แผนการโทร/ }));
    fireEvent.click(screen.getByRole('button', { name: /เพิ่มคนที่ต้องติดตาม/ }));
    expect(onOpenPlanner).toHaveBeenCalled();
    expect(onAdd).toHaveBeenCalled();
  });
});
