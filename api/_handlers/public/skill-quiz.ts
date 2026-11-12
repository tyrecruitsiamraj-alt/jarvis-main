/**
 * /api/public/skill-quiz — พนักงานทำแบบทดสอบจากลิงก์ (ไม่ต้องล็อกอิน · เจ้าของ 12 พ.ย. 2569)
 * GET ?token=   → ชื่อชุด/ชื่อพนักงาน/ข้อสอบที่ตัดเฉลยแล้ว · ส่งแล้ว = บอกว่าส่งแล้ว ไม่ส่งข้อสอบ
 * POST { token, answers } → ส่งได้ครั้งเดียว · ส่งแล้ว AI ร่างผลต่อเบื้องหลัง
 * 🔴 ไม่ส่งคะแนนกลับให้พนักงาน — ผลผ่านเจ้าหน้าที่ตรวจก่อนถึงลูกค้า
 */
import { sendError, handleApiError, type ApiReq, type ApiRes } from '../../_lib/http.js';
import { readJsonBody } from '../../_lib/body.js';
import { rateLimitOrReject } from '../../_lib/rateLimit.js';
import { draftQuizWithAi, getQuizAttemptByToken, markQuizOpened, submitQuizAnswers } from '../../_lib/skillQuiz.js';
import { parseQuizAnswers, publicQuestions } from '../../../src/lib/skillQuiz.js';

const TOKEN = /^[A-Za-z0-9_-]{16,40}$/;
const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);

export default async function handler(req: ApiReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  try {
    if (method === 'GET') {
      if (!rateLimitOrReject(req, res, 'public-skill-quiz-get', 60, 10 * 60 * 1000)) return;
      const token = String(one(req.query?.token) ?? '');
      if (!TOKEN.test(token)) return sendError(res, 404, 'not_found', 'ไม่พบแบบทดสอบนี้');
      const a = await getQuizAttemptByToken(token);
      if (!a) return sendError(res, 404, 'not_found', 'ไม่พบแบบทดสอบนี้');
      res.setHeader?.('Cache-Control', 'no-store');
      const head = { title: a.content.title, personName: a.person_name, personRole: a.person_role };
      if (a.submitted_at) return res.status(200).json({ ...head, submitted: true, questions: [] });
      await markQuizOpened(a.id);
      return res.status(200).json({ ...head, submitted: false, questions: publicQuestions(a.content) });
    }
    if (method !== 'POST') return sendError(res, 405, 'Method not allowed');
    if (!rateLimitOrReject(req, res, 'public-skill-quiz-post', 10, 10 * 60 * 1000)) return;
    const body = ((await readJsonBody(req)) ?? {}) as Record<string, unknown>;
    const token = String(body.token ?? '');
    if (!TOKEN.test(token)) return sendError(res, 404, 'not_found', 'ไม่พบแบบทดสอบนี้');
    const a = await getQuizAttemptByToken(token);
    if (!a) return sendError(res, 404, 'not_found', 'ไม่พบแบบทดสอบนี้');
    const parsed = parseQuizAnswers(a.content, body.answers);
    if (!parsed.ok) return sendError(res, 400, 'bad_request', parsed.message);
    if (!(await submitQuizAnswers(a.id, parsed.value))) return sendError(res, 409, 'already_submitted', 'ส่งคำตอบไปแล้ว');
    void draftQuizWithAi(a.id).catch(() => {});
    return res.status(200).json({ ok: true });
  } catch (e) {
    return handleApiError(res, e, 'public-skill-quiz');
  }
}
