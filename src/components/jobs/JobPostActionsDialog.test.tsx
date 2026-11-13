/**
 * ป๊อป "ทำอะไรไปแล้ว" แท็บโพสต์เอง แยก 2 แท็บ (เจ้าของ 13 พ.ย. 2569 "พอกดไปเจอ 2 แท็บมี genlink กับ โพสต์
 * gen link คือพวกไม่มี link กลุ่มมาแปะ โพสต์คือที่มี link มาแปะ")
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EMPTY_JOB_POST_ACTIONS } from '@/lib/jobPostActions';

const link = (id: string, label: string, post_url: string | null) => ({
  id, origin: 'manual' as const, code: `c${id}`, channel_label: `Facebook · Facebook Group · ${label}`, created_at: '2026-11-13T05:56:00Z',
  created_by_name: 'ใหม่', clicks: 1, applicants: 0, post_url,
});
vi.mock('@/lib/jobPostActionsApi', () => ({
  fetchJobPostActionsDetail: vi.fn(async () => ({
    summary: { ...structuredClone(EMPTY_JOB_POST_ACTIONS), manual: { links: 3, posted: 1, clicks: 3, applicants: 0 } },
    links: [link('1', 'กลุ่ม A', 'https://www.facebook.com/groups/1/posts/2/'), link('2', 'กลุ่ม B', null), link('3', 'กลุ่ม C', null)],
    orders: [],
    groups: { statuses: [], rows: [], error: null },
  })),
}));

describe('แท็บโพสต์เอง: Gen link / โพสต์', () => {
  it('Gen link = ไม่มีลิงก์โพสต์ · โพสต์ = มีลิงก์โพสต์ กดเปิดดูโพสต์ · สองแท็บรวม = ทั้งหมด', async () => {
    const { JobPostActionsPanel } = await import('./JobPostActionsDialog');
    render(<JobPostActionsPanel jobId="siamraj-pre:LBM6909002" tab="manual" onTabChange={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('job-actions-manual-tabs')).toBeTruthy());
    expect(screen.getByTestId('job-actions-manual-gen').textContent).toContain('2');
    expect(screen.getByTestId('job-actions-manual-posted').textContent).toContain('1');
    expect(screen.getAllByTestId('job-actions-link-row').map((r) => r.textContent)).toEqual([expect.stringContaining('กลุ่ม B'), expect.stringContaining('กลุ่ม C')]);
    fireEvent.click(screen.getByTestId('job-actions-manual-posted'));
    const rows = screen.getAllByTestId('job-actions-link-row');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('กลุ่ม A');
    expect(rows[0].querySelector('a')?.getAttribute('href')).toBe('https://www.facebook.com/groups/1/posts/2/');
  });
});
