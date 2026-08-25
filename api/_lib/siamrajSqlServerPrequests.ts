/**
 * **ใบขอล่วงหน้า** (`st_prequest_*`) — ทำให้เป็นใบขอเต็มใบเหมือนใบขอปกติ
 * (เจ้าของสั่ง 17 ส.ค. 2569: *"ทำเหมือนใบขอใบนึงเลย"*)
 *
 * ใบขอล่วงหน้า = ลูกค้าแจ้งความต้องการไว้ก่อน ยังไม่ถูกแปลงเป็นใบขอจริง
 * (`is_request <> 'Y'`) — ค่ามันคือ **หาคนล่วงหน้าได้ก่อนใบจริงจะออก**
 *
 * ⚠️ **id ขึ้นต้น `siamraj-pre:`** ไม่ใช่ `siamraj-sql:` — เลขที่ใบของสองระบบซ้ำกันได้
 * (ทั้งคู่ใช้รูป BU+ปีเดือน+running) ปนกันเมื่อไหร่ = ผลแมท/ใบสมัคร/คิวโทรไปผูกผิดใบ
 *
 * 🔴 สามข้อที่คิวรีตั้งต้นขาด แล้วอุดไว้ในนี้ (ตรวจกับ ERP จริง 17 ส.ค. 2569):
 *   1. **หน่วยของค่าแรง** (`fee_unit_code_1`) — วัดจริง: ค่าแรงหลัก 31 ใบ เป็นรายเดือน 30
 *      **รายวัน 1** (15,000/วัน) เอาไปโชว์ตรง ๆ โดยไม่ดูหน่วย = บอกเลขผิด 30 เท่า
 *      (บั๊กเดียวกับที่แก้ไปแล้วสองรอบทั้งหน้าประกาศและบทพูด AI)
 *   2. **อัตรามีหลายแถวต่อใบ** (11–24 แถว) — คิวรีเดิมเอาแถวเดียว โอที/เบี้ยขยัน/
 *      ค่าครองชีพหายหมด · ที่นี่ดึงแถวค่าแรงหลักไว้ใน list และเปิดทางให้ดึงทั้งชุด
 *      ผ่าน `fetchPrequestBenefitRates` (กรองฝั่งหักด้วย `what_side <> '2'`)
 *   3. **`draw_rate` = อัตราเบิก** (ต่างจากอัตราจ่ายจริง — วัดแล้วจ่าย 15,000 เบิก 23,000)
 *      **ไม่ select ออกมาเลยในไฟล์นี้** กันหลุดไปหน้าที่ผู้สมัคร/คนนอกเห็น
 *
 * ⚠️ `p2` มีแถวเดียวต่อใบ (วัดจริง 31/31) แต่ `ORDER BY` ของ ROW_NUMBER ต้องมีความหมาย
 * เผื่อวันหน้ามีหลายแถว — ที่นี่เรียงด้วย `work_place1` ให้ผลคงที่ ไม่ใช่หยิบมั่ว
 */
import { siamrajSqlQuery } from './siamrajSqlServer.js';
import { inferJobTypeFromDescription, primaryJobRoleLabel } from './siamrajJobMapping.js';
import { parseAgeRange, formatGenderRequirement } from './siamrajJobMapping.js';
import { normalizeSiamrajWorkAddress } from './siamrajSqlServerRequests.js';
import { type DepartmentScope } from './departmentScope.js';

/** ขึ้นต้น id ของใบขอล่วงหน้า — ห้ามชนกับ `siamraj-sql:` ของใบขอจริง */
export const PREQUEST_ID_PREFIX = 'siamraj-pre:';

export const PREQUEST_MAX_LIMIT = 500;

/** ใบขอล่วงหน้าย้อนหลังแค่ไหน — ชุดเดียวกับใบขอจริง (เจ้าของเคาะ 1 ม.ค. 2567) */
const PREQUEST_MIN_DATE =
  (process.env.SIAMRAJ_OPEN_REQUEST_MIN_DATE || '').trim() || '2024-01-01';

