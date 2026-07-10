import { siamrajSqlQuery } from './siamrajSqlServer.js';
import { toBangkokYmd } from './businessDate.js';
import {
  effectiveInformedCount,
  effectiveInformQtySql,
  isOpenStaffingRowForRemaining,
  requestPositionTotal,
  staffingPositionBreakdown,
} from './siamrajStaffingOpen.js';
import { inferJobTypeFromDescription, primaryJobRoleLabel } from './siamrajJobMapping.js';
import { normalizeSiamrajRequestNoForDisplay } from './siamrajRequestNo.js';

/**
 * รายการใบขอที่ "ปิด/แจ้งเข้าแล้ว" ในช่วงวันที่ — ให้ drill-down การ์ด "ปิดใบขอ" เห็นของจริง
 * ใช้นิยาม closed เดียวกับ throughput (siamrajSqlServerThroughput):
 *   closedPositions = informed>0 ? informed : (!isOpen ? total : 0)
 * เลยได้ตัวเลขตรงกับ KPI "ปิด"
 */
type ClosedRow = {
  request_no: string;
  request_date: Date | string | null;
  want_date_from: Date | string | null;
  request_qty: number | null;
  inform_qty: number | null;
  is_inform_all: string | null;
  effective_inform_qty: number | null;
  status: string | null;
  is_stop: string | null;
  stop_no: string | null;
  stop_date: Date | string | null;
  cancel_date: Date | string | null;
  has_inform: number | boolean | null;
  request_action_code: string | null;
  request_action_name: string | null;
  site_code: string | null;
  site_name: string | null;
  department_code: string | null;
  customer_name: string | null;
  staff_title_code: string | null;
  staff_title_name: string | null;
  job_name1: string | null;
  job_description_code_1: string | null;
  job_name2: string | null;
  job_description_code_2: string | null;
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

function toYmd(v: Date | string | null | undefined): string {
  return toBangkokYmd(v) || '';
}

/** จำนวนตำแหน่งที่ปิดในใบนี้ — ตรงกับ mapThroughputRow ฝั่ง isOpen=false */
function closedPositionCount(r: ClosedRow): number {
  const informed = effectiveInformedCount(r);
  if (informed > 0) return informed;
  if (!isOpenStaffingRowForRemaining(r)) return requestPositionTotal(r.request_qty);
  return 0;
}

function mapClosedRow(r: ClosedRow) {
  const roleLabel = primaryJobRoleLabel(r.job_name1, r.staff_title_name, r.job_description_code_1);
  const jobType = inferJobTypeFromDescription(
    r.job_name1,
    r.job_name2,
    r.staff_title_name,
    r.job_description_code_1,
  );
  const rawRequestNo = (r.request_no || '').trim();
  const requestNo = normalizeSiamrajRequestNoForDisplay(rawRequestNo, {
    siteCode: r.site_code,
    departmentCode: r.department_code,
  });
  const breakdown = staffingPositionBreakdown(r);
  const closureYmd = toYmd(r.stop_date) || toYmd(r.cancel_date) || toYmd(r.request_date);

  return {
    id: `siamraj-sql:${rawRequestNo}`,
    externalId: rawRequestNo,
    source: 'siamraj' as const,
    readOnly: true,
    request_no: requestNo,
    unit_name: r.customer_name?.trim() || r.site_name || r.site_code || '—',
    site_code: r.site_code || undefined,
    department_code: r.department_code?.trim() || undefined,
    location_address: r.site_name || r.site_code || '',
    position_units: closedPositionCount(r),
    request_positions: breakdown.requestPositions,
    filled_positions: breakdown.filledPositions,
    cancelled_positions: breakdown.cancelledPositions,
    cancel_date: toYmd(r.cancel_date) || undefined,
    status: 'closed' as const,
    siamraj_status: r.status || undefined,
    request_action_code: r.request_action_code || undefined,
    request_action_name: r.request_action_name || undefined,
    job_description_code_1: roleLabel || undefined,
    job_description_code_2: r.job_name2 || r.job_description_code_2 || undefined,
    staff_title_code: r.staff_title_code || undefined,
    staff_title_name: r.staff_title_name || undefined,
    required_date: toYmd(r.want_date_from) || toYmd(r.request_date) || closureYmd,
    request_date: toYmd(r.request_date) || closureYmd,
    closed_date: closureYmd || undefined,
    created_at: toYmd(r.request_date)
      ? new Date(`${toYmd(r.request_date)}T00:00:00.000Z`).toISOString()
      : new Date().toISOString(),
    urgency: 'advance' as const,
    total_income: 0,
    job_type: jobType,
    job_category: 'private' as const,
    penalty_per_day: 0,
    days_without_worker: 0,
    total_penalty: 0,
  };
}

function isDateYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function listSiamrajSqlServerClosedRequests(options: {
  from: string;
  to: string;
  limit?: number;
}): Promise<ReturnType<typeof mapClosedRow>[]> {
  const { from, to } = options;
  if (!isDateYmd(from) || !isDateYmd(to)) throw new Error('from/to must be YYYY-MM-DD');
  const limit = Math.min(Math.max(options.limit ?? 3000, 1), 5000);
  const filters = getSqlFilters();
  const clsExclude = excludeClsContractTypeWhere('SS');

  const rows = await siamrajSqlQuery<ClosedRow>(
    `
    SELECT TOP (@limit)
      A.request_no,
      A.request_date,
      A.want_date_from,
      A.request_qty,
      A.inform_qty,
      A.is_inform_all,
      ${effectiveInformQtySql('A')} AS effective_inform_qty,
      A.status,
      A.is_stop,
      A.stop_no,
      A.stop_date,
      A.cancel_date,
      CASE WHEN EXISTS (SELECT 1 FROM st_inform_head IH WHERE IH.request_no = A.request_no) THEN 1 ELSE 0 END AS has_inform,
      A.request_code AS request_action_code,
      (SELECT z.request_name FROM st_ms_request z WHERE z.request_code = A.request_code) AS request_action_name,
      A.site_code,
      SS.site_name,
      RTRIM(SS.department_code) AS department_code,
      (SELECT z.customer_name FROM st_site_contract_p1 z WHERE z.contract_no = A.contract_no) AS customer_name,
      A.staff_title_code,
      (SELECT z.staff_title_name FROM hr_ms_staff_title z WHERE z.staff_title_code = A.staff_title_code) AS staff_title_name,
      A.job_description_code_1,
      (SELECT z.job_description_name FROM hr_ms_job_description_1 z WHERE z.job_description_code_1 = A.job_description_code_1) AS job_name1,
      A.job_description_code_2,
      (SELECT z.job_description_name FROM hr_ms_job_description_2 z WHERE z.job_description_code_2 = A.job_description_code_2) AS job_name2
    FROM st_request_head A
    INNER JOIN ms_site SS ON A.site_code = SS.site_code
    WHERE SS.department_code BETWEEN @deptFrom AND @deptTo
      AND A.site_code BETWEEN @siteFrom AND @siteTo
      ${clsExclude}
      AND CONVERT(date, COALESCE(A.stop_date, A.cancel_date, A.request_date)) BETWEEN @fromDate AND @toDate
    ORDER BY COALESCE(A.stop_date, A.cancel_date, A.request_date) DESC
    `,
    { ...filters, fromDate: from, toDate: to, limit },
  );

  // เก็บเฉพาะใบที่มีตำแหน่งปิดจริง (ตรงนิยาม throughput)
  return rows.map(mapClosedRow).filter((r) => r.position_units > 0);
}
