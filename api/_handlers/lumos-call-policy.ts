/**
 * นโยบายการโทรตาม — GET อ่านได้ทุกคนที่เห็นหน้า Follow · PUT เฉพาะ admin
 *
 * เจ้าของขอตั้งเองได้ว่า "คนนึงจะโทรกี่ครั้ง และโทรช่วงเวลากี่โมงบ้าง"
 * ความหมายของค่าอยู่ที่ src/lib/callFollowupPolicy.ts + migrations/073
 * (แพตเทิร์นเดียวกับ lumos-dispatch-mode.ts ทุกอย่าง)
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
import { isPgUndefinedTable } from '../_lib/postgres.js';
import { getCallFollowupPolicy, setCallFollowupPolicy } from '../_lib/callFollowupPolicyStore.js';
import { normalizeCallFollowupPolicy } from '../../src/lib/callFollowupPolicy.js';

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();

  try {
    if (method === 'GET') {
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(200).json({ policy: await getCallFollowupPolicy() });
    }

    if (method === 'PUT') {
      // แก้ได้เฉพาะ admin — ค่าพวกนี้คุมว่าระบบโทรหาคนจริงบ่อยแค่ไหน/กี่โมง
      if (req.user?.role !== 'admin') {
        return sendError(res, 403, 'Forbidden', 'เฉพาะผู้ดูแลระบบที่แก้นโยบายการโทรได้');
      }
      const raw = await readJsonBody(req);
      if (typeof raw !== 'object' || raw === null) {
        return sendError(res, 400, 'Bad request', 'Invalid JSON body');
      }
      const body = raw as Record<string, unknown>;
      const before = await getCallFollowupPolicy();
      // normalize บีบทุกช่องเข้าขอบเขตที่สมเหตุสมผล — ค่าเพี้ยนได้ช่องนั้นเป็นค่าเริ่มต้น
      const next = normalizeCallFollowupPolicy(body.policy ?? body);

      const saved = await setCallFollowupPolicy(next, req.user?.email ?? null);

      // เพดานโทร/ช่วงเวลามีผลกับการโทรหาคนจริง — ต้องรู้ว่าใครเปลี่ยนเมื่อไหร่
      void auditFromAuthed(req, {
        action: 'call-followup-policy.update',
        entityType: 'app_call_followup_policy',
        entityId: 'default',
        before,
        after: saved,
      });

      return res.status(200).json({ policy: saved });
    }

    res.setHeader?.('Allow', 'GET, PUT');
    return sendError(res, 405, 'Method not allowed');
  } catch (e) {
    if (isPgUndefinedTable(e)) {
      // ยังไม่ migrate — GET ไม่เข้าทางนี้ (store กลืนให้แล้ว) เหลือแต่ PUT
      return sendError(
        res,
        503,
        'Service unavailable',
        'ยังไม่ได้สร้างตารางนโยบายการโทร — migration จะรันเองตอน deploy รอบถัดไป',
      );
    }
    return handleApiError(res, e, 'lumos-call-policy', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'follow');
