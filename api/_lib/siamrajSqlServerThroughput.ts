import { siamrajSqlQuery } from './siamrajSqlServer.js';
import { toBangkokYmd } from './businessDate.js';
import { staffingPositionBreakdown } from './siamrajStaffingOpen.js';

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
  staffingPositionBreakdown,
} from './siamrajStaffingOpen.js';

export type SiamrajThroughputRecord = {
  requestNo?: string;
  requestDate: string;
  closureDate: string | null;
  positionUnits: number;
  isOpen: boolean;
  kind?: 'filled' | 'cancelled' | 'remaining';
};

type SqlThroughputRow = {
  request_no: string | null;
  request_date: Date | string | null;
  want_date_from: Date | string | null;
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

function effectiveRequestDateSql(alias = 'A'): string {
  /** วันที่เปิดใบสำหรับ cohort รายเดือน = วันที่กรอกใบ (request_date) */
  return `CONVERT(date, ${alias}.request_date)`;
}

function requestOpenDateYmdFromRow(row: SqlThroughputRow): string | null {
  return toYmd(row.request_date) || toYmd(row.want_date_from);
}

function mapThroughputRow(row: SqlThroughputRow): SiamrajThroughputRecord[] {
  /** เดือนที่「เข้ามา」= วันที่เปิด/กรอกใบ ไม่ใช่ want_date_from */
  const requestDate = requestOpenDateYmdFromRow(row);
  if (!requestDate) return [];

  const requestNo = (row.request_no || '').trim() || undefined;
  const breakdown = staffingPositionBreakdown(row);
  const closureDate = toYmd(row.stop_date) || toYmd(row.cancel_date) || requestDate;
  const out: SiamrajThroughputRecord[] = [];

  if (breakdown.filledPositions > 0) {
    out.push({
      requestNo,
      requestDate,
      closureDate,
      positionUnits: breakdown.filledPositions,
      isOpen: false,
      kind: 'filled',
    });
  }
  if (breakdown.cancelledPositions > 0) {
    out.push({
      requestNo,
      requestDate,
      closureDate,
      positionUnits: breakdown.cancelledPositions,
      isOpen: false,
      kind: 'cancelled',
    });
  }
  if (breakdown.remainingPositions > 0) {
    out.push({
      requestNo,
      requestDate,
      closureDate: null,
      positionUnits: breakdown.remainingPositions,
      isOpen: true,
      kind: 'remaining',
    });
  }

  return out;
}

function isDateYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** ดึงใบขอตามวันที่เปิดใบในงวด — สำหรับ cohort เข้ามา/ปิด/ยกเลิก/คงเหลือ */
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

  const openDate = effectiveRequestDateSql('A');
  // สรุป inform เฉพาะใบในช่วง — เลี่ยง correlated COUNT ต่อแถว และเลี่ยงสแกน inform ทั้งตาราง
  const rows = await siamrajSqlQuery<SqlThroughputRow>(
    `
    SELECT
      A.request_no,
      A.request_date,
      A.want_date_from,
      A.request_qty,
      A.inform_qty,
      A.is_inform_all,
      CASE
        WHEN ISNULL(A.inform_qty, 0) > 0 THEN A.inform_qty
        ELSE ISNULL(IH.inform_cnt, 0)
      END AS effective_inform_qty,
      A.status,
      A.is_stop,
      A.stop_no,
      A.cancel_date,
      A.stop_date,
      CASE
        WHEN ISNULL(A.inform_qty, 0) > 0 OR ISNULL(IH.inform_cnt, 0) > 0 THEN 1
        ELSE 0
      END AS has_inform
    FROM st_request_head A
    INNER JOIN ms_site SS ON A.site_code = SS.site_code
    LEFT JOIN (
      SELECT IH.request_no, COUNT_BIG(*) AS inform_cnt
      FROM st_inform_head IH
      INNER JOIN st_request_head A2 ON A2.request_no = IH.request_no
      WHERE CONVERT(date, A2.request_date) >= @fromDate
        AND CONVERT(date, A2.request_date) <= @toDate
      GROUP BY IH.request_no
    ) IH ON IH.request_no = A.request_no
    WHERE SS.department_code BETWEEN @deptFrom AND @deptTo
      AND A.site_code BETWEEN @siteFrom AND @siteTo
      ${clsExclude}
      AND ${openDate} >= @fromDate
      AND ${openDate} <= @toDate
  `,
    { ...filters, fromDate: from, toDate: to },
  );

  return rows.flatMap(mapThroughputRow);
}
