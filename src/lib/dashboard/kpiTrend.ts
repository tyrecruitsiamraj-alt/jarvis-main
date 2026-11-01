/**
 * ลูกศรแนวโน้มบนการ์ด เข้ามา · หาได้แล้ว · ยกเลิก · เหลือหา (ศูนย์ควบคุมใบขอ)
 *
 * เจ้าของ 1 พ.ย. 2569: *"แยกเป็น อันไหนแนวโน้มบวกเป็นเขียว แดง เหลือง ให้ดูง่ายๆ"*
 * Choice ที่เคาะ: เทียบช่วงก่อนหน้ายาวเท่ากัน · "เข้ามา" ดีหรือแย่ = *"ตาม journey"*
 *
 * กติกา (ที่นี่ที่เดียว — การ์ดอ่านผลจากไฟล์นี้ ห้ามตัดสินสีเอง):
 * - ขั้นที่เดินหน้าใน journey เพิ่ม = ดีขึ้น (เข้ามา · หาได้แล้ว)
 * - ขั้นที่หลุด/ค้างเพิ่ม = แย่ลง (ยกเลิก · เหลือหา)
 * - เปลี่ยนไม่ถึง 5% = ทรงตัว (เหลือง)
 * - คำบอกทิศ (เพิ่มขึ้น/ลดลง/ทรงตัว) · สีบอกดีหรือแย่
 * - ช่วงที่ยังไม่จบ (เช่น เดือนนี้) เทียบเฉพาะจำนวนวันที่ผ่านมาเท่ากัน — เทียบทั้งเดือนกับ
 *   เดือนที่เพิ่งเริ่มได้แต่ "แย่ลง" ปลอม
 * - โหมด "ทั้งหมด" ไม่มีช่วงก่อนให้เทียบ = ไม่มีลูกศร
 */
import type { DashboardKpi } from '@/lib/dashboard/types';
import { sumCohortStockByRequestDate, type CohortStockSummary, type ThroughputRecord } from '@/lib/dashboard/throughput';
import { rangeText } from '@/lib/periodPick';
import type { ToneKey } from '@/lib/designTokens';

/** เปลี่ยนไม่ถึงกี่ % นับว่าทรงตัว */
export const KPI_TREND_FLAT_PERCENT = 5;

/** true = เพิ่มแล้วดี · false = เพิ่มแล้วแย่ */
export const KPI_TREND_UP_IS_GOOD: Record<string, boolean> = {
  total_requests: true,
  closed: true,
  cancelled: false,
  remaining: false,
};

export type KpiTrendVerdict = 'better' | 'flat' | 'worse';

/**
 * คำบนการ์ดบอกทิศของตัวเลข (เจ้าของ 1 พ.ย. 2569 *"ต้องใช้คำว่าเพิ่มขึ้น"*) — ดีหรือแย่บอกด้วยสีตาม journey
 * เปลี่ยนไม่ถึง 5% = ทรงตัว
 */
export function kpiTrendWord(percent: number): string {
  if (Math.abs(percent) < KPI_TREND_FLAT_PERCENT) return 'ทรงตัว';
  return percent > 0 ? 'เพิ่มขึ้น' : 'ลดลง';
}

export const KPI_TREND_TONE: Record<KpiTrendVerdict, ToneKey> = {
  better: 'success',
  flat: 'warn',
  worse: 'danger',
};

