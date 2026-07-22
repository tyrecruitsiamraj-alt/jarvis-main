/**
 * พยากรณ์ใบขอเข้าใหม่รายเดือน (net = เข้ามา − ยกเลิก) แยกตามประเภทใบขอ
 * โมเดล: "ค่ากลาง" (median) รายเดือนของปีย้อนหลังที่ครบปี + ช่วง ต่ำสุด–สูงสุด
 * — ใช้ค่ากลางแทนค่าเฉลี่ยเพื่อกันปีที่มีใบขอก้อนยักษ์ผิดปกติลากตัวเลขเพี้ยน
 * เดือนปัจจุบัน: คาดว่าจะเข้ามาอีก = max(ค่ากลาง − เข้ามาจริงแล้ว, 0)
 * — pure functions ไม่แตะ network เพื่อให้ unit test ตรง ๆ ได้
 */

export type ForecastLifecycle =
  | 'resignation'
  | 'replacement'
  | 'increase_headcount'
  | 'new_site'
  | 'other';

export type ForecastMonthCell = {
  intakePositions: number;
  cancelledPositions: number;
  netPositions: number;
  intakeRequests: number;
  netRequests: number;
};

export type ForecastYearData = {
  year: number;
  complete: boolean;
  months: Record<number, Partial<Record<ForecastLifecycle, ForecastMonthCell>>>;
};

export type ResignationUnitRank = {
  unitName: string;
  requests: number;
  positions: number;
  monthsActive: number;
};

export type DemandForecastResponse = {
  years: ForecastYearData[];
  currentYear: number;
  currentMonth: number;
  asOf: string;
  topResignationUnits?: ResignationUnitRank[];
};

export const LIFECYCLE_LABELS: Record<ForecastLifecycle, string> = {
  resignation: 'ลาออก',
  replacement: 'เปลี่ยนตัว',
  increase_headcount: 'เพิ่มอัตรา',
  new_site: 'เปิดไซต์',
  other: 'อื่นๆ',
};

/** กลุ่มแสดงผล — เปิดไซต์รวมเข้า "อื่นๆ" เพื่อยอดรวม reconcile กับของจริง */
export type ForecastGroup = 'resignation' | 'replacement' | 'increase_headcount' | 'other';

export const FORECAST_GROUPS: ForecastGroup[] = [
  'resignation',
  'replacement',
  'increase_headcount',
  'other',
];

export const FORECAST_GROUP_LABELS: Record<ForecastGroup, string> = {
  resignation: 'ลาออก',
  replacement: 'เปลี่ยนตัว',
  increase_headcount: 'เพิ่มอัตรา',
  other: 'อื่นๆ',
};

export function lifecycleToGroup(lc: ForecastLifecycle): ForecastGroup {
  if (lc === 'resignation' || lc === 'replacement' || lc === 'increase_headcount') return lc;
  return 'other';
}

export type GroupMonthForecast = {
  /** ค่ากลาง (median) net อัตรา จากปีที่ครบ — ตัวเลขพยากรณ์หลัก ทนต่อปีโดดผิดปกติ */
  medNet: number;
  minNet: number;
  maxNet: number;
  /** ค่ากลางจำนวนใบ (net) */
  medNetRequests: number;
  /** ปีปัจจุบัน: เข้ามาจริง (net) ในเดือนนี้ — undefined เมื่อยังไม่ถึงเดือนนั้น */
  actualNet?: number;
  actualNetRequests?: number;
  /** เดือนปัจจุบันเท่านั้น: คาดว่าจะเข้ามาอีก = max(med − actual, 0) */
  expectedMoreNet?: number;
  /** เดือนปัจจุบันเท่านั้น: เพดานที่อาจเข้ามาอีก = max(สูงสุดที่เคยเกิด − actual, 0) */
  expectedMoreMaxNet?: number;
  /** หมายเหตุเมื่อ "สูงสุด" มาจากปีที่โดดผิดปกติ (เช่น เปิดไซต์ก้อนใหญ่) */
  spikeNote?: string;
};

export type MonthForecast = {
  month: number;
  status: 'past' | 'current' | 'future';
  groups: Record<ForecastGroup, GroupMonthForecast>;
  /** ยอดรวมทุกประเภท — min/max คิดจากยอดรวมรายปี (ไม่ใช่ผลบวกของ min/max รายกลุ่ม) */
  total: GroupMonthForecast;
};

