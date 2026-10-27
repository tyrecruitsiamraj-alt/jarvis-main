/**
 * ═══ หน้าหลักผู้บริหาร · ตอบได้ใน 30 วินาที (เจ้าของ 24 ต.ค. 2569 "ทำเลย") ═══
 * - ต้องรีบ: ใบที่เสียเงินวันละมากสุด · ใบที่จะครบวันที่ต้องการใน 3 วันแต่ยังขาดคน
 * - ใครค้างเท่าไหร่: แยกตามเจ้าหน้าที่สรรหาของใบขอ (ช่องผู้รับผิดชอบ · ชุดเดียวกับกล่องงาน)
 * ใช้รายใบจาก `/api/home-money` (ใบที่ยังเปิด = ชุดเดียวกับกล่องงาน) · pure — เทสต์ `tests/api/homeExec2569-10-24.test.ts`
 */
import type { MoneyRequest } from './homeMoney';

/** `owner` = เจ้าหน้าที่สรรหาของใบ (ไม่มี = `NO_OWNER`) — หัวหน้ารู้ทันทีว่าต้องตามใคร (เจ้าของ 25 ต.ค. 2569) */
export type UrgentRow = { requestNo: string; unit: string; position: string; place: string | null; missing: number; perDay: number; needYmd: string | null; owner: string };

const missingOf = (r: Pick<MoneyRequest, 'qty' | 'filled'>) => Math.max(0, r.qty - r.filled);
/**
 * เสียวันละ = ยอดของวันนี้จากสมุดเดียวกับ "ตามสัญญา" (`todayCost` — หักคนแทนที่ส่งไปแล้ว · วันไซต์ไม่ทำงาน = 0)
 * ไม่มี `todayCost` (เทสต์/ข้อมูลเก่า) = คนที่ขาด × (ค่าปรับ + ลดมูลค่า)
 * 27 ต.ค. 2569: เดิมคูณเต็มอย่างเดียว ขึ้น 213,449/วัน ทั้งที่สมุดวันเดียวกันได้ 132,030 (คนแทนคลุม 70 ใบ)
 */
export const perDayOf = (r: Pick<MoneyRequest, 'qty' | 'filled' | 'finePerDay' | 'deductPerDay' | 'todayCost'>) =>
  typeof r.todayCost === 'number' ? r.todayCost : missingOf(r) * (r.finePerDay + r.deductPerDay);

const toRow = (r: MoneyRequest): UrgentRow => ({
  requestNo: r.requestNo,
  unit: r.unit,
  position: r.position,
  place: r.place?.trim() || null,
  missing: missingOf(r),
  perDay: perDayOf(r),
  needYmd: r.needYmd,
  owner: r.owner?.trim() || NO_OWNER,
});

