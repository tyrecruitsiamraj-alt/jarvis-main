/**
 * เลขคณิตของ "Rate ผลการโทร Lumos" — สรุปช่วงเวลา + เทียบช่วงก่อนหน้า
 *
 * ตอบ 4 คำถามของเจ้าของ (3 ก.ย. 2569): ส่งไปเท่าไหร่ · แยกผลเท่าไหร่ (นับ+%) ·
 * ปริมาณโตขึ้นหรือลดลง · ผลสำเร็จดีขึ้นหรือลดลง
 *
 * กติกานิยาม (ห้ามเบี่ยง — นิยามกลางอยู่ api/_lib/lumosQueueDefs + callOutcomeBuckets):
 * - "ส่งไป" = สายที่ส่งจริง **ไม่นับที่กดยกเลิก** (ยกเลิกไม่เคยถูกโทร โชว์แยกต่างหาก)
 * - ฐานของทุก % = สายที่มีผลจริง (หักยกเลิกแล้ว) — หลักเดียวกับ callFunnelMath
 * - "สำเร็จ" บนแผงนี้ = ตอบยืนยัน/สนใจ (confirmed) เท่านั้น — รับสายเฉย ๆ (acknowledged)
 *   ไม่นับเป็นสำเร็จ · ส่วน "โทรติด" (connected) เป็นคนละชั้น: แค่คุยกับคนได้ รวมที่ปฏิเสธ
 * - แนวโน้มห้ามเดา: ช่วงก่อนหน้าไม่มีฐานให้เทียบ = คืน null ให้จอบอกว่า "เทียบไม่ได้"
 */

/** ยอดรายวัน (นับตามวันที่ส่ง โซนไทย) — โครงเดียวกับ CallRateDay ฝั่ง API */
export type CallRateDay = {
  day: string;
  queued: number;
  cancelled: number;
  /** มีผลจริง หักยกเลิกแล้ว — ฐานของ % */
  withResult: number;
  connected: number;
  confirmed: number;
  declined: number;
  unreached: number;
};

/** สรุปหนึ่งช่วงเวลา */
export type CallRateWindow = {
  fromYmd: string;
  toYmd: string;
  /** ส่งจริง (queued − cancelled) */
  sent: number;
  cancelled: number;
  /** ส่งแล้วยังไม่มีผลกลับ */
  pending: number;
  withResult: number;
  connected: number;
  confirmed: number;
  declined: number;
  unreached: number;
  /** % จากฐานสายที่มีผลจริง — null เมื่อไม่มีฐาน (จอต้องเขียน "ยังไม่มีผล" ไม่ใช่ 0%) */
  connectedPct: number | null;
  confirmedPct: number | null;
  declinedPct: number | null;
  unreachedPct: number | null;
};

/** บวก/ลบวันบนสตริง YYYY-MM-DD ตรง ๆ (คณิตปฏิทิน ไม่แตะ timezone ของเครื่อง) */
export function ymdAddDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const t = new Date(Date.UTC(y, (m || 1) - 1, (d || 1) + n));
  return t.toISOString().slice(0, 10);
}

/** วันนี้ของธุรกิจ (โซนไทย) เป็น YYYY-MM-DD */
export function bangkokTodayYmd(now: Date = new Date()): string {
  return TH_YMD.format(now);
}

// Intl ประกาศระดับโมดูลเสมอ (กติกาโปรเจกต์ — เคยทำ API ช้า 4.7 วิ)
const TH_YMD = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function pctOf(n: number, base: number): number | null {
  if (base <= 0) return null;
  return Math.round((n / base) * 100);
}

