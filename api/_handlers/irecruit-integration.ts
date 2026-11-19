/**
 * ═══ iRecruit → Jarvis: ดึงผลแบบทดสอบ (เจ้าของ 18 พ.ย. 2569 "ทำ API ให้ iRecruit ดึงผลแบบทดสอบตามที่แนะนำเลย") ═══
 *
 * GET /api/integrations/irecruit/skill-results
 * ยืนยันตัว: header `x-api-key` (`withIntegrationKey` · key ชื่อ `irecruit` · ออก/ยกเลิกได้ที่ ตั้งค่า › เชื่อมระบบภายนอก)
 *
 * query:
 *   since=<ISO 8601>          ใบที่ส่งคำตอบหลังเวลานี้ (ใช้ครั้งแรก) · ไม่ส่ง = ตั้งแต่ใบแรก
 *   cursor=<next_cursor>      ดึงต่อจากรอบก่อน (ใช้แทน since) — ไม่ซ้ำ ไม่ตกหล่น
 *   phone=0XXXXXXXXX          เฉพาะเบอร์นี้ (หาคนด้วยเบอร์โทร)
 *   limit=1–500               ค่าเริ่ม 100
 * ตอบ { items, next_cursor, has_more }
 *
 * ส่งเฉพาะใบที่ส่งคำตอบแล้ว และไม่ถูกลบ · เรียงตามเวลาส่งคำตอบ
 * 🔴 PDPA: ส่งเท่าที่ iRecruit ใช้ — ไม่ส่งเลขบัตร · วันเกิด · คำตอบรายข้อ · บทวิเคราะห์
 * ลิงก์ใบผล = หน้าแบบทดสอบของ Jarvis (ต้องล็อกอิน Jarvis และมีสิทธิ์ดูชุดนั้น) — ไม่มีลิงก์สาธารณะ
 */
import { sendError, type ApiReq, type ApiRes } from '../_lib/http.js';
import { dbQuery } from '../_lib/postgres.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { logError, logInfo } from '../_lib/logger.js';
import { withIntegrationKey } from '../_lib/integrationKeyAuth.js';
import { getAppPublicUrl } from '../_lib/postmark.js';
import { QUIZ_STATUS_LABEL, quizAttemptStatus, scoreQuiz, type QuizAnswers, type QuizSetContent } from '../../src/lib/skillQuiz.js';

export const IRECRUIT_KEY_NAME = 'irecruit';
const ATTEMPTS = tableInAppSchema('skill_quiz_attempts');
const LIMIT_DEFAULT = 100;
const LIMIT_MAX = 500;
const ZERO_ID = '00000000-0000-0000-0000-000000000000';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);

type Row = {
  id: string;
  set_id: string;
  doc_no: string;
  person_name: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  content: QuizSetContent;
  answers: QuizAnswers | null;
  submitted_at: string;
  reviewed_at: string | null;
};

/** cursor = เวลาส่งคำตอบ (ละเอียดถึงไมโครวินาที) + id ของใบสุดท้าย — กันใบเวลาเดียวกันตกหล่นตอนแบ่งหน้า */
export function encodeSkillCursor(at: string, id: string): string {
  return Buffer.from(`${at}|${id}`, 'utf8').toString('base64url');
}

export function decodeSkillCursor(raw: string): { at: string; id: string } | null {
  const [at, id] = Buffer.from(raw, 'base64url').toString('utf8').split('|');
  if (!at || !id || !UUID_RE.test(id) || Number.isNaN(Date.parse(at))) return null;
  return { at, id };
}

export type SkillQueryInput =
  | { ok: true; after: { at: string; id: string } | null; phone: string | null; limit: number }
  | { ok: false; message: string };