/** ช่วงก่อนเป็น 0 = ไม่มีฐานให้คิด % → null (ไม่ใช่ 0) */
export function kpiTrendPercent(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function kpiTrendVerdict(kpiId: string, percent: number | null): KpiTrendVerdict | null {
  if (percent == null) return null;
  const upIsGood = KPI_TREND_UP_IS_GOOD[kpiId];
  if (upIsGood === undefined) return null;
  if (Math.abs(percent) < KPI_TREND_FLAT_PERCENT) return 'flat';
  return percent > 0 === upIsGood ? 'better' : 'worse';
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function daysBetween(from: string, to: string): number {
  const [a, b] = [from, to].map((s) => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  });
  return Math.round((b - a) / 86_400_000);
}

export type KpiTrendWindow = {
  /** ช่วงปัจจุบันที่ใช้เทียบ (ตัดที่วันนี้ถ้าช่วงยังไม่จบ) */
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  /** ช่วงยังไม่จบ = เทียบแค่วันที่ผ่านมา */
  partial: boolean;
};

function lastDayOfMonth(y: number, m: number): string {
  const d = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

type PeriodLike = { from: string; to: string; previousFrom: string; previousTo: string };

/**
 * ช่วงก่อนหน้าเต็มช่วง — เลือกเดือน = เดือนก่อนเต็มเดือน (ต.ค. เทียบ ก.ย. ไม่ใช่ 31 ส.ค.–30 ก.ย.)
 * เลือกทั้งปี = ปีก่อน · ช่วงอื่น = ยาวเท่ากันติดกันก่อนหน้า (ค่าจาก period)
 * ใช้ทั้งตอนดึงข้อมูลและตอนนับ — ต้องตรงกัน
 */
export function kpiTrendPreviousRange(period: PeriodLike): { from: string; to: string } {
  const [fy, fm, fd] = period.from.split('-').map(Number);
  const [ty, tm] = period.to.split('-').map(Number);
  if (fd === 1 && fy === ty && fm === tm && period.to === lastDayOfMonth(ty, tm)) {
    const py = fm === 1 ? fy - 1 : fy;
    const pm = fm === 1 ? 12 : fm - 1;
    return { from: `${py}-${String(pm).padStart(2, '0')}-01`, to: lastDayOfMonth(py, pm) };
  }
  if (period.from === `${fy}-01-01` && period.to === `${fy}-12-31`) {
    return { from: `${fy - 1}-01-01`, to: `${fy - 1}-12-31` };
  }
  return { from: period.previousFrom, to: period.previousTo };
}

/**
 * ช่วงเทียบ — ช่วงที่ยังไม่จบเทียบเฉพาะจำนวนวันที่ผ่านมาเท่ากัน
 * @param todayYmd วันนี้ (กรุงเทพ)
 */
export function kpiTrendWindow(period: PeriodLike, todayYmd: string): KpiTrendWindow | null {
  if (todayYmd < period.from) return null;
  const partial = todayYmd < period.to;
  const to = partial ? todayYmd : period.to;
  const prev = kpiTrendPreviousRange(period);
  const cut = addDaysYmd(prev.from, daysBetween(period.from, to));
  return {
    from: period.from,
    to,
    previousFrom: prev.from,
    previousTo: cut < prev.to ? cut : prev.to,
    partial,
  };
}

const PICK: Record<string, (s: CohortStockSummary) => number> = {
  total_requests: (s) => s.requestPositions,
  closed: (s) => s.filledPositions,
  cancelled: (s) => s.cancelledPositions,
  remaining: (s) => s.remainingPositions,
};

/**
 * ใส่แนวโน้มให้การ์ด 4 ใบ — นับ cohort ชุดเดียวกับตัวเลขบนการ์ด (`sumCohortStockByRequestDate`)
 * @param previousRecords throughput ของช่วงก่อน (กรองตัวกรองเดียวกับช่วงนี้แล้ว) · null = เทียบไม่ได้
 */
export function withKpiTrend(
  kpis: DashboardKpi[],
  currentRecords: ThroughputRecord[],
  previousRecords: ThroughputRecord[] | null,
  window: KpiTrendWindow | null,
): DashboardKpi[] {
  if (!previousRecords || !window) return kpis;
  const cur = sumCohortStockByRequestDate(currentRecords, window.from, window.to);
  const prev = sumCohortStockByRequestDate(previousRecords, window.previousFrom, window.previousTo);
  const prevLabel = rangeText(window.previousFrom, window.previousTo);
  const curLabel = rangeText(window.from, window.to);
  return kpis.map((kpi) => {
    const pick = PICK[kpi.id];
    if (!pick) return kpi;
    const c = pick(cur);
    const p = pick(prev);
    return {
      ...kpi,
      trendPercent: kpiTrendPercent(c, p),
      trendBase: window.partial
        ? `${curLabel} ${c.toLocaleString('th-TH')} · ${prevLabel} ${p.toLocaleString('th-TH')}`
        : `${prevLabel} ${p.toLocaleString('th-TH')}`,
    };
  });
}
