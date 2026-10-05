import { apiFetch } from './apiFetch';
import type { RecruitOverviewResponse } from './recruitOverviewTypes';

/** หน้า "ภาพรวมงานสรรหา" — `month` = 'YYYY-MM' (ไม่ส่ง = เดือนนี้) */
export async function fetchRecruitOverview(
  month?: string | null,
  /** ช่วงที่เลือกเอง (รายวัน/ช่วง · 5 ต.ค. 2569) — ส่งมา = ไม่ใช้ month */
  range?: { from: string; to: string } | null,
): Promise<RecruitOverviewResponse> {
  const p = new URLSearchParams();
  if (range) {
    p.set('from', range.from);
    p.set('to', range.to);
  } else if (month) p.set('month', month);
  const qs = p.toString();
  const r = await apiFetch(`/api/recruit-overview${qs ? `?${qs}` : ''}`);
  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(data.message || data.error || `โหลดภาพรวมงานสรรหาไม่สำเร็จ (HTTP ${r.status})`);
  }
  return (await r.json()) as RecruitOverviewResponse;
}
