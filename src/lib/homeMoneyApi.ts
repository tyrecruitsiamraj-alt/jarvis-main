/** ตัวดึง `/api/home-money` — หน้าหลักผู้บริหาร ก้อนเงิน + นาฬิกา (24 ต.ค. 2569) */
import { apiFetch } from '@/lib/apiFetch';
import type { HomeMoneyResponse } from '@/lib/homeMoney';
import type { BuTrendResponse } from '@/lib/homeBuTrend';

export type HomeMoneyPayload = HomeMoneyResponse & {
  /** สายดูแลหลังเริ่มงานที่นัดไว้ ยังไม่ถึงคิว — การ์ดดูแลบอก "รอโทร N สาย · เริ่ม …" */
  aftercareUpcoming?: { calls: number; people: number; firstAt: string | null } | null;
  errors?: Partial<Record<'replacement', string>>;
};

export async function fetchHomeMoney(q: { from: string | null; to: string | null; bu?: string | null }): Promise<HomeMoneyPayload> {
  const p = new URLSearchParams();
  if (q.from) p.set('from', q.from);
  if (q.to) p.set('to', q.to);
  if (q.bu) p.set('bu', q.bu);
  const r = await apiFetch(`/api/home-money${p.toString() ? `?${p}` : ''}`, { cache: 'no-store' });
  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as { message?: string };
    throw new Error(data.message || 'โหลดยอดเงินไม่ขึ้น ลองรีเฟรชอีกครั้ง');
  }
  return (await r.json()) as HomeMoneyPayload;
}

/** เทียบ BU ตามเวลา (10 พ.ย. 2569) — ไม่ส่ง month = 12 เดือนล่าสุด · month = รายวันของเดือนนั้น */
export async function fetchHomeBuTrend(q: { bu?: string | null; month?: string | null }): Promise<BuTrendResponse> {
  const p = new URLSearchParams({ trend: 'bu' });
  if (q.bu) p.set('bu', q.bu);
  if (q.month) p.set('month', q.month);
  const r = await apiFetch(`/api/home-money?${p}`, { cache: 'no-store' });
  if (!r.ok) {
    const data = (await r.json().catch(() => ({}))) as { message?: string };
    throw new Error(data.message || 'โหลดกราฟเทียบ BU ไม่ขึ้น ลองอีกครั้ง');
  }
  return (await r.json()) as BuTrendResponse;
}

/** ช่วงก่อนหน้าที่ยาวเท่ากัน (ชนติดวันแรกของช่วงที่เลือก) — ไว้เทียบขึ้น/ลง */
export function previousWindow(w: { from: string; to: string }): { from: string; to: string } {
  const DAY = 86_400_000;
  const a = Date.parse(`${w.from}T00:00:00Z`);
  const b = Date.parse(`${w.to}T00:00:00Z`);
  const len = Math.round((b - a) / DAY) + 1;
  const to = new Date(a - DAY).toISOString().slice(0, 10);
  const from = new Date(a - len * DAY).toISOString().slice(0, 10);
  return { from, to };
}
