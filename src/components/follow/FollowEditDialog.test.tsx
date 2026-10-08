/**
 * กล่องแก้ไขรายการติดตาม — สลับ "ใครโทรสายนี้" (เจ้าของสั่ง 1 ต.ค. 2569: *"แก้ไขมันต้องแก้ไขได้ว่าแบบเผื่อเปลี่ยนใจ
 * ไม่ใช่ Ai โทรและ หรือ จะเปลี่ยนจากคนเป็น Ai"*)
 * 🔴 ด่าน: สลับได้เฉพาะสายที่ยังไม่ถึงเวลา/ยังไม่ถูกโทร · บันทึกผ่านเส้นแก้ตารางทั้งชุด (ส่งทุกสายที่แก้ได้ของชุด
 *    เปลี่ยนแค่สายนี้) · สลับอย่างเดียวไม่ยิงเส้นแก้ข้อมูล · ผลกับ AI ต้องขึ้นบนจอ · สายคนโทรไม่ขึ้นคำเตือน "AI รับไปแล้ว"
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { FollowEntry } from '@/lib/followApi';

const replaceFollowSchedule = vi.fn();
const updateFollowEntry = vi.fn();
const createFollowEntry = vi.fn();
vi.mock('@/lib/followApi', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/followApi')>();
  return {
    ...mod,
    replaceFollowSchedule: (...a: unknown[]) => replaceFollowSchedule(...a),
    updateFollowEntry: (...a: unknown[]) => updateFollowEntry(...a),
    createFollowEntry: (...a: unknown[]) => createFollowEntry(...a),
  };
});
// ช่องเลือกเรื่อง/เจ้าหน้าที่โหลดรายการจาก API — ไม่ใช่เรื่องที่เทสต์นี้คุม
vi.mock('@/components/follow/TopicField', () => ({ default: () => null }));
vi.mock('@/components/follow/StaffContactField', () => ({ default: () => null }));

// Checkbox ของ Radix ในฟอร์มวัดขนาดด้วย ResizeObserver — jsdom ไม่มี
if (!('ResizeObserver' in globalThis)) {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

const { default: FollowEditDialog } = await import('./FollowEditDialog');

afterEach(() => {
  cleanup();
  replaceFollowSchedule.mockReset();
  updateFollowEntry.mockReset();
  createFollowEntry.mockReset();
});

const inHours = (h: number) => new Date(Math.floor((Date.now() + h * 3_600_000) / 60_000) * 60_000).toISOString();
const row = (over: Partial<FollowEntry>): FollowEntry =>
  ({
    id: 'a',
    recipient_name: 'ทดสอบ ระบบ',
    recipient_phone: '0812345678',
    topic: 'ติดตามเริ่มงาน',
    note: null,
    scheduled_at: inHours(5),
    created_by_name: 'แอดมิน',
    created_at: inHours(-24),
    cancelled: false,
    call_status: 'pending',
    call_outcome: null,
    call_summary: null,
    next_action: null,
    called_at: null,
    call_mode: 'ai',
    group_id: 'g1',
    ...over,
  }) as FollowEntry;

const sibling = row({ id: 'b', scheduled_at: inHours(29) });
const done = row({ id: 'done', scheduled_at: inHours(-20), call_status: 'completed', call_outcome: 'confirmed' });

function open(entry: FollowEntry, onSaved = vi.fn()) {
  render(
    <FollowEditDialog
      entry={entry}
      unitOptions={[]}
      siblings={[entry, sibling, done]}
      onClose={() => {}}
      onSaved={onSaved}
    />,
  );
  return onSaved;
}

describe('ใครโทรสายนี้', () => {
  it('🔴 AI → คนโทร อย่างเดียว ⇒ ยิงเส้นแก้ตารางครั้งเดียว (ทุกสายที่แก้ได้ของชุด เปลี่ยนแค่สายนี้) · ไม่ยิงเส้นแก้ข้อมูล', async () => {
    replaceFollowSchedule.mockResolvedValue({ group_id: 'g1', kept: 2, cancelled: 0, created: 0, lumos: { pushed: true, plans: 1, rounds: 1, reason: null } });
    const onSaved = open(row({}));
    expect((screen.getByRole('checkbox', { name: 'ใครโทรสายนี้ — AI โทร' }) as HTMLButtonElement).getAttribute('data-state')).toBe('checked');
    fireEvent.click(screen.getByRole('checkbox', { name: 'ใครโทรสายนี้ — คนโทร' }));
    fireEvent.click(screen.getByRole('button', { name: 'บันทึกการแก้ไข' }));
    await waitFor(() => expect(replaceFollowSchedule).toHaveBeenCalledTimes(1));
    expect(updateFollowEntry).not.toHaveBeenCalled();
    const [anchorId, body] = replaceFollowSchedule.mock.calls[0] as [
      string,
      { replace_ids: string[]; rounds: Array<{ id?: string; scheduled_at: string; call_mode: string }> },
    ];
    expect(anchorId).toBe('a');
    expect([...body.replace_ids].sort()).toEqual(['a', 'b']);
    expect(body.rounds).toEqual([
      { id: 'a', scheduled_at: row({}).scheduled_at, call_mode: 'manual' },
      { id: 'b', scheduled_at: sibling.scheduled_at, call_mode: 'ai' },
    ]);
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('เปลี่ยนเป็นคนโทรแล้ว — AI ไม่โทรสายนี้'));
  });

  it('แก้ชื่อด้วย + สลับ ⇒ แก้ข้อมูลก่อน แล้วค่อยสลับ · ข้อความบอกทั้งสองอย่าง', async () => {
    updateFollowEntry.mockResolvedValue({ ...row({}), queue_refreshed: 1, lumos_resync: { rounds: 1, cancelled: true, pushed: true } });
    replaceFollowSchedule.mockResolvedValue({ group_id: 'g1', kept: 2, cancelled: 0, created: 0, lumos: { pushed: true, plans: 1, rounds: 1, reason: null } });
    const onSaved = open(row({}));
    fireEvent.change(screen.getByLabelText('ชื่อผู้ที่ต้องติดตาม'), { target: { value: 'ทดสอบ ใหม่' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'ใครโทรสายนี้ — คนโทร' }));
    fireEvent.click(screen.getByRole('button', { name: 'บันทึกการแก้ไข' }));
    await waitFor(() => expect(replaceFollowSchedule).toHaveBeenCalled());
    expect(updateFollowEntry.mock.invocationCallOrder[0]).toBeLessThan(replaceFollowSchedule.mock.invocationCallOrder[0]);
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('แก้ไขแล้ว · เปลี่ยนเป็นคนโทรแล้ว — AI ไม่โทรสายนี้'));
  });

  it('คนโทร → AI · ส่งให้ AI ไม่สำเร็จต้องบอก (ห้ามเงียบ) · สายคนโทรไม่ขึ้นคำเตือน "AI รับไปแล้ว"', async () => {
    replaceFollowSchedule.mockResolvedValue({ group_id: 'g1', kept: 2, cancelled: 0, created: 0, lumos: { pushed: false, plans: 1, rounds: 1, reason: 'push ปิดอยู่' } });
    const onSaved = open(row({ call_mode: 'manual', call_status: null, dispatch_state: 'manual' }));
    expect(screen.queryByText(/สายนี้ AI รับไปแล้ว/)).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'ใครโทรสายนี้ — AI โทร' }));
    fireEvent.click(screen.getByRole('button', { name: 'บันทึกการแก้ไข' }));
    await waitFor(() => expect(replaceFollowSchedule).toHaveBeenCalled());
    const body = replaceFollowSchedule.mock.calls[0][1] as { rounds: Array<{ id?: string; call_mode: string }> };
    expect(body.rounds.find((r) => r.id === 'a')?.call_mode).toBe('ai');
    await waitFor(() =>
      expect(onSaved).toHaveBeenCalledWith('เปลี่ยนเป็น AI โทรแล้ว — แต่ยังส่งให้ AI ไม่สำเร็จ (push ปิดอยู่)'),
    );
  });

  it('🔴 สายที่ AI โทรไปแล้ว / เลยเวลาแล้ว ⇒ ไม่มีตัวเลือกให้สลับ', () => {
    open(row({ call_status: 'completed', call_outcome: 'no_answer', called_at: inHours(-1) }));
    expect(screen.queryByText('ใครโทรสายนี้')).toBeNull();
    cleanup();
    open(row({ scheduled_at: inHours(-2) }));
    expect(screen.queryByText('ใครโทรสายนี้')).toBeNull();
  });

  it('ไม่ได้สลับ ⇒ ไม่แตะเส้นแก้ตาราง (แก้ข้อมูลอย่างเดียวเหมือนเดิม)', async () => {
    updateFollowEntry.mockResolvedValue({ ...row({}), queue_refreshed: 1, lumos_resync: { rounds: 1, cancelled: true, pushed: true } });
    open(row({}));
    fireEvent.click(screen.getByRole('button', { name: 'บันทึกการแก้ไข' }));
    await waitFor(() => expect(updateFollowEntry).toHaveBeenCalled());
    expect(replaceFollowSchedule).not.toHaveBeenCalled();
  });
});

/**
 * 🔴 เปลี่ยนเบอร์ทั้งชุด + เตือนเบอร์ผู้สมัครตรงกับเบอร์เจ้าหน้าที่ (เจ้าของสั่ง 4 ต.ค. 2569 — เคยลงเบอร์เจ้าหน้าที่เป็นเบอร์ผู้สมัคร 10 สาย
 * แก้ทีละแถวแล้วหลุด 1 สาย)
 */
