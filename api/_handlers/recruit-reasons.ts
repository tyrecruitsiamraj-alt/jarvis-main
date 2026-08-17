import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import {
  listRecruitReasons,
  createRecruitReason,
  updateRecruitReason,
  deactivateRecruitReason,
} from '../_lib/recruitReasons.js';

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
 * master "เหตุผล" ของงานสรรหา (RM) — ปุ่ม "เหตุผล"
 * GET    — ทุก role ที่ล็อกอิน (ตอนบันทึกผลติดต่อต้องเลือกเหตุผล)
 * POST/PATCH/DELETE — หัวหน้างานขึ้นไป (บังคับที่ rbac)
 *
 * ⚠️ DELETE = **ปิดการใช้งาน ไม่ลบทิ้ง** — เหตุผลถูกอ้างจากผลติดต่อย้อนหลัง
 */
async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  try {
    if (method === 'GET') {
      return res.status(200).json(
        await listRecruitReasons({
          includeInactive: getQuery(req, 'all') === '1',
          processCode: getQuery(req, 'process'),
          outcomeCode: getQuery(req, 'outcome'),
        }),
      );
    }

    if (method === 'POST') {
      const body = await readJsonBody(req);
      if (!isPlainObject(body)) return sendError(res, 400, 'Bad request');
      return res.status(201).json(
        await createRecruitReason({
          processCode: body.processCode,
          outcomeCode: body.outcomeCode,
          name: body.name,
          sortOrder: body.sortOrder,
        }),
      );
    }

    if (method === 'PATCH') {
      const body = await readJsonBody(req);
      if (!isPlainObject(body)) return sendError(res, 400, 'Bad request');
      const id = typeof body.id === 'string' ? body.id : getQuery(req, 'id');
      if (!id) return sendError(res, 400, 'Bad request', 'ต้องระบุ id');
      const updated = await updateRecruitReason(id, {
        name: body.name,
        sortOrder: body.sortOrder,
        isActive: body.isActive,
      });
      if (!updated) return sendError(res, 404, 'Not found', 'ไม่พบเหตุผลนี้');
      return res.status(200).json(updated);
    }

    if (method === 'DELETE') {
      const id = getQuery(req, 'id');
      if (!id) return sendError(res, 400, 'Bad request', 'ต้องระบุ id');
      const off = await deactivateRecruitReason(id);
      if (!off) return sendError(res, 404, 'Not found', 'ไม่พบเหตุผลนี้');
      return res.status(200).json(off);
    }

    return sendError(res, 405, 'Method not allowed');
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (/ชื่อ|เหตุผล|ขั้นตอน|ผลของ|ระบุ/.test(msg)) return sendError(res, 400, 'Bad request', msg);
    return handleApiError(res, e, 'recruit-reasons', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'recruit-reasons');
