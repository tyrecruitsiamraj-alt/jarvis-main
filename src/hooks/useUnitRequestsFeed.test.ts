/**
 * 🔴 รอบดึงซ้ำล้มครั้งเดียว ห้ามล้างการ์ดทั้งบอร์ด (QA 10 ต.ค. 2569: ดึงทุก 60 วิล้มรอบเดียว การ์ดใบขอ 363 ใบหายหมด)
 * - เคยโหลดได้แล้ว + รอบถัดไปล้ม = คงใบเดิม · เลขยังโชว์ได้ (`ready`) · บอกเวลาของข้อมูล
 * - โหลดครั้งแรกล้ม = ไม่มีอะไรให้โชว์ (`failed`) ตามเดิม · ไม่มีสิทธิ์ (403) = ล้างตามเดิม
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const fetchUnitRequests = vi.fn();
vi.mock('@/lib/siamrajUnitRequestsApi', () => ({
  fetchSiamrajFeedMeta: async () => ({ enabled: true, readOnly: true, dbSource: 'postgres' }),
  fetchSiamrajUnitRequestsWithMeta: () => fetchUnitRequests(),
}));
vi.mock('@/lib/jobUrgency', () => ({ enrichJobsWithUrgency: <T,>(x: T) => x }));
vi.mock('@/lib/jobPenalty', () => ({ enrichJobsWithPenalty: <T,>(x: T) => x }));
vi.mock('@/lib/jobFeedBroadcast', () => ({ publishUnitRequestsFeed: () => {} }));
vi.mock('@/lib/workCalendarStore', () => ({ getWorkCalendarSnapshot: () => null, subscribeWorkCalendar: () => () => {} }));

const { useUnitRequestsFeed } = await import('./useUnitRequestsFeed');
const { HttpError } = await import('@/lib/apiFetch');

const JOBS = [{ id: 'a' }, { id: 'b' }];
const httpError = (status: number) => new HttpError(status, `HTTP ${status}`);

beforeEach(() => fetchUnitRequests.mockReset());
afterEach(() => vi.restoreAllMocks());

describe('useUnitRequestsFeed — รอบดึงล้ม', () => {
  it('🔴 เคยโหลดได้แล้ว รอบถัดไปล้ม = คงใบเดิม · ยังโชว์เลขได้ · บอกเวลาของข้อมูล', async () => {
    fetchUnitRequests.mockResolvedValueOnce({ items: JOBS, ageSeconds: 5 });
    const { result } = renderHook(() => useUnitRequestsFeed());
    await waitFor(() => expect(result.current.jobs).toHaveLength(2));

    fetchUnitRequests.mockRejectedValueOnce(httpError(500));
    await act(() => result.current.refetch());

    expect(result.current.jobs).toHaveLength(2);
    expect(result.current.feedState).toBe('ready');
    expect(result.current.loadError).toMatch(/^อัปเดตไม่สำเร็จ ยังโชว์ข้อมูลเมื่อ \d{2}:\d{2} น\.$/);

    // รอบถัดไปสำเร็จ = แถบหาย
    fetchUnitRequests.mockResolvedValueOnce({ items: JOBS, ageSeconds: 1 });
    await act(() => result.current.refetch());
    expect(result.current.loadError).toBeNull();
  });

  it('โหลดครั้งแรกล้ม = failed ไม่มีใบให้โชว์ (ห้ามขึ้น 0)', async () => {
    fetchUnitRequests.mockRejectedValueOnce(httpError(500));
    const { result } = renderHook(() => useUnitRequestsFeed());
    await waitFor(() => expect(result.current.feedState).toBe('failed'));
    expect(result.current.jobs).toHaveLength(0);
  });

  it('ไม่มีสิทธิ์ (403) หลังเคยโหลดได้ = ล้างตามเดิม', async () => {
    fetchUnitRequests.mockResolvedValueOnce({ items: JOBS, ageSeconds: 5 });
    const { result } = renderHook(() => useUnitRequestsFeed());
    await waitFor(() => expect(result.current.jobs).toHaveLength(2));
    fetchUnitRequests.mockRejectedValueOnce(httpError(403));
    await act(() => result.current.refetch());
    expect(result.current.jobs).toHaveLength(0);
    expect(result.current.feedState).toBe('forbidden');
  });
});
