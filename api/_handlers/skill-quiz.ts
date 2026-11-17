/**
 * /api/skill-quiz — หน้าแบบทดสอบพนักงานของเจ้าหน้าที่ (เจ้าของ 12 พ.ย. 2569)
 * GET              → รายการผล (สรุปคะแนนจากตัวตัดสินเดียว `scoreQuiz`)
 * GET ?view=sets   → ชุดข้อสอบ (+ ลิงก์ของชุด + ใครเห็น)
 * GET ?view=people → รายชื่อผู้ใช้ไว้เลือก "ใครเห็นชุดนี้"
 * GET ?id=         → ผลของคนหนึ่งคน (มีเฉลย/คำตอบ/บทวิเคราะห์)
 * POST { action }  → create_set · update_set · archive_set · save_review · ai_draft · archive_attempt
 * POST { action: 'upload_image', data } → { id } รูปของคำถาม/ตัวเลือก (17 พ.ย. 2569) · รูปเปิดดูที่ /api/public/skill-quiz?image=
 * 🔴 16 พ.ย. 2569 เห็นเฉพาะชุดที่ตั้งให้เห็น (ทั้ง BU / รายคน · `canSeeQuizSet`) — ผลของคนทำเห็นตามชุด
 *    ลิงก์ละคน (create_link) ถอดแล้ว เหลือลิงก์เดียวต่อชุด · เลขบัตรส่งออกเป็นเลขปิดท้ายเท่านั้น
 */
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { auditFromAuthed } from '../_lib/audit.js';
import { dbQuery } from '../_lib/postgres.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { APP_DEPARTMENT_CODES, loadUserDepartmentScope } from '../_lib/departmentScope.js';
import { decryptPii } from '../_lib/piiCipher.js';
import {
  archiveQuizAttempt,
  archiveQuizSet,
  createQuizSet,
  draftQuizWithAi,
  getQuizAttempt,
  getQuizSet,
  listQuizAttempts,
  listQuizSets,
  saveQuizImage,
  saveQuizReview,
  updateQuizSet,
  type QuizAttemptRow,
} from '../_lib/skillQuiz.js';
import { parseQuizAnalysis, parseQuizSetInput, quizAttemptStatus, scoreQuiz } from '../../src/lib/skillQuiz.js';
import { canSeeQuizSet, maskCitizenId, parseQuizViewers, type QuizViewer } from '../../src/lib/skillQuizTaker.js';

const USERS = tableInAppSchema('users');

async function viewerOf(req: AuthedReq): Promise<QuizViewer> {
  const scope = await loadUserDepartmentScope(req.user);
  return { userId: req.user.sub, isAdmin: req.user.role === 'admin', codes: scope.mode === 'all' ? null : scope.mode === 'code' ? scope.codes : [] };
}

/** ข้อมูลคนทำที่ส่งให้จอเจ้าหน้าที่ — เลขบัตรถอดแล้วปิดเหลือท้ายบัตร ไม่ส่งตัวเข้ารหัสออกไป */
function takerOf(a: QuizAttemptRow) {
  return {
    first_name: a.first_name,
    last_name: a.last_name,
    phone: a.phone,
    age: a.age,
    birth_date: a.birth_date,
    citizen_id_masked: maskCitizenId(decryptPii(a.citizen_id_enc)) || null,
    consented_at: a.consented_at,
  };
}

function publicAttempt(a: QuizAttemptRow) {
  const { citizen_id_enc: _enc, ...rest } = a;
  return { ...rest, ...takerOf(a) };
}

