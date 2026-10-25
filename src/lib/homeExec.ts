/**
 * ═══ หน้าหลักผู้บริหาร · ตอบได้ใน 30 วินาที (เจ้าของ 24 ต.ค. 2569 "ทำเลย") ═══
 * - ต้องรีบ: ใบที่เสียเงินวันละมากสุด · ใบที่จะครบวันที่ต้องการใน 3 วันแต่ยังขาดคน
 * - ใครค้างเท่าไหร่: แยกตามเจ้าหน้าที่สรรหาของใบขอ (ช่องผู้รับผิดชอบ · ชุดเดียวกับกล่องงาน)
 * ใช้รายใบจาก `/api/home-money` (ใบที่ยังเปิด = ชุดเดียวกับกล่องงาน) · pure — เทสต์ `tests/api/homeExec2569-10-24.test.ts`
 */
import type { MoneyRequest } from './homeMoney';

/** `owner` = เจ้าหน้าที่สรรหาของใบ (ไม่มี = `NO_OWNER`) — หัวหน้ารู้ทันทีว่าต้องตามใคร (เจ้าของ 25 ต.ค. 2569) */
export type UrgentRow = { requestNo: string; unit: string; position: string; missing: number; perDay: number; needYmd: string | null; owner: string };

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

/**
 * ═══ AI กับคน ถ้าจะขยาย ต้องใช้อย่างละเท่าไหร่ (เจ้าของ 24 ต.ค. 2569 "อยาก Scale ได้ว่าอย่างละเท่าไหร่") ═══
 * คนทำได้วันละ = งานที่ลงผล ÷ คน-วันที่ลงผลจริง · AI ทำได้วันละ = สายที่ได้ผล ÷ วันในช่วง (AI ไม่มีเพดานต่อวันจากฝั่งเรา)
 * งานเพิ่มวันละ X ⇒ ใช้คนเพิ่ม = X ÷ คนทำได้วันละ (ปัดขึ้น) · หรือให้ AI โทรเพิ่ม X สาย
 */
export type ScaleStat = { perPersonDay: number | null; staffPeople: number; staffPerDay: number; aiPerDay: number; days: number };
export function scaleOf(w: { staffActions: number; staffPeople: number; staffPersonDays: number; aiCalls: number } | null | undefined, from: string, to: string): ScaleStat | null {
  if (!w) return null;
  const days = Math.max(1, Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1);
  return {
    perPersonDay: w.staffPersonDays > 0 ? Math.round((w.staffActions / w.staffPersonDays) * 10) / 10 : null,
    staffPeople: w.staffPeople,
    staffPerDay: Math.round((w.staffActions / days) * 10) / 10,
    aiPerDay: Math.round((w.aiCalls / days) * 10) / 10,
    days,
  };
}
export function peopleNeeded(extraPerDay: number, perPersonDay: number | null): number | null {
  if (!perPersonDay || perPersonDay <= 0) return null;
  return Math.ceil(Math.max(0, extraPerDay) / perPersonDay);
}
