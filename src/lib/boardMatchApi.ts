import { apiFetch } from '@/lib/apiFetch';
import type { BoardMatchResponse } from '@/lib/boardCandidateTypes';

/**
 * ดึงผลแมท "คนของเรา" ของใบขอเดียว — **แหล่งเดียวกับหน้าจับคู่งาน**
 * (เจ้าของสั่ง 17 ส.ค. 2569: *"หน้า AI match ต้อง match auto เลยจากพวก todo ไม่มีงาน
 * reuse ฯลฯ การทำงานเหมือนหน้าจับคู่งานเลย … แต่แยกให้ดูเฉพาะของใบนั้น ๆ"*)
 *
 * ⚠️ GET นี้ **ไม่สั่ง AI คิดสด** — worker หลังบ้านคิดแล้วเก็บไว้ ที่นี่แค่ไปอ่าน
 * ถ้ายังไม่มีผลจะได้ `pending: true` พร้อมส่งใบเข้าคิวให้เอง แล้วผู้เรียกวนเช็คเอง
 * `refresh: true` = สั่งคิดใหม่ (ผลเดิมยังส่งกลับมาให้แสดงระหว่างรอ)
 */
export async function fetchBoardMatchForJob(
  jobId: string,
  options?: { refresh?: boolean },
): Promise<BoardMatchResponse> {
  const params = new URLSearchParams({ jobId });
  if (options?.refresh) params.set('refresh', '1');
  const r = await apiFetch(`/api/matching/board-candidates?${params.toString()}`);
  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as {
      message?: string;
      detail?: string;
      error?: string;
    };
    throw new Error(data.message || data.detail || data.error || `ค้นหาไม่สำเร็จ (HTTP ${r.status})`);
  }
  return (await r.json()) as BoardMatchResponse;
}
