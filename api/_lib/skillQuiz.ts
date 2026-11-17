/**
 * ═══ แบบทดสอบพนักงาน ฝั่งเซิร์ฟเวอร์ (เจ้าของ 12 พ.ย. 2569 · migration 176) ═══
 * ตรรกะคะแนน/เกรด/ตรวจฟอร์มอยู่ `src/lib/skillQuiz.ts` ที่เดียว
 *
 * ลิงก์เดียวต่อชุด (16 พ.ย. 2569): คนทำกรอกข้อมูล + ยินยอม PDPA แล้วได้ใบของตัวเอง (token สุ่ม 24 ตัว)
 * ส่งคำตอบได้ครั้งเดียว (อัปเดตแบบมีเงื่อนไข `submitted_at is null` — ฐานตัดสิน) · ลิงก์ละคนแบบเก่ายังเปิดได้ แต่สร้างใหม่ไม่ได้แล้ว
 * ส่งแล้ว AI ร่างบทวิเคราะห์ต่อเบื้องหลัง · AI ล้ม = เก็บเหตุไว้ เจ้าหน้าที่เขียนเองได้
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
} from '../../src/lib/skillQuiz.js';
import type { QuizTakerInput, QuizViewers } from '../../src/lib/skillQuizTaker.js';

const SETS = tableInAppSchema('skill_quiz_sets');
const ATTEMPTS = tableInAppSchema('skill_quiz_attempts');
const DOC_SEQ = tableInAppSchema('skill_quiz_doc_seq');
const IMAGES = tableInAppSchema('skill_quiz_images');

/** รูปของคำถาม/ตัวเลือก (17 พ.ย. 2569 · migration 183) — หน้าจอย่อรูปก่อนส่ง เพดานนี้กันของหลุด */
export const QUIZ_IMAGE_MAX_BYTES = 1_500_000;
type QuizImageMime = 'image/jpeg' | 'image/png' | 'image/webp';

/** ดูชนิดรูปจากไบต์จริง ไม่เชื่อชนิดที่หน้าจอบอก — ไม่ใช่ JPEG/PNG/WebP = null */
export function sniffQuizImage(b: Buffer): QuizImageMime | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.length > 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/** รับรูปจาก base64 → ตรวจ → เก็บ · ได้รหัสรูปกลับ */
export async function saveQuizImage(base64: string, byName: string | null): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const bytes = Buffer.from(base64.replace(/^data:[^,]*,/, ''), 'base64');
  if (bytes.length === 0) return { ok: false, message: 'ไม่พบรูป' };
  if (bytes.length > QUIZ_IMAGE_MAX_BYTES) return { ok: false, message: 'รูปใหญ่เกินไป' };
  const mime = sniffQuizImage(bytes);
  if (!mime) return { ok: false, message: 'ใช้ได้เฉพาะรูป JPG PNG หรือ WebP' };
  const { rows } = await dbQuery<{ id: string }>(
    `insert into ${IMAGES} (mime, size_bytes, bytes, created_by_name) values ($1, $2, $3, $4) returning id::text`,
    [mime, bytes.length, bytes, byName],
  );
  return { ok: true, id: rows[0].id };
}

export async function getQuizImage(id: string): Promise<{ mime: string; bytes: Buffer } | null> {
  const { rows } = await dbQuery<{ mime: string; bytes: Buffer }>(`select mime, bytes from ${IMAGES} where id = $1 limit 1`, [id]);
  return rows[0] ?? null;
}

export type QuizSetRow = {
  id: string;
  content: QuizSetContent;
  created_by_name: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  attempts: number;
  /** ลิงก์เดียวของชุด (16 พ.ย. 2569) */
  public_token: string | null;
  viewer_bus: string[];
  viewer_user_ids: string[];
};

export type QuizAttemptRow = {
  id: string;
  set_id: string;
  token: string;
  doc_no: string;
  person_name: string;
  person_role: string;
  content: QuizSetContent;
  answers: QuizAnswers | null;
  analysis: QuizAnalysis | null;
  analysis_by: 'ai' | 'staff' | null;
  ai_error: string | null;
  created_by_name: string | null;
  created_at: string;
  opened_at: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by_name: string | null;
  /** คนทำกรอกเอง (ลิงก์ของชุด · 16 พ.ย. 2569) — ลิงก์ละคนแบบเก่าเป็น null */
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  age: number | null;
  birth_date: string | null;
  /** เข้ารหัสแล้ว — ห้ามส่งออกจาก server (handler แปลงเป็นเลขปิดท้ายบัตร) */
  citizen_id_enc: string | null;
  consented_at: string | null;
};

