import { siamrajSqlQuery } from './siamrajSqlServer.js';
import { toBangkokYmd } from './businessDate.js';
import {
  effectiveInformedCount,
  effectiveInformQtySql,
  isOpenStaffingRowForRemaining,
  remainingOpenPositionsFromRow,
  requestPositionTotal,
} from './siamrajStaffingOpen.js';

export {
  effectiveInformedCount,
  effectiveInformQtySql,
  informedPositionCount,
  isOpenStaffingRow,
  isOpenStaffingRowForRemaining,
  openStaffingRequestWhereSql,
  remainingOpenPositions,
  remainingOpenPositionsFromRow,
  requestPositionTotal,
} from './siamrajStaffingOpen.js';

export type SiamrajThroughputRecord = {
  requestDate: string;
  closureDate: string | null;
  positionUnits: number;
  isOpen: boolean;
};

type SqlThroughputRow = {
  request_date: Date | string | null;
  request_qty: number | null;
  inform_qty: number | null;
  is_inform_all: string | null;
  effective_inform_qty: number | null;
  status: string | null;
  is_stop: string | null;
  stop_no: string | null;
  cancel_date: Date | string | null;
  stop_date: Date | string | null;
  has_inform: number | boolean | null;
};

function getSqlFilters() {
  return {
    deptFrom: (process.env.SIAMRAJ_SQL_DEPT_FROM || '_').trim(),
    deptTo: (process.env.SIAMRAJ_SQL_DEPT_TO || 'Z').trim(),
    siteFrom: (process.env.SIAMRAJ_SQL_SITE_FROM || '_').trim(),
    siteTo: (process.env.SIAMRAJ_SQL_SITE_TO || 'Z').trim(),
  };
}

function excludeClsContractTypeWhere(alias = 'SS'): string {
  const raw = (process.env.SIAMRAJ_SQL_EXCLUDE_CONTRACT_TYPE_C ?? 'true').trim().toLowerCase();
  if (raw === 'false' || raw === '0' || raw === 'no' || raw === 'off') return '';
  return `AND RTRIM(${alias}.contract_type_code) <> 'C'`;
}

function toYmd(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  const ymd = toBangkokYmd(v);
  return ymd || null;
}

function mapThroughputRow(row: SqlThroughputRow): SiamrajThroughputRecord[] {
  const requestDate = toYmd(row.request_date);
  if (!requestDate) return [];

  const total = requestPositionTotal(row.request_qty);
  const informed = effectiveInformedCount(row);
  const remaining = remainingOpenPositionsFromRow(row);
  const isOpen = isOpenStaffingRowForRemaining(row);
  const closureDate = toYmd(row.stop_date) || toYmd(row.cancel_date) || requestDate;
  const out: SiamrajThroughputRecord[] = [];

  if (informed > 0) {
    out.push({
      requestDate,
      closureDate,
      positionUnits: informed,
      isOpen: false,
    });
  }

  if (isOpen && remaining > 0) {
    out.push({
      requestDate,
      closureDate: null,
      positionUnits: remaining,
      isOpen: true,
    });
  } else if (!isOpen && informed === 0) {
    out.push({
      requestDate,
      closureDate,
      positionUnits: total,
      isOpen: false,
    });
  }

  return out;
}

function isDateYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** ดึงใบขอในช่วงวันที่ (วันที่กรอก หรือวันที่ปิด) สำหรับกราฟขอ vs ปิด */
export async function listSiamrajSqlServerThroughput(options: {
  from: string;
  to: string;
}): Promise<SiamrajThroughputRecord[]> {
  const { from, to } = options;
  if (!isDateYmd(from) || !isDateYmd(to)) {
    throw new Error('from/to must be YYYY-MM-DD');
  }

  const filters = getSqlFilters();
  const clsExclude = excludeClsContractTypeWhere('SS');

  const rows = await siamrajSqlQuery<SqlThroughputRow>(
    `
    SELECT
      A.request_date,
      A.request_qty,
      A.inform_qty,
      A.is_inform_all,
      ${effectiveInformQtySql('A')} AS effective_inform_qty,
      A.status,
      A.is_stop,
      A.stop_no,
      A.cancel_date,
      A.stop_date,
      CASE
        WHEN EXISTS (SELECT 1 FROM st_inform_head IH WHERE IH.request_no = A.request_no) THEN 1
        ELSE 0
      END AS has_inform
    FROM st_request_head A
    INNER JOIN ms_site SS ON A.site_code = SS.site_code
    WHERE SS.department_code BETWEEN @deptFrom AND @deptTo
      AND A.site_code BETWEEN @siteFrom AND @siteTo
      ${clsExclude}
      AND (
        CONVERT(date, A.request_date) >= @fromDate AND CONVERT(date, A.request_date) <= @toDate
        OR (A.stop_date IS NOT NULL AND CONVERT(date, A.stop_date) >= @fromDate AND CONVERT(date, A.stop_date) <= @toDate)
        OR (A.cancel_date IS NOT NULL AND CONVERT(date, A.cancel_date) >= @fromDate AND CONVERT(date, A.cancel_date) <= @toDate)
        OR (
          ISNULL(A.inform_qty, 0) > 0
          AND CONVERT(date, A.request_date) >= @fromDate AND CONVERT(date, A.request_date) <= @toDate
        )
      )
  `,
    { ...filters, fromDate: from, toDate: to },
  );

  return rows.flatMap(mapThroughputRow);
}
