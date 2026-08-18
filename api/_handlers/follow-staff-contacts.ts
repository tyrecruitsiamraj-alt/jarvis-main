/**
 * รายชื่อ+เบอร์เจ้าหน้าที่ผู้ติดตาม (migration 099 · เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ)
 *
 * GET  /api/follow-staff-contacts → รายชื่อทั้งหมด (ทุก role ที่ล็อกอิน — dropdown หน้า Follow ใช้)
 * POST /api/follow-staff-contacts → เพิ่มชื่อ+เบอร์ (supervisor ขึ้นไป — บังคับที่ rbac)
 *
 * ⚠️ ตั้งใจไม่มี DELETE/PATCH — เบอร์ถูกอ่านให้ผู้สมัครฟังไปแล้วในสายที่โทรออก
 * ลบ/แก้ทีหลังไม่ช่วยอะไรกับสายที่ออกไปแล้ว · จะเอาออกจริงให้เจ้าของสั่งก่อน
 */
import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { auditFromAuthed } from '../_lib/audit.js';
import {
  listStaffContacts,
  createStaffContact,
  parseStaffContactInput,
  isUniqueViolation,
} from '../_lib/followStaffContacts.js';

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  try {
    if (method === 'GET') {
      const items = await listStaffContacts();
      return res.status(200).json({ items, total: items.length });
    }

    if (method === 'POST') {
      const parsed = parseStaffContactInput(await readJsonBody(req));
      if (parsed.error || !parsed.value) {
        return sendError(res, 400, 'Bad request', parsed.error || 'ข้อมูลไม่ถูกต้อง');
      }
      let created;
      try {
        created = await createStaffContact(parsed.value, {
          sub: req.user.sub,
          email: req.user.email ?? null,
        });
      } catch (e) {
        if (isUniqueViolation(e)) {
          return sendError(res, 409, 'Conflict', 'ชื่อ+เบอร์นี้มีอยู่ในรายชื่อแล้ว');
        }
        throw e;
      }
      await auditFromAuthed(req, {
        action: 'follow.staff_contact.create',
        entityType: 'follow_staff_contact',
        entityId: created.id,
        after: created,
      });
      return res.status(201).json(created);
    }

    return sendError(res, 405, 'Method not allowed');
  } catch (e) {
    return handleApiError(res, e, 'follow-staff-contacts', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'follow-staff-contacts');
