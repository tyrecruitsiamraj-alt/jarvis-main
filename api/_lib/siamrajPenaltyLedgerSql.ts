/**
 * ═══ ข้อมูลดิบของสมุดค่าปรับใบขอ + ยอดที่ลูกค้าหักเงินจริง (ERP · อ่านอย่างเดียว · 24 ต.ค. 2569) ═══
 *
 * - ใบขอทุกสถานะ (เปิด/ปิด/Stop/ยกเลิก) ตั้งแต่ `LEDGER_SINCE` ประเภทเดียวกับกล่องงาน (`boardStaffingRequestTypeWhereSql`)
 *   ไม่รวม Cls (รถอย่างเดียว) — ตัวกรองชุดเดียวกับ feed ใบขอ (`siamrajSqlServerRequests.ts`)
 * - คนที่หาได้ = ใบแจ้งเข้าที่ไม่ถูกยกเลิก (`activeInformWhereSql`) · วันเริ่มงาน `st_inform_detail.begin_date` ·
 *   วันคีย์แจ้งเข้า `st_inform_head.record_date`
 * - ลูกค้าหักเงิน = ช่องค่าปรับในใบรับเงิน `ar_cheque_detail.fine_amount` (รวมทุกเรื่องที่ลูกค้าหัก — คนเก่าขาดงานด้วย
 *   ไม่ใช่เฉพาะใบขอ · วัดจริง 24 ต.ค. 2569 เจอหน่วยงานที่ใบขอไม่มีอัตราแต่ถูกหัก) ⇒ ห้ามเอาไปเทียบตรงกับค่าปรับใบขอ
 * แคชในหน่วยความจำ 10 นาทีต่อขอบเขตแผนก — ERP ช้าและข้อมูลย้อนหลังไม่เปลี่ยนบ่อย
 */
import { siamrajSqlQuery } from './siamrajSqlServer.js';
import { activeInformWhereSql, effectiveInformQtySql } from './siamrajStaffingOpen.js';
import { boardStaffingRequestTypeWhereSql, excludeInternalReplacementRoleWhereSql } from './siamrajBoardRequestTypes.js';
import { scopeCacheKey, sqlServerDepartmentScopeClause, type DepartmentScope } from './departmentScope.js';
import { buFromSiteCode } from '../../src/lib/homeBu.js';
import type { PenaltyInform, PenaltyRequestRow } from '../../src/lib/requestPenaltyLedger.js';

/** นับตั้งแต่วันนี้ (เจ้าของ "นับทั้งหมด") — เท่ากับขอบเขตเก่าสุดของ feed ใบขอ */
export const LEDGER_SINCE = (process.env.SIAMRAJ_OPEN_REQUEST_MIN_DATE || '').trim() || '2024-01-01';
const CACHE_MS = 10 * 60_000;

/** ลูกค้าหักเงินรายวัน (วันที่ใบรับเงิน) ต่อไซต์ — หน้าเว็บตัดตามช่วงได้เป๊ะ (24 ต.ค. 2569 · เดิมรายเดือน เทียบช่วงสั้นไม่ได้) */
export type CustomerFineDay = { ymd: string; site: string; bu: string | null; amount: number; receipts: number };
export type PenaltyLedgerRaw = { rows: PenaltyRequestRow[]; informs: PenaltyInform[]; customerFines: CustomerFineDay[]; loadedAt: number };

const cache = new Map<string, PenaltyLedgerRaw>();

function filters() {
  return {
    deptFrom: (process.env.SIAMRAJ_SQL_DEPT_FROM || '_').trim(),
    deptTo: (process.env.SIAMRAJ_SQL_DEPT_TO || 'Z').trim(),
    siteFrom: (process.env.SIAMRAJ_SQL_SITE_FROM || '_').trim(),
    siteTo: (process.env.SIAMRAJ_SQL_SITE_TO || 'Z').trim(),
  };
}
/**
 * ประเภทใบขอ — ตัวกรองชุดเดียวกับ feed กล่องงาน (`listSiamrajSqlServerUnitRequests`): `SIAMRAJ_UNIT_REQUESTS_MODE=all`
 * = ทุกประเภท · อื่น ๆ = เฉพาะประเภทหาคน (24 ต.ค. 2569 — เดิมกรองตายตัว 4 ประเภท เลขเหลือหาไม่ตรงกล่องงาน 137 ใบ)
 */
