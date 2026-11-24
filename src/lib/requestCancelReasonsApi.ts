import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import { readErrorMessage, readJsonSafe } from '@/lib/api';
import type { CancelReasonMaster, CancelReasonTag } from '@/lib/requestCancelReason';

/**
 * เหตุผลยกเลิกใบขอ — ฝั่งหน้าเว็บของ `/api/request-cancel-reasons` (24 พ.ย. 2569)
 * รายการกลางกับเหตุผลบนใบมาก้อนเดียว (ตารางเล็ก) · ตัวตัดสินอยู่ `requestCancelReason.ts`
 */
export type CancelReasonsData = { reasons: CancelReasonMaster[]; tags: CancelReasonTag[] };

export async function fetchCancelReasons(): Promise<CancelReasonsData> {
  const r = await apiFetch('/api/request-cancel-reasons', { cache: 'no-store' });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'โหลดเหตุผลยกเลิกไม่สำเร็จ'));
  const d = await readJsonSafe<Partial<CancelReasonsData>>(r);
  return { reasons: Array.isArray(d?.reasons) ? d.reasons : [], tags: Array.isArray(d?.tags) ? d.tags : [] };
}

async function send(method: 'PUT' | 'POST' | 'PATCH', body: unknown, fallback: string): Promise<void> {
  const r = await apiFetch('/api/request-cancel-reasons', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await readErrorMessage(r, fallback));
}

/** ใส่/เปลี่ยนเหตุผลบนใบ · `reasonId = null` = ล้างออก */
export const tagCancelReason = (requestNo: string, reasonId: number | null) =>
  send('PUT', { requestNo, reasonId }, 'บันทึกเหตุผลไม่สำเร็จ');
export const createCancelReason = (label: string, gotPerson: boolean) => send('POST', { label, gotPerson }, 'เพิ่มเหตุผลไม่สำเร็จ');
export const updateCancelReason = (id: number, patch: { label?: string; gotPerson?: boolean; active?: boolean }) =>
  send('PATCH', { id, ...patch }, 'บันทึกไม่สำเร็จ');

/** อ่านครั้งเดียวตอนเปิดแผง · `reload` หลังบันทึก · `null` = กำลังโหลด */
export function useCancelReasons(enabled = true): { data: CancelReasonsData | null; error: string; reload: () => Promise<void> } {
  const [data, setData] = useState<CancelReasonsData | null>(null);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    try {
      setData(await fetchCancelReasons());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดเหตุผลยกเลิกไม่สำเร็จ');
      setData((d) => d ?? { reasons: [], tags: [] });
    }
  }, []);
  useEffect(() => {
    if (enabled) void reload();
  }, [enabled, reload]);
  return { data, error, reload };
}
