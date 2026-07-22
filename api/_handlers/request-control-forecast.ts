import {
  withRbac,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { listSiamrajThroughput } from '../_lib/siamrajUnitRequests.js';
import {
  loadUserDepartmentScope,
  type DepartmentScope,
} from '../_lib/departmentScope.js';
import { toBangkokYmd } from '../_lib/businessDate.js';

/** ประเภทใบขอสำหรับพยากรณ์ demand — ชุดเดียวกับ lifecycleKind ของ throughput feed */
export type ForecastLifecycle =
  | 'resignation'
  | 'replacement'
  | 'increase_headcount'
  | 'new_site'
  | 'other';

const LIFECYCLES: ForecastLifecycle[] = [
  'resignation',
  'replacement',
  'increase_headcount',
  'new_site',
  'other',
];

/** ยอดรายเดือนต่อประเภท: เข้ามา / ยกเลิก / net (เข้ามา − ยกเลิก) — หน่วยอัตรา + ใบ */
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
  /** months[1..12] → lifecycle → cell (เดือนที่ไม่มีข้อมูล = ไม่มี key) */
  months: Record<number, Partial<Record<ForecastLifecycle, ForecastMonthCell>>>;
};

export type DemandForecastResponse = {
  years: ForecastYearData[];
  currentYear: number;
  currentMonth: number;
  asOf: string;
};

function emptyCell(): ForecastMonthCell {
  return {
    intakePositions: 0,
    cancelledPositions: 0,
    netPositions: 0,
    intakeRequests: 0,
    netRequests: 0,
  };
}

/** รวม throughput records (แตกเป็น filled/cancelled/remaining ต่อใบ) เป็นยอดรายเดือน × ประเภท */
export function aggregateThroughputYear(
  year: number,
  complete: boolean,
  records: Array<{
    requestNo?: string;
    requestDate: string;
    positionUnits: number;
    kind?: 'filled' | 'cancelled' | 'remaining';
    lifecycleKind?: ForecastLifecycle;
  }>,
): ForecastYearData {
  const months: ForecastYearData['months'] = {};
  // สะสมต่อใบก่อน เพื่อคำนวณ netRequests (ใบที่หลังหักยกเลิกแล้วยังเหลือ > 0)
  const perRequest = new Map<
    string,
    { month: number; lifecycle: ForecastLifecycle; intake: number; cancelled: number }
  >();

  let anonSeq = 0;
  for (const r of records) {
    const month = Number(r.requestDate.slice(5, 7));
    if (!Number.isInteger(month) || month < 1 || month > 12) continue;
    const lifecycle: ForecastLifecycle = r.lifecycleKind ?? 'other';
    const key = r.requestNo || `__anon_${anonSeq++}`;
    let agg = perRequest.get(key);
    if (!agg) {
      agg = { month, lifecycle, intake: 0, cancelled: 0 };
      perRequest.set(key, agg);
    }
    agg.intake += r.positionUnits;
    if (r.kind === 'cancelled') agg.cancelled += r.positionUnits;
  }

  for (const agg of perRequest.values()) {
    const byLc = (months[agg.month] ??= {});
    const cell = (byLc[agg.lifecycle] ??= emptyCell());
    cell.intakePositions += agg.intake;
    cell.cancelledPositions += agg.cancelled;
    cell.netPositions += Math.max(agg.intake - agg.cancelled, 0);
    cell.intakeRequests += 1;
    if (agg.intake - agg.cancelled > 0) cell.netRequests += 1;
  }

  return { year, complete, months };
}

/**
 * แคชรายปีใน memory — ปีที่จบแล้วข้อมูลไม่เปลี่ยน แคชยาว, ปีปัจจุบันแคชสั้น
 * (per-instance บน serverless — best effort พอสำหรับ dashboard)
 */
const yearCache = new Map<string, { data: ForecastYearData; expiresAt: number }>();
const COMPLETE_YEAR_TTL_MS = 24 * 60 * 60 * 1000;
const CURRENT_YEAR_TTL_MS = 10 * 60 * 1000;

function scopeKey(scope: DepartmentScope): string {
  if (scope.mode === 'code') return `code:${scope.code}`;
  return scope.mode;
}

async function loadYear(
  year: number,
  todayYmd: string,
  departmentScope: DepartmentScope,
): Promise<ForecastYearData> {
  const currentYear = Number(todayYmd.slice(0, 4));
  const complete = year < currentYear;
  const key = `${scopeKey(departmentScope)}:${year}`;
  const cached = yearCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const from = `${year}-01-01`;
  const to = complete ? `${year}-12-31` : todayYmd;
  const records = await listSiamrajThroughput({ from, to, departmentScope });
  const data = aggregateThroughputYear(year, complete, records);
  yearCache.set(key, {
    data,
    expiresAt: Date.now() + (complete ? COMPLETE_YEAR_TTL_MS : CURRENT_YEAR_TTL_MS),
  });
  return data;
}

const HISTORY_YEARS = 3;

/** GET /api/request-control/demand-forecast — ยอด เข้ามา/ยกเลิก/net รายเดือน × ประเภท 3 ปี + YTD */
async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    res.setHeader?.('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const departmentScope = await loadUserDepartmentScope(req.user);
    const todayYmd = toBangkokYmd(new Date()) || new Date().toISOString().slice(0, 10);
    const currentYear = Number(todayYmd.slice(0, 4));
    const currentMonth = Number(todayYmd.slice(5, 7));

    const wantedYears: number[] = [];
    for (let y = currentYear - HISTORY_YEARS; y <= currentYear; y += 1) wantedYears.push(y);

    // ปีที่จบแล้วมัก cache hit — โหลดขนานกันเมื่อ miss
    const years = await Promise.all(
      wantedYears.map((y) => loadYear(y, todayYmd, departmentScope)),
    );

    res.setHeader?.('Cache-Control', 'no-store');
    const body: DemandForecastResponse = { years, currentYear, currentMonth, asOf: todayYmd };
    return res.status(200).json(body);
  } catch (e) {
    return handleApiError(res, e, 'request-control demand-forecast GET', {
      userId: req.user.sub,
    });
  }
}

export default withRbac(handler, 'siamraj-unit-requests');

export { LIFECYCLES };