const ATTEMPT_COLUMNS = `id::text, set_id::text, token, doc_no, person_name, person_role, content, answers, analysis, analysis_by,
  ai_error, created_by_name, created_at, opened_at, submitted_at, reviewed_at, reviewed_by_name,
  first_name, last_name, phone, age, to_char(birth_date, 'YYYY-MM-DD') as birth_date, citizen_id_enc, consented_at`;

const SET_COLUMNS = `s.id::text, s.content, s.created_by_name, s.created_by_user_id, s.created_at, s.updated_at, s.public_token, s.viewer_bus, s.viewer_user_ids`;

const newToken = () => randomBytes(18).toString('base64url');

export async function listQuizSets(): Promise<QuizSetRow[]> {
  const read = () =>
    dbQuery<QuizSetRow>(
      `select ${SET_COLUMNS},
         (select count(*)::int from ${ATTEMPTS} a where a.set_id = s.id and a.archived_at is null) as attempts
       from ${SETS} s where s.archived_at is null order by s.updated_at desc`,
    );
  let { rows } = await read();
  // ชุดที่สร้างก่อน 16 พ.ย. ยังไม่มีลิงก์ของชุด — ออกให้ครั้งแรกที่เปิดหน้า
  const missing = rows.filter((r) => !r.public_token);
  if (missing.length > 0) {
    for (const r of missing) await dbQuery(`update ${SETS} set public_token = $2 where id = $1::uuid and public_token is null`, [r.id, newToken()]);
    ({ rows } = await read());
  }
  return rows;
}

export async function getQuizSet(id: string): Promise<QuizSetRow | null> {
  const { rows } = await dbQuery<QuizSetRow>(`select ${SET_COLUMNS}, 0 as attempts from ${SETS} s where s.id = $1::uuid and s.archived_at is null`, [id]);
  return rows[0] ?? null;
}

export async function getQuizSetByToken(token: string): Promise<QuizSetRow | null> {
  const { rows } = await dbQuery<QuizSetRow>(`select ${SET_COLUMNS}, 0 as attempts from ${SETS} s where s.public_token = $1 and s.archived_at is null`, [token]);
  return rows[0] ?? null;
}

export async function createQuizSet(content: QuizSetContent, viewers: QuizViewers, by: { name: string | null; userId: string | null }): Promise<string> {
  const { rows } = await dbQuery<{ id: string }>(
    `insert into ${SETS} (content, created_by_name, updated_by_name, created_by_user_id, public_token, viewer_bus, viewer_user_ids)
     values ($1::jsonb, $2, $2, $3, $4, $5::text[], $6::text[]) returning id::text`,
    [JSON.stringify(content), by.name, by.userId, newToken(), viewers.bus, viewers.userIds],
  );
  return rows[0].id;
}

export async function updateQuizSet(id: string, content: QuizSetContent, viewers: QuizViewers, byName: string | null): Promise<boolean> {
  const { rows } = await dbQuery<{ id: string }>(
    `update ${SETS} set content = $2::jsonb, updated_by_name = $3, updated_at = now(), viewer_bus = $4::text[], viewer_user_ids = $5::text[]
      where id = $1::uuid and archived_at is null returning id::text`,
    [id, JSON.stringify(content), byName, viewers.bus, viewers.userIds],
  );
  return rows.length > 0;
}

export async function archiveQuizSet(id: string): Promise<boolean> {
  const { rows } = await dbQuery<{ id: string }>(`update ${SETS} set archived_at = now() where id = $1::uuid and archived_at is null returning id::text`, [id]);
  return rows.length > 0;
}

/**
 * คนทำกรอกข้อมูลแล้วกดเริ่ม — สร้างใบของคนนี้จากลิงก์ของชุด
 * คนหนึ่งทำชุดเดิมได้ครั้งเดียว: unique index (set_id, citizen_id_hash) ตัดสิน · ชน = `exists`
 */
