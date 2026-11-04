import { apiFetch } from './apiFetch';
import type { StuckMonthlyRow, StuckRequest } from './recruitStuck';

/** `GET /api/recruit-stuck` — ใบขอที่ยังต้องหา ติดตรงไหน + ยอดรายเดือน (หน้าภาพรวมโฉมใหม่ · 4 พ.ย. 2569) */
export type RecruitStuckResponse = {
  generatedAt: string;
  today: string;
  bu: string | null;
  requests: StuckRequest[] | null;
  monthly: StuckMonthlyRow[] | null;
  errors: Partial<Record<'requests' | 'monthly', string>>;
};

export async function fetchRecruitStuck(bu?: string | null): Promise<RecruitStuckResponse> {
  const r = await apiFetch(`/api/recruit-stuck${bu ? `?bu=${encodeURIComponent(bu)}` : ''}`);
  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(data.message || data.error || `โหลดใบขอที่ยังต้องหาไม่สำเร็จ (HTTP ${r.status})`);
  }
  return (await r.json()) as RecruitStuckResponse;
}