type PrequestRow = {
  prequest_no: string;
  prequest_date: Date | string | null;
  want_date_from: Date | string | null;
  want_date_to: Date | string | null;
  request_qty: number | null;
  customer_name: string | null;
  bu_department_code: string | null;
  department_name: string | null;
  requester_name: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  staff_title_name: string | null;
  job_name_1: string | null;
  job_name_2: string | null;
  request_action_code: string | null;
  request_action_name: string | null;
  age: string | null;
  sex_name: string | null;
  experience: string | null;
  work_place: string | null;
  work_addr: string | null;
  work_detail: string | null;
  work_date: string | null;
  work_time: string | null;
  resign_staff_name: string | null;
  resign_reason: string | null;
  boss_nationality: string | null;
  /** อัตราจ่ายของแถวค่าแรงหลัก — **ไม่ใช่**อัตราเบิก */
  payment_rate: number | null;
  /** หน่วยของอัตรา: M ต่อเดือน · D ต่อวัน · H ต่อชั่วโมง */
  rate_unit: string | null;
  fee_name: string | null;
};

const toYmd = (v: Date | string | null): string | undefined => {
  if (!v) return undefined;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
};

const txt = (v: string | null | undefined): string | undefined => {
  const s = (v ?? '').toString().normalize('NFC').replace(/\u00a0/g, ' ').trim();
  if (!s || /^[-–—.\s]+$/.test(s)) return undefined;
  return s;
};

/**
 * แปลงแถว ERP → รูปเดียวกับใบขอปกติ (`mapSqlServerRow`)
 * ฟิลด์ที่ใบขอล่วงหน้า**ไม่มีจริง** ใส่ค่าที่แปลว่า "ยังไม่มี" ไม่ใช่เดาให้ดูดี:
 *   - แจ้งเข้า/ปิดครบ = 0 เสมอ (ยังไม่เริ่มหาคน)
 *   - ไซต์ = ไม่มี (ยังไม่เปิดไซต์)
 */
function mapPrequestRow(r: PrequestRow) {
  const workSchedule = [txt(r.work_date), txt(r.work_time)].filter(Boolean).join(' • ');
  const roleLabel = primaryJobRoleLabel(r.job_name_1, r.staff_title_name, null);
  const ageRange = parseAgeRange(r.age);
  const qty = Math.max(0, Number(r.request_qty) || 0);
  const no = (r.prequest_no || '').trim();

  return {
    id: `${PREQUEST_ID_PREFIX}${no}`,
    externalId: no,
    source: 'siamraj' as const,
    readOnly: true,
    /** 🔴 ธงบอกว่าเป็นใบขอล่วงหน้า — หน้าจอใช้ติดป้าย และตัวกรองใช้แยกกอง */
    is_prequest: true as const,
    request_no: no,
    submittedByName: txt(r.requester_name),
    request_date: toYmd(r.prequest_date) || new Date().toISOString().slice(0, 10),
    created_at: toYmd(r.prequest_date)
      ? new Date(`${toYmd(r.prequest_date)}T00:00:00.000Z`).toISOString()
      : new Date().toISOString(),
    required_date: toYmd(r.want_date_from) || toYmd(r.prequest_date) || new Date().toISOString().slice(0, 10),
    /** วันสิ้นสุดที่ลูกค้าอยากได้ — ใบขอจริงไม่มีช่องนี้ */
    wanted_until_date: toYmd(r.want_date_to),
    unit_name: txt(r.customer_name) || '—',
    department_code: txt(r.bu_department_code),
    department_name: txt(r.department_name),
    location_address: normalizeSiamrajWorkAddress(r.work_addr) || txt(r.work_place) || '',
    work_place: txt(r.work_place),
    work_schedule: workSchedule || undefined,
    work_detail: txt(r.work_detail),
    contact_name: txt(r.contact_name),
    contact_phone: txt(r.contact_phone),
    boss_nationality: txt(r.boss_nationality),
    resigned_employee_name: txt(r.resign_staff_name),
    resigned_reason: txt(r.resign_reason),
    experience_required: txt(r.experience),
    request_action_code: txt(r.request_action_code),
    request_action_name: txt(r.request_action_name),
    staff_title_name: txt(r.staff_title_name),
    job_description_code_1: roleLabel || txt(r.job_name_1),
    job_description_code_2: txt(r.job_name_2),
    age_range_min: ageRange.min,
    age_range_max: ageRange.max,
    gender_requirement: formatGenderRequirement(r.sex_name),
    // ยังไม่เริ่มหาคน → ขอมาเท่าไหร่ก็เหลือหาเท่านั้น
    request_positions: qty,
    position_units: qty,
    filled_positions: 0,
    cancelled_positions: 0,
    status: 'open' as const,
    urgency: 'advance' as const,
    /**
     * 🔴 อัตราจ่ายดิบ + หน่วย — **ห้ามเอา `total_income` ไปโชว์โดยไม่ดู `rate_unit`**
     * (รายวันมีจริงในฐาน) การคิดรายได้ต่อเดือนใช้ตัวเดียวกับใบขอจริง
     */
    total_income: Number(r.payment_rate) || 0,
    rate_unit: txt(r.rate_unit),
    fee_name: txt(r.fee_name),
    job_type: inferJobTypeFromDescription(r.job_name_1, r.job_name_2, r.staff_title_name, null),
    /**
     * 🔴 ค่าโครงสร้าง ไม่ใช่ของจริง — ERP ไม่มีฟิลด์นี้ และ CHECK ของตาราง `jobs`
     * รับได้แค่ private/government/bank จึงยัด 'private' ไว้ให้ type ผ่าน
     * **ห้ามเอาไปแสดง/ค้นหา** — ราชการ/เอกชนของจริงอยู่ที่ `unit_sector`
     * (แปะโดย `attachUnitSector` · แสดงผ่าน `jobSectorLabel` ที่เดียว)
     */
    job_category: 'private' as const,
    penalty_per_day: 0,
    days_without_worker: 0,
    total_penalty: 0,
  };
}

