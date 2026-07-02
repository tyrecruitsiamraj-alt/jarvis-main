import { siamrajSqlQuery } from './siamrajSqlServer.js';
import {
  formatGenderRequirement,
  inferJobTypeFromDescription,
  parseAgeRange,
  primaryJobRoleLabel,
} from './siamrajJobMapping.js';

type SqlServerRequestRow = {
  external_id: string;
  request_no: string;
  act_saleco_datetime: Date | string | null;
  act_saleco_effective_date: Date | string | null;
  site_code: string | null;
  site_name: string | null;
  department_code: string | null;
  department_name: string | null;
  customer_name: string | null;
  status: string | null;
  staff_fullname: string | null;
  mobile_phone: string | null;
  job_description_code_1: string | null;
  job_description_code_2: string | null;
  staff_title_code: string | null;
  staff_title_name: string | null;
  job_name1: string | null;
  job_name2: string | null;
  requester_name: string | null;
  request_action_name: string | null;
  request_action_code: string | null;
  resign_date: Date | string | null;
  reason_main_name: string | null;
  work_addr: string | null;
  work_date: string | null;
  work_time: string | null;
  age: string | null;
  sex: string | null;
  payment_rate: number | null;
  draw_rate: number | null;
  fee_name: string | null;
  abs_customer_fine: number | null;
  contact_name: string | null;
};

