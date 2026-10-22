/** ตัวดึง `/api/request-pipeline` — หน้าหลัก แท็บใบขอ (22 ต.ค. 2569) */
import { apiFetch } from '@/lib/apiFetch';
import type { RequestPipelineResponse } from '@/lib/requestPipelineTypes';

export async function fetchRequestPipeline(q: { from: string | null; to: string | null }): Promise<RequestPipelineResponse> {
  const p = new URLSearchParams();
  if (q.from) p.set('from', q.from);
  if (q.to) p.set('to', q.to);
  const r = await apiFetch(`/api/request-pipeline${p.toString() ? `?${p}` : ''}`, { cache: 'no-store' });
  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as { message?: string };
    throw new Error(data.message || 'โหลดเส้นใบขอไม่ขึ้น ลองรีเฟรชอีกครั้ง');
  }
  return (await r.json()) as RequestPipelineResponse;
}