export type SiamrajPrequest = ReturnType<typeof mapPrequestRow>;

/** คอลัมน์ที่ select — ⚠️ ไม่มี `draw_rate` โดยตั้งใจ (อัตราเบิก ห้ามหลุด) */
const PREQUEST_SELECT = `
    RTRIM(h.prequest_no) AS prequest_no, h.prequest_date, h.want_date_from, h.want_date_to,
    h.request_qty,
    RTRIM(h.customer_name) AS customer_name,
    RTRIM(h.bu_department_code) AS bu_department_code,
    RTRIM(bu_dept.department_name) AS department_name,
    RTRIM(staff.fname) + ' ' + RTRIM(staff.lname) AS requester_name,
    RTRIM(h.contact_name) AS contact_name,
    COALESCE(NULLIF(RTRIM(h.mobile), ''), RTRIM(h.phone)) AS contact_phone,
    RTRIM(st.staff_title_name) AS staff_title_name,
    RTRIM(j1.job_description_name) AS job_name_1,
    RTRIM(j2.job_description_name) AS job_name_2,
    RTRIM(h.request_code) AS request_action_code,
    RTRIM(req.request_name) AS request_action_name,
    RTRIM(p2.age) AS age, RTRIM(sx.sex_name) AS sex_name, RTRIM(p2.experience) AS experience,
    LTRIM(RTRIM(p2.work_place1)) AS work_place,
    LTRIM(RTRIM(
      ISNULL(NULLIF(LTRIM(RTRIM(p2.work_place1)), N''), N'') +
      CASE WHEN NULLIF(LTRIM(RTRIM(p2.work_place2)), N'') IS NOT NULL THEN N' ' + LTRIM(RTRIM(p2.work_place2)) ELSE N'' END +
      CASE WHEN NULLIF(LTRIM(RTRIM(p2.work_place3)), N'') IS NOT NULL THEN N' ' + LTRIM(RTRIM(p2.work_place3)) ELSE N'' END
    )) AS work_addr,
    RTRIM(p2.work_detail1) AS work_detail,
    RTRIM(p2.work_date) AS work_date, RTRIM(p2.work_time) AS work_time,
    LTRIM(RTRIM(p2.replace_detail1)) AS resign_staff_name,
    LTRIM(RTRIM(p2.replace_detail2)) AS resign_reason,
    RTRIM(p2.boss_nationality) AS boss_nationality,
    r.fee_rate AS payment_rate,
    RTRIM(fee.fee_unit_code_1) AS rate_unit,
    RTRIM(fee.fee_name) AS fee_name`;

