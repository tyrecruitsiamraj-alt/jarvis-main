/**
 * ═══ สมุดค่าปรับ/ลดมูลค่าของใบขอ — หน้าหลักผู้บริหาร (เจ้าของ 24 ต.ค. 2569) ═══
 *
 * > *"โดนค่าปรับ ลดมูลค่าเท่าไหร่ · โดนใบไหนบ้าง · ใบละกี่วัน วันละกี่คน"* ·
 * > *"นับทั้งหมด แยกเป็นเดือนๆ ดูรายวันได้ด้วย รายสัปดาห์"* · *"ไม่เอาวันหยุดมาคำนวณ"*
 *
 * สูตร (เจ้าของ + หัวหน้าเคาะ 24 ต.ค. 2569 — ต่อคนต่อวันทำงาน):
 *   วันละ = คนที่ขาดในวันนั้น × อัตรา (ค่าปรับ `abs_customer_fine` / ลดมูลค่า `abs_customer_deduct` ของใบขอ)
 *   - นับเฉพาะวันทำงานของใบขอ (`parseWorkWeekdays` ตัวเดียวกับ "ผ่านมา" ของเมนูใบขอ) · อ่านไม่ออก = ทุกวัน
 *   - ไม่หักวันหยุดนักขัตฤกษ์ (ERP ไม่มีตารางวันหยุดที่ใช้ได้ — กติกาเดียวกับ siteWorkdays.ts)
 *   - คนที่ขาด = จำนวนที่ขอ − คนที่เริ่มงานแล้วถึงวันนั้น (วันเริ่มงานในใบแจ้งเข้าที่ไม่ถูกยกเลิก)
 *   - หยุดนับเมื่อใบถูก Stop/ยกเลิก/ปิด (วันนั้นไม่นับ) · ใบที่ยังเปิด นับถึงวันนี้
 * สองจุดเริ่มนับ (เจ้าของ Choice "ทั้งสองแบบเทียบกัน"):
 *   - `need` = วันที่ลูกค้าต้องการ (มุมลูกค้า · ใบย้อนหลังเริ่มนับก่อนวันคีย์)
 *   - `key`  = วันคีย์ใบขอ แต่ไม่ก่อนวันที่ต้องการ (มุมทีม · ช่วงก่อนเรารู้เรื่องไม่นับ)
 * สองนาฬิกา (เจ้าของ 24 ต.ค. 2569):
 *   - ความเร็วทีม = วันหาคนครบ − วันคีย์ (หาได้ = วันคีย์แจ้งเข้า หรือวันเริ่มงาน แล้วแต่อันไหนก่อน)
 *   - ช้ากว่าที่ลูกค้าต้องการ = วันที่คนเริ่มงานครบ − วันที่ต้องการ (ติดลบ = 0)
 *
 * ส่งคนแทน (`replacements` ไซต์ → [วัน, คน] ชุดเดียวกับแท็บใบขอ): คนแทนในวันนั้นที่ไซต์เดียวกันหักคนที่ขาด
 *   แบ่งให้ใบที่ต้องการก่อนก่อน (แบบเดียวกับ `allocateReplacements`) · แยกนับต่อจุดเริ่มนับ
 * ไฟล์นี้ pure — เทสต์ `src/lib/requestPenaltyLedger.test.ts`
 */
import { parseWorkWeekdays } from './siteWorkdays';

export type PenaltyRequestRow = {
  requestNo: string;
  site: string;
  bu: string | null;
  unit: string;
  position: string;
  qty: number;
  /** วันคีย์ใบขอ YYYY-MM-DD */
  keyYmd: string;
  /** วันที่ลูกค้าต้องการ YYYY-MM-DD */
  needYmd: string | null;
  /** วันที่ใบจบ (Stop/ยกเลิก/ปิด) · null = ยังเปิด */
  endYmd: string | null;
  workDays: string | null;
  finePerDay: number;
  deductPerDay: number;
  /**
   * จำนวนที่หาได้ตามนิยามกล่องงาน (`effectiveInformQtySql` — inform_qty หรือใบแจ้งเข้าที่ไม่ถูกยกเลิก) · ไม่ส่ง = นับจากใบแจ้งเข้าที่มีวันที่
   * ใบแจ้งเข้าที่มีวันเริ่มงานเกินเลขนี้ = ตัดทิ้ง · ขาดวันที่ = ถือว่าเริ่มวันคีย์ใบขอ (เลขเหลือหาต้องตรงกล่องงาน — 24 ต.ค. 2569)
   */
  informedCap?: number | null;
};

