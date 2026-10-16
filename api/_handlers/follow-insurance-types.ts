/**
 * "ประเภทประกัน" ขั้น 4 ฟอร์มเพิ่มคนติดตาม (migration 149 · เจ้าของสั่ง 16 ต.ค. 2569)
 *
 * GET  /api/follow-insurance-types → ตัวเลือกทั้งหมด (ทุก role ที่ล็อกอิน — dropdown หน้าติดตามใช้)
 * POST /api/follow-insurance-types → เพิ่มประเภทใหม่ (supervisor ขึ้นไป — บังคับที่ rbac)
 *
 * ⚠️ ตั้งใจไม่มี DELETE/PATCH (เหมือน follow-topics) — จะเอาออกให้เจ้าของสั่งก่อน
 */
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { auditFromAuthed } from '../_lib/audit.js';
import {
  createFollowInsuranceType,
  isUndefinedTable,
  listFollowInsuranceTypes,
  parseInsuranceTypeInput,
} from '../_lib/followInsuranceTypes.js';
import { isUniqueViolation } from '../_lib/followStaffContacts.js';

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  try {
    if (method === 'GET') {
      const items = await listFollowInsuranceTypes();
      return res.status(200).json({ items, total: items.length });
    }

    if (method === 'POST') {
      const parsed = parseInsuranceTypeInput(await readJsonBody(req));
      if (parsed.error || !parsed.value) {
        return sendError(res, 400, 'Bad request', parsed.error || 'ข้อมูลไม่ถูกต้อง');
      }
      let created;
      try {
        created = await createFollowInsuranceType(parsed.value.name, {
          sub: req.user.sub,
          email: req.user.email ?? null,
        });
      } catch (e) {
        if (isUniqueViolation(e)) return sendError(res, 409, 'Conflict', 'ประเภทประกันนี้มีอยู่ในลิสต์แล้ว');
        if (isUndefinedTable(e)) {
          return sendError(res, 503, 'Service unavailable', 'ระบบกำลังอัปเดตฐานข้อมูล ลองใหม่อีกครั้งในอีกสักครู่');
        }
        throw e;
      }
      await auditFromAuthed(req, {
        action: 'follow.insurance_type.create',
        entityType: 'follow_insurance_type',
        entityId: created.id,
        after: created,
      });
      return res.status(201).json(created);
    }

    return sendError(res, 405, 'Method not allowed');
  } catch (e) {
    return handleApiError(res, e, 'follow-insurance-types', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'follow-insurance-types');
