/**
 * ═══ GET/PUT /api/call-followup-policy — โทรซ้ำคนที่ไม่รับสาย (เจ้าของ 26 ต.ค. 2569) ═══
 * > *"ไม่รับสายแล้วโทรวันถัดไป ขอเป็นโทรใหม่ตอนเที่ยง · ขอหน้าไว้ตั้งเวลาผ่าน UI"* · Choice: ทุกงานที่ AI โทร · Admin แก้
 * - GET: ค่าที่ใช้อยู่ (โทรได้กี่ครั้ง · เวลาโทรซ้ำ)
 * - PUT (admin): `{ maxAttempts, retryTimes }` — ค่าอื่นของนโยบายคงเดิม · จดบันทึกการใช้งานทุกครั้ง
 * ความหมาย/ตัวกรองค่าอยู่ `src/lib/callFollowupPolicy.ts` ที่เดียว · เก็บใน app_call_followup_policy (073)
 */
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { auditFromAuthed } from '../_lib/audit.js';
import { getCallFollowupPolicy, setCallFollowupPolicy } from '../_lib/callFollowupPolicyStore.js';
import { MAX_RETRY_TIMES, normalizeCallFollowupPolicy } from '../../src/lib/callFollowupPolicy.js';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  try {
    if (method === 'GET') {
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(200).json({ policy: await getCallFollowupPolicy() });
    }
    if (method === 'PUT') {
      if (req.user?.role !== 'admin') return sendError(res, 403, 'Forbidden', 'เฉพาะผู้ดูแลระบบที่แก้ได้');
      const raw = await readJsonBody(req);
      if (typeof raw !== 'object' || raw === null) return sendError(res, 400, 'Bad request', 'ข้อมูลไม่ถูกต้อง');
      const body = raw as { maxAttempts?: unknown; retryTimes?: unknown };
      const max = Number(body.maxAttempts);
      if (!Number.isInteger(max) || max < 1 || max > 10) return sendError(res, 400, 'Bad request', 'จำนวนครั้งต้องเป็น 1–10');
      const times = Array.isArray(body.retryTimes) ? body.retryTimes.map((t) => String(t ?? '').trim()) : [];
      if (times.length === 0) return sendError(res, 400, 'Bad request', 'ต้องมีเวลาโทรซ้ำอย่างน้อย 1 เวลา');
      if (times.length > MAX_RETRY_TIMES) return sendError(res, 400, 'Bad request', `ตั้งได้ไม่เกิน ${MAX_RETRY_TIMES} เวลา`);
      if (times.some((t) => !HHMM.test(t))) return sendError(res, 400, 'Bad request', 'เวลาต้องเป็นรูปแบบ ชม.:นาที');
      const before = await getCallFollowupPolicy();
      const next = normalizeCallFollowupPolicy({ ...before, maxAttempts: max, retryTimes: times });
      const saved = await setCallFollowupPolicy(next, req.user?.email ?? null);
      await auditFromAuthed(req, {
        action: 'call-followup-policy.update',
        entityType: 'app_call_followup_policy',
        entityId: 'default',
        before: { maxAttempts: before.maxAttempts, retryTimes: before.retryTimes },
        after: { maxAttempts: saved.maxAttempts, retryTimes: saved.retryTimes },
      });
      return res.status(200).json({ policy: saved });
    }
    res.setHeader?.('Allow', 'GET, PUT');
    return sendError(res, 405, 'Method not allowed');
  } catch (e) {
    return handleApiError(res, e, 'call-followup-policy', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'call-followup-policy');