export type PenaltyInform = {
  requestNo: string;
  /** วันเริ่มงาน */
  startYmd: string;
  /** วันคีย์แจ้งเข้า */
  recordYmd: string;
  qty: number;
};

export type LedgerMode = 'need' | 'key';
export const LEDGER_MODES: readonly LedgerMode[] = ['need', 'key'];

export type LedgerAmount = { days: number; personDays: number; fine: number; deduct: number; coveredPersonDays: number };
export type LedgerRequest = PenaltyRequestRow & {
  filled: number;
  /** วันที่หาคนได้ครบ (หรือคนสุดท้ายที่หาได้ถ้ายังไม่ครบ) */
  foundYmd: string | null;
  /** ความเร็วทีม (วันปฏิทิน) — null = ยังหาไม่ได้สักคน */
  speedDays: number | null;
  /** ช้ากว่าที่ลูกค้าต้องการ (วันปฏิทิน · ติดลบ = 0) — null = ยังไม่ครบ */
  lateDays: number | null;
  advance: boolean;
  open: boolean;
  amount: Record<LedgerMode, LedgerAmount>;
  /** คนที่เริ่มงานสะสมตามวัน [วันเริ่มงาน, รวมถึงวันนั้น] (ไม่เกินจำนวนที่ขอ) — ไว้คิดยกมา/เหลือ */
  starts: Array<[string, number]>;
};
export type LedgerDaily = Record<LedgerMode, Record<string, { fine: number; deduct: number; personDays: number }>>;

const DAY_MS = 86_400_000;
const t = (ymd: string) => Date.parse(`${ymd}T00:00:00Z`);
const ymdOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const diffDays = (a: string, b: string) => Math.round((t(b) - t(a)) / DAY_MS);
const zero = (): LedgerAmount => ({ days: 0, personDays: 0, fine: 0, deduct: 0, coveredPersonDays: 0 });
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * คิดสมุดของทุกใบ · `from`/`to` (รวมปลาย) = ช่วงที่จะรวมยอด · วันนอกช่วงไม่นับ
 * ใบที่ไม่มีอัตราเลย หรือไม่มีวันที่ต้องการ = ไม่มีค่าปรับ (ยังอยู่ในรายการเพื่อนาฬิกา)
 */
