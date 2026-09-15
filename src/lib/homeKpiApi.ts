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
  /**
   * จำนวนรายการติดตามที่ **ยังไม่ระบุหน่วยงาน** จึงไม่อยู่ใน BU ไหนเลย
   * 🔴 ต้องขึ้นบนจอตอนกรอง BU อยู่ — ไม่งั้นเลขหายไปเงียบ ๆ แล้วคนถามว่า
   * "ทั้งหมด 30 · LBD 20 ที่เหลือไปไหน" (เกิดจริง 15 ก.ย. 2569)
   */
  no_bu?: { apptToday: number; followToday: number };
};

export async function fetchHomeKpis(bu?: string | null): Promise<HomeKpisResponse> {
  const q = bu ? `?bu=${encodeURIComponent(bu)}` : '';
  const r = await apiFetch(`/api/home-kpis${q}`);
  if (!r.ok) throw new Error('โหลด KPI หน้าหลักไม่สำเร็จ');
  return (await r.json()) as HomeKpisResponse;
}
