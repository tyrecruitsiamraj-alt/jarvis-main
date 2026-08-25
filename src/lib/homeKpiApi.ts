/**
 * client ของ `/api/home-kpis` — KPI แถวบนหน้าหลัก + ตัวเลือก BU (Phase 10)
 *
 * 🔴 หน้าแรกต้องไม่ล้มเพราะเส้นนี้ — ผู้เรียกจับ error แล้วซ่อนแถบ KPI ไปเลย
 * (แถบว่างดีกว่ากรอบ error คาหน้าแรก · กติกาเดียวกับฉากห้องทำงาน)
 */
import { apiFetch } from '@/lib/apiFetch';
import type { KpiRaw } from '@/lib/homeKpi';

/** ผลงานวันนี้ต่อโต๊ะ — key ตรงกับ `DeskId` ของ officeFloor */
export type DeskTodayEntry = {
  count: number;
  unit: string;
  /** เวลาเหตุการณ์ล่าสุดของโต๊ะนี้ (ISO) — null = วันนี้ยังไม่มีอะไรเกิด */
  lastAt: string | null;
};

export type HomeKpisResponse = {
  generated_at: string;
  /** BU ที่กรองอยู่ — null = ดูทั้งหมด */
  bu: string | null;
  bu_options: Array<{ bu: string; count: number }>;
  kpis: KpiRaw;
  desk_today: Record<string, DeskTodayEntry>;
};

export async function fetchHomeKpis(bu?: string | null): Promise<HomeKpisResponse> {
  const q = bu ? `?bu=${encodeURIComponent(bu)}` : '';
  const r = await apiFetch(`/api/home-kpis${q}`);
  if (!r.ok) throw new Error('โหลด KPI หน้าหลักไม่สำเร็จ');
  return (await r.json()) as HomeKpisResponse;
}