describe('เปลี่ยนเบอร์ทั้งชุด + เตือนเบอร์เจ้าหน้าที่', () => {
  const phoneBox = () => screen.getByLabelText('เบอร์โทร') as HTMLInputElement;

  it('ยังไม่แก้เบอร์ = ไม่มีช่องติ๊ก · แก้เบอร์ = ขึ้น "ใช้เบอร์นี้กับสายที่เหลือในชุดนี้ด้วย (1 สาย)" ติ๊กไว้ก่อน', () => {
    open(row({}));
    expect(screen.queryByTestId('apply-phone-to-set')).toBeNull();
    fireEvent.change(phoneBox(), { target: { value: '0899999999' } });
    expect(screen.getByTestId('apply-phone-to-set').textContent).toContain('(1 สาย)');
    expect(screen.getByRole('checkbox', { name: 'ใช้เบอร์นี้กับสายที่เหลือในชุดนี้ด้วย' }).getAttribute('data-state')).toBe('checked');
  });

  it('บันทึก ⇒ ส่ง apply_phone_to_set · ข้อความบอกจำนวนสายที่เปลี่ยนตาม', async () => {
    updateFollowEntry.mockResolvedValue({ ...row({}), phone_applied: 1, lumos_resync: { pushed: true, rounds: 2, cancelled: true, reason: null } });
    const onSaved = open(row({}));
    fireEvent.change(phoneBox(), { target: { value: '0899999999' } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึกการแก้ไข' }));
    await waitFor(() => expect(updateFollowEntry).toHaveBeenCalledTimes(1));
    expect(updateFollowEntry.mock.calls[0][1]).toMatchObject({ recipient_phone: '0899999999', apply_phone_to_set: true });
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(String(onSaved.mock.calls[0][0])).toContain('เปลี่ยนเบอร์อีก 1 สายในชุด');
  });

  it('เอาติ๊กออก ⇒ แก้แค่สายนี้', async () => {
    updateFollowEntry.mockResolvedValue({ ...row({}) });
    open(row({}));
    fireEvent.change(phoneBox(), { target: { value: '0899999999' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'ใช้เบอร์นี้กับสายที่เหลือในชุดนี้ด้วย' }));
    fireEvent.click(screen.getByRole('button', { name: 'บันทึกการแก้ไข' }));
    await waitFor(() => expect(updateFollowEntry).toHaveBeenCalledTimes(1));
    expect(updateFollowEntry.mock.calls[0][1].apply_phone_to_set).toBeUndefined();
  });

  it('🔴 เบอร์ผู้สมัคร = เบอร์เจ้าหน้าที่ ⇒ เตือนก่อน ไม่บันทึก · กดซ้ำ = ยืนยันแล้วบันทึก', async () => {
    updateFollowEntry.mockResolvedValue({ ...row({}) });
    open(row({ staff_phone: '+66899999999' }));
    fireEvent.change(phoneBox(), { target: { value: '0899999999' } });
    fireEvent.click(screen.getByRole('button', { name: 'บันทึกการแก้ไข' }));
    expect(await screen.findByText(/เบอร์ผู้สมัครตรงกับเบอร์เจ้าหน้าที่/)).toBeTruthy();
    expect(updateFollowEntry).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'บันทึกการแก้ไข' }));
    await waitFor(() => expect(updateFollowEntry).toHaveBeenCalledTimes(1));
  });
});