export function parseSkillQuery(q: Record<string, unknown> | undefined): SkillQueryInput {
  const cursor = String(one(q?.cursor) ?? '').trim();
  const since = String(one(q?.since) ?? '').trim();
  const phoneRaw = String(one(q?.phone) ?? '').replace(/\D/g, '');
  const limitRaw = String(one(q?.limit) ?? '').trim();
  let after: { at: string; id: string } | null = null;
  if (cursor) {
    after = decodeSkillCursor(cursor);
    if (!after) return { ok: false, message: 'cursor ไม่ถูกต้อง — ใช้ค่า next_cursor ที่ได้จากรอบก่อน' };
  } else if (since) {
    if (Number.isNaN(Date.parse(since))) return { ok: false, message: 'since ต้องเป็นวันเวลาแบบ ISO 8601 เช่น 2026-11-01T00:00:00+07:00' };
    after = { at: new Date(since).toISOString(), id: ZERO_ID };
  }
  if (phoneRaw && !/^0\d{9}$/.test(phoneRaw)) return { ok: false, message: 'phone ต้องเป็นเบอร์ 10 หลัก ขึ้นต้นด้วย 0' };
  const n = limitRaw ? Number(limitRaw) : LIMIT_DEFAULT;
  if (!Number.isInteger(n) || n < 1 || n > LIMIT_MAX) return { ok: false, message: `limit ต้องเป็นเลข 1–${LIMIT_MAX}` };
  return { ok: true, after, phone: phoneRaw || null, limit: n };
}

/** แถว → สิ่งที่ส่งให้ iRecruit (คะแนนคิดด้วย `scoreQuiz` ตัวเดียวกับใบผลบนจอ) */
export function toSkillResult(r: Row, appUrl: string) {
  const result = r.answers ? scoreQuiz(r.content, r.answers) : null;
  const status = quizAttemptStatus(r);
  return {
    id: r.id,
    doc_no: r.doc_no,
    set: { id: r.set_id, title: r.content.title, role: r.content.roleLabel || null },
    person: {
      first_name: r.first_name ?? r.person_name,
      last_name: r.last_name ?? null,
      phone: r.phone ?? null,
    },
    submitted_at: r.submitted_at,
    status,
    status_label: QUIZ_STATUS_LABEL[status],
    reviewed_at: r.reviewed_at,
    pass_score: r.content.passScore,
    score: result?.score ?? null,
    grade: result?.grade ?? null,
    passed_skills: result?.passedSkills ?? null,
    total_skills: result?.skills.length ?? null,
    /** ผ่านทุกทักษะ (คะแนนรายทักษะ ≥ เกณฑ์ของชุด) */
    passed: result ? result.skills.length > 0 && result.passedSkills === result.skills.length : null,
    skills: (result?.skills ?? []).map((s) => ({ name: s.name, score: s.score, passed: s.passed })),
    result_url: appUrl ? `${appUrl}/skill-test?set=${encodeURIComponent(r.set_id)}&open=${encodeURIComponent(r.id)}` : null,
  };
}

async function getSkillResults(req: ApiReq, res: ApiRes) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    res.setHeader?.('Allow', 'GET');
    return sendError(res, 405, 'Method not allowed');
  }
  const p = parseSkillQuery(req.query as Record<string, unknown> | undefined);
  if (!p.ok) return sendError(res, 400, 'Bad request', p.message);
  try {
    const { rows } = await dbQuery<Row & { submitted_at_us: string }>(
      `select id::text, set_id::text, doc_no, person_name, first_name, last_name, phone, content, answers,
              submitted_at, reviewed_at,
              to_char(submitted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as submitted_at_us
         from ${ATTEMPTS}
        where submitted_at is not null and archived_at is null
          and ($1::timestamptz is null or (submitted_at, id) > ($1::timestamptz, $2::uuid))
          and ($3::text is null or phone = $3)
        order by submitted_at, id
        limit $4`,
      [p.after?.at ?? null, p.after?.id ?? ZERO_ID, p.phone, p.limit + 1],
    );
    const hasMore = rows.length > p.limit;
    const page = rows.slice(0, p.limit);
    const last = page[page.length - 1];
    const appUrl = getAppPublicUrl();
    logInfo('irecruit.skillResults', { count: page.length, hasMore, byPhone: Boolean(p.phone) });
    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(200).json({
      items: page.map((r) => toSkillResult(r, appUrl)),
      // ไม่มีใบใหม่ = ส่ง cursor เดิมกลับ ให้รอบหน้าดึงต่อจากจุดเดิมได้
      next_cursor: last ? encodeSkillCursor(last.submitted_at_us, last.id) : p.after ? encodeSkillCursor(p.after.at, p.after.id) : null,
      has_more: hasMore,
    });
  } catch (e) {
    logError('irecruit.skillResults', e);
    return sendError(res, 500, 'Server error', 'อ่านผลแบบทดสอบไม่สำเร็จ');
  }
}

export const irecruitSkillResultsHandler = withIntegrationKey(IRECRUIT_KEY_NAME, getSkillResults);
