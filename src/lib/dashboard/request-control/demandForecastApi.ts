import { apiFetch } from '@/lib/apiFetch';
import type { DemandForecastResponse } from '@/lib/dashboard/request-control/demandForecast';

/** ดึงยอดรายเดือน 3 ปี + YTD สำหรับพยากรณ์ใบขอเข้าใหม่ (ต้องล็อกอิน) */
export async function fetchDemandForecast(): Promise<DemandForecastResponse | null> {
  try {
    const r = await apiFetch('/api/request-control/demand-forecast');
    if (!r.ok) return null;
    return (await r.json()) as DemandForecastResponse;
  } catch {
    return null;
  }
}
