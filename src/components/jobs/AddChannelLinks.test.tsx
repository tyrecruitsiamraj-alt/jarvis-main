/**
 * สร้างลิงก์เพิ่มให้ประกาศเดิม — เลือกช่องทางอย่างเดียว ข้อความไม่ต้องกรอกใหม่ (เจ้าของ 4 ต.ค. 2569)
 * สร้างเสร็จโชว์ลิงก์ใหม่ทั้งหมดทันที คัดลอกแยกทีละอัน / ทั้งหมด
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { RecruitChannelMatch, RecruitPosting } from '@/lib/recruitPostings';

const addPostingLink = vi.fn(async (_id: string, input: { channelLabel?: string | null }) => ({
  id: `l-${input.channelLabel ?? 'mid'}`,
  channelId: null,
  channelLabel: input.channelLabel ?? null,
  code: `c${(input.channelLabel ?? 'mid').length}`,
  note: null,
  hitCount: 0,
  createdAt: '2026-10-04T05:00:00Z',
}));
vi.mock('@/lib/recruitPostingsApi', () => ({
  addPostingLink: (id: string, input: { channelLabel?: string | null }) => addPostingLink(id, input),
}));
// ตัวเลือกช่องทางจริงต้องโหลดจาก API — แทนด้วยปุ่มเดียวที่เลือกสองช่องทาง
vi.mock('@/components/shared/MultiChannelPicker', () => ({
  default: ({ onChange }: { onChange: (v: RecruitChannelMatch[]) => void }) => (
    <button
      type="button"
      onClick={() =>
        onChange([
          { id: 'a', name: 'Finnix', parentId: null, parentName: null, isActive: true },
          { id: 'b', name: 'Call in', parentId: null, parentName: null, isActive: true },
        ] as RecruitChannelMatch[])
      }
    >
      เลือกสองช่องทาง
    </button>
  ),
}));

const { default: AddChannelLinks } = await import('./AddChannelLinks');
const posting = { id: 'p1', title: 'คนสวน สมมุติ', links: [], status: 'open' } as unknown as RecruitPosting;

describe('AddChannelLinks', () => {
  it('ใช้ประกาศเดิม · เลือก 2 ช่องทาง = สร้าง 2 ลิงก์ใต้ประกาศเดิม · โชว์ให้คัดลอกแยก + ทั้งหมด', async () => {
    const onCreated = vi.fn();
    render(<AddChannelLinks posting={posting} onCreated={onCreated} />);
    expect(screen.getByText('คนสวน สมมุติ')).toBeTruthy();
    expect(screen.getByRole('button', { name: /สร้างลิงก์กลาง 1 อัน/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'เลือกสองช่องทาง' }));
    fireEvent.click(screen.getByRole('button', { name: /สร้าง 2 ลิงก์/ }));
    await waitFor(() => expect(screen.getByText('สร้างแล้ว 2 ลิงก์')).toBeTruthy());
    expect(addPostingLink).toHaveBeenCalledTimes(2);
    expect(addPostingLink.mock.calls.every(([id]) => id === 'p1')).toBe(true);
    expect(screen.getByRole('button', { name: 'คัดลอกลิงก์ Finnix' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'คัดลอกลิงก์ Call in' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /คัดลอกทั้งหมด/ })).toBeTruthy();
    expect(onCreated).toHaveBeenCalled();
  });
});
