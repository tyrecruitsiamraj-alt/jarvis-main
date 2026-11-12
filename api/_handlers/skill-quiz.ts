/**
 * /api/skill-quiz — หน้าแบบทดสอบพนักงานของเจ้าหน้าที่ (เจ้าของ 12 พ.ย. 2569)
 * GET              → รายการลิงก์/ผล (สรุปคะแนนจากตัวตัดสินเดียว `scoreQuiz`)
 * GET ?view=sets   → ชุดข้อสอบ
 * GET ?id=         → ผลของคนหนึ่งคน (มีเฉลย/คำตอบ/บทวิเคราะห์)
 * POST { action }  → create_set · update_set · archive_set · create_link · save_review · ai_draft · archive_attempt
 */
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { auditFromAuthed } from '../_lib/audit.js';
import {
  archiveQuizAttempt,
  archiveQuizSet,
  createQuizAttempt,
  createQuizSet,
  draftQuizWithAi,
  getQuizAttempt,
  listQuizAttempts,
  listQuizSets,
  saveQuizReview,
  updateQuizSet,
} from '../_lib/skillQuiz.js';
import { parseQuizAnalysis, parseQuizSetInput, parseStaffTextScores, quizAttemptStatus, scoreQuiz } from '../../src/lib/skillQuiz.js';

const UUID = /^[0-9a-f-]{36}$/i;
const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  const byName = req.user?.email ?? null;
  try {
    if (method === 'GET') {
      res.setHeader?.('Cache-Control', 'no-store');
      if (one(req.query?.view) === 'sets') return res.status(200).json({ sets: await listQuizSets() });
      const id = String(one(req.query?.id) ?? '');
      if (id) {
        if (!UUID.test(id)) return sendError(res, 400, 'bad_request', 'id ไม่ถูกต้อง');
        const a = await getQuizAttempt(id);
        if (!a) return sendError(res, 404, 'not_found', 'ไม่พบผลนี้');
        return res.status(200).json({ attempt: a });
      }
      const rows = await listQuizAttempts();
      return res.status(200).json({
        attempts: rows.map((a) => {
          const r = a.answers ? scoreQuiz(a.content, a.answers, a.text_scores ?? {}) : null;
          return {
            id: a.id,
            token: a.token,
            doc_no: a.doc_no,
            person_name: a.person_name,
            person_role: a.person_role,
            title: a.content.title,
            status: quizAttemptStatus(a),
            score: r?.score ?? null,
            grade: r?.grade ?? null,
            created_at: a.created_at,
            opened_at: a.opened_at,
            submitted_at: a.submitted_at,
          };
        }),
      });
    }
    if (method !== 'POST') {
      res.setHeader?.('Allow', 'GET, POST');
      return sendError(res, 405, 'Method not allowed');
    }
    const body = ((await readJsonBody(req)) ?? {}) as Record<string, unknown>;
    const action = String(body.action ?? '');
    const id = str(body.id, 40);
    if (action === 'create_set' || action === 'update_set') {
      const parsed = parseQuizSetInput(body.content);
      if (!parsed.ok) return sendError(res, 400, 'bad_request', parsed.message);
      if (action === 'create_set') {
        const newId = await createQuizSet(parsed.value, byName);
        void auditFromAuthed(req, { action: 'skill_quiz.set_create', entityType: 'skill_quiz_set', entityId: newId, after: { title: parsed.value.title } }).catch(() => {});
        return res.status(201).json({ id: newId });
      }
      if (!UUID.test(id)) return sendError(res, 400, 'bad_request', 'id ไม่ถูกต้อง');
      if (!(await updateQuizSet(id, parsed.value, byName))) return sendError(res, 404, 'not_found', 'ไม่พบชุดข้อสอบนี้');
      void auditFromAuthed(req, { action: 'skill_quiz.set_update', entityType: 'skill_quiz_set', entityId: id, after: { title: parsed.value.title } }).catch(() => {});
      return res.status(200).json({ id });
    }
    if (action === 'archive_set') {
      if (!UUID.test(id)) return sendError(res, 400, 'bad_request', 'id ไม่ถูกต้อง');
      if (!(await archiveQuizSet(id))) return sendError(res, 404, 'not_found', 'ไม่พบชุดข้อสอบนี้');
      void auditFromAuthed(req, { action: 'skill_quiz.set_archive', entityType: 'skill_quiz_set', entityId: id }).catch(() => {});
      return res.status(200).json({ ok: true });
    }
    if (action === 'create_link') {
      const setId = str(body.setId, 40);
      const name = str(body.personName, 200);
      if (!UUID.test(setId)) return sendError(res, 400, 'bad_request', 'เลือกชุดข้อสอบ');
      if (!name) return sendError(res, 400, 'bad_request', 'ใส่ชื่อพนักงาน');
      const a = await createQuizAttempt(setId, { name, role: str(body.personRole, 200) }, byName);
      if (!a) return sendError(res, 404, 'not_found', 'ไม่พบชุดข้อสอบนี้');
      void auditFromAuthed(req, { action: 'skill_quiz.link_create', entityType: 'skill_quiz_attempt', entityId: a.id, after: { doc_no: a.doc_no } }).catch(() => {});
      return res.status(201).json({ id: a.id, token: a.token, doc_no: a.doc_no });
    }
    if (!UUID.test(id)) return sendError(res, 400, 'bad_request', 'id ไม่ถูกต้อง');
    if (action === 'save_review') {
      const a = await getQuizAttempt(id);
      if (!a || !a.submitted_at) return sendError(res, 409, 'not_submitted', 'พนักงานยังไม่ได้ส่งคำตอบ');
      const textScores = parseStaffTextScores(a.content, body.textScores, a.text_scores ?? {});
      const reviewed = body.reviewed === true;
      if (reviewed && scoreQuiz(a.content, a.answers ?? {}, textScores).pendingText > 0) {
        return sendError(res, 400, 'bad_request', 'ให้คะแนนข้อเขียนตอบให้ครบก่อน');
      }
      await saveQuizReview(id, { textScores, analysis: parseQuizAnalysis(body.analysis), reviewed }, byName);
      void auditFromAuthed(req, { action: 'skill_quiz.review', entityType: 'skill_quiz_attempt', entityId: id, after: { reviewed } }).catch(() => {});
      return res.status(200).json({ attempt: await getQuizAttempt(id) });
    }
    if (action === 'ai_draft') {
      const r = await draftQuizWithAi(id);
      if (!r.ok) return sendError(res, 502, 'ai_failed', r.message);
      return res.status(200).json({ attempt: await getQuizAttempt(id) });
    }
    if (action === 'archive_attempt') {
      if (!(await archiveQuizAttempt(id))) return sendError(res, 404, 'not_found', 'ไม่พบลิงก์นี้');
      void auditFromAuthed(req, { action: 'skill_quiz.link_archive', entityType: 'skill_quiz_attempt', entityId: id }).catch(() => {});
      return res.status(200).json({ ok: true });
    }
    return sendError(res, 400, 'bad_request', 'action ไม่ถูกต้อง');
  } catch (e) {
    return handleApiError(res, e, 'skill-quiz', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'skill-quiz');