/** รวมยอดของวันใน [fromYmd..toYmd] (เทียบสตริงได้ตรง ๆ เพราะรูปแบบ YYYY-MM-DD) */
export function summarizeCallRateWindow(
  series: readonly CallRateDay[],
  fromYmd: string,
  toYmd: string,
): CallRateWindow {
  const w: CallRateWindow = {
    fromYmd,
    toYmd,
    sent: 0,
    cancelled: 0,
    pending: 0,
    withResult: 0,
    connected: 0,
    confirmed: 0,
    declined: 0,
    unreached: 0,
    connectedPct: null,
    confirmedPct: null,
    declinedPct: null,
    unreachedPct: null,
  };
  for (const d of series) {
    if (d.day < fromYmd || d.day > toYmd) continue;
    const sent = Math.max(d.queued - d.cancelled, 0);
    w.sent += sent;
    w.cancelled += d.cancelled;
    w.pending += Math.max(sent - d.withResult, 0);
    w.withResult += d.withResult;
    w.connected += d.connected;
    w.confirmed += d.confirmed;
    w.declined += d.declined;
    w.unreached += d.unreached;
  }
  w.connectedPct = pctOf(w.connected, w.withResult);
  w.confirmedPct = pctOf(w.confirmed, w.withResult);
  w.declinedPct = pctOf(w.declined, w.withResult);
  w.unreachedPct = pctOf(w.unreached, w.withResult);
  return w;
}

/** ทิศของแนวโน้ม — null = เทียบไม่ได้ (ช่วงใดช่วงหนึ่งไม่มีฐาน) */
export type TrendDir = 'up' | 'down' | 'flat';

export type CallRateTrend = {
  current: CallRateWindow;
  previous: CallRateWindow;
  /** ปริมาณ: เทียบยอดส่งจริงสองช่วง — null เมื่อสองช่วงเป็น 0 ทั้งคู่ (ไม่มีอะไรให้เทียบ) */
  volumeDir: TrendDir | null;
  /** % เปลี่ยนของยอดส่ง — null เมื่อช่วงก่อนเป็น 0 (หารไม่ได้ จอต้องบอกตรง ๆ) */
  volumePct: number | null;
  /** คุณภาพ: เทียบ % สำเร็จ (confirmed) — null เมื่อช่วงใดช่วงหนึ่งไม่มีสายที่มีผลจริง */
  successDir: TrendDir | null;
  /** จุดต่างของ % สำเร็จ (จุดเปอร์เซ็นต์ ไม่ใช่ %การเปลี่ยน) */
  successDeltaPts: number | null;
  /** คุณภาพชั้นโทรติด — มุมรอง ใช้บอกว่า "ติดต่อถึงตัวคนได้ดีขึ้นไหม" */
  connectedDir: TrendDir | null;
  connectedDeltaPts: number | null;
};

function dirOf(delta: number): TrendDir {
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'flat';
}

/**
 * เทียบ "ช่วงล่าสุด N วัน (จบวันนี้)" กับ "N วันก่อนหน้านั้น"
 * เช่น days=7 วันนี้ 3 ก.ย. ⇒ ช่วงนี้ 28 ส.ค.–3 ก.ย. · ช่วงก่อน 21–27 ส.ค.
 */
export function compareCallRate(
  series: readonly CallRateDay[],
  days: number,
  todayYmd: string,
): CallRateTrend {
  const n = Math.max(Math.trunc(days), 1);
  const curFrom = ymdAddDays(todayYmd, -(n - 1));
  const prevTo = ymdAddDays(curFrom, -1);
  const prevFrom = ymdAddDays(prevTo, -(n - 1));
  const current = summarizeCallRateWindow(series, curFrom, todayYmd);
  const previous = summarizeCallRateWindow(series, prevFrom, prevTo);

  const bothEmpty = current.sent === 0 && previous.sent === 0;
  const volumeDir = bothEmpty ? null : dirOf(current.sent - previous.sent);
  const volumePct =
    previous.sent > 0 ? Math.round(((current.sent - previous.sent) / previous.sent) * 100) : null;

  const canRate = current.confirmedPct !== null && previous.confirmedPct !== null;
  const successDeltaPts = canRate ? current.confirmedPct! - previous.confirmedPct! : null;
  const canConnect = current.connectedPct !== null && previous.connectedPct !== null;
  const connectedDeltaPts = canConnect ? current.connectedPct! - previous.connectedPct! : null;

  return {
    current,
    previous,
    volumeDir,
    volumePct,
    successDir: successDeltaPts === null ? null : dirOf(successDeltaPts),
    successDeltaPts,
    connectedDir: connectedDeltaPts === null ? null : dirOf(connectedDeltaPts),
    connectedDeltaPts,
  };
}
