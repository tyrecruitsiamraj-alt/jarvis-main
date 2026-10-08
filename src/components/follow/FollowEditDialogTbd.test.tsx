/**
 * 🔴 สาย "ยังไม่ชัวร์เวลา" — แก้เวลาแล้วต้องสลับ AI/คนโทรได้ (เจ้าของ 6 ต.ค. 2569:
 * *"ยังไม่ชัวร์เวลา แก้ไขเวลาแล้ว ต้องการเปลี่ยนจาก AI โทร ให้เป็นคนโทร ไม่มีปุ่มเปลี่ยน"*)
 * เวลาแทนของสายนี้ = เที่ยงคืนของวันนั้น ⇒ ถึงวันจริงเลยไปแล้ว ตัวเลือกเคยหายทั้งที่คนเลือกเวลาจริงในอนาคตแล้ว
 * ตอนนี้: เปิดมายังไม่เลือกเวลา = ไม่มีตัวเลือก (เวลาแทนเลยแล้ว) · เลือกเวลาอนาคต = มีตัวเลือก · บันทึก = แก้เวลาก่อน แล้วส่งตารางใหม่ที่มีสายนี้
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { FollowEntry } from '@/lib/followApi';

const replaceFollowSchedule = vi.fn();
const updateFollowEntry = vi.fn();
vi.mock('@/lib/followApi', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/followApi')>();
  return {
    ...mod,
    replaceFollowSchedule: (...a: unknown[]) => replaceFollowSchedule(...a),
    updateFollowEntry: (...a: unknown[]) => updateFollowEntry(...a),
    createFollowEntry: vi.fn(),
  };
});
vi.mock('@/components/follow/TopicField', () => ({ default: () => null }));
vi.mock('@/components/follow/StaffContactField', () => ({ default: () => null }));
// ช่องวันเวลาจริงเป็นปฏิทิน + ตัวเลือกเวลา — ในเทสต์ใช้ช่องพิมพ์ค่า `YYYY-MM-DDTHH:mm` ตรง ๆ
vi.mock('@/components/shared/DateTimeField24', () => ({
  default: ({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) => (
    <input aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));
if (!('ResizeObserver' in globalThis)) {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

const { default: FollowEditDialog } = await import('./FollowEditDialog');
const { isoToBangkokInput } = await import('@/lib/followScheduleEdit');

afterEach(() => {
  cleanup();
  replaceFollowSchedule.mockReset();
  updateFollowEntry.mockReset();
});

const inHours = (h: number) => new Date(Math.floor((Date.now() + h * 3_600_000) / 60_000) * 60_000).toISOString();
const tbd = {
  id: 'a',
  recipient_name: 'ทดสอบ ระบบ',
  recipient_phone: '0812345678',
  topic: 'ติดตามเริ่มงาน',
  note: null,
  // เวลาแทน (เที่ยงคืน) ที่เลยไปแล้ว
  scheduled_at: inHours(-3),
  created_by_name: 'แอดมิน',
  created_at: inHours(-24),
  cancelled: false,
  call_status: null,
  call_outcome: null,
  call_summary: null,
  next_action: null,
  called_at: null,
  call_mode: 'manual',
  time_tbd: true,
  group_id: 'g1',
} as unknown as FollowEntry;

describe('ยังไม่ชัวร์เวลา → เลือกเวลาจริงแล้วสลับใครโทรได้', () => {
  // 8 ต.ค. 2569: สายคนโทรที่เลยเวลา (ยังไม่ลงผล) มีตัวเลือกเสมอ — ติ๊ก AI = เลื่อนเวลาให้ AI โทรอีก 10 นาที (เทสต์ถัดไป)
  it('เวลาแทนเลยแล้วก็มีตัวเลือก · เลือกเวลาอนาคต = มี · บันทึกแก้เวลาก่อนแล้วส่งตารางที่มีสายนี้เป็น AI', async () => {
    updateFollowEntry.mockResolvedValue({ ...tbd, time_tbd: false, queue_refreshed: 0, lumos_resync: null });
    replaceFollowSchedule.mockResolvedValue({ group_id: 'g1', kept: 1, cancelled: 0, created: 0, lumos: { pushed: true, plans: 1, rounds: 1, reason: null } });
    const onSaved = vi.fn();
    render(<FollowEditDialog entry={tbd} unitOptions={[]} siblings={[tbd]} onClose={() => {}} onSaved={onSaved} />);
    expect(screen.getByText('ใครโทรสายนี้')).toBeTruthy();

    const future = inHours(6);
    fireEvent.change(screen.getByLabelText('เวลานัด'), { target: { value: isoToBangkokInput(future) } });
    expect(screen.getByText('ใครโทรสายนี้')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: 'ใครโทรสายนี้ — AI โทร' }));
    fireEvent.click(screen.getByRole('button', { name: 'บันทึกการแก้ไข' }));

    await waitFor(() => expect(replaceFollowSchedule).toHaveBeenCalledTimes(1));
    expect(updateFollowEntry.mock.invocationCallOrder[0]).toBeLessThan(replaceFollowSchedule.mock.invocationCallOrder[0]);
    const body = replaceFollowSchedule.mock.calls[0][1] as { replace_ids: string[]; rounds: Array<{ id?: string; call_mode: string }> };
    expect(body.replace_ids).toEqual(['a']);
    expect(body.rounds.find((r) => r.id === 'a')?.call_mode).toBe('ai');
  });
});

// เจ้าของ 8 ต.ค. 2569: "คนโทรแล้วทำไมแก้เป็น Ai ไม่ได้อะ" — วัดจริง: ทีมแก้สายนัด 13:10 ตอน 14:05 ช่องเลือกใครโทรหาย
describe('สายคนโทรที่เลยเวลา → ส่งให้ AI โทรแทน', () => {
  it('ติ๊ก AI = เลื่อนเวลาเป็นอีก ~10 นาที แล้วบันทึกแก้เวลาก่อน ส่งตารางสายนี้เป็น AI · กลับเป็นคนโทร = คืนเวลาเดิม', async () => {
    const overdue = { ...tbd, time_tbd: false, scheduled_at: inHours(-1) } as unknown as FollowEntry;
    updateFollowEntry.mockResolvedValue({ ...overdue, queue_refreshed: 0, lumos_resync: null });
    replaceFollowSchedule.mockResolvedValue({ group_id: 'g1', kept: 1, cancelled: 0, created: 0, lumos: { pushed: true, plans: 1, rounds: 1, reason: null } });
    render(<FollowEditDialog entry={overdue} unitOptions={[]} siblings={[overdue]} onClose={() => {}} onSaved={vi.fn()} />);
    const timeBox = screen.getByLabelText('เวลานัด') as HTMLInputElement;
    const before = timeBox.value;
    fireEvent.click(screen.getByRole('checkbox', { name: 'ใครโทรสายนี้ — AI โทร' }));
    expect(timeBox.value).not.toBe(before);
    fireEvent.click(screen.getByRole('checkbox', { name: 'ใครโทรสายนี้ — คนโทร' }));
    expect(timeBox.value).toBe(before);
    fireEvent.click(screen.getByRole('checkbox', { name: 'ใครโทรสายนี้ — AI โทร' }));
    fireEvent.click(screen.getByRole('button', { name: 'บันทึกการแก้ไข' }));
    await waitFor(() => expect(replaceFollowSchedule).toHaveBeenCalledTimes(1));
    const patch = updateFollowEntry.mock.calls[0][1] as { scheduled_at: string };
    const ahead = Date.parse(patch.scheduled_at) - Date.now();
    expect(ahead).toBeGreaterThan(5 * 60_000);
    expect(ahead).toBeLessThanOrEqual(11 * 60_000);
    const body = replaceFollowSchedule.mock.calls[0][1] as { rounds: Array<{ id?: string; call_mode: string }> };
    expect(body.rounds.find((r) => r.id === 'a')?.call_mode).toBe('ai');
  });
});