// 8 ต.ค. 2569 เจ้าของ: "มันต้องแก้ได้สิ่ว่าคนหรือ Ai" (รายการ "สายของคนนี้") · "แก้ได้แบบหน้าติดตามคนเริ่มงาน"
describe('สลับใครโทรของสายอื่นจากรายการสายของคนนี้', () => {
  const lumosOk = { group_id: 'g1', kept: 2, cancelled: 0, created: 0, lumos: { pushed: true, plans: 1, rounds: 1, reason: null } };

  it('สายในชุดเดียวกัน ⇒ ตารางชุดนี้ครั้งเดียว เปลี่ยนแค่สายนั้น · สายที่ผ่านไปแล้วติ๊กไม่ได้', async () => {
    replaceFollowSchedule.mockResolvedValue(lumosOk);
    const onSaved = open(row({}));
    expect(screen.getAllByRole('checkbox', { name: /^ใครโทรสาย .+ — AI โทร$/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole('checkbox', { name: /^ใครโทรสาย .+ — คนโทร$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'บันทึกการแก้ไข' }));
    await waitFor(() => expect(replaceFollowSchedule).toHaveBeenCalledTimes(1));
    expect(updateFollowEntry).not.toHaveBeenCalled();
    const [anchorId, body] = replaceFollowSchedule.mock.calls[0] as [string, { rounds: Array<{ id?: string; call_mode: string }> }];
    expect(anchorId).toBe('a');
    expect(body.rounds.map((r) => [r.id, r.call_mode])).toEqual([['a', 'ai'], ['b', 'manual']]);
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('เปลี่ยนคนโทรอีก 1 สายแล้ว'));
  });

  it('สายของชุดอื่น (ส่งคนแทนอีกใบงาน) ⇒ ส่งตารางของชุดนั้นแยก ไม่ผูกข้ามชุด', async () => {
    replaceFollowSchedule.mockResolvedValue(lumosOk);
    const entry = row({});
    const other = row({ id: 'x', group_id: 'g2', scheduled_at: inHours(40), call_mode: 'manual', call_status: null });
    const onSaved = vi.fn();
    render(<FollowEditDialog entry={entry} unitOptions={[]} siblings={[entry, other]} onClose={() => {}} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /^ใครโทรสาย .+ — AI โทร$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'บันทึกการแก้ไข' }));
    await waitFor(() => expect(replaceFollowSchedule).toHaveBeenCalledTimes(1));
    const [anchorId, body] = replaceFollowSchedule.mock.calls[0] as [string, { replace_ids: string[]; rounds: Array<{ id?: string; call_mode: string }> }];
    expect(anchorId).toBe('x');
    expect(body.replace_ids).toEqual(['x']);
    expect(body.rounds.map((r) => [r.id, r.call_mode])).toEqual([['x', 'ai']]);
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('เปลี่ยนคนโทรอีก 1 สายแล้ว'));
  });
});
