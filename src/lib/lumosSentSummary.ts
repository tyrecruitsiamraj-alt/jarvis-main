/**
 * ═══ ส่งให้ Lumos ทั้งระบบ — ตัวคิดของหัวคอลัมน์ Lumos บนหน้าแรก (28 ก.ย. 2569) ═══
 *
 * เจ้าของ: *"จะรู้ได้ไงว่าทั้งระบบส่งไปหา Lumos ทั้งหมดเท่าไหร่ เอาไว้หน้าแรกเลยได้ไหม"* → Choice:
 * ยอดรวมหัวคอลัมน์ Lumos · **วันนี้ · เดือนนี้ · ทั้งหมด** + *"เรื่องช่วงดูได้ด้วย แยก bu ดูได้ด้วย"* · นับเป็นสาย
 *
 * 🔴 กติกา:
 * - นับ **สาย** (แถวคิว) ตามวันที่ส่งเข้าคิว — ยอด "ทั้งหมด" = "ส่งให้ AI ไปแล้ว" ของทุกเส้นทางรวมกัน (รวมยกเลิก)
 * - แจกสถานะ/เส้นทางของ **ช่วงที่ดูอยู่** (ช่วงที่เลือก → ทั้งหมด) และต้องบวกกันได้ยอดของช่วงนั้นเป๊ะ
 * - กรอง BU แล้วสายที่ไม่รู้ BU ต้องบอกจำนวน (ไม่อยู่ BU ไหน) — ห้ามหายเงียบ
 */
import type { LumosSentRoute, LumosSentRow, LumosSentState } from '@/lib/officeTeam';

export type LumosSentRange = { from: string; to: string };

export const LUMOS_SENT_STATES: readonly LumosSentState[] = ['pending', 'waiting', 'done', 'cancelled', 'other'];
export const LUMOS_SENT_ROUTES: readonly LumosSentRoute[] = ['public', 'match', 'follow', 'other'];

export type LumosSentSummary = {
  today: number;
  month: number;
  all: number;
  /** ช่วงที่เลือก · null = ไม่ได้เลือก */
  range: number | null;
  /** สถานะตอนนี้ของสายในช่วงที่ดูอยู่ (ช่วงที่เลือก → ทั้งหมด) */
  states: Record<LumosSentState, number>;
  /** เส้นทางเข้าของสายในช่วงที่ดูอยู่ */
  routes: Record<LumosSentRoute, number>;
  /** กำลังกรอง BU: สายที่ไม่รู้ BU ในช่วงที่ดูอยู่ · ไม่ได้กรอง = null */
  unknownBu: number | null;
};

const zero = <K extends string>(keys: readonly K[]) =>
  Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;

const inRange = (day: string, r: LumosSentRange) => day >= r.from && day <= r.to;

export function summarizeLumosSent(
  rows: readonly LumosSentRow[],
  opts: {
    /** วันนี้ตามปฏิทินกรุงเทพ (YYYY-MM-DD) */
    today: string;
    /** BU ที่กรอง (รหัสจากไซต์) · null = ทุก BU */
    bu: string | null;
    range: LumosSentRange | null;
  },
): LumosSentSummary {
  const monthStart = `${opts.today.slice(0, 7)}-01`;
  const out: LumosSentSummary = {
    today: 0,
    month: 0,
    all: 0,
    range: opts.range ? 0 : null,
    states: zero(LUMOS_SENT_STATES),
    routes: zero(LUMOS_SENT_ROUTES),
    unknownBu: opts.bu ? 0 : null,
  };
  const viewing = (day: string) => (opts.range ? inRange(day, opts.range) : true);
  for (const r of rows) {
    if (opts.bu && r.bu !== opts.bu) {
      if (r.bu === null && out.unknownBu !== null && viewing(r.day)) out.unknownBu += r.n;
      continue;
    }
    out.all += r.n;
    if (r.day === opts.today) out.today += r.n;
    if (r.day >= monthStart && r.day <= opts.today) out.month += r.n;
    if (opts.range && out.range !== null && inRange(r.day, opts.range)) out.range += r.n;
    if (viewing(r.day)) {
      out.states[r.state] += r.n;
      out.routes[r.route] += r.n;
    }
  }
  return out;
}

/** ตัวเลือก BU — จากสายที่มีจริง (ทั้งหมด) เรียงมากไปน้อย · ไม่รู้ BU ไม่เป็นตัวเลือก (บอกเป็นจำนวนแทน) */
export function lumosSentBuOptions(rows: readonly LumosSentRow[]): Array<{ bu: string; count: number }> {
  const acc = new Map<string, number>();
  for (const r of rows) if (r.bu) acc.set(r.bu, (acc.get(r.bu) ?? 0) + r.n);
  return [...acc.entries()]
    .map(([bu, count]) => ({ bu, count }))
    .sort((a, b) => b.count - a.count || a.bu.localeCompare(b.bu));
}
