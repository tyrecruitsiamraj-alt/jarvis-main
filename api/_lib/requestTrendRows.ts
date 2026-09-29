/**
 * ═══ แถวใบขอ + ใบแจ้งเข้า (ERP ผ่านสำเนา) — ตัวเดียวของแท็บ Dashboard กับหน้าหลัก ═══
 *
 * ย้ายมาจาก `api/_handlers/dashboard-trends.ts` 29 ก.ย. 2569 (ย้ายอย่างเดียว ตรรกะเดิมทุกบรรทัด)
 * เพราะหน้าหลักโฉม 3 ก้อน (ก้อน "ผลงานเดือนนี้") ต้องใช้ **สำเนาชุดเดียวกัน** กับแท็บ Dashboard
 * — คีย์สำเนาผูกกับวันเริ่มอย่างเดียว ⇒ ส่งวันเริ่มเดียวกัน = ใช้สำเนาก้อนเดียว ไม่ยิง ERP เพิ่ม
 */
import { getSiamrajDbSource, listSiamrajThroughput } from './siamrajUnitRequests.js';
import { listSiamrajSqlServerInformDays } from './siamrajSqlServerInforms.js';
import { readThroughSnapshot } from './trendSnapshots.js';
import type { DepartmentScope } from './departmentScope.js';
import { normalizeTrendBu } from '../../src/lib/trends/bu.js';
import type { InformTrendRow, RequestTrendPayload, RequestTrendRow } from '../../src/lib/trends/types.js';

/** สำเนาสดพอ 30 นาที · ส่งของเก่าพร้อมดึงใหม่เบื้องหลังได้ถึง 2 วัน (ของเก่าบอกอายุตรง ๆ เสมอ) */
const REQUEST_TTL_MS = 30 * 60_000;
const REQUEST_MAX_STALE_MS = 48 * 60 * 60_000;

/** ข้อมูลใบขอดึงย้อนตั้งแต่ต้นปีของ 2 ปีก่อน — ตัวเดียวกับแท็บ Dashboard (`requestDataFrom`) ⇒ สำเนาก้อนเดียวกัน */
export function requestTrendDataFrom(todayYmd: string): string {
  return `${Number(todayYmd.slice(0, 4)) - 2}-01-01`;
}

/** ใบขออยู่ในขอบเขตของผู้ใช้ไหม (BU = รหัสแผนกชุดกลาง) */
export function inTrendScope(scope: DepartmentScope, bu: string | null): boolean {
  if (scope.mode === 'all') return true;
  if (scope.mode === 'none') return false;
  return bu === scope.code;
}

async function loadRequestSnapshot(from: string, to: string): Promise<{ requests: RequestTrendRow[]; informs: InformTrendRow[] }> {
  const [records, informs] = await Promise.all([
    listSiamrajThroughput({ from, to, departmentScope: { mode: 'all' } }),
    listSiamrajSqlServerInformDays({ from, to }),
  ]);
  const requests: RequestTrendRow[] = [];
  for (const x of records) {
    if (!x.requestNo || !x.kind || !(x.positionUnits > 0)) continue;
    requests.push({
      requestNo: x.requestNo,
      cohortDate: x.requestDate,
      submittedDate: x.submittedDate ?? null,
      closureDate: x.isOpen ? null : x.closureDate,
      kind: x.kind,
      positions: x.positionUnits,
      departmentCode: normalizeTrendBu(x.departmentCode ?? null),
      siteCode: x.siteCode ?? null,
      unitName: x.unitName ?? null,
      lifecycleKind: x.lifecycleKind ?? null,
      leadKind: x.leadKind ?? null,
    });
  }
  return { requests, informs };
}

/**
 * แถวใบขอ + ใบแจ้งเข้าผ่านสำเนา แล้วกรองด้วย `keep` (BU ของแถว = รหัสแผนกชุดกลาง)
 * ⚠️ ปลายช่วงต้องเผื่อใบขอล่วงหน้า (ผู้เรียกส่ง วันนี้ + 183 วัน) — ตัดที่วันนี้ = ใบที่ต้องการคนเดือนหน้าหายทั้งกอง
 */
export async function loadRequestTrendPayload(
  from: string,
  to: string,
  keep: (bu: string | null) => boolean,
): Promise<RequestTrendPayload> {
  if (getSiamrajDbSource() !== 'sqlserver') {
    throw Object.assign(new Error('ข้อมูลใบขอไม่ได้ต่อกับ ERP (SQL Server) — ดู Dashboard ใบขอไม่ได้'), { status: 503 });
  }
  // 🔴 คีย์ผูกกับวันเริ่มเท่านั้น — ปลายช่วงคือ "วันนี้" เสมอ (ไม่งั้นคีย์เปลี่ยนทุกวันแล้วต้องรอ ERP ใหม่ทุกวัน)
  const key = `requests:v1:${from}`;
  const outcome = await readThroughSnapshot(key, () => loadRequestSnapshot(from, to), {
    ttlMs: REQUEST_TTL_MS,
    maxStaleMs: REQUEST_MAX_STALE_MS,
    rowCount: (v) => v.requests.length + v.informs.length,
  });
  const { requests, informs } = outcome.value;
  return {
    range: { from, to },
    requests: requests.filter((r) => keep(r.departmentCode)),
    informs: informs.filter((r) => keep(normalizeTrendBu(r.departmentCode))),
    fetchedAt: new Date(outcome.fetchedAt).toISOString(),
    ageSeconds: Math.max(0, Math.round((Date.now() - outcome.fetchedAt) / 1000)),
    source: outcome.source,
  };
}