function requestTypeWhere(): string {
  const mode = (process.env.SIAMRAJ_UNIT_REQUESTS_MODE || 'staffing_queue').toLowerCase();
  return mode === 'all' ? '' : `AND ${boardStaffingRequestTypeWhereSql('A')} AND ${excludeInternalReplacementRoleWhereSql('A')}`;
}
function clsExclude(alias = 'SS'): string {
  const raw = (process.env.SIAMRAJ_SQL_EXCLUDE_CONTRACT_TYPE_C ?? 'true').trim().toLowerCase();
  return raw === 'false' || raw === '0' || raw === 'no' || raw === 'off' ? '' : `AND RTRIM(${alias}.contract_type_code) <> 'C'`;
}

type ReqSqlRow = {
  request_no: string;
  site_code: string;
  unit: string | null;
  position: string | null;
  request_qty: number | null;
  key_ymd: string | null;
  need_ymd: string | null;
  end_ymd: string | null;
  stop_reason: string | null;
  work_date: string | null;
  fine: number | null;
  deduct: number | null;
  eff_informed: number | null;
  is_replace: string | null;
  replace_window: string | null;
};
type InformSqlRow = { request_no: string; start_ymd: string | null; record_ymd: string | null; qty: number | null };
type FineSqlRow = { ymd: string; site_code: string; amount: number; receipts: number };

