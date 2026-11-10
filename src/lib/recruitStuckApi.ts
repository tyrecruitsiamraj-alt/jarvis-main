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

/**
 * ยิงล่วงหน้าพร้อมก้อนภาพรวม (เจ้าของ 10 พ.ย. 2569 "หน้าโหลดช้า" · วัดบนเว็บจริง: ใบขอติดตรงไหนรอก้อนภาพรวมเสร็จก่อนถึงเริ่มยิง
 * ⇒ สมการบนสุดขึ้นที่ 10.7 วิ) — `fetchRecruitStuck` ของช่วง/BU เดียวกันภายใน 30 วิ ใช้คำขอนี้แทนยิงซ้ำ
 */
const PREFETCH_MS = 30_000;
const prefetched = new Map<string, { at: number; p: Promise<RecruitStuckResponse> }>();
const prefetchKey = (bu: string | null | undefined, range?: { from: string; to: string }) => `${bu ?? ''}|${range?.from ?? ''}|${range?.to ?? ''}`;

export function prefetchRecruitStuck(bu: string | null | undefined, range: { from: string; to: string }): void {
  const key = prefetchKey(bu, range);
  const hit = prefetched.get(key);
  if (hit && Date.now() - hit.at < PREFETCH_MS) return;
  const p = requestRecruitStuck(bu, range);
  // ไม่มีใครรับ = ไม่ขึ้น unhandled rejection · คนที่รับไปได้ error ตามปกติ
  p.catch(() => prefetched.delete(key));
  prefetched.set(key, { at: Date.now(), p });
}

/** `part: 'monthly'` = เทียบเดือนอย่างเดียว (โหลดตอนกางการ์ด · 9 พ.ย. 2569) · ไม่ส่ง = ใบขอ */
export async function fetchRecruitStuck(bu?: string | null, range?: { from: string; to: string }, part?: 'monthly'): Promise<RecruitStuckResponse> {
  if (!part) {
    const key = prefetchKey(bu, range);
    const hit = prefetched.get(key);
    if (hit) {
      prefetched.delete(key);
      if (Date.now() - hit.at < PREFETCH_MS) return hit.p;
    }
  }
  return requestRecruitStuck(bu, range, part);
}

async function requestRecruitStuck(bu?: string | null, range?: { from: string; to: string }, part?: 'monthly'): Promise<RecruitStuckResponse> {
  const q = new URLSearchParams();
  if (bu) q.set('bu', bu);
  if (part) q.set('part', part);
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
