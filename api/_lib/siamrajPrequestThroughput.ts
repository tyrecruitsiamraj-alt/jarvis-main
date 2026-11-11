/**
 * ═══ ใบขอชั่วคราว (ใบขอล่วงหน้า `st_prequest_*`) ในข้อมูลแนวโน้มของศูนย์ควบคุมใบขอ ═══
 * เจ้าของ 11 พ.ย. 2569 "เอาแบบนับรวมเหมือนหน้าหลัก" — เข้ามา/หาได้/ยกเลิก/เหลือหา นับใบชั่วคราวเหมือนสมุดใบขอหน้าหลัก
 * (`siamrajPenaltyLedgerSql.ts` · `requestFlowRole`): เปิดอยู่ = เหลือหา · ERP ปิด/แปลงเป็นใบจริง = จบ ไม่มีคนหาได้ ⇒ อัตราเป็นยกเลิก
 * งวด = วันที่ต้องการคน (ฐานเดียวกับใบจริงในหน้านี้) · ไม่มีวันที่ต้องการ = วันคีย์
 * 🔴 คีย์ใบ = `ชั่วคราว <เลขที่>` / `siamraj-pre:<เลขที่>` — เลขที่ซ้ำใบจริงได้ ห้ามใช้เลขเปล่า
 */
import { siamrajSqlQuery } from './siamrajSqlServer.js';
import { sqlServerCodesClause, type DepartmentScope } from './departmentScope.js';
import { PREQUEST_LEDGER_PREFIX } from '../../src/lib/requestPenaltyLedger.js';
import { requestLeadKindFromYmd } from '../../src/lib/requestLeadKind.js';
import type { SiamrajThroughputRecord } from './siamrajSqlServerThroughput.js';

type Row = {
  prequest_no: string;
  bu: string | null;
  unit: string | null;
  request_qty: number | null;
  key_ymd: string | null;
  need_ymd: string | null;
  end_ymd: string | null;
};

export function prequestThroughputRecord(r: Row): SiamrajThroughputRecord | null {
  const no = (r.prequest_no ?? '').trim();
  const cohort = r.need_ymd || r.key_ymd;
  if (!no || !cohort) return null;
  const open = r.end_ymd == null;
  return {
    requestNo: `${PREQUEST_LEDGER_PREFIX}${no}`,
    jobId: `siamraj-pre:${no}`,
    requestNoDisplay: no,
    unitName: (r.unit ?? '').trim() || undefined,
    departmentCode: (r.bu ?? '').trim() || undefined,
    requiredDate: r.need_ymd,
    submittedDate: r.key_ymd,
    leadKind: r.key_ymd ? requestLeadKindFromYmd(r.key_ymd, r.need_ymd) : undefined,
    requestDate: cohort,
    closureDate: open ? null : r.end_ymd,
    positionUnits: Math.max(1, Number(r.request_qty) || 1),
    isOpen: open,
    kind: open ? 'remaining' : 'cancelled',
    lifecycleKind: 'other',
  };
}

export async function listPrequestThroughput(options: { from: string; to: string; departmentScope?: DepartmentScope }): Promise<SiamrajThroughputRecord[]> {
  const scope = options.departmentScope ?? { mode: 'all' as const };
  if (scope.mode === 'none') return [];
  const dept = scope.mode === 'all' ? { sql: '', params: {} as Record<string, string> } : sqlServerCodesClause(scope, 'RTRIM(h.bu_department_code)');
  const rows = await siamrajSqlQuery<Row>(
    `SELECT RTRIM(h.prequest_no) AS prequest_no, RTRIM(h.bu_department_code) AS bu,
            NULLIF(LTRIM(RTRIM(h.customer_name)), N'') AS unit,
            h.request_qty,
            CONVERT(varchar(10), h.prequest_date, 120) AS key_ymd,
            CONVERT(varchar(10), h.want_date_from, 120) AS need_ymd,
            CASE WHEN RTRIM(h.status) <> 'A' OR ISNULL(RTRIM(h.is_request), 'N') = 'Y'
                 THEN CONVERT(varchar(10), COALESCE(h.update_date, h.record_date, h.prequest_date), 120) END AS end_ymd
       FROM st_prequest_head h
      WHERE COALESCE(h.want_date_from, h.prequest_date) >= CONVERT(datetime, @from, 120)
        AND COALESCE(h.want_date_from, h.prequest_date) < DATEADD(day, 1, CONVERT(datetime, @to, 120))
        ${dept.sql}`,
    { from: options.from, to: options.to, ...dept.params },
  );
  return rows.map(prequestThroughputRecord).filter((r): r is SiamrajThroughputRecord => r !== null);
}
