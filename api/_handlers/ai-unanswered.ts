/**
 * ═══ GET/PATCH /api/ai/unanswered — คำถามที่ผู้ช่วย AI ตอบไม่ได้ (เจ้าของ 16 พ.ย. 2569) ═══
 * GET → `{ items }` ที่ยังไม่ได้กด "ดูแล้ว" · PATCH `{ id }` → กด "ดูแล้ว" (ใส่เวลา ไม่ลบแถว)
 * admin เท่านั้น — กล่องอยู่ ตั้งค่า › AI ที่ใช้คิดงาน · ตัวจด `api/_lib/aiAssistant/unanswered.ts`
 */
import { z } from 'zod';
import { withAuth, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { clearUnanswered, listUnanswered } from '../_lib/aiAssistant/unanswered.js';

const Clear = z.object({ id: z.string().regex(/^\d{1,18}$/) });

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  try {
    if (method === 'GET') {
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(200).json({ items: await listUnanswered() });
    }
    if (method === 'PATCH') {
      const parsed = Clear.safeParse(await readJsonBody(req));
      if (!parsed.success) return sendError(res, 400, 'bad_request', 'ไม่รู้ว่าจะกดดูแล้วข้อไหน');
      if (!(await clearUnanswered(parsed.data.id, req.user.email))) return sendError(res, 404, 'not_found', 'ข้อนี้กดดูแล้วไปแล้ว');
      return res.status(200).json({ ok: true });
    }
    res.setHeader?.('Allow', 'GET, PATCH');
    return sendError(res, 405, 'Method not allowed');
  } catch (e) {
    return handleApiError(res, e, 'ai-unanswered', { userId: req.user?.sub });
  }
}

export default withAuth(handler, { roles: ['admin'] });
