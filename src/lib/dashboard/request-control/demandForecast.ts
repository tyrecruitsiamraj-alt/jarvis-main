/**
 * พยากรณ์ใบขอเข้าใหม่รายเดือน (net = เข้ามา − ยกเลิก) แยกตามประเภทใบขอ
 * โมเดล: ค่าเฉลี่ยรายเดือนของปีย้อนหลังที่ครบปี + ช่วง ต่ำสุด–สูงสุด ของปีเหล่านั้น
 * เดือนปัจจุบัน: คาดว่าจะเข้ามาอีก = max(ค่าเฉลี่ย − เข้ามาจริงแล้ว, 0)
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

export type DemandForecastResponse = {
  years: ForecastYearData[];
  currentYear: number;
  currentMonth: number;
  asOf: string;
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
  /** ค่าเฉลี่ย net (อัตรา) จากปีที่ครบ ปัดเป็นจำนวนเต็ม */
  avgNet: number;
  minNet: number;
  maxNet: number;
  /** ค่าเฉลี่ยจำนวนใบ (net) */
  avgNetRequests: number;
  /** ปีปัจจุบัน: เข้ามาจริง (net) ในเดือนนี้ — undefined เมื่อยังไม่ถึงเดือนนั้น */
  actualNet?: number;
  actualNetRequests?: number;
  /** เดือนปัจจุบันเท่านั้น: คาดว่าจะเข้ามาอีก = max(avg − actual, 0) */
  expectedMoreNet?: number;
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

function avgOf(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
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
    const actualGroups = currentYearData ? groupCellsForMonth(currentYearData.months[month]) : null;
    const hasActual = status !== 'future' && actualGroups !== null;

    const groups = {} as MonthForecast['groups'];
    for (const g of FORECAST_GROUPS) {
      const nets = perYearGroups.map((cells) => cells[g].net);
      const reqs = perYearGroups.map((cells) => cells[g].netRequests);
      const avgNet = round(avgOf(nets));
      const entry: GroupMonthForecast = {
        avgNet,
        minNet: nets.length ? Math.min(...nets) : 0,
        maxNet: nets.length ? Math.max(...nets) : 0,
        avgNetRequests: round(avgOf(reqs)),
      };
      if (hasActual && actualGroups) {
        entry.actualNet = actualGroups[g].net;
        entry.actualNetRequests = actualGroups[g].netRequests;
        if (status === 'current') {
          entry.expectedMoreNet = Math.max(avgNet - actualGroups[g].net, 0);
        }
      }
      groups[g] = entry;
    }

    // ยอดรวม: min/max จากยอดรวมของแต่ละปี
    const perYearTotals = perYearGroups.map((cells) =>
      FORECAST_GROUPS.reduce((s, g) => s + cells[g].net, 0),
    );
    const perYearTotalReqs = perYearGroups.map((cells) =>
      FORECAST_GROUPS.reduce((s, g) => s + cells[g].netRequests, 0),
    );
    const totalAvg = round(avgOf(perYearTotals));
    const total: GroupMonthForecast = {
      avgNet: totalAvg,
      minNet: perYearTotals.length ? Math.min(...perYearTotals) : 0,
      maxNet: perYearTotals.length ? Math.max(...perYearTotals) : 0,
      avgNetRequests: round(avgOf(perYearTotalReqs)),
    };
    if (hasActual && actualGroups) {
      total.actualNet = FORECAST_GROUPS.reduce((s, g) => s + actualGroups[g].net, 0);
      total.actualNetRequests = FORECAST_GROUPS.reduce(
        (s, g) => s + actualGroups[g].netRequests,
        0,
      );
      if (status === 'current') {
        total.expectedMoreNet = Math.max(totalAvg - total.actualNet, 0);
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
  };
}

export const THAI_MONTH_SHORT = [
  'มค', 'กพ', 'มีค', 'เมย', 'พค', 'มิย', 'กค', 'สค', 'กย', 'ตค', 'พย', 'ธค',
];