const PREQUEST_JOINS = `
  INNER JOIN st_prequest_head h ON h.prequest_no = x.prequest_no
  INNER JOIN p2_one p2 ON p2.prequest_no = h.prequest_no
  OUTER APPLY (
    SELECT TOP 1 r0.withdraw_type_code, r0.income1_code, r0.income2_code, r0.fee_code, r0.fee_rate
      FROM st_prequest_p3_rate r0
     WHERE r0.prequest_no = h.prequest_no
     ORDER BY CASE WHEN RTRIM(r0.is_wage) = 'Y' THEN 0 ELSE 1 END, r0.fee_rate DESC
  ) r
  LEFT JOIN wg2_ms_fee fee ON fee.fee_codex = (r.withdraw_type_code + r.income1_code + r.income2_code + r.fee_code)
  LEFT JOIN hr_ms_staff_title st ON st.staff_title_code = h.staff_title_code
  LEFT JOIN hr_ms_job_description_1 j1 ON j1.job_description_code_1 = h.job1_code
  LEFT JOIN hr_ms_job_description_2 j2 ON j2.job_description_code_2 = h.job2_code
  LEFT JOIN st_ms_request req ON req.request_code = h.request_code
  LEFT JOIN ms_sex sx ON sx.sex_code = p2.sex
  LEFT JOIN hr_staff staff ON staff.staff_id = h.staff_id
  LEFT JOIN ms_department bu_dept ON bu_dept.division_code = h.bu_division_code AND bu_dept.department_code = h.bu_department_code`;

/**
 * `p2` แถวเดียวต่อใบ (วัดจริง) — ยังใส่ ROW_NUMBER ไว้เป็นกันชน แต่ **เรียงด้วยค่าจริง**
 * (`work_place1`) ไม่ใช่ `prequest_no` ซึ่งเรียงแล้วไม่ต่างกันเลย = หยิบมั่วถ้ามีหลายแถว
 */
const P2_ONE_CTE = `
  p2_one AS (
    SELECT * FROM (
      SELECT B.*, ROW_NUMBER() OVER (PARTITION BY B.prequest_no ORDER BY B.work_place1, B.work_date) AS rn
        FROM st_prequest_p2 B
    ) t WHERE t.rn = 1
  )`;

export async function listSiamrajSqlServerPrequests(options: {
  limit?: number;
  departmentScope?: DepartmentScope;
} = {}): Promise<SiamrajPrequest[]> {
  const limit = Math.min(Math.max(options.limit ?? 200, 1), PREQUEST_MAX_LIMIT);
  // ⚠️ ใบขอล่วงหน้าเก็บแผนกที่ `bu_department_code` (คนละชื่อกับใบขอจริงที่ใช้ ms_site)
  // จึงเขียนเงื่อนไขเองแทนตัวช่วยกลาง ซึ่งผูกกับ `department_code` ของ ms_site
  const scopeMode = options.departmentScope ?? { mode: 'all' as const };
  const scope =
    scopeMode.mode === 'all'
      ? { sql: '', params: {} as Record<string, string> }
      : scopeMode.mode === 'none'
        ? { sql: 'AND 1 = 0', params: {} as Record<string, string> }
        : {
            sql: 'AND RTRIM(A.bu_department_code) = @scopeDept',
            params: { scopeDept: scopeMode.code } as Record<string, string>,
          };

  const rows = await siamrajSqlQuery<PrequestRow>(
    `
    WITH recent AS (
      SELECT TOP (@limit) A.prequest_no
        FROM st_prequest_head A
       WHERE RTRIM(A.status) = 'A'
         AND ISNULL(RTRIM(A.is_request), 'N') <> 'Y'
         AND A.prequest_date >= CONVERT(datetime, @minDate, 120)
         ${scope.sql}
       ORDER BY A.prequest_date DESC
    ),
    ${P2_ONE_CTE}
    SELECT ${PREQUEST_SELECT}
      FROM recent x
      ${PREQUEST_JOINS}
     ORDER BY h.prequest_date DESC`,
    { limit, minDate: PREQUEST_MIN_DATE, ...scope.params },
  );
  return rows.map(mapPrequestRow);
}

/** เปิดใบเดียวด้วยเลขที่ใบ — ไม่ผ่าน `recent` (เปิดใบเก่ากว่ากรอบวันที่ได้เสมอ) */
export async function getSiamrajSqlServerPrequestById(
  prequestNo: string,
): Promise<SiamrajPrequest | null> {
  const no = prequestNo.startsWith(PREQUEST_ID_PREFIX)
    ? prequestNo.slice(PREQUEST_ID_PREFIX.length)
    : prequestNo;
  if (!no.trim()) return null;
  const rows = await siamrajSqlQuery<PrequestRow>(
    `
    WITH recent AS (SELECT @no AS prequest_no),
    ${P2_ONE_CTE}
    SELECT ${PREQUEST_SELECT}
      FROM recent x
      ${PREQUEST_JOINS}`,
    { no: no.trim() },
  );
  return rows[0] ? mapPrequestRow(rows[0]) : null;
}

export function isPrequestId(id: string): boolean {
  return (id || '').startsWith(PREQUEST_ID_PREFIX);
}
