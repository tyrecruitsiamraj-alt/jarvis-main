/**
 * ปุ่มลงผลโทรของรอบคนโทร (migration 130 · เจ้าของเคาะ 30 ก.ย. 2569)
 * 🔴 ด่าน: กดแล้วกางในที่เดิม (ไม่มี Dialog ซ้อน) · ยังไม่บันทึกจนกว่าจะเลือกผล · หมายเหตุพิมพ์ก่อนแล้วไปด้วย ·
 *    ลงแล้วเห็นผล + ใครลง · ล้างต้องยืนยันก่อน · ป๊อปของรอบโชว์ปุ่มนี้เฉพาะรอบคนโทร
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import FollowStaffCallControls from './FollowStaffCallControls';
import FollowRoundsDialog from './FollowRoundsDialog';
import type { FollowEntry } from '@/lib/followApi';
import type { FollowPlanningRound } from '@/lib/followPlanning';

afterEach(() => cleanup());

function entry(over: Partial<FollowEntry> = {}): FollowEntry {
  return {
    id: 'e1',
    recipient_name: 'ทดสอบ',
    recipient_phone: '0800000000',
    topic: 'ยืนยันวันเริ่มงาน',
    note: null,
    scheduled_at: '2026-09-30T02:00:00Z',
    created_by_name: null,
    created_at: '2026-09-29T02:00:00Z',
    cancelled: false,
    call_status: null,
    call_outcome: null,
    call_summary: null,
    next_action: null,
    called_at: null,
    call_mode: 'manual',
    dispatch_state: 'manual',
    ...over,
  } as FollowEntry;
}

describe('ลงผลสายคนโทร 2 ขั้น (เจ้าของเคาะ 6 ต.ค. 2569)', () => {
  it('ขั้น 1 มี ไป / ไม่ไป / ขอเลื่อน / ติดต่อไม่ได้ · ไม่มีช่องพิมพ์คำตอบ', () => {
    render(<FollowStaffCallControls entry={entry()} onRecord={vi.fn()} onFinish={vi.fn()} />);
    for (const label of ['ไป', 'ไม่ไป', 'ขอเลื่อน', 'ติดต่อไม่ได้']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('กด ไม่ไป → บันทึกผล → ถามจบเรื่อง · กดจบ = ปิดงานว่าไม่ไป', async () => {
    const onRecord = vi.fn().mockResolvedValue(true);
    const onFinish = vi.fn().mockResolvedValue(undefined);
    render(<FollowStaffCallControls entry={entry()} onRecord={onRecord} onFinish={onFinish} />);
    fireEvent.click(screen.getByRole('button', { name: 'ไม่ไป' }));
    await waitFor(() => expect(onRecord).toHaveBeenCalledWith('declined'));
    expect(await screen.findByText('จบเรื่องนี้เลยไหม')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'จบ · ไม่ไป' }));
    await waitFor(() => expect(onFinish).toHaveBeenCalledWith('no_show_start'));
  });

  it('🔴 ขั้น 2 มี ลา กับ จำวันผิด ด้วย (เจ้าของสั่ง 6 ต.ค. 2569)', async () => {
    const onFinish = vi.fn().mockResolvedValue(undefined);
    render(<FollowStaffCallControls entry={entry()} onRecord={vi.fn().mockResolvedValue(true)} onFinish={onFinish} />);
    fireEvent.click(screen.getByRole('button', { name: 'ขอเลื่อน' }));
    expect(await screen.findByRole('button', { name: 'จบ · เลื่อน' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'จบ · ลา' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'จบ · จำวันผิด' }));
    await waitFor(() => expect(onFinish).toHaveBeenCalledWith('wrong_date'));
  });

  it('กด ไป → โทรต่อตามแผน = ไม่ปิดงาน', async () => {
    const onFinish = vi.fn();
    render(<FollowStaffCallControls entry={entry()} onRecord={vi.fn().mockResolvedValue(true)} onFinish={onFinish} />);
    fireEvent.click(screen.getByRole('button', { name: 'ไป' }));
    fireEvent.click(await screen.findByRole('button', { name: 'โทรต่อตามแผน' }));
    expect(screen.queryByText('จบเรื่องนี้เลยไหม')).toBeNull();
    expect(onFinish).not.toHaveBeenCalled();
  });

  it('ติดต่อไม่ได้ = ไม่ถาม โทรต่อเลย · บันทึกไม่ผ่าน = ไม่ถาม', async () => {
    const onRecord = vi.fn().mockResolvedValue(true);
    const { unmount } = render(<FollowStaffCallControls entry={entry()} onRecord={onRecord} onFinish={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'ติดต่อไม่ได้' }));
    await waitFor(() => expect(onRecord).toHaveBeenCalledWith('no_answer'));
    expect(screen.queryByText('จบเรื่องนี้เลยไหม')).toBeNull();
    unmount();
    render(<FollowStaffCallControls entry={entry()} onRecord={vi.fn().mockResolvedValue(false)} onFinish={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'ไม่ไป' }));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText('จบเรื่องนี้เลยไหม')).toBeNull();
  });

  it('ลงแล้ว → เห็นผล + คนลง · แก้ได้ · ล้างต้องยืนยันก่อน', async () => {
    const onClear = vi.fn().mockResolvedValue(undefined);
    render(
      <FollowStaffCallControls
        entry={entry({
          staff_call_outcome: 'no_answer',
          staff_called_at: '2026-09-30T03:00:00Z',
          staff_called_by_name: 'staff@example.com',
        })}
        onRecord={vi.fn()}
        onFinish={vi.fn()}
        onClear={onClear}
      />,
    );
    expect(screen.getByText('ติดต่อไม่ได้')).toBeTruthy();
    expect(screen.getByText(/staff@example\.com/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'ล้างผล' }));
    expect(onClear).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'ล้างเลย' }));
    await waitFor(() => expect(onClear).toHaveBeenCalled());
  });
});

describe('ป๊อปของรอบ: ปุ่มลงผลโชว์เฉพาะรอบคนโทร', () => {
  const round = (e: FollowEntry): FollowPlanningRound => ({ entry: e, state: 'notSent', time: '09:00', ymd: '2026-09-30' });
  const baseProps = {
    open: true,
    onClose: vi.fn(),
    group: null,
    ymd: '2026-09-30',
    busyId: null,
    cancellingId: null,
    onAskCancel: vi.fn(),
    onCancel: vi.fn(),
    onEdit: vi.fn(),
    onReopen: vi.fn(),
    onComplete: vi.fn(),
    onStaffCall: vi.fn(),
    onStaffCallClear: vi.fn(),
    onPurge: null,
    purgingId: null,
    onAskPurge: vi.fn(),
  };

  it('รอบคนโทรมีที่ลงผล · รอบของ AI ไม่มี', () => {
    render(
      <FollowRoundsDialog
        {...baseProps}
        rounds={[round(entry({ id: 'm1' })), round(entry({ id: 'a1', call_mode: 'ai', dispatch_state: 'queued' }))]}
      />,
    );
    expect(screen.getAllByText('เขาไปไหม')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'ไม่ไป' })).toHaveLength(1);
    // รอบคนโทรไม่มี "บันทึกว่าเสร็จสิ้น" แยก · รอบ AI ยังมี (6 ต.ค. 2569)
    expect(screen.getAllByRole('button', { name: /บันทึกว่าเสร็จสิ้น/ })).toHaveLength(1);
  });
});

describe('🔴 ตาราง = ปุ่มลงผลปุ่มเดียว เด้งป๊อป (เจ้าของ 7 ต.ค. 2569 ปัญหา Lumos ข้อ 5 "เลื่อนดูแล้วมือไปกดโดนของคนอื่น")', () => {
  it('แถวไม่มีปุ่ม ไป/ไม่ไป ตรง ๆ · กด "ลงผล" แล้วเลือกในป๊อป · ขั้น 2 อยู่ในป๊อปเดียวกัน', async () => {
    const onRecord = vi.fn().mockResolvedValue(true);
    const onFinish = vi.fn().mockResolvedValue(undefined);
    render(<FollowStaffCallControls compact entry={entry()} onRecord={onRecord} onFinish={onFinish} extra={<span>ยกเลิกสาย</span>} />);
    expect(screen.queryByRole('button', { name: 'ไม่ไป' })).toBeNull();
    expect(screen.getByText('ยกเลิกสาย')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'ลงผล' }));
    fireEvent.click(await screen.findByRole('button', { name: 'ไม่ไป' }));
    await waitFor(() => expect(onRecord).toHaveBeenCalledWith('declined'));
    fireEvent.click(await screen.findByRole('button', { name: 'จบ · ไม่ไป' }));
    await waitFor(() => expect(onFinish).toHaveBeenCalledWith('no_show_start'));
  });
});
