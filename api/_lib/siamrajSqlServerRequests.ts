import { siamrajSqlQuery } from './siamrajSqlServer.js';

type SqlServerRequestRow = {
  external_id: string;
  request_no: string;
  act_saleco_datetime: Date | string | null;
  act_saleco_effective_date: Date | string | null;
  site_code: string | null;
  site_name: string | null;
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

function mapSqlServerRow(r: SqlServerRequestRow) {
  const workSchedule = [r.work_date, r.work_time].filter(Boolean).join(' • ');

  return {
    id: `siamraj-sql:${r.external_id}`,
    externalId: r.external_id,
    source: 'siamraj' as const,
    readOnly: true,
    request_no: r.request_no,
    submittedByName: r.requester_name?.trim() || undefined,
    submittedAt: toIso(r.act_saleco_datetime) || undefined,
    requiredDate: toYmd(r.act_saleco_effective_date) || undefined,
    lastWorkingDay: toYmd(r.resign_date) || undefined,
    unit_name: r.site_name || r.site_code || '—',
    site_code: r.site_code || undefined,
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
    job_description_code_1: r.job_name1 || r.job_description_code_1 || undefined,
    job_description_code_2: r.job_name2 || r.job_description_code_2 || undefined,
    request_date: toYmd(r.act_saleco_datetime) || new Date().toISOString().slice(0, 10),
    created_at: toIso(r.act_saleco_datetime) || new Date().toISOString(),
    urgency: 'advance' as const,
    total_income: r.payment_rate ?? 0,
    job_type: 'central' as const,
    job_category: 'private' as const,
    penalty_per_day: 0,
    days_without_worker: 0,
    total_penalty: 0,
  };
}

const BASE_SQL = `
  SELECT
    A.request_no AS external_id,
    A.request_no,
    COALESCE(A.record_date, A.request_date) AS act_saleco_datetime,
    COALESCE(S.resign_date, A.want_date_from) AS act_saleco_effective_date,
    A.site_code,
    SS.site_name,
    A.status,
    (SELECT z.fname + ' ' + z.lname FROM hr_staff z WHERE z.staff_id = S.staff_id) AS staff_fullname,
    (SELECT z.phone FROM st_request_p1 z WHERE z.request_no = A.request_no) AS mobile_phone,
    A.job_description_code_1,
    A.job_description_code_2,
    A.staff_title_code,
    (SELECT z.staff_title_name FROM hr_ms_staff_title z WHERE z.staff_title_code = A.staff_title_code) AS staff_title_name,
    (SELECT z.job_description_name FROM hr_ms_job_description_1 z WHERE z.job_description_code_1 = A.job_description_code_1) AS job_name1,
    (SELECT z.job_description_name FROM hr_ms_job_description_2 z WHERE z.job_description_code_2 = A.job_description_code_2) AS job_name2,
    (SELECT z.fname + ' ' + z.lname FROM hr_staff z WHERE z.staff_id = A.do_id) AS requester_name,
    (SELECT z.request_name FROM st_ms_request z WHERE z.request_code = A.request_code) AS request_action_name,
    A.request_code AS request_action_code,
    S.resign_date,
    (SELECT z.resign_type_name FROM hr_ms_resign_type z WHERE z.resign_type_code = S.resign_type_code) AS reason_main_name,
  LTRIM(RTRIM(
    COALESCE(B.work_place1, '') +
    COALESCE(B.work_place2, '') +
    COALESCE(B.work_place3, '')
  )) AS work_addr,
    B.work_date,
    B.work_time,
    B.age,
    B.sex,
    C.payment_rate,
    (SELECT z.contact_name FROM st_request_p1 z WHERE z.request_no = A.request_no) AS contact_name,
    ROW_NUMBER() OVER (PARTITION BY A.request_no ORDER BY C.payment_rate DESC) AS rn
  FROM st_request_head A
  LEFT JOIN st_request_staff S ON S.request_no = A.request_no
  INNER JOIN st_request_p2 B ON A.request_no = B.request_no
  INNER JOIN st_request_p3_rate C ON B.request_no = C.request_no
  LEFT JOIN ms_site SS ON A.site_code = SS.site_code
`;

function staffingQueueWhereSql(): string {
  return `
    A.status = 'A'
    AND (
      EXISTS (SELECT 1 FROM st_ms_request mr WHERE mr.request_code = A.request_code AND mr.request_name LIKE N'%ลาออก%')
      OR EXISTS (SELECT 1 FROM st_ms_request mr WHERE mr.request_code = A.request_code AND mr.request_name LIKE N'%เปลี่ยน%')
    )
  `;
}

export async function listSiamrajSqlServerUnitRequests(options: { limit?: number; mode?: string }) {
  const limit = Math.min(Math.max(options.limit ?? 200, 1), 500);
  const mode = (options.mode || process.env.SIAMRAJ_UNIT_REQUESTS_MODE || 'staffing_queue').toLowerCase();
  const where = mode === 'all' ? `A.status = 'A'` : staffingQueueWhereSql();

  const rows = await siamrajSqlQuery<SqlServerRequestRow & { rn: number }>(`
    WITH base AS (
      ${BASE_SQL}
      WHERE ${where}
    )
    SELECT TOP (@limit)
      external_id, request_no, act_saleco_datetime, act_saleco_effective_date,
      site_code, site_name, status, staff_fullname, mobile_phone,
      job_description_code_1, job_description_code_2, staff_title_code, staff_title_name,
      job_name1, job_name2, requester_name, request_action_name, request_action_code,
      resign_date, reason_main_name, work_addr, work_date, work_time, age, sex,
      payment_rate, contact_name
    FROM base
    WHERE rn = 1
    ORDER BY act_saleco_datetime DESC
  `, { limit });

  return rows.map(mapSqlServerRow);
}

export async function getSiamrajSqlServerUnitRequestById(requestNo: string) {
  const rows = await siamrajSqlQuery<SqlServerRequestRow & { rn: number }>(`
    WITH base AS (
      ${BASE_SQL}
      WHERE A.request_no = @requestNo
    )
    SELECT TOP 1
      external_id, request_no, act_saleco_datetime, act_saleco_effective_date,
      site_code, site_name, status, staff_fullname, mobile_phone,
      job_description_code_1, job_description_code_2, staff_title_code, staff_title_name,
      job_name1, job_name2, requester_name, request_action_name, request_action_code,
      resign_date, reason_main_name, work_addr, work_date, work_time, age, sex,
      payment_rate, contact_name
    FROM base
    WHERE rn = 1
  `, { requestNo });

  return rows[0] ? mapSqlServerRow(rows[0]) : null;
}
