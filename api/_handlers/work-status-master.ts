import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody, getString } from '../_lib/body.js';
import { auditFromAuthed } from '../_lib/audit.js';
import {
  listWorkStatusMaster,
  createWorkStatus,
  updateWorkStatus,
  deleteWorkStatus,
  countWorkStatusUsage,
} from '../_lib/workStatusMaster.js';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function getQuery(req: AuthedReq, key: string): string {
  const v = req.query?.[key];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}

/**
 * Master "สถานะทำงาน" ของใบขอ
 * GET   — ทุก role ที่ login (dropdown ทั้งระบบต้องใช้) พร้อมจำนวนใบขอที่ใช้อยู่
 * POST/PATCH/DELETE — admin เท่านั้น (บังคับที่ rbac: resource นี้ write = admin)
 */
async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();

  try {
    if (method === 'GET') {
      const items = await listWorkStatusMaster();
      // แนบจำนวนใบขอที่ใช้อยู่ ให้หน้าตั้งค่าบอกได้ว่าตัวไหนลบไม่ได้เพราะมีคนใช้
      const withUsage = await Promise.all(
        items.map(async (it) => ({
          ...it,
          usage: await countWorkStatusUsage(it.code).catch(() => 0),
        })),
      );
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(200).json({ items: withUsage });
    }

    if (method === 'POST') {
      const raw = await readJsonBody(req);
      if (!isPlainObject(raw)) return sendError(res, 400, 'Bad request', 'Invalid JSON body');
      const item = await createWorkStatus({
        code: raw.code,
        label: raw.label,
        dateLabel: raw.date_label ?? raw.dateLabel,
        sortOrder: raw.sort_order ?? raw.sortOrder,
      });
      await auditFromAuthed(req, {
        action: 'work_status_master.create',
        entityType: 'work_status_master',
        entityId: item.code,
        after: { label: item.label, sort_order: item.sort_order },
      });
      return res.status(200).json({ item });
    }

    if (method === 'PATCH') {
      const raw = await readJsonBody(req);
      if (!isPlainObject(raw)) return sendError(res, 400, 'Bad request', 'Invalid JSON body');
      const code = getString(raw.code) || getQuery(req, 'code');
      if (!code) return sendError(res, 400, 'Bad request', 'code is required');
      const item = await updateWorkStatus(code, {
        label: raw.label,
        dateLabel: raw.date_label ?? raw.dateLabel,
        sortOrder: raw.sort_order ?? raw.sortOrder,
        isActive: raw.is_active ?? raw.isActive,
      });
      if (!item) return sendError(res, 404, 'Not found', 'ไม่พบสถานะนี้');
      await auditFromAuthed(req, {
        action: 'work_status_master.update',
        entityType: 'work_status_master',
        entityId: item.code,
        after: { label: item.label, is_active: item.is_active, sort_order: item.sort_order },
      });
      return res.status(200).json({ item });
    }

    if (method === 'DELETE') {
      const code = getQuery(req, 'code');
      if (!code) return sendError(res, 400, 'Bad request', 'code query is required');
      const result = await deleteWorkStatus(code);
      if (!result.ok) {
        if (result.reason === 'not_found') return sendError(res, 404, 'Not found', 'ไม่พบสถานะนี้');
        if (result.reason === 'builtin') {
          return sendError(
            res,
            409,
            'Conflict',
            'สถานะพื้นฐานของระบบลบไม่ได้ (ระบบนับตัวเลขจากสถานะนี้) — ปิดใช้งานได้แทน',
          );
        }
        return sendError(
          res,
          409,
          'Conflict',
          `มีใบขอ ${result.usage} ใบใช้สถานะนี้อยู่ ลบไม่ได้ — ปิดใช้งานเพื่อซ่อนจากตัวเลือกได้`,
        );
      }
      await auditFromAuthed(req, {
        action: 'work_status_master.delete',
        entityType: 'work_status_master',
        entityId: code,
      });
      return res.status(200).json({ ok: true });
    }

    res.setHeader?.('Allow', 'GET, POST, PATCH, DELETE');
    return sendError(res, 405, 'Method not allowed');
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (/ต้องระบุ|ต้องเป็น|ว่างไม่ได้|nothing to update|is required/.test(message)) {
      return sendError(res, 400, 'Bad request', message);
    }
    if (/duplicate key|unique/i.test(message)) {
      return sendError(res, 409, 'Conflict', 'มีรหัสสถานะนี้อยู่แล้ว');
    }
    return handleApiError(res, e, 'work-status-master', { userId: req.user.sub });
  }
}

export default withRbac(handler, 'work-status-master');
