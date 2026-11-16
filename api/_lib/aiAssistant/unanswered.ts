/**
 * ═══ คำถามที่ผู้ช่วย AI ตอบไม่ได้ (เจ้าของ 16 พ.ย. 2569 "Ai เก็บอะไรที่ไม่มีคำตอบมา แล้วบอกหน่อยว่าไม่มีคำตอบแล้วจะดูยังไง") ═══
 * ผู้ช่วยเรียกเครื่องมือ `note_unanswered` เมื่อระบบไม่มีข้อมูล/ช่องที่ตรงคำถาม → จดคำถามล่าสุดของผู้ใช้ + ขาดอะไร
 * ดูที่ ตั้งค่า › AI ที่ใช้คิดงาน (`/api/ai/unanswered` admin) · ข้อความปิดเบอร์/อีเมล/เลขบัตรก่อนจด (`maskPersonal`)
 */
import { dbQuery, isPgUndefinedTable } from '../postgres.js';
import { tableInAppSchema } from '../schema.js';
import { maskPersonal } from './tools.js';

const T = tableInAppSchema('ai_unanswered');
/** คำถามเดิมของคนเดิมภายในเวลานี้ = ไม่จดซ้ำ (ผู้ช่วยเรียกซ้ำในวงเดียวกัน/ผู้ใช้กดลองใหม่) */
const DEDUPE_MINUTES = 30;

export type UnansweredRow = { id: string; askedBy: string | null; question: string; missing: string | null; createdAt: string };

export async function recordUnanswered(input: { userId: string; name: string; question: string; missing: string }): Promise<void> {
  const question = maskPersonal(input.question).trim().slice(0, 1000);
  if (!question) return;
  await dbQuery(
    `insert into ${T} (asked_by, asked_by_name, question, missing)
     select $1, $2, $3, $4
      where not exists (select 1 from ${T} where asked_by = $1 and question = $3 and created_at > now() - make_interval(mins => $5))`,
    [input.userId, input.name, question, maskPersonal(input.missing).trim().slice(0, 500) || null, DEDUPE_MINUTES],
  );
}

/** ที่ยังไม่ได้กด "ดูแล้ว" ใหม่ → เก่า · ยังไม่มีตาราง = ว่าง */
export async function listUnanswered(limit = 200): Promise<UnansweredRow[]> {
  try {
    const { rows } = await dbQuery<{ id: string; asked_by_name: string | null; question: string; missing: string | null; created_at: Date | string }>(
      `select id::text as id, asked_by_name, question, missing, created_at from ${T} where cleared_at is null order by created_at desc limit $1`,
      [limit],
    );
    return rows.map((r) => ({ id: r.id, askedBy: r.asked_by_name, question: r.question, missing: r.missing, createdAt: new Date(r.created_at).toISOString() }));
  } catch (e) {
    if (isPgUndefinedTable(e)) return [];
    throw e;
  }
}

export async function clearUnanswered(id: string, by: string): Promise<boolean> {
  const { rows } = await dbQuery<{ id: string }>(
    `update ${T} set cleared_at = now(), cleared_by = $2 where id = $1::bigint and cleared_at is null returning id::text as id`,
    [id, by],
  );
  return rows.length > 0;
}
