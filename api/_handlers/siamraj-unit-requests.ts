import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import {
  getSiamrajDbSource,
  isSiamrajUnitRequestsEnabled,
  listSiamrajUnitRequests,
  listSiamrajThroughput,
  listSiamrajUnits,
  listSiamrajClosedRequests,
  getSiamrajUnitRequestById,
} from '../_lib/siamrajUnitRequests.js';
import { getSiamrajSqlServerConfig } from '../_lib/siamrajSqlServer.js';
import { getUnitAssignmentsMap } from '../_lib/siamrajUnitAssignments.js';
import { getUnitNotesMap } from '../_lib/siamrajUnitNotes.js';
import { getUnitWorkStatusMap } from '../_lib/siamrajUnitWorkStatus.js';
import { loadUserDepartmentScope } from '../_lib/departmentScope.js';
import { enqueuePrecomputeJobs } from '../_lib/matchPrecomputeWorker.js';
import { enrichJobsWithUrgency } from '@/lib/jobUrgency';

function getQuery(req: AuthedReq, key: string): string {
  const v = req.query?.[key];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}

/**
 * แปะผู้รับผิดชอบ (สรรหา/คัดสรร) จาก PostgreSQL ลงในใบขอที่อ่านมาจาก Siamraj (read-only)
 * เป็นข้อมูลเสริม — ถ้าดึงจาก PG ไม่ได้ ปล่อยผ่านโดยไม่ทำให้ feed ล่ม
 */
export async function attachAssignments(items: unknown[]): Promise<void> {
  const list = items as Array<Record<string, unknown>>;
  const keyOf = (it: Record<string, unknown>) =>
    String(it.request_no || it.externalId || it.id || '').trim();
  try {
    const keys = list.map(keyOf).filter(Boolean);
    if (keys.length === 0) return;
    const map = await getUnitAssignmentsMap(keys);
    if (map.size === 0) return;
    for (const it of list) {
      const a = map.get(keyOf(it));
      if (!a) continue;
      it.recruiter_name = a.recruiter_name;
      it.screener_name = a.screener_name;
      it.opl_name = a.opl_name;
    }
  } catch {
    /* ผู้รับผิดชอบเป็นข้อมูลเสริม — ไม่ทำให้ feed หลักล่ม */
  }
}

export async function attachNotes(items: unknown[]): Promise<void> {
  const list = items as Array<Record<string, unknown>>;
  const keyOf = (it: Record<string, unknown>) =>
    String(it.request_no || it.externalId || it.id || '').trim();
  try {
    const keys = list.map(keyOf).filter(Boolean);
    if (keys.length === 0) return;
    const map = await getUnitNotesMap(keys);
    if (map.size === 0) return;
    for (const it of list) {
      const n = map.get(keyOf(it));
      if (!n) continue;
      it.list_note = n.note;
      it.send_replacement = n.send_replacement ?? null;
      it.parser_override_text = n.parser_override_text ?? null;
      // apply field overrides ที่ผู้ใช้แก้เอง (persist) ทับค่าจาก ERP
      const fo = n.field_overrides;
      if (fo) {
        if (fo.age_min !== undefined) it.age_range_min = fo.age_min;
        if (fo.age_max !== undefined) it.age_range_max = fo.age_max;
        if (fo.gender !== undefined && fo.gender !== null) it.gender_requirement = fo.gender;
        if (fo.branches !== undefined) it.branch_override = fo.branches;
        /**
         * ที่อยู่/รายได้/สวัสดิการที่เจ้าหน้าที่แก้เองจากกล่องงาน (17 ส.ค. 2569)
         * ⚠️ ทับเฉพาะเมื่อ**ตั้งค่าไว้จริง** (ไม่ใช่ null) — null แปลว่า "ใช้ค่า ERP"
         * ต่างจาก age/gender ข้างบนที่ null = ล้างค่าโดยตั้งใจ (พฤติกรรมเดิม ห้ามเปลี่ยน)
         */
        if (fo.province) it.override_province = fo.province;
        if (fo.district) it.override_district = fo.district;
        if (fo.subdistrict) it.override_subdistrict = fo.subdistrict;
        if (fo.total_income != null) it.total_income = fo.total_income;
        if (fo.benefits && fo.benefits.length > 0) it.extra_benefits = fo.benefits;
        it.field_overrides = fo;
      }
    }
  } catch {
    /* หมายเหตุเป็นข้อมูลเสริม */
  }
}

