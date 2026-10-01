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

describe('ปุ่มลงผลโทร', () => {
  it('ยังไม่ลงผล → กางในที่เดิม · เลือกผลแล้วบันทึกพร้อมหมายเหตุ', async () => {
    const onRecord = vi.fn().mockResolvedValue(undefined);
    render(<FollowStaffCallControls entry={entry()} onRecord={onRecord} onClear={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /ลงผลโทร/ }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onRecord).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('หมายเหตุผลโทร'), { target: { value: 'ยืนยันเริ่มพรุ่งนี้' } });
    fireEvent.click(screen.getByRole('button', { name: 'ยืนยันว่าไป' }));
    await waitFor(() => expect(onRecord).toHaveBeenCalledWith('confirmed', 'ยืนยันเริ่มพรุ่งนี้'));
  });

  it('มีครบ 6 ผล = ชุดของกล่องงาน + ติดต่อสำเร็จ (คำของงานติดตาม · คำเดียวกับปุ่มบนแถว)', () => {
    render(<FollowStaffCallControls entry={entry()} onRecord={vi.fn()} onClear={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /ลงผลโทร/ }));
    for (const label of ['ยืนยันว่าไป', 'ยกเลิก — ไม่ไปแล้ว', 'ขอเลื่อน', 'ติดต่อสำเร็จ', 'ติดต่อไม่สำเร็จ', 'เบอร์ผิด']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
  });

  it('ลงแล้ว → เห็นผล + คนลง · ล้างต้องยืนยันก่อน', async () => {
    const onClear = vi.fn().mockResolvedValue(undefined);
    render(
      <FollowStaffCallControls
        entry={entry({
          staff_call_outcome: 'no_answer',
          staff_called_at: '2026-09-30T03:00:00Z',
          staff_called_by_name: 'staff@example.com',
        })}
        onRecord={vi.fn()}
        onClear={onClear}
      />,
    );
    expect(screen.getByText('คนโทร: ติดต่อไม่สำเร็จ')).toBeTruthy();
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
    expect(screen.getAllByText('ผลโทรของสายนี้')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /ลงผลโทร/ })).toHaveLength(1);
  });
});
