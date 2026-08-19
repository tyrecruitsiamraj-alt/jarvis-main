import { useCallback, useEffect, useState } from 'react';
import type { JobRequest } from '@/types';
import { fetchSiamrajClosedRequests } from '@/lib/siamrajUnitRequestsApi';
import { closedRangeForDays } from '@/lib/closedRequestRange';

/** ช่วงวันที่ให้เลือกของชุดใบปิด/ยกเลิก (ชุดเดิมจากแท็บ "ปิดแล้ว") */
export const CLOSED_RANGE_OPTIONS = [
  { days: 30, label: '30 วัน' },
  { days: 90, label: '90 วัน' },
  { days: 180, label: '6 เดือน' },
  { days: 365, label: '1 ปี' },
] as const;

/**
 * ชุดใบขอที่ปิดแล้ว/ยกเลิก — คนละ feed กับกล่องงาน (กล่องงานถามหาเฉพาะใบที่ยังเปิด)
 *
 * ⚠️ **ต้องมีช่วงวันที่เสมอ** — ใบปิดสะสมย้อนหลังหลายปี ดึงทั้งหมดคือรอเป็นนาที
 * เริ่มที่ 30 วันล่าสุด แล้วให้เลือกช่วงยาวขึ้นได้ (วัดจริง 19 ส.ค. 2569: 30 วัน = 170 ใบ · 81ms)
 *
 * ย้ายออกมาจาก `ClosedRequestsPanel` (19 ส.ค. 2569) เพราะเจ้าของสั่งให้กล่อง
 * "ปิดแล้ว/ยกเลิก" บนหน้ากล่องงานกดแล้วดูในหน้าเดิมเหมือนกล่องอื่น — หน้ากล่องงาน
 * จึงต้องถือชุดนี้ไว้เองเพื่อโชว์เลขบนกล่องได้ตั้งแต่ยังไม่กด
 */
export function useClosedRequestsFeed(options?: { skip?: boolean }): {
  rows: JobRequest[];
  loading: boolean;
  error: string | null;
  days: number;
  setDays: (days: number) => void;
  reload: () => void;
} {
  const skip = options?.skip ?? false;
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState<JobRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadRev, setReloadRev] = useState(0);

  const reload = useCallback(() => setReloadRev((n) => n + 1), []);

  useEffect(() => {
    if (skip) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const { from, to } = closedRangeForDays(days);
    void fetchSiamrajClosedRequests(from, to)
      .then((next) => {
        if (cancelled) return;
        setRows(next);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setRows([]);
        setError(e instanceof Error ? e.message : 'โหลดใบขอที่ปิดแล้วไม่สำเร็จ');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days, reloadRev, skip]);

  return { rows, loading, error, days, setDays, reload };
}