export async function startQuizAttemptFromSet(
  setId: string,
  t: QuizTakerInput,
  citizen: { hash: string; enc: string },
  consentVersion: string,
): Promise<{ ok: true; token: string } | { ok: false; reason: 'exists' | 'no_set' }> {
  const token = newToken();
  const seq = await dbQuery<{ seq: string }>(`select nextval('${DOC_SEQ}')::text as seq`);
  try {
    const { rows } = await dbQuery<{ token: string }>(
      `insert into ${ATTEMPTS} (set_id, token, doc_no, person_name, person_role, content, first_name, last_name, phone, age, birth_date,
         citizen_id_hash, citizen_id_enc, consent_version, consented_at)
       select id, $2, $3, $4, coalesce(content->>'roleLabel', ''), content, $5, $6, $7, $8, $9::date, $10, $11, $12, now()
         from ${SETS} where id = $1::uuid and archived_at is null
       returning token`,
      [setId, token, quizDocNo(Number(seq.rows[0].seq)), `${t.firstName} ${t.lastName}`, t.firstName, t.lastName, t.phone, t.age, t.birthDate, citizen.hash, citizen.enc, consentVersion],
    );
    return rows[0] ? { ok: true, token: rows[0].token } : { ok: false, reason: 'no_set' };
  } catch (e) {
    if ((e as { code?: string })?.code === '23505') return { ok: false, reason: 'exists' };
    throw e;
  }
}

/** เข้าซ้ำด้วยเลขบัตร + วันเกิด — ต้องตรงทั้งคู่ (ไม่บอกว่าผิดช่องไหน) */
export async function findQuizAttemptForResume(setId: string, citizenHash: string, birthDate: string): Promise<string | null> {
  const { rows } = await dbQuery<{ token: string }>(
    `select token from ${ATTEMPTS} where set_id = $1::uuid and citizen_id_hash = $2 and birth_date = $3::date and archived_at is null limit 1`,
    [setId, citizenHash, birthDate],
  );
  return rows[0]?.token ?? null;
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
  v: { analysis: QuizAnalysis; reviewed: boolean },
  byName: string | null,
): Promise<boolean> {
  // คอลัมน์ text_scores ยังอยู่ในตาราง (migration เพิ่มอย่างเดียว) แต่ไม่ใช้แล้ว — ไม่มีข้อเขียนตอบ (16 พ.ย. 2569)
  const { rows } = await dbQuery<{ id: string }>(
    `update ${ATTEMPTS} set analysis = $2::jsonb, analysis_by = 'staff',
       reviewed_at = case when $3 then now() else null end, reviewed_by_name = case when $3 then $4 else null end
     where id = $1::uuid and submitted_at is not null and archived_at is null returning id::text`,
    [id, JSON.stringify(v.analysis), v.reviewed, byName],
  );
  return rows.length > 0;
}

export async function archiveQuizAttempt(id: string): Promise<boolean> {
  const { rows } = await dbQuery<{ id: string }>(`update ${ATTEMPTS} set archived_at = now() where id = $1::uuid and archived_at is null returning id::text`, [id]);
  return rows.length > 0;
}

/**
 * ให้ AI ร่างบทวิเคราะห์ — เจ้าหน้าที่ตรวจแล้วไม่ทับ (เว้นกด "ให้ AI ร่างใหม่")
 * ล้ม = เก็บเหตุใน ai_error ให้จอบอก · ไม่โยนต่อ (เรียกเบื้องหลังหลังพนักงานส่ง)
 * 🔴 รีวิวโค้ด 15 พ.ย. 2569: เดิมทับบทวิเคราะห์ที่เจ้าหน้าที่ตรวจแล้ว แต่จอยังขึ้น "ตรวจแล้วโดย …"
 *    - เบื้องหลังหลังพนักงานส่ง (`manual` ไม่ส่ง) = เขียนเฉพาะใบที่ยังไม่ตรวจ (ฐานตัดสินใน where — ตรวจก่อน AI ตอบเสร็จก็ไม่ทับ)
 *    - เจ้าหน้าที่กดให้ AI ร่างใหม่เอง (`manual`) = ทับได้ และล้างสถานะตรวจแล้ว (ต้องตรวจใหม่ก่อนส่งลูกค้า)
 */
export async function draftQuizWithAi(id: string, opts: { manual?: boolean } = {}): Promise<{ ok: true } | { ok: false; message: string }> {
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
  const parsed = parseQuizAiReply(reply);
  if (!parsed) return fail('อ่านคำตอบของ AI ไม่ได้ — ลองใหม่ หรือเขียนเอง');
  const { rows } = await dbQuery<{ id: string }>(
    `update ${ATTEMPTS} set analysis = $2::jsonb, analysis_by = 'ai', ai_error = null,
            reviewed_at = null, reviewed_by_name = null
      where id = $1::uuid and ($3::boolean or reviewed_at is null)
      returning id::text`,
    [id, JSON.stringify(parsed.analysis), opts.manual === true],
  );
  if (rows.length === 0) return { ok: false, message: 'เจ้าหน้าที่ตรวจใบนี้แล้ว — ไม่ทับบทวิเคราะห์' };
  return { ok: true };
}
