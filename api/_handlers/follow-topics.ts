/**
 * "เรื่องที่จะให้โทรติดตาม" (migration 100 · เจ้าของสั่ง 18 ส.ค. 2569)
 *
 * GET  /api/follow-topics → ตัวเลือกทั้งหมด (ทุก role ที่ล็อกอิน — dropdown หน้า Follow ใช้)
 * POST /api/follow-topics → เพิ่มเรื่องใหม่ (supervisor ขึ้นไป — บังคับที่ rbac)
 *
 * ⚠️ ตั้งใจไม่มี DELETE/PATCH — เรื่องถูกอ้างจากรายการติดตามย้อนหลัง (เก็บเป็นข้อความ)
 * ลบตัวเลือกไม่ได้ทำให้รายการเก่าหาย แต่จะทำให้สถิติแยกกลุ่มไม่ตรง · จะเอาออกให้เจ้าของสั่งก่อน
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
import { listFollowTopics, createFollowTopic, parseTopicInput } from '../_lib/followTopics.js';
import { isUniqueViolation } from '../_lib/followStaffContacts.js';

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  try {
    if (method === 'GET') {
      const items = await listFollowTopics();
      return res.status(200).json({ items, total: items.length });
    }

    if (method === 'POST') {
      const parsed = parseTopicInput(await readJsonBody(req));
      if (parsed.error || !parsed.value) {
        return sendError(res, 400, 'Bad request', parsed.error || 'ข้อมูลไม่ถูกต้อง');
      }
      let created;
      try {
        created = await createFollowTopic(parsed.value.name, {
          sub: req.user.sub,
          email: req.user.email ?? null,
        });
      } catch (e) {
        if (isUniqueViolation(e)) {
          return sendError(res, 409, 'Conflict', 'เรื่องนี้มีอยู่ในลิสต์แล้ว');
        }
        throw e;
      }
      await auditFromAuthed(req, {
        action: 'follow.topic.create',
        entityType: 'follow_topic',
        entityId: created.id,
        after: created,
      });
      return res.status(201).json(created);
    }

    return sendError(res, 405, 'Method not allowed');
  } catch (e) {
    return handleApiError(res, e, 'follow-topics', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'follow-topics');
