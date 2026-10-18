/**
 * ═══ /api/pdpa-requests — คำขอใช้สิทธิ์ข้อมูลส่วนบุคคล ฝั่งเจ้าหน้าที่ (เจ้าของเลือกทำ 18 ต.ค. 2569) ═══
 *
 * GET              → รายการคำขอ + จำนวนข้อมูลที่เจอในระบบต่อเบอร์
 * GET ?id=&data=1  → ข้อมูลทั้งหมดของเบอร์นี้ (คำขอต้องยืนยันตัวตนแล้วเท่านั้น)
 * POST             → เจ้าหน้าที่ลงคำขอแทน `{ kind, fullName, phone, detail }` (ขอลบ/คัดค้าน = หยุดโทรทันที)
 * PATCH            → `{ id, action: 'verify' | 'close' | 'reject' | 'erase', note }`
 * สิทธิ์: admin (หน้าตั้งค่า) — ลบข้อมูลย้อนไม่ได้
 */
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { auditFromAuthed } from '../_lib/audit.js';
import {
  collectPdpaPersonData,
  createPdpaRequest,
  erasePdpaPerson,
  getPdpaRequest,
  listPdpaRequests,
  setPdpaRequestStatus,
} from '../_lib/pdpaRequests.js';
import { pdpaActions, validatePdpaRequest } from '../../src/lib/pdpaRequests.js';

const UUID_RE = /^[0-9a-f-]{36}$/i;

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  const byName = req.user.email || req.user.sub;
  try {
    if (method === 'GET') {
      const id = typeof req.query?.id === 'string' ? req.query.id : '';
      if (id) {
        if (!UUID_RE.test(id)) return sendError(res, 400, 'Bad request', 'รหัสคำขอไม่ถูกต้อง');
        const row = await getPdpaRequest(id);
        if (!row) return sendError(res, 404, 'Not found', 'ไม่พบคำขอนี้');
        if (row.status !== 'verified') return sendError(res, 409, 'Conflict', 'ยืนยันตัวตนก่อนถึงจะเปิดดูข้อมูลได้');
        const data = await collectPdpaPersonData(row.phone_e164);
        await auditFromAuthed(req, { action: 'pdpa_request.view_data', entityType: 'pdpa_request', entityId: id });
        return res.status(200).json({ request: row, data });
      }
      return res.status(200).json({ items: await listPdpaRequests() });
    }

    if (method === 'POST') {
      const parsed = validatePdpaRequest(await readJsonBody(req));
      if (!parsed.ok) return sendError(res, 400, 'Bad request', parsed.message);
      const { row, stopped } = await createPdpaRequest(parsed.value, { source: 'staff', byName, clientIp: null });
      await auditFromAuthed(req, {
        action: 'pdpa_request.create',
        entityType: 'pdpa_request',
        entityId: row.id,
        after: { kind: row.kind, source: 'staff', stopped },
      });
      return res.status(201).json({ item: row, stopped });
    }

    if (method === 'PATCH') {
      const raw = await readJsonBody(req);
      const body = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
      const id = typeof body.id === 'string' ? body.id : '';
      const action = body.action;
      const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : null;
      if (!UUID_RE.test(id)) return sendError(res, 400, 'Bad request', 'รหัสคำขอไม่ถูกต้อง');
      const row = await getPdpaRequest(id);
      if (!row) return sendError(res, 404, 'Not found', 'ไม่พบคำขอนี้');
      const allowed = pdpaActions(row.kind, row.status);
      if (action !== 'verify' && action !== 'close' && action !== 'reject' && action !== 'erase') {
        return sendError(res, 400, 'Bad request', 'action ไม่ถูกต้อง');
      }
      if (!allowed.includes(action)) return sendError(res, 409, 'Conflict', 'คำขอนี้ทำแบบนี้ไม่ได้แล้ว โหลดใหม่แล้วลองอีกครั้ง');
      if (action === 'reject' && !note) return sendError(res, 400, 'Bad request', 'บอกเหตุผลที่ไม่ดำเนินการ');

      let updated = null;
      let erased: Record<string, number> | null = null;
      if (action === 'verify') updated = await setPdpaRequestStatus(id, ['received'], 'verified', byName, null);
      if (action === 'close') updated = await setPdpaRequestStatus(id, ['verified'], 'done', byName, note);
      if (action === 'reject') updated = await setPdpaRequestStatus(id, ['received', 'verified'], 'rejected', byName, note);
      if (action === 'erase') {
        erased = await erasePdpaPerson(id, byName);
        updated = erased ? await getPdpaRequest(id) : null;
      }
      if (!updated) return sendError(res, 409, 'Conflict', 'คำขอนี้ถูกเปลี่ยนไปแล้ว โหลดใหม่แล้วลองอีกครั้ง');
      await auditFromAuthed(req, {
        action: `pdpa_request.${action}`,
        entityType: 'pdpa_request',
        entityId: id,
        before: { status: row.status },
        after: { status: updated.status, erased },
      });
      return res.status(200).json({ item: updated, erased });
    }

    return sendError(res, 405, 'Method not allowed', 'GET / POST / PATCH เท่านั้น');
  } catch (e) {
    return handleApiError(res, e, 'pdpa-requests');
  }
}

export default withRbac(handler, 'pdpa-requests');
