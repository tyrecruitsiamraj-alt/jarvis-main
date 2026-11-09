import { apiFetch } from './apiFetch';
import type { StuckMonthlyRow, StuckRequest } from './recruitStuck';

/** `GET /api/recruit-stuck` — ใบขอที่เหลือหา ติดตรงไหน + ยอดรายเดือน (หน้าภาพรวมโฉมใหม่ · 4 พ.ย. 2569) */
export type RecruitStuckResponse = {
  generatedAt: string;
  today: string;
  bu: string | null;
  /** ช่วงที่ใช้คิด "ขอใหม่" (ไม่มี = เส้นรุ่นเก่า) */
  window?: { from: string; to: string };
  requests: StuckRequest[] | null;
  monthly: StuckMonthlyRow[] | null;
  errors: Partial<Record<'requests' | 'monthly', string>>;
};

export async function fetchRecruitStuck(bu?: string | null, range?: { from: string; to: string }): Promise<RecruitStuckResponse> {
  const q = new URLSearchParams();
  if (bu) q.set('bu', bu);
  if (range) {
    q.set('from', range.from);
    q.set('to', range.to);
  }
  const qs = q.toString();
  const r = await apiFetch(`/api/recruit-stuck${qs ? `?${qs}` : ''}`);
  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(data.message || data.error || `โหลดใบขอที่เหลือหาไม่สำเร็จ (HTTP ${r.status})`);
  }
  return (await r.json()) as RecruitStuckResponse;
}