export type DemandForecast = {
  months: MonthForecast[];
  historyYears: number[];
  currentYear: number;
  currentMonth: number;
  asOf: string;
  topResignationUnits: ResignationUnitRank[];
};

type GroupCells = Record<ForecastGroup, { net: number; netRequests: number }>;

function emptyGroupCells(): GroupCells {
  return {
    resignation: { net: 0, netRequests: 0 },
    replacement: { net: 0, netRequests: 0 },
    increase_headcount: { net: 0, netRequests: 0 },
    other: { net: 0, netRequests: 0 },
  };
}

/** รวม cell ต่อ lifecycle เป็น 4 กลุ่มแสดงผลของเดือนหนึ่งในปีหนึ่ง */
function groupCellsForMonth(
  monthData: Partial<Record<ForecastLifecycle, ForecastMonthCell>> | undefined,
): GroupCells {
  const out = emptyGroupCells();
  if (!monthData) return out;
  for (const [lc, cell] of Object.entries(monthData) as Array<
    [ForecastLifecycle, ForecastMonthCell]
  >) {
    if (!cell) continue;
    const g = lifecycleToGroup(lc);
    out[g].net += cell.netPositions;
    out[g].netRequests += cell.netRequests;
  }
  return out;
}

function round(n: number): number {
  return Math.round(n);
}

/** ค่ากลาง — 3 ปีคือค่าปีกลาง, จำนวนคู่คือเฉลี่ยสองตัวกลาง */
function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

const SPIKE_MIN_ABS = 30;

/**
 * หมายเหตุเมื่อ "สูงสุด" ของเดือนมาจากปีที่โดดผิดปกติ (สูงสุด ≥ 2× ค่ากลาง และ ≥ 30 อัตรา)
 * ชี้ปีที่พีคและประเภทใบขอที่เป็นตัวการ เช่น เปิดไซต์ก้อนใหญ่
 */
function spikeNoteFor(
  med: number,
  max: number,
  perYear: Array<{ year: number; net: number; byLifecycle: Partial<Record<ForecastLifecycle, number>> }>,
): string | undefined {
  if (max < SPIKE_MIN_ABS || max < med * 2) return undefined;
  const spikeYear = perYear.find((y) => y.net === max);
  if (!spikeYear) return undefined;
  const beYear = String(spikeYear.year + 543).slice(-2);

  let topLc: ForecastLifecycle | null = null;
  let topNet = 0;
  for (const [lc, net] of Object.entries(spikeYear.byLifecycle) as Array<[ForecastLifecycle, number]>) {
    if ((net ?? 0) > topNet) {
      topNet = net ?? 0;
      topLc = lc;
    }
  }
  if (topLc && topNet >= max * 0.5) {
    return `สูงสุด ${max.toLocaleString('th-TH')} มาจากปี ${beYear} ที่มีใบขอ${LIFECYCLE_LABELS[topLc]}ก้อนใหญ่ ${topNet.toLocaleString('th-TH')} อัตรา — ปีทั่วไป ~${med.toLocaleString('th-TH')}`;
  }
  return `สูงสุด ${max.toLocaleString('th-TH')} มาจากปี ${beYear} ที่สูงผิดปกติ — ปีทั่วไป ~${med.toLocaleString('th-TH')}`;
}

