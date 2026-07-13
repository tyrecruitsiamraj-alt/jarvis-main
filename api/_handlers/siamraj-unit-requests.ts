import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import {
  getSiamrajDbSource,
  getSiamrajSchema,
  isSiamrajUnitRequestsEnabled,
  listSiamrajUnitRequests,
  listSiamrajThroughput,
  getSiamrajUnitRequestById,
} from '../_lib/siamrajUnitRequests.js';
import { getSiamrajSqlServerConfig } from '../_lib/siamrajSqlServer.js';
import { getUnitAssignmentsMap } from '../_lib/siamrajUnitAssignments.js';
import { getUnitNotesMap } from '../_lib/siamrajUnitNotes.js';
import { getUnitWorkStatusMap } from '../_lib/siamrajUnitWorkStatus.js';

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
async function attachAssignments(items: unknown[]): Promise<void> {
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

async function attachNotes(items: unknown[]): Promise<void> {
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
    }
  } catch {
    /* หมายเหตุเป็นข้อมูลเสริม */
  }
}

async function attachWorkStatus(items: unknown[]): Promise<void> {
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
      return res.status(200).json({
        enabled: isSiamrajUnitRequestsEnabled(),
        dbSource: getSiamrajDbSource(),
        schema: getSiamrajSchema(),
        sqlServer: getSiamrajSqlServerConfig()
          ? { host: getSiamrajSqlServerConfig()?.server, database: getSiamrajSqlServerConfig()?.database }
          : null,
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

    const id = getQuery(req, 'id');
    if (id) {
      const item = await getSiamrajUnitRequestById(id);
      if (!item) return sendError(res, 404, 'Not found', 'ไม่พบใบขอ');
      await attachAssignments([item]);
      await attachNotes([item]);
      await attachWorkStatus([item]);
      return res.status(200).json(item);
    }

    if (getQuery(req, 'throughput') === '1') {
      const from = getQuery(req, 'from');
      const to = getQuery(req, 'to');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        return sendError(res, 400, 'Bad request', 'ต้องระบุ from และ to เป็น YYYY-MM-DD');
      }
      const items = await listSiamrajThroughput({ from, to });
      return res.status(200).json(items);
    }

    const limit = Number(getQuery(req, 'limit') || '200');
    const mode = getQuery(req, 'mode');
    const items = await listSiamrajUnitRequests({ limit, mode });
    await attachAssignments(items);
    await attachNotes(items);
    await attachWorkStatus(items);
    return res.status(200).json(items);
  } catch (e) {
    return handleApiError(res, e, 'siamraj-unit-requests');
  }
}

export default withRbac(handler, 'siamraj-unit-requests');