export async function attachWorkStatus(items: unknown[]): Promise<void> {
  const list = items as Array<Record<string, unknown>>;
  const keyOf = (it: Record<string, unknown>) =>
    String(it.request_no || it.externalId || it.id || '').trim();
  try {
    const keys = list.map(keyOf).filter(Boolean);
    if (keys.length === 0) return;
    const map = await getUnitWorkStatusMap(keys);
    if (map.size === 0) return;
    for (const it of list) {
      const w = map.get(keyOf(it));
      if (!w) continue;
      it.work_status = w.status;
      it.work_person_first_name = w.person_first_name;
      it.work_person_last_name = w.person_last_name;
      it.work_status_date = w.status_date;
      it.work_persons = w.persons;
    }
  } catch {
    /* สถานะทำงานเป็นข้อมูลเสริม */
  }
}

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();

  try {
    if (method === 'GET') {
      res.setHeader?.('Cache-Control', 'no-store, no-cache, must-revalidate');
    }

    if (method === 'GET' && getQuery(req, 'meta') === '1') {
      // ⚠ ห้ามคืนรายละเอียด infra (host/IP ของ DB, ชื่อ database, schema) ให้ client —
      // เป็นข้อมูล reconnaissance ให้ผู้โจมตี และ frontend ไม่ได้ใช้ค่าพวกนี้เลย
      // คืนแค่ "ต่อ SQL Server ได้ไหม" เป็น boolean พอ
      return res.status(200).json({
        enabled: isSiamrajUnitRequestsEnabled(),
        dbSource: getSiamrajDbSource(),
        sqlServerConfigured: !!getSiamrajSqlServerConfig(),
        postgresFallback: false,
        readOnly: true,
        mode: process.env.SIAMRAJ_UNIT_REQUESTS_MODE || 'staffing_queue',
      });
    }

    if (method !== 'GET') {
      return sendError(res, 405, 'Method not allowed', 'Read-only feed from Siamraj');
    }

    if (!isSiamrajUnitRequestsEnabled()) {
      return sendError(
        res,
        503,
        'Service unavailable',
        'ตั้งค่า SIAMRAJ_SCHEMA / SO_OPERATION_SCHEMA หรือ DB_HOST+DB_USER+DB_NAME บนเซิร์ฟเวอร์ก่อน',
      );
    }

    const departmentScope = await loadUserDepartmentScope(req.user);

    const id = getQuery(req, 'id');
    if (id) {
      // หน้ารายละเอียดต้องเปิดใบที่ปิด/ยกเลิกแล้วได้ (drill-down บน Dashboard ชี้มาที่ใบพวกนี้)
      const item = await getSiamrajUnitRequestById(id, departmentScope, { includeClosed: true });
      if (!item) return sendError(res, 404, 'Not found', 'ไม่พบใบขอ');
      await attachAssignments([item]);
      await attachNotes([item]);
      await attachWorkStatus([item]);
      return res.status(200).json(item);
    }

    /**
     * `?units=1` — รายชื่อหน่วยงานทั้งชุด (read-only) สำหรับกล่องเลือกหน่วยงานหน้า Follow
     * เจ้าของแจ้ง 18 ส.ค. 2569 ว่ากล่องเดิม "ขึ้นไม่ครบ" เพราะยุบมาจากใบขอที่ยังเปิด
     * เท่านั้น (152 หน่วยงาน) · ชุดนี้เอาทุกหน่วยงานที่มีใบขอตั้งแต่ปี 2567 (~1,054)
     * ⚠️ ผูก department scope เหมือนเส้นใบขอ — ห้ามให้คน BU หนึ่งเห็นชื่อลูกค้าของ BU อื่น
     * ⚠️ ไม่เพิ่ม route ใหม่ (โหมดบนเส้นเดิม) — แพตเทิร์นเดียวกับ ?throughput=1 / ?closed=1
     */
    if (getQuery(req, 'units') === '1') {
      const sinceYear = Number(getQuery(req, 'since') || '2024');
      const units = await listSiamrajUnits({
        sinceYear: Number.isFinite(sinceYear) ? sinceYear : 2024,
        departmentScope,
      });
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(200).json({ items: units, total: units.length });
    }

    if (getQuery(req, 'throughput') === '1') {
      const from = getQuery(req, 'from');
      const to = getQuery(req, 'to');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        return sendError(res, 400, 'Bad request', 'ต้องระบุ from และ to เป็น YYYY-MM-DD');
      }
      const items = await listSiamrajThroughput({ from, to, departmentScope });
      return res.status(200).json(items);
    }

    if (getQuery(req, 'closed') === '1') {
      const from = getQuery(req, 'from');
      const to = getQuery(req, 'to');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        return sendError(res, 400, 'Bad request', 'ต้องระบุ from และ to เป็น YYYY-MM-DD');
      }
      const items = await listSiamrajClosedRequests({ from, to, departmentScope });
      // แนบชื่อผู้รับผิดชอบเหมือนเส้นใบเปิด — ไม่งั้น "ปิดแล้ว" ต่อคนใน
      // ภาระงานตามผู้รับผิดชอบ (buildRecruiterOverview) จะเป็น 0 เพราะยอดไปกองที่ "ยังไม่มอบหมาย"
      await attachAssignments(items);
      return res.status(200).json(items);
    }

    const limit = Number(getQuery(req, 'limit') || '200');
    const mode = getQuery(req, 'mode');
    const items = await listSiamrajUnitRequests({ limit, mode, departmentScope });
    await Promise.all([attachAssignments(items), attachNotes(items), attachWorkStatus(items)]);
    // Push ให้ precompute worker — urgency ต้องคิดก่อนเพื่อให้ priority sort ถูกต้อง
    enqueuePrecomputeJobs(enrichJobsWithUrgency(items as Parameters<typeof enrichJobsWithUrgency>[0]));
    return res.status(200).json(items);
  } catch (e) {
    return handleApiError(res, e, 'siamraj-unit-requests');
  }
}

export default withRbac(handler, 'siamraj-unit-requests');
