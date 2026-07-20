import { siamrajSqlQuery } from './siamrajSqlServer.js';

/**
 * "คนของเรา" — ผู้สมัครที่ผ่านสัมภาษณ์แล้ว รอลงงาน (board card บน SQL Server Siamraj)
 * ที่มา: ir_board_card (board_id=1, column_id=2, is_archived='N') join hr_recruitment + ที่อยู่
 */
export type BoardReadyCandidate = {
  card_id: number;
  board_name: string | null;
  column_label: string | null;
  application_no: string | null;
  application_date: string | null;
  first_name: string | null;
  last_name: string | null;
  nick_name: string | null;
  mobile: string | null;
  sex_code: string | null;
  age: number | null;
  required_salary: number | null;
  /** ตำแหน่ง/สกิลที่คัดไว้แล้ว (สัญญาณแมทหลัก) */
  job1_name: string | null;
  job2_name: string | null;
  site_name: string | null;
  work_place: string | null;
  province_name: string | null;
  amphur_name: string | null;
  full_address: string | null;
  priority_code: string | null;
  last_activity_at: string | null;
  remarks: string | null;
};

type Row = {
  card_id: number;
  board_name: string | null;
  column_label: string | null;
  application_no: string | null;
  application_date: Date | string | null;
  fname: string | null;
  lname: string | null;
  nick_name: string | null;
  mobile: string | null;
  phone: string | null;
  sex_code: string | null;
  age: number | null;
  required_salary: number | null;
  job1_name: string | null;
  job2_name: string | null;
  site_name: string | null;
  work_place: string | null;
  province_name: string | null;
  amphur_name: string | null;
  full_address: string | null;
  priority_code: string | null;
  last_activity_at: Date | string | null;
  remarks: string | null;
};

const LIST_SQL = `
SELECT TOP (@limit)
    c.card_id,
    bh.board_name,
    bc.display_label_th   AS column_label,
    r.application_no,
    r.application_date,
    r.fname,
    r.lname,
    r.nick_name,
    r.mobile,
    r.phone,
    r.sex_code,
    CASE WHEN r.birth_date IS NOT NULL
         THEN DATEDIFF(YEAR, r.birth_date, GETDATE())
         ELSE NULL END    AS age,
    r.required_salary,
    j1.job_description_name AS job1_name,
    j2.job_description_name AS job2_name,
    r.site_name,
    r.work_place,
    pv.province_name,
    am.amphur_name,
    LTRIM(RTRIM(CONCAT(
        ra.home_no, N' ', ra.address1, N' ', ra.address2, N' ', ra.address3, N' ',
        CASE WHEN tb.tambon_name IS NOT NULL THEN N'ต.' + tb.tambon_name + N' ' ELSE N'' END,
        CASE WHEN am.amphur_name IS NOT NULL THEN N'อ.' + am.amphur_name + N' ' ELSE N'' END,
        pv.province_name, N' ', ra.zip_code
    )))                    AS full_address,
    c.priority_code,
    c.last_activity_at,
    c.remarks
FROM dbo.ir_board_card AS c
INNER JOIN dbo.ir_board_head   AS bh ON bh.board_id  = c.board_id
INNER JOIN dbo.ir_board_column AS bc ON bc.column_id = c.column_id
LEFT JOIN dbo.hr_recruitment   AS r  ON r.citizen_id = c.citizen_id
LEFT JOIN dbo.hr_ms_job_description_1 AS j1 ON j1.job_description_code_1 = r.job_description_code_1
LEFT JOIN dbo.hr_ms_job_description_2 AS j2 ON j2.job_description_code_2 = r.job_description_code_2
LEFT JOIN dbo.hr_recruitment_address  AS ra ON ra.citizen_id = r.citizen_id
LEFT JOIN dbo.ms_province             AS pv ON pv.province_code = ra.province_code
LEFT JOIN dbo.ms_province_amphur      AS am ON am.province_code = ra.province_code AND am.amphur_code = ra.amphur_code
LEFT JOIN dbo.ms_province_tambon      AS tb ON tb.province_code = ra.province_code AND tb.amphur_code = ra.amphur_code AND tb.tambon_code = ra.tambon_code
WHERE c.board_id    = @boardId
  AND c.is_archived = 'N'
  AND c.column_id   = @columnId
ORDER BY c.last_activity_at DESC, c.card_id DESC
`;

function toIso(v: Date | string | null): string | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString();
}

const clean = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

export async function listBoardReadyCandidates(options?: {
  boardId?: number;
  columnId?: number;
  limit?: number;
}): Promise<BoardReadyCandidate[]> {
  const boardId = options?.boardId ?? Number(process.env.BOARD_READY_BOARD_ID || 1);
  const columnId = options?.columnId ?? Number(process.env.BOARD_READY_COLUMN_ID || 2);
  const limit = Math.min(Math.max(options?.limit ?? 500, 1), 2000);

  const rows = await siamrajSqlQuery<Row>(LIST_SQL, { boardId, columnId, limit });
  return rows.map((r) => ({
    card_id: r.card_id,
    board_name: clean(r.board_name),
    column_label: clean(r.column_label),
    application_no: clean(r.application_no),
    application_date: toIso(r.application_date),
    first_name: clean(r.fname),
    last_name: clean(r.lname),
    nick_name: clean(r.nick_name),
    mobile: clean(r.mobile) || clean(r.phone),
    sex_code: clean(r.sex_code),
    age: typeof r.age === 'number' && r.age > 0 && r.age < 100 ? r.age : null,
    required_salary:
      r.required_salary != null && Number.isFinite(Number(r.required_salary))
        ? Number(r.required_salary)
        : null,
    job1_name: clean(r.job1_name),
    job2_name: clean(r.job2_name),
    site_name: clean(r.site_name),
    work_place: clean(r.work_place),
    province_name: clean(r.province_name),
    amphur_name: clean(r.amphur_name),
    full_address: clean(r.full_address),
    priority_code: clean(r.priority_code),
    last_activity_at: toIso(r.last_activity_at),
    remarks: clean(r.remarks),
  }));
}
