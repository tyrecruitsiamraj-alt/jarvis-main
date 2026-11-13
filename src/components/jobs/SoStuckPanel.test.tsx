/**
 * บั๊ก 13 พ.ย. 2569 (LMO6911012): ขอ Scrap แล้วกล่อง "ค้างอยู่" ขึ้นทั้งที่ So Scraping เริ่มแล้ว
 * ต้นเหตุ = จอใช้แถวตอนสร้าง (pending) · So Scraping เปลี่ยนเป็น in_progress ระหว่าง start (0.3 วิ)
 * แก้: server อ่านแถวใหม่หลัง start · "ส่งอีกครั้ง" / "เริ่มงานอีกครั้ง" ส่งแถวใหม่ให้หน้าแม่
 */
import { readFileSync } from 'node:fs';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const started = { id: 'r1', job_id: 'siamraj-sql:LMO6911012', request_no: 'LMO6911012', request_type: 'scraping', status: 'in_progress' };
vi.mock('@/lib/jobPostingRequestsApi', () => ({
  fetchSoIssues: vi.fn(async () => []),
  cancelJobPostingRequest: vi.fn(),
  startJobPostingRequestWithItem: vi.fn(async () => ({ start: { state: 'started', queued: true, message: null, skippedGroups: 0 }, item: started })),
}));

describe('SoStuckPanel ส่งอีกครั้ง', () => {
  it('ได้แถวใหม่จากฐาน (in_progress) ส่งให้หน้าแม่ — ไม่เดาสถานะเอง', async () => {
    const { default: SoStuckPanel } = await import('./SoStuckPanel');
    const onItem = vi.fn();
    render(<SoStuckPanel order={{ ...started, status: 'pending' } as never} onCancelled={() => {}} onItem={onItem} />);
    fireEvent.click(await screen.findByRole('button', { name: /อีกครั้ง/ }));
    await waitFor(() => expect(onItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1', status: 'in_progress' })));
  });
});

describe('ต้นเหตุฝั่ง server + จอ', () => {
  it('สร้างใบแล้ว start แล้วอ่านแถวใหม่จากฐานก่อนตอบ · start ซ้ำตอบแถวใหม่ด้วย', () => {
    const h = readFileSync('api/_handlers/matching-job-postings.ts', 'utf8');
    const afterStart = h.slice(h.indexOf('const soStart = await startSoRequest(item.request_no);'));
    expect(afterStart.indexOf('getJobPostingRequestById(item.id)')).toBeGreaterThan(0);
    expect(afterStart).toContain('return res.status(200).json({ ...fresh, so_start: soStart });');
    expect(h).toContain('item: (await getJobPostingRequestById(existing.id)) ?? existing');
  });
  it('หน้าสั่งงาน (Scrap) + หน้า Autopost รับแถวใหม่จากปุ่มเริ่ม/ส่งอีกครั้ง', () => {
    const o = readFileSync('src/components/jobs/OrderPostButton.tsx', 'utf8');
    expect(o.match(/onItem=\{\(item\) => setLatest/g)?.length).toBe(2);
    const a = readFileSync('src/components/jobs/AutopostDialog.tsx', 'utf8');
    expect(a).toContain('setRefreshedOrder(item)');
    expect(a).toContain('cancelledOrder ?? refreshedOrder ??');
    expect(a).toMatch(/SoStartLine requestId=\{sent\.id\} initial=\{sent\.so_start\} onItem=/);
  });
});