const UUID = /^[0-9a-f-]{36}$/i;
const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  const byName = req.user?.email ?? null;
  try {
    const me = await viewerOf(req);
    const visibleSets = async () => (await listQuizSets()).filter((s) => canSeeQuizSet(s, me));
    const canSeeSetId = async (setId: string) => {
      const s = await getQuizSet(setId);
      return s !== null && canSeeQuizSet(s, me);
    };
    if (method === 'GET') {
      res.setHeader?.('Cache-Control', 'no-store');
      const view = one(req.query?.view);
      if (view === 'sets') return res.status(200).json({ sets: await visibleSets() });
      if (view === 'people') {
        const { rows } = await dbQuery<{ id: string; name: string; bu: string | null }>(
          `select id::text, coalesce(nullif(trim(nickname), ''), nullif(trim(full_name), ''), email) as name, department_code as bu
             from ${USERS} where is_active order by 2`,
        );
        return res.status(200).json({ people: rows, bus: APP_DEPARTMENT_CODES, myId: me.userId });
      }
      const id = String(one(req.query?.id) ?? '');
      if (id) {
        if (!UUID.test(id)) return sendError(res, 400, 'bad_request', 'id ไม่ถูกต้อง');
        const a = await getQuizAttempt(id);
        if (!a || !(await canSeeSetId(a.set_id))) return sendError(res, 404, 'not_found', 'ไม่พบผลนี้');
        return res.status(200).json({ attempt: publicAttempt(a) });
      }
      const seen = new Set((await visibleSets()).map((s) => s.id));
      const rows = (await listQuizAttempts()).filter((a) => seen.has(a.set_id));
      return res.status(200).json({
        attempts: rows.map((a) => {
          const r = a.answers ? scoreQuiz(a.content, a.answers) : null;
          return {
            id: a.id,
            set_id: a.set_id,
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
            ...takerOf(a),
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
      const viewers = parseQuizViewers(body.viewers, APP_DEPARTMENT_CODES);
      if (!viewers.ok) return sendError(res, 400, 'bad_request', viewers.message);
      if (action === 'create_set') {
        const newId = await createQuizSet(parsed.value, viewers.value, { name: byName, userId: req.user.sub });
        void auditFromAuthed(req, { action: 'skill_quiz.set_create', entityType: 'skill_quiz_set', entityId: newId, after: { title: parsed.value.title } }).catch(() => {});
        return res.status(201).json({ id: newId });
      }
      if (!UUID.test(id)) return sendError(res, 400, 'bad_request', 'id ไม่ถูกต้อง');
      if (!(await canSeeSetId(id)) || !(await updateQuizSet(id, parsed.value, viewers.value, byName))) return sendError(res, 404, 'not_found', 'ไม่พบชุดข้อสอบนี้');
      void auditFromAuthed(req, { action: 'skill_quiz.set_update', entityType: 'skill_quiz_set', entityId: id, after: { title: parsed.value.title } }).catch(() => {});
      return res.status(200).json({ id });
    }
    if (action === 'upload_image') {
      const saved = await saveQuizImage(typeof body.data === 'string' ? body.data : '', byName);
      if (!saved.ok) return sendError(res, 400, 'bad_request', saved.message);
      return res.status(201).json({ id: saved.id });
    }
    if (action === 'archive_set') {
      if (!UUID.test(id)) return sendError(res, 400, 'bad_request', 'id ไม่ถูกต้อง');
      if (!(await canSeeSetId(id)) || !(await archiveQuizSet(id))) return sendError(res, 404, 'not_found', 'ไม่พบชุดข้อสอบนี้');
      void auditFromAuthed(req, { action: 'skill_quiz.set_archive', entityType: 'skill_quiz_set', entityId: id }).catch(() => {});
      return res.status(200).json({ ok: true });
    }
    if (!UUID.test(id)) return sendError(res, 400, 'bad_request', 'id ไม่ถูกต้อง');
    const target = await getQuizAttempt(id);
    if (!target || !(await canSeeSetId(target.set_id))) return sendError(res, 404, 'not_found', 'ไม่พบผลนี้');
    if (action === 'save_review') {
      const a = target;
      if (!a.submitted_at) return sendError(res, 409, 'not_submitted', 'พนักงานยังไม่ได้ส่งคำตอบ');
      const reviewed = body.reviewed === true;
      await saveQuizReview(id, { analysis: parseQuizAnalysis(body.analysis), reviewed }, byName);
      void auditFromAuthed(req, { action: 'skill_quiz.review', entityType: 'skill_quiz_attempt', entityId: id, after: { reviewed } }).catch(() => {});
      return res.status(200).json({ attempt: publicAttempt((await getQuizAttempt(id))!) });
    }
    if (action === 'ai_draft') {
      const r = await draftQuizWithAi(id, { manual: true });
      if (!r.ok) return sendError(res, 502, 'ai_failed', r.message);
      return res.status(200).json({ attempt: publicAttempt((await getQuizAttempt(id))!) });
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