function toIso(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function toYmd(v: Date | string | null | undefined): string {
  const iso = toIso(v);
  if (!iso) return '';
  return iso.slice(0, 10);
}

function getSqlFilters() {
  return {
    deptFrom: (process.env.SIAMRAJ_SQL_DEPT_FROM || '_').trim(),
    deptTo: (process.env.SIAMRAJ_SQL_DEPT_TO || 'Z').trim(),
    siteFrom: (process.env.SIAMRAJ_SQL_SITE_FROM || '_').trim(),
    siteTo: (process.env.SIAMRAJ_SQL_SITE_TO || 'Z').trim(),
  };
}

function mapSqlServerRow(r: SqlServerRequestRow) {
  const workSchedule = [r.work_date, r.work_time].filter(Boolean).join(' • ');
  const roleLabel = primaryJobRoleLabel(r.job_name1, r.staff_title_name, r.job_description_code_1);
  const jobDesc = [roleLabel, r.job_name2, r.fee_name].filter(Boolean).join(' / ');
  const ageRange = parseAgeRange(r.age);
  const genderRequirement = formatGenderRequirement(r.sex);
  const jobType = inferJobTypeFromDescription(r.job_name1, r.staff_title_name, r.job_description_code_1);

  return {
    id: `siamraj-sql:${r.external_id}`,
    externalId: r.external_id,
    source: 'siamraj' as const,
    readOnly: true,
    request_no: r.request_no,
    submittedByName: r.requester_name?.trim() || undefined,
    submittedAt: toIso(r.act_saleco_datetime) || undefined,
    required_date:
      toYmd(r.act_saleco_effective_date) ||
      toYmd(r.act_saleco_datetime) ||
      new Date().toISOString().slice(0, 10),
    lastWorkingDay: toYmd(r.resign_date) || undefined,
    unit_name: r.customer_name?.trim() || r.site_name || r.site_code || '—',
    site_code: r.site_code || undefined,
    department_code: r.department_code?.trim() || undefined,
    department_name: r.department_name?.trim() || undefined,
    location_address: r.work_addr || r.site_name || r.site_code || '',
    request_action_code: r.request_action_code || undefined,
    request_action_name: r.request_action_name || undefined,
    resigned_employee_name: r.staff_fullname?.trim() || undefined,
    resigned_reason: r.reason_main_name || undefined,
    contact_name: r.contact_name || undefined,
    contact_phone: r.mobile_phone?.trim() || undefined,
    work_schedule: workSchedule || undefined,
    status: 'open' as const,
    siamraj_status: r.status || undefined,
    staff_title_code: r.staff_title_code || undefined,
    staff_title_name: r.staff_title_name || undefined,
    job_description_code_1: roleLabel || jobDesc || undefined,
    job_description_code_2: r.job_name2 || r.job_description_code_2 || undefined,
    age_range_min: ageRange.min,
    age_range_max: ageRange.max,
    gender_requirement: genderRequirement,
    request_date: toYmd(r.act_saleco_datetime) || new Date().toISOString().slice(0, 10),
    created_at: toIso(r.act_saleco_datetime) || new Date().toISOString(),
    urgency: 'advance' as const,
    total_income: r.payment_rate ?? 0,
    job_type: jobType,
    job_category: 'private' as const,
    penalty_per_day: r.abs_customer_fine ?? 0,
    days_without_worker: 0,
    total_penalty: r.abs_customer_fine ?? 0,
  };
}

/** ใบขอที่ยังไม่ปิด — ยังต้องหาคน (ไม่กรอง is_inform_all) */
function openStaffingRequestWhere(alias = 'A'): string {
  return `${alias}.status = 'A' AND ${alias}.is_stop = 'N'`;
}

/** Query เต็มสำหรับดูรายละเอียดใบขอเดียว */
const BASE_SQL = `
  SELECT
    A.request_no AS external_id,
    A.request_no,
    A.request_date AS act_saleco_datetime,
    COALESCE(S.resign_date, A.want_date_from) AS act_saleco_effective_date,
    A.site_code,
    SS.site_name,
    RTRIM(SS.department_code) AS department_code,
    (SELECT TOP 1 D.department_name FROM ms_department D WHERE D.department_code = SS.department_code ORDER BY D.seq) AS department_name,
    A.status,
    (SELECT z.fname + ' ' + z.lname FROM hr_staff z WHERE z.staff_id = A.do_id) AS requester_name,
    (SELECT z.customer_name FROM st_site_contract_p1 z WHERE z.contract_no = A.contract_no) AS customer_name,
    B.work_place1 + '' + COALESCE(B.work_place2, '') + '' + COALESCE(B.work_place3, '') AS work_addr,
    A.staff_title_code,
    A.job_description_code_1,
    A.job_description_code_2,
    (SELECT z.staff_title_name FROM hr_ms_staff_title z WHERE z.staff_title_code = A.staff_title_code) AS staff_title_name,
    (SELECT z.job_description_name FROM hr_ms_job_description_1 z WHERE z.job_description_code_1 = A.job_description_code_1) AS job_name1,
    (SELECT z.job_description_name FROM hr_ms_job_description_2 z WHERE z.job_description_code_2 = A.job_description_code_2) AS job_name2,
    A.request_code AS request_action_code,
    (SELECT z.request_name FROM st_ms_request z WHERE z.request_code = A.request_code) AS request_action_name,
    (SELECT z.fname + ' ' + z.lname FROM hr_staff z WHERE z.staff_id = S.staff_id) AS staff_fullname,
    S.resign_date,
    (SELECT z.resign_type_name FROM hr_ms_resign_type z WHERE z.resign_type_code = S.resign_type_code) AS reason_main_name,
    (SELECT z.fee_name FROM wg2_ms_fee z WHERE z.fee_codex = (C.withdraw_type_code + C.income1_code + C.income2_code + C.fee_code)) AS fee_name,
    C.payment_rate,
    C.draw_rate,
    B.work_date,
    B.work_time,
    B.age,
    B.sex,
    (SELECT z.abs_customer_fine FROM st_request_p3 z WHERE z.request_no = A.request_no) AS abs_customer_fine,
    (SELECT z.contact_name FROM st_request_p1 z WHERE z.request_no = A.request_no) AS contact_name,
    (SELECT z.phone FROM st_request_p1 z WHERE z.request_no = A.request_no) AS mobile_phone,
    ROW_NUMBER() OVER (
      PARTITION BY A.request_no
      ORDER BY CASE WHEN C.is_wage = 'Y' THEN 0 ELSE 1 END, C.payment_rate DESC
    ) AS rn
  FROM st_request_head A
  LEFT JOIN st_request_staff S ON S.request_no = A.request_no
  INNER JOIN st_request_p2 B ON A.request_no = B.request_no
  INNER JOIN st_request_p3_rate C ON B.request_no = C.request_no
  INNER JOIN ms_site SS ON A.site_code = SS.site_code
`;

const BASE_SQL_LIST = `${BASE_SQL}
  WHERE ${openStaffingRequestWhere()}
`;

const BASE_SQL_BY_ID = `${BASE_SQL}
  WHERE A.status = 'A'
`;

const SELECT_COLUMNS = `
  external_id, request_no, act_saleco_datetime, act_saleco_effective_date,
  site_code, site_name, department_code, department_name, customer_name, status, staff_fullname, mobile_phone,
  job_description_code_1, job_description_code_2, staff_title_code, staff_title_name,
  job_name1, job_name2, requester_name, request_action_name, request_action_code,
  resign_date, reason_main_name, work_addr, work_date, work_time, age, sex,
  payment_rate, draw_rate, fee_name, abs_customer_fine, contact_name
`;

function staffingQueueExtraWhere(alias = 'A'): string {
  return `
    AND (
      EXISTS (SELECT 1 FROM st_ms_request mr WHERE mr.request_code = ${alias}.request_code AND mr.request_name LIKE N'%ลาออก%')
      OR EXISTS (SELECT 1 FROM st_ms_request mr WHERE mr.request_code = ${alias}.request_code AND mr.request_name LIKE N'%เปลี่ยน%')
    )
  `;
}

export async function listSiamrajSqlServerUnitRequests(options: { limit?: number; mode?: string }) {
  const limit = Math.min(Math.max(options.limit ?? 200, 1), 500);
  const mode = (options.mode || process.env.SIAMRAJ_UNIT_REQUESTS_MODE || 'all').toLowerCase();
  const extraWhere = mode === 'staffing_queue' ? staffingQueueExtraWhere() : '';
  const filters = getSqlFilters();

  const rows = await siamrajSqlQuery<SqlServerRequestRow & { rn: number }>(
    `
    WITH recent AS (
      SELECT TOP (@limit) A.request_no
      FROM st_request_head A
      INNER JOIN ms_site SS ON A.site_code = SS.site_code
      WHERE ${openStaffingRequestWhere()}
        AND SS.department_code BETWEEN @deptFrom AND @deptTo
        AND A.site_code BETWEEN @siteFrom AND @siteTo
        ${extraWhere}
      ORDER BY A.request_date DESC
    ),
    base AS (
      ${BASE_SQL_LIST}
      AND A.request_no IN (SELECT request_no FROM recent)
    )
    SELECT
      ${SELECT_COLUMNS}
    FROM base
    WHERE rn = 1
    ORDER BY act_saleco_datetime DESC
  `,
    { limit, ...filters },
  );

  return rows.map(mapSqlServerRow);
}

export async function getSiamrajSqlServerUnitRequestById(requestNo: string) {
  const rows = await siamrajSqlQuery<SqlServerRequestRow & { rn: number }>(
    `
    WITH base AS (
      ${BASE_SQL_BY_ID}
      AND A.request_no = @requestNo
    )
    SELECT TOP 1
      ${SELECT_COLUMNS}
    FROM base
    WHERE rn = 1
  `,
    { requestNo },
  );

  return rows[0] ? mapSqlServerRow(rows[0]) : null;
}
