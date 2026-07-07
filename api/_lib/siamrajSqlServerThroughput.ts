import { siamrajSqlQuery } from './siamrajSqlServer.js';
import { toBangkokYmd } from './businessDate.js';

export type SiamrajThroughputRecord = {
  requestDate: string;
  closureDate: string | null;
  positionUnits: number;
  isOpen: boolean;
};

type SqlThroughputRow = {
  request_date: Date | string | null;
  request_qty: number | null;
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

function positionUnits(qty: number | null | undefined): number {
  return qty != null && qty > 0 ? qty : 1;
}

/** ใบขอที่ยังต้องหาคน — ตรงกับ feed หลัก */
export function isOpenStaffingRow(row: {
  status: string | null;
  is_stop: string | null;
  stop_no: string | null;
  has_inform: number | boolean | null;
}): boolean {
  const status = (row.status || '').trim().toUpperCase();
  const isStop = (row.is_stop || '').trim().toUpperCase();
  const stopNo = (row.stop_no || '').trim();
  const hasInform = row.has_inform === true || row.has_inform === 1;
  return status === 'A' && isStop === 'N' && !stopNo && !hasInform;
}

function closureDateFromRow(row: SqlThroughputRow): string | null {
  if (isOpenStaffingRow(row)) return null;
  return toYmd(row.stop_date) || toYmd(row.cancel_date) || toYmd(row.request_date);
}

function mapThroughputRow(row: SqlThroughputRow): SiamrajThroughputRecord | null {
  const requestDate = toYmd(row.request_date);
  if (!requestDate) return null;
  const isOpen = isOpenStaffingRow(row);
  return {
    requestDate,
    closureDate: closureDateFromRow(row),
    positionUnits: positionUnits(row.request_qty),
    isOpen,
  };
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
          EXISTS (SELECT 1 FROM st_inform_head IH WHERE IH.request_no = A.request_no)
          AND NOT (
            A.status = 'A'
            AND A.is_stop = 'N'
            AND (A.stop_no IS NULL OR RTRIM(A.stop_no) = '')
          )
          AND CONVERT(date, A.request_date) >= @fromDate AND CONVERT(date, A.request_date) <= @toDate
        )
      )
  `,
    { ...filters, fromDate: from, toDate: to },
  );

  return rows.map(mapThroughputRow).filter((r): r is SiamrajThroughputRecord => r != null);
}
