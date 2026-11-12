/**
 * ═══ แบบทดสอบพนักงาน ฝั่งเซิร์ฟเวอร์ (เจ้าของ 12 พ.ย. 2569 · migration 176) ═══
 * ตรรกะคะแนน/เกรด/ตรวจฟอร์มอยู่ `src/lib/skillQuiz.ts` ที่เดียว
 *
 * ลิงก์ละคน: token สุ่ม 24 ตัว · ส่งคำตอบได้ครั้งเดียว (อัปเดตแบบมีเงื่อนไข `submitted_at is null` — ฐานตัดสิน)
 * ส่งแล้ว AI ร่างคะแนนเขียนตอบ + บทวิเคราะห์ต่อเบื้องหลัง · AI ล้ม = เก็บเหตุไว้ เจ้าหน้าที่เขียนเองได้
 */
import { randomBytes } from 'node:crypto';
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { aiChat, isAiConfigured } from './aiClient.js';
import { logError } from './logger.js';
import {
  buildQuizAiPrompt,
  parseQuizAiReply,
  quizDocNo,
  type QuizAnalysis,
  type QuizAnswers,
  type QuizSetContent,
  type QuizTextScore,
} from '../../src/lib/skillQuiz.js';

const SETS = tableInAppSchema('skill_quiz_sets');
const ATTEMPTS = tableInAppSchema('skill_quiz_attempts');
const DOC_SEQ = tableInAppSchema('skill_quiz_doc_seq');

export type QuizSetRow = { id: string; content: QuizSetContent; created_by_name: string | null; created_at: string; updated_at: string; attempts: number };

export type QuizAttemptRow = {
  id: string;
  set_id: string;
  token: string;
  doc_no: string;
  person_name: string;
  person_role: string;
  content: QuizSetContent;
  answers: QuizAnswers | null;
  text_scores: Record<string, QuizTextScore>;
  analysis: QuizAnalysis | null;
  analysis_by: 'ai' | 'staff' | null;
  ai_error: string | null;
  created_by_name: string | null;
  created_at: string;
  opened_at: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by_name: string | null;
};

const ATTEMPT_COLUMNS = `id::text, set_id::text, token, doc_no, person_name, person_role, content, answers, text_scores, analysis, analysis_by,
  ai_error, created_by_name, created_at, opened_at, submitted_at, reviewed_at, reviewed_by_name`;

export async function listQuizSets(): Promise<QuizSetRow[]> {
  const { rows } = await dbQuery<QuizSetRow>(
    `select s.id::text, s.content, s.created_by_name, s.created_at, s.updated_at,
       (select count(*)::int from ${ATTEMPTS} a where a.set_id = s.id and a.archived_at is null) as attempts
     from ${SETS} s where s.archived_at is null order by s.updated_at desc`,
  );
  return rows;
}

export async function createQuizSet(content: QuizSetContent, byName: string | null): Promise<string> {
  const { rows } = await dbQuery<{ id: string }>(
    `insert into ${SETS} (content, created_by_name, updated_by_name) values ($1::jsonb, $2, $2) returning id::text`,
    [JSON.stringify(content), byName],
  );
  return rows[0].id;
}

export async function updateQuizSet(id: string, content: QuizSetContent, byName: string | null): Promise<boolean> {
  const { rows } = await dbQuery<{ id: string }>(
    `update ${SETS} set content = $2::jsonb, updated_by_name = $3, updated_at = now() where id = $1::uuid and archived_at is null returning id::text`,
    [id, JSON.stringify(content), byName],
  );
  return rows.length > 0;
}

export async function archiveQuizSet(id: string): Promise<boolean> {
  const { rows } = await dbQuery<{ id: string }>(`update ${SETS} set archived_at = now() where id = $1::uuid and archived_at is null returning id::text`, [id]);
  return rows.length > 0;
}

/** สร้างลิงก์ของพนักงานหนึ่งคน — เก็บสำเนาชุดข้อสอบ ณ ตอนนี้ */
export async function createQuizAttempt(setId: string, person: { name: string; role: string }, byName: string | null): Promise<QuizAttemptRow | null> {
  const token = randomBytes(18).toString('base64url');
  const seq = await dbQuery<{ seq: string }>(`select nextval('${DOC_SEQ}')::text as seq`);
  const { rows } = await dbQuery<QuizAttemptRow>(
    `insert into ${ATTEMPTS} (set_id, token, doc_no, person_name, person_role, content, created_by_name)
     select id, $2, $3, $4, $5, content, $6 from ${SETS} where id = $1::uuid and archived_at is null
     returning ${ATTEMPT_COLUMNS}`,
    [setId, token, quizDocNo(Number(seq.rows[0].seq)), person.name, person.role, byName],
  );
  return rows[0] ?? null;
}

export async function listQuizAttempts(): Promise<QuizAttemptRow[]> {
  const { rows } = await dbQuery<QuizAttemptRow>(`select ${ATTEMPT_COLUMNS} from ${ATTEMPTS} where archived_at is null order by created_at desc limit 500`);
  return rows;
}

