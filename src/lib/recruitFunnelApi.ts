import { apiFetch } from '@/lib/apiFetch';
import { readErrorMessage, readJsonSafe } from '@/lib/api';
import type { RecruitFunnelCounts } from '@/lib/recruitFunnel';

export type RecruitFunnelResponse = RecruitFunnelCounts & {
  leads: number;
  from: string | null;
  to: string | null;
};

/**
 * ยอดสรุปงานสรรหา (RM) — อ่านจาก iRecruit อย่างเดียว
 * ⚠️ ล้มแล้ว **โยน error** ไม่คืนศูนย์ — แผงต้องบอกว่า "อ่านไม่ได้" ไม่ใช่โชว์ 0 ทั้งแถว
 */
export async function fetchRecruitFunnel(
  range: { from?: string | null; to?: string | null } = {},
): Promise<RecruitFunnelResponse> {
  const params = new URLSearchParams();
  if (range.from) params.set('from', range.from);
  if (range.to) params.set('to', range.to);
  const qs = params.toString();
  const r = await apiFetch(`/api/recruit/funnel${qs ? `?${qs}` : ''}`);
  if (!r.ok) throw new Error(await readErrorMessage(r, 'โหลดยอดสรุปงานสรรหาไม่สำเร็จ'));
  const data = await readJsonSafe<RecruitFunnelResponse>(r);
  if (!data || typeof data !== 'object') throw new Error('ยอดสรุปงานสรรหาอ่านไม่ออก');
  return data;
}