export function buildDemandForecast(response: DemandForecastResponse): DemandForecast {
  const completeYears = response.years
    .filter((y) => y.complete)
    .sort((a, b) => a.year - b.year);
  const currentYearData = response.years.find((y) => y.year === response.currentYear);

  const months: MonthForecast[] = [];
  for (let month = 1; month <= 12; month += 1) {
    const status: MonthForecast['status'] =
      month < response.currentMonth ? 'past' : month === response.currentMonth ? 'current' : 'future';

    // ค่าประวัติศาสตร์ต่อปี (ปีที่ไม่มีเดือนนั้นนับเป็น 0 — เดือนไม่มีใบขอคือข้อมูล ไม่ใช่ข้อมูลหาย)
    const perYearGroups = completeYears.map((y) => groupCellsForMonth(y.months[month]));
    // lifecycle รายปีของเดือนนี้ — ใช้ชี้ตัวการของปีพีคใน spikeNote
    const perYearLifecycles = completeYears.map((y) => {
      const byLifecycle: Partial<Record<ForecastLifecycle, number>> = {};
      const monthData = y.months[month];
      if (monthData) {
        for (const [lc, cell] of Object.entries(monthData) as Array<
          [ForecastLifecycle, ForecastMonthCell]
        >) {
          if (cell) byLifecycle[lc] = cell.netPositions;
        }
      }
      return { year: y.year, byLifecycle };
    });
    const actualGroups = currentYearData ? groupCellsForMonth(currentYearData.months[month]) : null;
    const hasActual = status !== 'future' && actualGroups !== null;

    const groups = {} as MonthForecast['groups'];
    for (const g of FORECAST_GROUPS) {
      const nets = perYearGroups.map((cells) => cells[g].net);
      const reqs = perYearGroups.map((cells) => cells[g].netRequests);
      const medNet = round(medianOf(nets));
      const maxNet = nets.length ? Math.max(...nets) : 0;
      const entry: GroupMonthForecast = {
        medNet,
        minNet: nets.length ? Math.min(...nets) : 0,
        maxNet,
        medNetRequests: round(medianOf(reqs)),
        spikeNote: spikeNoteFor(
          medNet,
          maxNet,
          perYearLifecycles.map((y, i) => ({
            year: y.year,
            net: nets[i],
            byLifecycle: Object.fromEntries(
              Object.entries(y.byLifecycle).filter(([lc]) =>
                lifecycleToGroup(lc as ForecastLifecycle) === g,
              ),
            ) as Partial<Record<ForecastLifecycle, number>>,
          })),
        ),
      };
      if (hasActual && actualGroups) {
        entry.actualNet = actualGroups[g].net;
        entry.actualNetRequests = actualGroups[g].netRequests;
        if (status === 'current') {
          entry.expectedMoreNet = Math.max(medNet - actualGroups[g].net, 0);
          entry.expectedMoreMaxNet = Math.max(maxNet - actualGroups[g].net, 0);
        }
      }
      groups[g] = entry;
    }

    // ยอดรวม: ค่ากลาง/min/max จากยอดรวมของแต่ละปี (ไม่ใช่ผลบวกของค่ารายกลุ่ม)
    const perYearTotals = perYearGroups.map((cells) =>
      FORECAST_GROUPS.reduce((s, g) => s + cells[g].net, 0),
    );
    const perYearTotalReqs = perYearGroups.map((cells) =>
      FORECAST_GROUPS.reduce((s, g) => s + cells[g].netRequests, 0),
    );
    const totalMed = round(medianOf(perYearTotals));
    const totalMax = perYearTotals.length ? Math.max(...perYearTotals) : 0;
    const total: GroupMonthForecast = {
      medNet: totalMed,
      minNet: perYearTotals.length ? Math.min(...perYearTotals) : 0,
      maxNet: totalMax,
      medNetRequests: round(medianOf(perYearTotalReqs)),
      spikeNote: spikeNoteFor(
        totalMed,
        totalMax,
        perYearLifecycles.map((y, i) => ({
          year: y.year,
          net: perYearTotals[i],
          byLifecycle: y.byLifecycle,
        })),
      ),
    };
    if (hasActual && actualGroups) {
      total.actualNet = FORECAST_GROUPS.reduce((s, g) => s + actualGroups[g].net, 0);
      total.actualNetRequests = FORECAST_GROUPS.reduce(
        (s, g) => s + actualGroups[g].netRequests,
        0,
      );
      if (status === 'current') {
        total.expectedMoreNet = Math.max(totalMed - total.actualNet, 0);
        total.expectedMoreMaxNet = Math.max(totalMax - total.actualNet, 0);
      }
    }

    months.push({ month, status, groups, total });
  }

  return {
    months,
    historyYears: completeYears.map((y) => y.year),
    currentYear: response.currentYear,
    currentMonth: response.currentMonth,
    asOf: response.asOf,
    topResignationUnits: response.topResignationUnits ?? [],
  };
}

export const THAI_MONTH_SHORT = [
  'มค', 'กพ', 'มีค', 'เมย', 'พค', 'มิย', 'กค', 'สค', 'กย', 'ตค', 'พย', 'ธค',
];
