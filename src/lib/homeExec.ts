/**
 * ═══ หน้าหลักผู้บริหาร · ตอบได้ใน 30 วินาที (เจ้าของ 24 ต.ค. 2569 "ทำเลย") ═══
 * - ต้องรีบ: ใบที่เสียเงินวันละมากสุด · ใบที่จะครบวันที่ต้องการใน 3 วันแต่ยังขาดคน
 * - ใครค้างเท่าไหร่: แยกตามเจ้าหน้าที่สรรหาของใบขอ (ช่องผู้รับผิดชอบ · ชุดเดียวกับกล่องงาน)
 * ใช้รายใบจาก `/api/home-money` (ใบที่ยังเปิด = ชุดเดียวกับกล่องงาน) · pure — เทสต์ `tests/api/homeExec2569-10-24.test.ts`
 */
import type { MoneyRequest } from './homeMoney';

export type UrgentRow = { requestNo: string; unit: string; position: string; missing: number; perDay: number; needYmd: string | null };

const missingOf = (r: Pick<MoneyRequest, 'qty' | 'filled'>) => Math.max(0, r.qty - r.filled);
/** เสียวันละ = คนที่ยังขาด × (ค่าปรับ + ลดมูลค่า) ต่อคนต่อวัน */
export const perDayOf = (r: Pick<MoneyRequest, 'qty' | 'filled' | 'finePerDay' | 'deductPerDay'>) =>
  missingOf(r) * (r.finePerDay + r.deductPerDay);

const toRow = (r: MoneyRequest): UrgentRow => ({
  requestNo: r.requestNo,
  unit: r.unit,
  position: r.position,
  missing: missingOf(r),
  perDay: perDayOf(r),
  needYmd: r.needYmd,
});

const addDays = (ymd: string, n: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** ใบที่เลยวันที่ต้องการแล้ว เรียงเสียวันละมากสุดก่อน */
export function costliest(requests: readonly MoneyRequest[], today: string, top = 5): { rows: UrgentRow[]; total: number } {
  const all = requests
    .filter((r) => r.open && r.needYmd != null && r.needYmd <= today && perDayOf(r) > 0)
    .map(toRow)
    .sort((a, b) => b.perDay - a.perDay || b.missing - a.missing);
  return { rows: all.slice(0, top), total: all.length };
}

/** ใบที่จะครบวันที่ต้องการในอีก 1–`days` วัน แต่ยังขาดคน · ใกล้สุดก่อน */
export function dueSoon(requests: readonly MoneyRequest[], today: string, days = 3, top = 5): { rows: UrgentRow[]; total: number } {
  const last = addDays(today, days);
  const all = requests
    .filter((r) => r.open && r.needYmd != null && r.needYmd > today && r.needYmd <= last && missingOf(r) > 0)
    .map(toRow)
    .sort((a, b) => (a.needYmd! < b.needYmd! ? -1 : a.needYmd! > b.needYmd! ? 1 : b.perDay - a.perDay));
  return { rows: all.slice(0, top), total: all.length };
}

export const NO_OWNER = 'ยังไม่มีคนรับผิดชอบ';
export type OwnerRow = { name: string; requests: number; overdue: number; missing: number; perDay: number };

/** ใบที่ยังเปิด แยกตามเจ้าหน้าที่ — `ownerOf(เลขใบขอ)` มาจากช่องผู้รับผิดชอบของใบขอ (ไม่รู้ = ยังไม่มีคนรับผิดชอบ) */
export function byOwner(requests: readonly MoneyRequest[], today: string, ownerOf: (requestNo: string) => string | null): OwnerRow[] {
  const out = new Map<string, OwnerRow>();
  for (const r of requests) {
    if (!r.open) continue;
    const name = ownerOf(r.requestNo)?.trim() || NO_OWNER;
    const row = out.get(name) ?? { name, requests: 0, overdue: 0, missing: 0, perDay: 0 };
    row.requests += 1;
    if (r.needYmd != null && r.needYmd <= today) {
      row.overdue += 1;
      row.perDay += perDayOf(r);
    }
    row.missing += missingOf(r);
    out.set(name, row);
  }
  return [...out.values()].sort(
    (a, b) => Number(a.name === NO_OWNER) - Number(b.name === NO_OWNER) || b.perDay - a.perDay || b.requests - a.requests,
  );
}

/** ค่าตั้งต้นของหน้าผู้บริหาร = เดือนนี้ (วันที่ 1 ถึงวันนี้) — ผู้บริหารคิดเป็นเดือน */
export function thisMonthWindow(today: string): { from: string; to: string } {
  return { from: `${today.slice(0, 7)}-01`, to: today };
}