export function buildPenaltyLedger(
  rows: readonly PenaltyRequestRow[],
  informs: readonly PenaltyInform[],
  todayYmd: string,
  window: { from: string; to: string },
  replacements: Record<string, ReadonlyArray<readonly [string, number]>> = {},
): { requests: LedgerRequest[]; daily: LedgerDaily } {
  const repOf = new Map<string, number>();
  for (const [site, days] of Object.entries(replacements)) for (const [d, n] of days) repOf.set(`${site}|${d}`, n);
  const used: Record<LedgerMode, Map<string, number>> = { need: new Map(), key: new Map() };
  const byReq = new Map<string, PenaltyInform[]>();
  for (const i of informs) {
    const list = byReq.get(i.requestNo) ?? [];
    list.push(i);
    byReq.set(i.requestNo, list);
  }
  const daily: LedgerDaily = { need: {}, key: {} };
  const requests: LedgerRequest[] = [];

  // ใบที่ต้องการก่อนได้คนแทนก่อน (ลำดับต้องคงที่ ผลจึงไม่ขึ้นกับลำดับที่ ERP ส่งมา)
  const ordered = [...rows].sort((a, b) =>
    (a.needYmd ?? '9') < (b.needYmd ?? '9') ? -1 : (a.needYmd ?? '9') > (b.needYmd ?? '9') ? 1 : a.requestNo.localeCompare(b.requestNo),
  );
  for (const r of ordered) {
    const qty = Math.max(1, Math.round(r.qty) || 1);
    const list = (byReq.get(r.requestNo) ?? []).slice().sort((a, b) => (a.startYmd < b.startYmd ? -1 : 1));
    // คนที่เริ่มงานสะสมตามวัน (เกินจำนวนที่ขอไม่นับ)
    const cap = r.informedCap == null ? qty : Math.max(0, Math.min(qty, Math.round(r.informedCap)));
    const starts: Array<[string, number]> = [];
    let filled = 0;
    for (const i of list) {
      if (filled >= cap) break;
      const add = Math.min(Math.max(1, Math.round(i.qty) || 1), cap - filled);
      filled += add;
      starts.push([i.startYmd, filled]);
    }
    if (r.informedCap != null && filled < cap) {
      // กล่องงานนับว่าได้คนแล้ว แต่ไม่มีใบแจ้งเข้าที่มีวันที่ ⇒ ถือว่าได้ตั้งแต่วันคีย์ (ไม่คิดค่าปรับให้คนที่ไม่รู้วัน)
      const extra = cap - filled;
      for (const st of starts) st[1] += extra;
      starts.unshift([r.keyYmd, extra]);
      starts.sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : x[1] - y[1]));
      filled = cap;
    }
    const found = list
      .map((i) => (i.recordYmd < i.startYmd ? i.recordYmd : i.startYmd))
      .sort()
      .slice(0, Math.max(1, Math.min(list.length, qty)));
    const foundYmd = found.length > 0 && list.length > 0 ? found[found.length - 1] : null;
    const fullStart = filled >= qty && starts.length > 0 ? starts[starts.length - 1][0] : null;
    const advance = r.needYmd != null && r.needYmd > r.keyYmd;
    const amount: Record<LedgerMode, LedgerAmount> = { need: zero(), key: zero() };

    if (r.needYmd && (r.finePerDay > 0 || r.deductPerDay > 0)) {
      const weekdays = parseWorkWeekdays(r.workDays);
      // ปลาย (ไม่รวม): วันจบของใบ · ใบเปิด = พรุ่งนี้ (รวมวันนี้)
      const endEx = r.endYmd ?? ymdOf(t(todayYmd) + DAY_MS);
      for (const mode of LEDGER_MODES) {
        const start = mode === 'need' ? r.needYmd : r.keyYmd > r.needYmd ? r.keyYmd : r.needYmd;
        const from = start > window.from ? start : window.from;
        const lastIn = endEx <= window.to ? ymdOf(t(endEx) - DAY_MS) : window.to;
        if (lastIn < from) continue;
        let k = 0;
        let have = 0;
        for (let ms = t(from); ms <= t(lastIn); ms += DAY_MS) {
          const d = ymdOf(ms);
          if (weekdays && !weekdays.has(new Date(ms).getUTCDay())) continue;
          while (k < starts.length && starts[k][0] <= d) have = starts[k++][1];
          let missing = qty - have;
          if (missing <= 0) continue;
          const a = amount[mode];
          const rk = `${r.site}|${d}`;
          const rep = repOf.get(rk);
          if (rep) {
            const cover = Math.min(missing, rep - (used[mode].get(rk) ?? 0));
            if (cover > 0) {
              used[mode].set(rk, (used[mode].get(rk) ?? 0) + cover);
              a.coveredPersonDays += cover;
              missing -= cover;
              if (missing <= 0) continue;
            }
          }
          a.days += 1;
          a.personDays += missing;
          a.fine += missing * r.finePerDay;
          a.deduct += missing * r.deductPerDay;
          const day = (daily[mode][d] ??= { fine: 0, deduct: 0, personDays: 0 });
          day.fine += missing * r.finePerDay;
          day.deduct += missing * r.deductPerDay;
          day.personDays += missing;
        }
        amount[mode].fine = round2(amount[mode].fine);
        amount[mode].deduct = round2(amount[mode].deduct);
      }
    }

    requests.push({
      ...r,
      qty,
      filled,
      foundYmd,
      speedDays: foundYmd ? Math.max(0, diffDays(r.keyYmd, foundYmd)) : null,
      lateDays: fullStart && r.needYmd ? Math.max(0, diffDays(r.needYmd, fullStart)) : null,
      advance,
      open: r.endYmd == null && filled < qty,
      amount,
      starts,
    });
  }
  for (const mode of LEDGER_MODES) {
    for (const v of Object.values(daily[mode])) {
      v.fine = round2(v.fine);
      v.deduct = round2(v.deduct);
    }
  }
  return { requests, daily };
}