const addDays = (ymd: string, n: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/**
 * ใบค้างนานผิดปกติ = เลยวันที่ต้องการเกิน 90 วันและไม่เคยได้คนเลย (เช่น LMO6808002 ตั้งแต่ ส.ค. 2568)
 * แยกออกจาก "ต้องรีบ" ไม่ให้เบียดใบที่ยังแก้ได้ (เจ้าของ 24 ต.ค. 2569 Choice) — เงินยังนับเหมือนเดิม
 */
export const STALE_DAYS = 90;
export function isStale(r: Pick<MoneyRequest, 'open' | 'needYmd' | 'filled'>, today: string): boolean {
  return r.open && r.filled === 0 && r.needYmd != null && r.needYmd < addDays(today, -STALE_DAYS);
}
export function staleOf(requests: readonly MoneyRequest[], today: string): { rows: UrgentRow[]; perDay: number } {
  const rows = requests.filter((r) => isStale(r, today)).map(toRow).sort((a, b) => b.perDay - a.perDay);
  return { rows, perDay: rows.reduce((a, r) => a + r.perDay, 0) };
}

/**
 * เสียวันละทั้งหมด = ทุกใบที่ยังเปิดและเลยวันที่ต้องการ (รวมใบค้างเกิน 90 วัน) — เท่ากับผลรวมช่อง
 * "เสียเงินวันละ" ของตารางงานของเจ้าหน้าที่ทุกคน (เจ้าของ 27 ต.ค. 2569 "ยอดไม่เท่ากันหนิ")
 */
export function overdueOf(requests: readonly MoneyRequest[], today: string): { rows: UrgentRow[]; perDay: number } {
  const rows = requests
    // นับใบเสียวันละ 0 ด้วย — จำนวนใบต้องเท่าช่อง "ใบที่เลยวัน" ของตาราง
    .filter((r) => r.open && r.needYmd != null && r.needYmd <= today)
    .map(toRow)
    .sort((a, b) => b.perDay - a.perDay);
  return { rows, perDay: rows.reduce((a, r) => a + r.perDay, 0) };
}

/** ใบที่เลยวันที่ต้องการแล้ว (ไม่นับใบค้างนานผิดปกติ) เรียงเสียวันละมากสุดก่อน */
export function costliest(requests: readonly MoneyRequest[], today: string, top = 5): { rows: UrgentRow[]; total: number } {
  const all = requests
    .filter((r) => r.open && r.needYmd != null && r.needYmd <= today && perDayOf(r) > 0 && !isStale(r, today))
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

/**
 * ═══ ยกเลิกเพราะอะไร (เจ้าของ 25 ต.ค. 2569 "คงเป็นยกเลิกก้อนเดียว พอกดเข้าไปค่อยโชว์ว่าเหตุผลอะไรบ้าง อย่างละเท่าไหร่") ═══
 * เหตุผลจาก ERP (`st_ms_stop_by`) · ไม่ได้กรอก = `NO_REASON` · `weight` = นับใบ (1) หรือคน (`flow.cancelled`) — ผลรวมเท่ากล่องที่กด
 */
export const NO_REASON = 'ไม่ได้กรอกเหตุผล';
export function reasonsOf(rows: readonly MoneyRequest[], weight: (r: MoneyRequest) => number): Array<{ label: string; n: number }> {
  const out = new Map<string, number>();
  for (const r of rows) {
    const w = weight(r);
    if (w <= 0) continue;
    const k = r.stopReason?.trim() || NO_REASON;
    out.set(k, (out.get(k) ?? 0) + w);
  }
  return [...out.entries()]
    .map(([label, n]) => ({ label, n }))
    .sort((a, b) => Number(a.label === NO_REASON) - Number(b.label === NO_REASON) || b.n - a.n);
}
export type OwnerRow = { name: string; requests: number; overdue: number; missing: number; perDay: number; closed: number; filled: number };

/**
 * แยกตามเจ้าหน้าที่สรรหาของใบขอ (`owner` จากช่องผู้รับผิดชอบ · ไม่มี = ยังไม่มีคนรับผิดชอบ)
 * ค้าง/เลยวัน/ขาด/เสียวันละ = ใบที่ยังเปิด ณ วันนี้ · ปิดครบ/หาได้ = ในช่วงที่เลือก (รวมใบที่ปิดไปแล้ว)
 */
export function byOwner(requests: readonly MoneyRequest[], today: string): OwnerRow[] {
  const out = new Map<string, OwnerRow>();
  for (const r of requests) {
    if (!r.open && !r.closedInWindow && r.filledInWindow === 0) continue;
    const name = r.owner?.trim() || NO_OWNER;
    const row = out.get(name) ?? { name, requests: 0, overdue: 0, missing: 0, perDay: 0, closed: 0, filled: 0 };
    if (r.closedInWindow) row.closed += 1;
    row.filled += r.filledInWindow;
    if (r.open) {
      row.requests += 1;
      if (r.needYmd != null && r.needYmd <= today) {
        row.overdue += 1;
        row.perDay += perDayOf(r);
      }
      row.missing += missingOf(r);
    }
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
