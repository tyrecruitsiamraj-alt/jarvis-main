/**
 * /api/public/skill-quiz — พนักงานทำแบบทดสอบจากลิงก์ (ไม่ต้องล็อกอิน · เจ้าของ 12 พ.ย. 2569)
 * GET ?token=   → ชื่อชุด/ชื่อพนักงาน/ข้อสอบที่ตัดเฉลยแล้ว · ส่งแล้ว = บอกว่าส่งแล้ว ไม่ส่งข้อสอบ
 * POST { token, answers } → ส่งได้ครั้งเดียว · ส่งแล้ว AI ร่างผลต่อเบื้องหลัง
 * 🔴 ไม่ส่งคะแนนกลับให้พนักงาน — ผลผ่านเจ้าหน้าที่ตรวจก่อนถึงลูกค้า
 *
 * ลิงก์ของชุด (16 พ.ย. 2569 · แบบ Knowa):
 * GET ?set=                       → ชื่อชุด · ตำแหน่ง · จำนวนข้อ (ไม่ส่งข้อสอบ)
 * POST { action: 'start', set, firstName, lastName, phone, age, citizenId, birthDate, consent } → token ใบของคนนี้
 * POST { action: 'resume', set, citizenId, birthDate } → token ใบเดิม (ตรงทั้งคู่เท่านั้น)
 * เลขบัตรเก็บแบบเข้ารหัส + แฮชไว้ค้น · ทำชุดเดิมได้ครั้งเดียว (ฐานตัดสิน)
 *
 * GET ?image=<uuid> → ตัวรูปของคำถาม/ตัวเลือก (17 พ.ย. 2569) · รหัสสุ่มเดาไม่ได้ · รูปไม่เปลี่ยนจึงเก็บแคชได้ยาว
 */
import { sendError, handleApiError, type ApiReq, type ApiRes } from '../../_lib/http.js';
import { readJsonBody } from '../../_lib/body.js';
import { rateLimitOrReject } from '../../_lib/rateLimit.js';
import {
  draftQuizWithAi,
  findQuizAttemptForResume,
  getQuizAttemptByToken,
  getQuizImage,
  getQuizSetByToken,
  markQuizOpened,
  startQuizAttemptFromSet,
  submitQuizAnswers,
} from '../../_lib/skillQuiz.js';
import { encryptPii, hashPii } from '../../_lib/piiCipher.js';
import { isQuizImageId, parseQuizAnswers, publicQuestions } from '../../../src/lib/skillQuiz.js';
import { parseQuizResumeInput, parseQuizTakerInput } from '../../../src/lib/skillQuizTaker.js';
import { PDPA_CONSENT_REQUIRED_MESSAGE, PDPA_CONSENT_VERSION } from '../../../src/lib/pdpaConsent.js';

const TOKEN = /^[A-Za-z0-9_-]{16,40}$/;
const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const BKK_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' });
const today = () => BKK_DAY.format(new Date());
const NOT_FOUND = 'ไม่พบแบบทดสอบนี้';
const RESUME_MISS = 'ไม่พบข้อมูล ตรวจเลขบัตรและวันเกิดอีกครั้ง';

export default async function handler(req: ApiReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  try {
    if (method === 'GET' && one(req.query?.image) !== undefined) {
      // ทั้งห้องเปิดชุดที่มีรูปหลายสิบรูปพร้อมกันจาก IP เดียวได้ — เพดานสูง
      if (!rateLimitOrReject(req, res, 'public-skill-quiz-image', 3000, 10 * 60 * 1000)) return;
      const id = String(one(req.query?.image) ?? '');
      const img = isQuizImageId(id) ? await getQuizImage(id) : null;
      if (!img) return sendError(res, 404, 'not_found', 'ไม่พบรูป');
      res.setHeader?.('Content-Type', img.mime);
      res.setHeader?.('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader?.('X-Content-Type-Options', 'nosniff');
      return res.status(200).end?.(img.bytes);
    }
    if (method === 'GET' && one(req.query?.set) !== undefined) {
      if (!rateLimitOrReject(req, res, 'public-skill-quiz-get', 60, 10 * 60 * 1000)) return;
      const setToken = String(one(req.query?.set) ?? '');
      const set = TOKEN.test(setToken) ? await getQuizSetByToken(setToken) : null;
      if (!set) return sendError(res, 404, 'not_found', NOT_FOUND);
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(200).json({ title: set.content.title, roleLabel: set.content.roleLabel, questionCount: set.content.questions.length });
    }
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
    // ทั้งห้องอาจทำพร้อมกันจากเน็ตออฟฟิศเดียว (IP เดียว) — เพดานส่ง/เริ่มจึงสูง · เข้าซ้ำ (เดาวันเกิดได้) แยกเพดานต่ำ
    if (!rateLimitOrReject(req, res, 'public-skill-quiz-post', 120, 10 * 60 * 1000)) return;
    const body = ((await readJsonBody(req)) ?? {}) as Record<string, unknown>;
    if (body.action === 'start' || body.action === 'resume') {
      const setToken = String(body.set ?? '');
      const set = TOKEN.test(setToken) ? await getQuizSetByToken(setToken) : null;
      if (!set) return sendError(res, 404, 'not_found', NOT_FOUND);
      if (body.action === 'resume') {
        if (!rateLimitOrReject(req, res, 'public-skill-quiz-resume', 20, 10 * 60 * 1000)) return;
        const r = parseQuizResumeInput(body, today());
        if (!r.ok) return sendError(res, 400, 'bad_request', r.message);
        const token = await findQuizAttemptForResume(set.id, hashPii('skill_quiz', r.value.citizenId), r.value.birthDate);
        if (!token) return sendError(res, 404, 'not_found', RESUME_MISS);
        return res.status(200).json({ token });
      }
      const t = parseQuizTakerInput(body, today());
      if (!t.ok) return sendError(res, 400, 'bad_request', t.message);
      if (body.consent !== true) return sendError(res, 400, 'bad_request', PDPA_CONSENT_REQUIRED_MESSAGE);
      const started = await startQuizAttemptFromSet(
        set.id,
        t.value,
        { hash: hashPii('skill_quiz', t.value.citizenId), enc: encryptPii(t.value.citizenId) },
        PDPA_CONSENT_VERSION,
      );
      if (!started.ok) {
        if (started.reason === 'exists') return sendError(res, 409, 'already_started', 'เลขบัตรนี้ทำชุดนี้แล้ว — กด "เคยกรอกแล้ว" แล้วใส่เลขบัตรกับวันเกิด');
        return sendError(res, 404, 'not_found', NOT_FOUND);
      }
      return res.status(201).json({ token: started.token });
    }
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