/** รวมยอดรายวันเป็นรายสัปดาห์ (เริ่มจันทร์) / รายเดือน — คีย์ = วันแรกของสัปดาห์ / YYYY-MM */
export function groupDaily(
  daily: Record<string, { fine: number; deduct: number; personDays: number }>,
  unit: 'day' | 'week' | 'month',
): Array<{ key: string; fine: number; deduct: number; personDays: number }> {
  const out = new Map<string, { key: string; fine: number; deduct: number; personDays: number }>();
  for (const [d, v] of Object.entries(daily)) {
    let key = d;
    if (unit === 'month') key = d.slice(0, 7);
    if (unit === 'week') {
      const ms = t(d);
      const dow = (new Date(ms).getUTCDay() + 6) % 7;
      key = ymdOf(ms - dow * DAY_MS);
    }
    const cur = out.get(key) ?? { key, fine: 0, deduct: 0, personDays: 0 };
    cur.fine = round2(cur.fine + v.fine);
    cur.deduct = round2(cur.deduct + v.deduct);
    cur.personDays += v.personDays;
    out.set(key, cur);
  }
  return [...out.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
}

/** คนที่เริ่มงานแล้วถึงวัน `d` (รวมวันนั้น) */
export function filledBy(starts: ReadonlyArray<readonly [string, number]>, d: string): number {
  let n = 0;
  for (const [ymd, cum] of starts) {
    if (ymd > d) break;
    n = cum;
  }
  return n;
}

/** ตำแหน่งที่ยังต้องหา ณ สิ้นวัน `d` — ใบคีย์แล้ว ยังไม่จบ (วันจบไม่นับว่าเปิด) */
export function openPositionsAt(r: Pick<LedgerRequest, 'qty' | 'keyYmd' | 'endYmd' | 'starts'>, d: string): number {
  if (r.keyYmd > d) return 0;
  if (r.endYmd != null && r.endYmd <= d) return 0;
  return Math.max(0, r.qty - filledBy(r.starts, d));
}

export type RequestFlow = {
  /** หน่วย: คน */
  carryIn: number;
  newPositions: number;
  filled: number;
  cancelled: number;
  remaining: number;
  /** หน่วย: ใบ — ยกมา + ขอใหม่ − ปิดครบ − ยกเลิก = เหลือ (ใบที่ยังต้องหา) */
  carryInRequests: number;
  newRequests: number;
  closedRequests: number;
  cancelledRequests: number;
  remainingRequests: number;
};

/**
 * ═══ ยกมา + ขอใหม่ − หาได้ − ยกเลิก = เหลือ (หน่วย: คน) ในช่วง [from, to] (เจ้าของ 24 ต.ค. 2569 ข้อ 1) ═══
 * แยกรายใบตามสถานะต้นช่วง/ปลายช่วง ⇒ สมการลงตัวเสมอ (เทสต์คุม) · ปิดครบใบ = ใบที่คนครบในช่วง (หน่วย: ใบ)
 */
export function requestFlow(requests: readonly LedgerRequest[], from: string, to: string): RequestFlow {
  const before = ymdOf(t(from) - DAY_MS);
  const f: RequestFlow = {
    carryIn: 0,
    newPositions: 0,
    filled: 0,
    cancelled: 0,
    remaining: 0,
    carryInRequests: 0,
    newRequests: 0,
    closedRequests: 0,
    cancelledRequests: 0,
    remainingRequests: 0,
  };
  for (const r of requests) {
    if (r.keyYmd > to) continue;
    const b = openPositionsAt(r, before);
    const a = openPositionsAt(r, to);
    const keyedIn = r.keyYmd >= from;
    const endedIn = r.endYmd != null && r.endYmd >= from && r.endYmd <= to;
    if (!keyedIn && b === 0 && !endedIn) {
      // จบไปก่อนช่วง หรือครบก่อนช่วง — ไม่เกี่ยว
      continue;
    }
    f.carryIn += b;
    f.remaining += a;
    const newQ = keyedIn ? r.qty : 0;
    const startFill = keyedIn ? 0 : filledBy(r.starts, before);
    const endFill = endedIn ? filledBy(r.starts, r.endYmd as string) : filledBy(r.starts, to);
    // ส่วนที่หายไปจากใบนี้ในช่วง = หาได้ + ยกเลิก — แบ่งด้วยคนที่เริ่มงานจริง ที่เหลือคือยกเลิก (ข้อมูลเพี้ยนก็ยังลงตัว)
    const gone = Math.max(0, b + newQ - a);
    const fill = Math.min(gone, Math.max(0, Math.min(r.qty, endFill) - startFill));
    if (keyedIn) {
      f.newPositions += r.qty;
      f.newRequests += 1;
    }
    f.filled += fill;
    f.cancelled += gone - fill;
    // หน่วยใบ: เปิดต้นช่วง (หรือคีย์ในช่วง) แล้วไม่เปิดปลายช่วง = ปิดครบ (คนครบ) หรือยกเลิก
    if (b > 0) f.carryInRequests += 1;
    if (a > 0) f.remainingRequests += 1;
    if ((b > 0 || keyedIn) && a === 0) {
      const full = r.starts.find(([, cum]) => cum >= r.qty);
      if (full && full[0] <= to && (r.endYmd == null || full[0] <= r.endYmd)) f.closedRequests += 1;
      else f.cancelledRequests += 1;
    }
  }
  return f;
}
