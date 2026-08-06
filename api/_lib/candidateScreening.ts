/**
 * ผลคัดกรองผู้สมัคร (เหล้า/บุหรี่ + ประวัติคดี) — ชั้นทับที่ Jarvis เก็บเอง
 *
 * บอร์ด iRecruit (SQL Server ของ ERP) ไม่มีสองฟิลด์นี้และเราเพิ่มคอลัมน์ในฐานเขาไม่ได้
 * จึงเก็บฝั่ง PostgreSQL ผูกด้วยคู่ (source, candidate_ref) แบบเดียวกับ candidate_proposals
 * ดู migrations/067_candidate_screening.sql
 *
 * ความหมายของค่า → คะแนนเรียงผู้สมัคร อยู่ที่ src/lib/candidatePriority.ts ที่เดียว
 * (lifestyleVerdict / criminalRecordVerdict) — ไฟล์นี้แค่เก็บกับอ่าน ไม่ตัดสินความหมาย
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { isScreeningAnswer, type ScreeningAnswer } from '../../src/lib/candidatePriority.js';

const table = tableInAppSchema('candidate_screening');

const MAX_NOTE = 2000;
const MAX_TEXT = 200;

export type ScreeningSource = 'board' | 'irecruit';

export type CandidateScreeningRecord = {
  source: ScreeningSource;
  candidateRef: string;
  candidateName: string | null;
  drinking: ScreeningAnswer;
  smoking: ScreeningAnswer;
  criminalRecord: ScreeningAnswer;
  criminalNote: string | null;
  screenedByName: string | null;
  updatedAt: string;
};

type Row = {
  source: string;
  candidate_ref: string;
  candidate_name: string | null;
  drinking: string;
  smoking: string;
  criminal_record: string;
  criminal_note: string | null;
  screened_by_name: string | null;
  updated_at: string;
};

export function isScreeningSource(v: unknown): v is ScreeningSource {
  return v === 'board' || v === 'irecruit';
}

/** ค่าที่อ่านจาก DB อาจเป็นอะไรก็ได้ถ้ามีคนไปแก้มือ — บังคับให้ตกใน 3 ค่าที่รู้จัก */
function answer(v: unknown): ScreeningAnswer {
  return isScreeningAnswer(v) ? v : 'unknown';
}

function trimTo(value: unknown, max: number): string | null {
  const s = typeof value === 'string' ? value.trim() : '';
  return s ? s.slice(0, max) : null;
}

function mapRow(r: Row): CandidateScreeningRecord {
  return {
    source: isScreeningSource(r.source) ? r.source : 'board',
    candidateRef: r.candidate_ref,
    candidateName: r.candidate_name,
    drinking: answer(r.drinking),
    smoking: answer(r.smoking),
    criminalRecord: answer(r.criminal_record),
    criminalNote: r.criminal_note,
    screenedByName: r.screened_by_name,
    updatedAt: r.updated_at,
  };
}

const COLUMNS = `source, candidate_ref, candidate_name, drinking, smoking,
  criminal_record, criminal_note, screened_by_name, updated_at`;

/**
 * อ่านผลคัดกรองหลายคนพร้อมกัน — คืน map candidate_ref → record
 * ตารางยังไม่ถูก migrate (deploy ก่อนหน้า) ก็คืน map ว่าง ไม่ให้ feed หลักล้ม
 */
export async function getCandidateScreeningMap(
  source: ScreeningSource,
  candidateRefs: string[],
): Promise<Map<string, CandidateScreeningRecord>> {
  const refs = [...new Set(candidateRefs.map((r) => (r || '').trim()).filter(Boolean))];
  const map = new Map<string, CandidateScreeningRecord>();
  if (refs.length === 0) return map;
  try {
    const { rows } = await dbQuery<Row>(
      `SELECT ${COLUMNS} FROM ${table}
        WHERE source = $1 AND candidate_ref = ANY($2::text[])`,
      [source, refs],
    );
    for (const r of rows) map.set(r.candidate_ref, mapRow(r));
  } catch {
    /* ข้อมูลเสริมของการเรียงลำดับ — ไม่ทำให้หน้า Matching ล่ม */
  }
  return map;
}

export type UpsertScreeningInput = {
  source: ScreeningSource;
  candidateRef: string;
  candidateName?: unknown;
  drinking?: unknown;
  smoking?: unknown;
  criminalRecord?: unknown;
  criminalNote?: unknown;
  userId?: string | null;
  userName?: string | null;
};

/**
 * บันทึกผลคัดกรอง — ส่งฟิลด์ไหนมาอัปเดตเฉพาะฟิลด์นั้น (undefined = ไม่แตะ)
 * เขียนทับได้เรื่อย ๆ เพราะเจ้าหน้าที่อาจถามเพิ่มภายหลัง
 */
export async function upsertCandidateScreening(
  input: UpsertScreeningInput,
): Promise<CandidateScreeningRecord> {
  const ref = (input.candidateRef || '').trim();
  if (!ref) throw new Error('ต้องระบุผู้สมัคร');

  const drinking = input.drinking === undefined ? null : answer(input.drinking);
  const smoking = input.smoking === undefined ? null : answer(input.smoking);
  const criminal = input.criminalRecord === undefined ? null : answer(input.criminalRecord);

  const { rows } = await dbQuery<Row>(
    `INSERT INTO ${table}
       (source, candidate_ref, candidate_name, drinking, smoking, criminal_record,
        criminal_note, screened_by_user_id, screened_by_name)
     VALUES ($1, $2, $3,
             coalesce($4, 'unknown'), coalesce($5, 'unknown'), coalesce($6, 'unknown'),
             $7, $8, $9)
     ON CONFLICT (source, candidate_ref) DO UPDATE SET
       candidate_name   = coalesce(excluded.candidate_name, ${table}.candidate_name),
       drinking         = coalesce($4, ${table}.drinking),
       smoking          = coalesce($5, ${table}.smoking),
       criminal_record  = coalesce($6, ${table}.criminal_record),
       criminal_note    = case when $10 then $7 else ${table}.criminal_note end,
       screened_by_user_id = excluded.screened_by_user_id,
       screened_by_name    = excluded.screened_by_name,
       updated_at       = now()
     RETURNING ${COLUMNS}`,
    [
      input.source,
      ref,
      trimTo(input.candidateName, MAX_TEXT),
      drinking,
      smoking,
      criminal,
      trimTo(input.criminalNote, MAX_NOTE),
      trimTo(input.userId, 64),
      trimTo(input.userName, MAX_TEXT),
      input.criminalNote !== undefined,
    ],
  );
  return mapRow(rows[0]);
}
