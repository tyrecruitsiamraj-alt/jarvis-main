/**
 * ═══ GET/PUT /api/bu-line-ids — แอดไลน์ประจำ BU ในข้อความประกาศ (เจ้าของ 13 พ.ย. 2569) ═══
 * - GET: ทุก BU ที่ตั้งไว้ `{ ids: { LBD: '@xxx' } }` (คนทำประกาศต้องอ่านได้ — ร่างข้อความใช้)
 * - PUT (admin): `{ bu, lineId }` · lineId ว่าง = ลบ · จดบันทึกการใช้งานทุกครั้ง
 */
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { auditFromAuthed } from '../_lib/audit.js';
import { getBuLineIds, setBuLineId } from '../_lib/buLineIds.js';
import { isLineBu, normalizeLineId } from '../../src/lib/buLineIds.js';

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  try {
    if (method === 'GET') {
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(200).json({ ids: await getBuLineIds() });
    }
    if (method === 'PUT') {
      if (req.user?.role !== 'admin') return sendError(res, 403, 'Forbidden', 'เฉพาะผู้ดูแลระบบที่แก้ได้');
      const body = (await readJsonBody(req)) as { bu?: unknown; lineId?: unknown } | null;
      const bu = typeof body?.bu === 'string' ? body.bu.trim().toUpperCase() : '';
      if (!isLineBu(bu)) return sendError(res, 400, 'Bad request', 'ไม่รู้จัก BU นี้');
      const lineId = normalizeLineId(body?.lineId);
      if (lineId === 'invalid') return sendError(res, 400, 'Bad request', 'ID LINE ใช้ได้แค่ตัวอังกฤษ ตัวเลข . _ - และ @ หน้าสุด');
      const before = (await getBuLineIds())[bu] ?? null;
      await setBuLineId(bu, lineId, req.user?.email ?? null);
      await auditFromAuthed(req, { action: 'bu-line-id.update', entityType: 'bu_line_ids', entityId: bu, before: { lineId: before }, after: { lineId } });
      return res.status(200).json({ ids: await getBuLineIds() });
    }
    res.setHeader?.('Allow', 'GET, PUT');
    return sendError(res, 405, 'Method not allowed');
  } catch (e) {
    return handleApiError(res, e, 'bu-line-ids', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'job-applications');