export async function getQuizAttempt(id: string): Promise<QuizAttemptRow | null> {
  const { rows } = await dbQuery<QuizAttemptRow>(`select ${ATTEMPT_COLUMNS} from ${ATTEMPTS} where id = $1::uuid and archived_at is null`, [id]);
  return rows[0] ?? null;
}

export async function getQuizAttemptByToken(token: string): Promise<QuizAttemptRow | null> {
  const { rows } = await dbQuery<QuizAttemptRow>(`select ${ATTEMPT_COLUMNS} from ${ATTEMPTS} where token = $1 and archived_at is null`, [token]);
  return rows[0] ?? null;
}

export async function markQuizOpened(id: string): Promise<void> {
  await dbQuery(`update ${ATTEMPTS} set opened_at = now() where id = $1::uuid and opened_at is null`, [id]);
}

/** ส่งคำตอบ — ได้ครั้งเดียว (false = ส่งไปแล้ว/ลิงก์ถูกลบ) */
export async function submitQuizAnswers(id: string, answers: QuizAnswers): Promise<boolean> {
  const { rows } = await dbQuery<{ id: string }>(
    `update ${ATTEMPTS} set answers = $2::jsonb, submitted_at = now(), opened_at = coalesce(opened_at, now())
     where id = $1::uuid and submitted_at is null and archived_at is null returning id::text`,
    [id, JSON.stringify(answers)],
  );
  return rows.length > 0;
}

export async function saveQuizReview(
  id: string,
  v: { textScores: Record<string, QuizTextScore>; analysis: QuizAnalysis; reviewed: boolean },
  byName: string | null,
): Promise<boolean> {
  const { rows } = await dbQuery<{ id: string }>(
    `update ${ATTEMPTS} set text_scores = $2::jsonb, analysis = $3::jsonb, analysis_by = 'staff',
       reviewed_at = case when $4 then now() else null end, reviewed_by_name = case when $4 then $5 else null end
     where id = $1::uuid and submitted_at is not null and archived_at is null returning id::text`,
    [id, JSON.stringify(v.textScores), JSON.stringify(v.analysis), v.reviewed, byName],
  );
  return rows.length > 0;
}

export async function archiveQuizAttempt(id: string): Promise<boolean> {
  const { rows } = await dbQuery<{ id: string }>(`update ${ATTEMPTS} set archived_at = now() where id = $1::uuid and archived_at is null returning id::text`, [id]);
  return rows.length > 0;
}

/**
 * ให้ AI ร่างคะแนนเขียนตอบ + บทวิเคราะห์ — ทับเฉพาะของที่ AI เขียน (ข้อที่เจ้าหน้าที่ให้คะแนนเองแล้วคงไว้)
 * ล้ม = เก็บเหตุใน ai_error ให้จอบอก · ไม่โยนต่อ (เรียกเบื้องหลังหลังพนักงานส่ง)
 */
export async function draftQuizWithAi(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const a = await getQuizAttempt(id);
  if (!a || !a.answers) return { ok: false, message: 'ยังไม่มีคำตอบ' };
  const fail = async (message: string) => {
    await dbQuery(`update ${ATTEMPTS} set ai_error = $2 where id = $1::uuid`, [id, message]);
    return { ok: false as const, message };
  };
  if (!(await isAiConfigured('skill_report'))) return fail('ยังไม่ได้ตั้ง AI — ตั้งได้ที่ ตั้งค่า › AI ที่ใช้คิดงาน');
  let reply: string;
  try {
    reply = await aiChat({
      task: 'skill_report',
      messages: [
        { role: 'system', content: 'คุณเป็นหัวหน้าช่างที่ประเมินผลแบบทดสอบของพนักงาน ตอบเป็น JSON ตามที่ขอเท่านั้น' },
        { role: 'user', content: buildQuizAiPrompt(a.content, a.answers) },
      ],
      format: 'json',
      temperature: 0.2,
      timeoutMs: 120_000,
    });
  } catch (e) {
    logError('skill_quiz.ai_fail', { id, message: e instanceof Error ? e.message : String(e) });
    return fail(e instanceof Error ? e.message : 'AI ไม่ตอบ');
  }
  const parsed = parseQuizAiReply(a.content, reply);
  if (!parsed) return fail('อ่านคำตอบของ AI ไม่ได้ — ลองใหม่ หรือเขียนเอง');
  const keepStaff = Object.fromEntries(Object.entries(a.text_scores ?? {}).filter(([, s]) => s.by === 'staff'));
  const textScores = { ...parsed.textScores, ...keepStaff };
  await dbQuery(
    `update ${ATTEMPTS} set text_scores = $2::jsonb, analysis = $3::jsonb, analysis_by = 'ai', ai_error = null where id = $1::uuid`,
    [id, JSON.stringify(textScores), JSON.stringify(parsed.analysis)],
  );
  return { ok: true };
}
