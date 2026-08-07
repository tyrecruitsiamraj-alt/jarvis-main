import { apiFetch } from '@/lib/apiFetch';
import { readErrorMessage, readJsonSafe } from '@/lib/api';
import type { CallBatch } from '@/lib/callBatch';

/** ชุดส่งงานโทร — ดู api/_handlers/lumos-call-batches.ts */
export async function fetchCallBatches(): Promise<CallBatch[]> {
  try {
    const r = await apiFetch('/api/lumos/call-batches');
    if (!r.ok) return [];
    const data = await readJsonSafe<{ batches?: CallBatch[] }>(r);
    return data?.batches ?? [];
  } catch {
    return [];
  }
}

/**
 * สร้างชุดส่งรออนุมัติจากคนที่ติ๊กเลือกไว้ในหน้า Matching
 *
 * ⚠️ หนึ่งชุด = หนึ่งช่อง — บอร์ดเข้าช่อง reminder · iRecruit เข้าช่อง interview
 * ส่งมาปนกันในคำขอเดียว server ตอบ 400 (สถานะ/การยกเลิกจะกำกวม)
 * ตัวเรียกจึงต้องแยกยิงทีละฝั่ง ไม่ใช่รวมก้อนเดียว
 */
export async function createCallBatch(input: {
  jobId: string;
  boardCardIds?: number[];
  irecruitIds?: number[];
  note?: string;
}): Promise<CallBatch> {
  const r = await apiFetch('/api/lumos/call-batches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'สร้างชุดส่งไม่สำเร็จ'));
  const data = await readJsonSafe<{ batch?: CallBatch }>(r);
  if (!data?.batch) throw new Error('สร้างชุดส่งไม่สำเร็จ');
  return data.batch;
}

export async function approveCallBatch(batchId: string): Promise<CallBatch> {
  const r = await apiFetch('/api/lumos/call-batches', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batchId, action: 'approve' }),
  });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'อนุมัติไม่สำเร็จ'));
  return ((await readJsonSafe<{ batch: CallBatch }>(r)) as { batch: CallBatch }).batch;
}

export async function cancelCallBatch(batchId: string, reason?: string): Promise<CallBatch> {
  const r = await apiFetch('/api/lumos/call-batches', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ batchId, action: 'cancel', reason: reason ?? null }),
  });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'ยกเลิกไม่สำเร็จ'));
  return ((await readJsonSafe<{ batch: CallBatch }>(r)) as { batch: CallBatch }).batch;
}

/** ถอนคนออกจากชุด (ก่อนเข้าคิวจริง) */
export async function removeCallBatchItem(batchId: string, itemId: string): Promise<CallBatch | null> {
  const params = new URLSearchParams({ batchId, itemId });
  const r = await apiFetch(`/api/lumos/call-batches?${params}`, { method: 'DELETE' });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'ถอนออกไม่สำเร็จ'));
  const data = await readJsonSafe<{ batch: CallBatch | null }>(r);
  return data?.batch ?? null;
}
