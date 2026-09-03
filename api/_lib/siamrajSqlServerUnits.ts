import { siamrajSqlQuery } from './siamrajSqlServer.js';
import { workSiteNameOf } from './siamrajUnitName';
import { sqlServerDepartmentScopeClause, type DepartmentScope } from './departmentScope.js';
import { toBangkokYmd } from './businessDate.js';

/**
 * **รายชื่อหน่วยงานทั้งชุด** สำหรับกล่อง "เลือกหน่วยงานจากบอร์ด" ของหน้า Follow
 *
 * เจ้าของแจ้ง 18 ส.ค. 2569: *"เลือกหน่วยงานได้ แต่ขึ้นไม่ครบทุกหน่วยงานแก้ที"*
 * ต้นเหตุ: กล่องเดิมยุบมาจาก **ใบขอที่ยังเปิด** เท่านั้น = 152 หน่วยงาน
 * แต่งาน Follow ต้องตามเรื่องคนที่ลงงานไปแล้ว ซึ่งใบขอของหน่วยงานนั้น **ปิดไปแล้ว**
 *
 * เจ้าของเลือกขอบเขต: **ทุกหน่วยงานที่มีใบขอตั้งแต่ปี 2567** (วัดจริง ~1,054 หน่วยงาน)
 * ไม่เอาทะเบียนไซต์ทั้งหมด (22,112 ไซต์ รวม BU อื่นอย่าง CR/DB ที่ไม่เกี่ยวกับสรรหา)
 *
 * ⚠️ เส้นนี้ **read-only + อ่านทีเดียวทั้งชุด** — ผูก department scope เหมือนเส้นใบขอ
 * (ห้ามให้คน BU หนึ่งเห็นชื่อลูกค้าของ BU อื่น)
 */
export type SiamrajUnitOption = {
  siteCode: string;
  /** ชื่อที่โชว์ — ลูกค้าตามสัญญาก่อน (ตรงกับที่บอร์ดโชว์) ไม่มีค่อยใช้ชื่อไซต์ */
  unitName: string;
  departmentCode: string | null;
  /** ใบขอที่ยังเปิดของหน่วยงานนี้ */
  openRequests: number;
  /** ใบขอทั้งหมดตั้งแต่ปีที่กำหนด — บอกว่าหน่วยงานนี้ยัง active แค่ไหน */
  totalRequests: number;
  /** วันที่ใบขอล่าสุด (YYYY-MM-DD) — ใช้เรียงและให้คนกวาดตายืนยันว่าใช่หน่วยงานที่คิด */
  lastRequestDate: string | null;
  sampleRequestNo: string | null;
};

type Row = {
  site_code: string | null;
  customer_name: string | null;
  site_name: string | null;
  department_code: string | null;
  open_cnt: number | null;
  total_cnt: number | null;
  last_request_date: Date | string | null;
  sample_request_no: string | null;
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

/** เงื่อนไข "ใบยังเปิด" ชุดเดียวกับที่เส้นใบขอใช้ — ปิด/แจ้งเข้าครบ/ยกเลิก = ไม่เปิด */
const OPEN_CASE_SQL = `
  CASE WHEN (A.is_stop IS NULL OR RTRIM(A.is_stop) <> 'Y')
        AND (A.is_inform_all IS NULL OR RTRIM(A.is_inform_all) <> 'Y')
        AND A.cancel_date IS NULL
       THEN 1 ELSE 0 END`;

export async function listSiamrajSqlServerUnits(options: {
  /** ปี ค.ศ. เริ่มต้น — ค่าเริ่มต้น 2024 (= พ.ศ. 2567 ตามที่เจ้าของเลือก) */
  sinceYear?: number;
  departmentScope?: DepartmentScope;
}): Promise<SiamrajUnitOption[]> {
  const filters = getSqlFilters();
  const clsExclude = excludeClsContractTypeWhere('SS');
  const deptScope = sqlServerDepartmentScopeClause(options.departmentScope ?? { mode: 'all' });
  const year = Number.isFinite(options.sinceYear) ? Number(options.sinceYear) : 2024;
  const fromDate = `${String(Math.min(Math.max(year, 2000), 2100)).padStart(4, '0')}-01-01`;

  const rows = await siamrajSqlQuery<Row>(
    `
    SELECT
      RTRIM(SS.site_code) AS site_code,
      MAX(RTRIM(cst.customer_name)) AS customer_name,
      MAX(RTRIM(SS.site_name))      AS site_name,
      MAX(RTRIM(ISNULL(SS.department_code, ''))) AS department_code,
      SUM(${OPEN_CASE_SQL}) AS open_cnt,
      COUNT_BIG(*)          AS total_cnt,
      MAX(CONVERT(date, A.request_date)) AS last_request_date,
      MAX(RTRIM(A.request_no))           AS sample_request_no
    FROM st_request_head A
    INNER JOIN ms_site SS ON A.site_code = SS.site_code
    OUTER APPLY (
      SELECT TOP 1 z.customer_name FROM st_site_contract_p1 z WHERE z.contract_no = A.contract_no
    ) cst
    WHERE SS.department_code BETWEEN @deptFrom AND @deptTo
      AND A.site_code BETWEEN @siteFrom AND @siteTo
      ${clsExclude}
      ${deptScope.sql}
      AND CONVERT(date, A.request_date) >= @fromDate
    GROUP BY RTRIM(SS.site_code)
    ORDER BY MAX(CONVERT(date, A.request_date)) DESC
  `,
    { ...filters, fromDate, ...deptScope.params },
  );

  return rows
    .map((r) => {
      const siteCode = (r.site_code || '').trim();
      const unitName =
        (r.customer_name || '').trim() || (r.site_name || '').trim() || siteCode || '—';
      return {
        siteCode,
        unitName,
        // จุดทำงานจริง (ตัดหางตำแหน่ง/จำนวนคน) — ตัวเลือกหน่วยงานจะได้ไม่ชี้ผิดสาขา
        workSiteName: workSiteNameOf(r.site_name, unitName),
        departmentCode: (r.department_code || '').trim() || null,
        openRequests: Number(r.open_cnt) || 0,
        totalRequests: Number(r.total_cnt) || 0,
        lastRequestDate: toBangkokYmd(r.last_request_date) || null,
        sampleRequestNo: (r.sample_request_no || '').trim() || null,
      };
    })
    // ไม่มีรหัสไซต์ = ระบุหน่วยงานให้งาน Follow ไม่ได้ (คีย์ของกล่องคือ site_code)
    .filter((u) => u.siteCode);
}
