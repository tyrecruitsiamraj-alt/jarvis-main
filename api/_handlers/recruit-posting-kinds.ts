import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import {
  createRecruitPostingKind,
  listRecruitPostingKinds,
  updateRecruitPostingKind,
} from '../_lib/recruitPostingKinds.js';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * ประเภทกล่องลอย (เจ้าของสั่ง 14 ต.ค. 2569 "ทำหน้าจัดการประเภทกล่องในตั้งค่าบอร์ด")
 * GET ?all=1 รวมที่ปิดแล้ว · POST เพิ่ม {label} · PATCH {code, label?, isActive?} — สิทธิ์ชุดเดียวกับ "เหตุผล" (staff ขึ้นไป)
 * ไม่มี DELETE — ปิดใช้งานแทน (ประกาศเก่าอ้างรหัสอยู่)
 */
async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  const actor = req.user?.email ?? null;
  try {
    if (method === 'GET') {
      const all = req.query?.all === '1';
      return res.status(200).json(await listRecruitPostingKinds({ includeInactive: all }));
    }
    if (method === 'POST') {
      const body = await readJsonBody(req);
      if (!isPlainObject(body)) return sendError(res, 400, 'Bad request');
      return res.status(201).json(await createRecruitPostingKind({ label: body.label }, actor));
    }
    if (method === 'PATCH') {
      const body = await readJsonBody(req);
      if (!isPlainObject(body) || typeof body.code !== 'string') return sendError(res, 400, 'Bad request', 'ต้องระบุรหัสประเภท');
      const updated = await updateRecruitPostingKind(body.code, { label: body.label, isActive: body.isActive }, actor);
      if (!updated) return sendError(res, 404, 'Not found', 'ไม่พบประเภทกล่องนี้');
      return res.status(200).json(updated);
    }
    return sendError(res, 405, 'Method not allowed');
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (/ประเภทกล่อง|ไม่มีอะไรให้แก้/.test(msg)) return sendError(res, 400, 'Bad request', msg);
    return handleApiError(res, e, 'recruit-posting-kinds', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'recruit-reasons');
