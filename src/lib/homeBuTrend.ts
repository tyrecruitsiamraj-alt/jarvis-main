/**
 * ═══ เทียบ BU ตามเวลา — เสียเงินตามสัญญา + เหลือหา (เจ้าของ 10 พ.ย. 2569) ═══
 * > *"กราฟเปรียบเทียบแบบตามช่วงวันที่ของทุก Bu … เทียบรายเดือนว่าแต่ละ BU แนวโน้มค่าปรับเพิ่มขึ้นไหม"*
 * > Choice "เทียบ": *"ถ้าฉันกดดูแบบเดือน ก็จะเห็นทุกเดือนเลย พอกดเดือนไหนก็ค่อยให้เห็นเป็นวัน"* · ค่าปรับ = ตามสัญญาในช่วง
 *
 * 🔴 นิยามเดียวกับการ์ดหน้าหลัก (ห้ามคิดใหม่): เงิน = `amount.need.fine + deduct` ของสมุด (`buildPenaltyLedger`)
 *    เหลือหา = `requestFlowRole(...).open` ณ ปลายช่วงของแต่ละแท่ง (ใบ) · `remaining` (อัตรา) — รวมใบขอชั่วคราวเหมือนการ์ด
 *    ⇒ แท่งของเดือน/วันที่ตรงกับช่วงที่เลือกบนหน้าหลัก = เลขบนการ์ดพอดี · pure (ไม่แตะฐาน)
 */
import {
  buildPenaltyLedger,
  requestFlowRole,
  type PenaltyInform,
  type PenaltyRequestRow,
} from './requestPenaltyLedger';

export type BuTrendCell = { money: number; remainingRequests: number; remainingPositions: number };
export type BuTrendPoint = { key: string; from: string; to: string; byBu: Record<string, BuTrendCell> };
export type BuTrendBucket = { key: string; from: string; to: string };
export type BuTrendResponse = { granularity: 'month' | 'day'; month: string | null; bus: string[]; points: BuTrendPoint[] };

const pad = (n: number) => String(n).padStart(2, '0');
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** เดือนย้อนหลัง `count` เดือนถึงเดือนของ `today` (เดือนนี้ = ถึงวันนี้) */
export function monthBuckets(today: string, count: number): BuTrendBucket[] {
  const [y, m] = today.split('-').map(Number);
  const out: BuTrendBucket[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const yy = d.getUTCFullYear();
    const mm = d.getUTCMonth() + 1;
    const key = `${yy}-${pad(mm)}`;
    const to = `${key}-${pad(lastDay(yy, mm))}`;
    out.push({ key, from: `${key}-01`, to: to > today ? today : to });
  }
  return out;
}

/** ทุกวันของเดือน `month` (YYYY-MM) ถึงวันนี้ · เดือนในอนาคต = ว่าง */
export function dayBuckets(month: string, today: string): BuTrendBucket[] {
  const [y, m] = month.split('-').map(Number);
  const out: BuTrendBucket[] = [];
  for (let d = 1; d <= lastDay(y, m); d += 1) {
    const ymd = `${month}-${pad(d)}`;
    if (ymd > today) break;
    out.push({ key: ymd, from: ymd, to: ymd });
  }
  return out;
}

export function buildBuTrend(
  rows: readonly PenaltyRequestRow[],
  informs: readonly PenaltyInform[],
  today: string,
  buckets: readonly BuTrendBucket[],
  buOf: (r: PenaltyRequestRow) => string,
  replacements: Record<string, ReadonlyArray<readonly [string, number]>> = {},
): { bus: string[]; points: BuTrendPoint[] } {
  const seen = new Set<string>();
  const points = buckets.map((b) => {
    const ledger = buildPenaltyLedger(rows, informs, today, { from: b.from, to: b.to }, replacements);
    const byBu: Record<string, BuTrendCell> = {};
    for (const r of ledger.requests) {
      const bu = buOf(r);
      const money = r.amount.need.fine + r.amount.need.deduct;
      const role = requestFlowRole(r, b.from, b.to);
      if (money <= 0 && !role.open) continue;
      const cell = (byBu[bu] ??= { money: 0, remainingRequests: 0, remainingPositions: 0 });
      cell.money += money;
      if (role.open) {
        cell.remainingRequests += 1;
        cell.remainingPositions += role.remaining;
      }
      seen.add(bu);
    }
    for (const c of Object.values(byBu)) c.money = Math.round(c.money * 100) / 100;
    return { key: b.key, from: b.from, to: b.to, byBu };
  });
  return { bus: [...seen].sort(), points };
}