export async function loadPenaltyLedgerRaw(scope: DepartmentScope): Promise<PenaltyLedgerRaw> {
  const key = scopeCacheKey(scope);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.loadedAt < CACHE_MS) return hit;

  const dept = sqlServerDepartmentScopeClause(scope);
  const params = { since: LEDGER_SINCE, ...filters(), ...dept.params };
  const requestWhere = `
        A.request_date >= CONVERT(datetime, @since, 120)
        AND SS.department_code BETWEEN @deptFrom AND @deptTo
        AND A.site_code BETWEEN @siteFrom AND @siteTo
        ${clsExclude('SS')}
        ${dept.sql}
        ${requestTypeWhere()}`;

  const [reqRows, informRows, fineRows] = await Promise.all([
    siamrajSqlQuery<ReqSqlRow>(
      `SELECT RTRIM(A.request_no) AS request_no, RTRIM(A.site_code) AS site_code,
              COALESCE((SELECT TOP 1 z.customer_name FROM st_site_contract_p1 z WHERE z.contract_no = A.contract_no), SS.site_name) AS unit,
              -- ชื่องานจริง (เช่น พนักงานขับรถ) ก่อน · ไม่มีค่อยใช้คำนำหน้าตำแหน่ง ("พนักงาน" เฉย ๆ บอกอะไรไม่ได้)
              COALESCE(
                NULLIF(LTRIM(RTRIM((SELECT z.job_description_name FROM hr_ms_job_description_1 z WHERE z.job_description_code_1 = A.job_description_code_1))), N''),
                (SELECT z.staff_title_name FROM hr_ms_staff_title z WHERE z.staff_title_code = A.staff_title_code)
              ) AS position,
              A.request_qty,
              CONVERT(varchar(10), A.request_date, 120) AS key_ymd,
              CONVERT(varchar(10), A.want_date_from, 120) AS need_ymd,
              CASE
                WHEN A.status <> 'A' OR ISNULL(A.is_stop, 'N') = 'Y' OR ISNULL(RTRIM(A.stop_no), '') <> ''
                  THEN CONVERT(varchar(10), COALESCE(A.stop_date, A.cancel_date, A.update_date), 120)
                WHEN ISNULL(A.is_inform_all, 'N') = 'Y' THEN CONVERT(varchar(10), A.update_date, 120)
                ELSE NULL
              END AS end_ymd,
              -- เหตุผลที่หยุดใบ (st_ms_stop_by) — กดกล่องยกเลิกแล้วแยกเหตุผล (เจ้าของ 25 ต.ค. 2569)
              (SELECT TOP 1 RTRIM(z.stop_by_name) FROM st_ms_stop_by z WHERE z.stop_by_code = A.stop_code) AS stop_reason,
              B.work_date,
              -- สัญญาให้ส่งคนแทนได้ไหม + ภายในกี่ชั่วโมง (27 ต.ค. 2569 · ส่งคนแทน = ไม่โดนปรับ)
              RTRIM(ISNULL(B.is_replace, '')) AS is_replace,
              NULLIF(LTRIM(RTRIM(B.replace_detail1)), '') AS replace_window,
              P.abs_customer_fine AS fine,
              P.abs_customer_deduct AS deduct,
              ${effectiveInformQtySql('A')} AS eff_informed
         FROM st_request_head A
         INNER JOIN ms_site SS ON SS.site_code = A.site_code
         LEFT JOIN st_request_p2 B ON B.request_no = A.request_no
         LEFT JOIN st_request_p3 P ON P.request_no = A.request_no
        WHERE ${requestWhere}`,
      params,
    ),
    siamrajSqlQuery<InformSqlRow>(
      `SELECT RTRIM(IH.request_no) AS request_no,
              CONVERT(varchar(10), COALESCE(D.begin_date, IH.inform_date), 120) AS start_ymd,
              CONVERT(varchar(10), IH.record_date, 120) AS record_ymd,
              ISNULL(D.inform_qty, 1) AS qty
         FROM st_inform_head IH
         LEFT JOIN st_inform_detail D ON D.inform_no = IH.inform_no
        WHERE ${activeInformWhereSql('IH')}
          AND IH.request_no IN (
            SELECT A.request_no FROM st_request_head A INNER JOIN ms_site SS ON SS.site_code = A.site_code WHERE ${requestWhere}
          )`,
      params,
    ),
    siamrajSqlQuery<FineSqlRow>(
      `SELECT CONVERT(varchar(10), H.cheque_date, 120) AS ymd, RTRIM(D.site_code) AS site_code,
              SUM(D.fine_amount) AS amount, COUNT(DISTINCT D.cheque_no) AS receipts
         FROM ar_cheque_detail D
         INNER JOIN ar_cheque_head H ON H.cheque_no = D.cheque_no
         INNER JOIN ms_site SS ON SS.site_code = D.site_code
        WHERE ISNULL(D.fine_amount, 0) <> 0
          AND H.cheque_date >= CONVERT(datetime, @since, 120)
          AND SS.department_code BETWEEN @deptFrom AND @deptTo
          ${dept.sql}
        GROUP BY CONVERT(varchar(10), H.cheque_date, 120), RTRIM(D.site_code)`,
      params,
    ),
  ]);

  const rows: PenaltyRequestRow[] = [];
  for (const r of reqRows) {
    if (!r.key_ymd) continue;
    rows.push({
      requestNo: r.request_no,
      site: r.site_code,
      bu: buFromSiteCode(r.site_code),
      unit: (r.unit ?? '').trim() || r.site_code,
      position: (r.position ?? '').trim(),
      qty: Number(r.request_qty) || 1,
      keyYmd: r.key_ymd,
      needYmd: r.need_ymd,
      endYmd: r.end_ymd,
      stopReason: (r.stop_reason ?? '').trim() || null,
      workDays: r.work_date,
      finePerDay: Number(r.fine) || 0,
      deductPerDay: Number(r.deduct) || 0,
      replaceAccepted: r.is_replace === 'Y' ? true : r.is_replace === 'N' ? false : null,
      replaceWindow: r.replace_window,
      informedCap: r.eff_informed == null ? null : Number(r.eff_informed) || 0,
    });
  }
  const informs: PenaltyInform[] = informRows
    .filter((i) => i.start_ymd)
    .map((i) => ({
      requestNo: i.request_no,
      startYmd: i.start_ymd as string,
      recordYmd: i.record_ymd ?? (i.start_ymd as string),
      qty: Number(i.qty) || 1,
    }));
  const customerFines: CustomerFineDay[] = fineRows.map((f) => ({
    ymd: f.ymd,
    site: f.site_code,
    bu: buFromSiteCode(f.site_code),
    amount: Math.round(Number(f.amount) * 100) / 100,
    receipts: Number(f.receipts) || 0,
  }));
  const out: PenaltyLedgerRaw = { rows, informs, customerFines, loadedAt: Date.now() };
  cache.set(key, out);
  return out;
}
