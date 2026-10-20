/**
 * ═══ หน้าการติดต่อของจับคู่งาน — รายชื่อแบบตารางเหมือนแท็บการติดต่อของงานสรรหา (เจ้าของ 20 ต.ค. 2569 Choice "ทำตามนี้") ═══
 *
 * เดิม (`MyCallsSection`) ไม่มีเบอร์ให้กดโทร · กดผลแล้วคนหายจากหน้า ⇒ ตอนนี้
 * - แถว = คนของเรา (`source = 'board'`) ที่ **ฉัน** เก็บไปโทรเอง: ที่ยังถืออยู่ + ที่ลงผลแล้ว/หลุดเพราะครบ 24 ชม. ภายใน 30 วัน
 * - แนบเบอร์ (ของฉันเองเท่านั้น — คนที่หน้าจับคู่ก็เห็นเบอร์นี้อยู่แล้ว) · อายุ · เพศ · อำเภอ/จังหวัดจากการ์ดบอร์ด
 * - ชื่อหน่วยงานของใบขอจากสำเนารายการใบขอ (อ่านไม่ได้ = เลขใบขอ)
 * อ่านอย่างเดียว · การ์ดอ่านไม่ได้ = แถวยังอยู่ ช่องที่ขาดเป็นค่าว่าง
 */
import { dbQuery, isPgUndefinedTable } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { siamrajSqlQuery } from './siamrajSqlServer.js';
import { logWarn, errorSummaryText } from './logger.js';

const HOLDS = tableInAppSchema('candidate_call_holds');
export const SELECTION_RESULT_DAYS = 30;

export type SelectionContactRow = {
  id: string;
  cardId: number | null;
  name: string | null;
  /** 0XXXXXXXXX */
  phone: string | null;
  age: number | null;
  sex: string | null;
  area: string | null;
  jobId: string;
  requestNo: string | null;
  jobLabel: string | null;
  heldAt: string;
  expiresAt: string;
  /** ยังถืออยู่ (ยังไม่ลงผล) */
  open: boolean;
  /** ถือครบ 24 ชม. โดยไม่ได้ลงผล — ล็อกหลุดแล้ว (โชว์ไว้ไม่ให้หายเงียบ) */
  expired: boolean;
  result: 'confirmed' | 'declined' | 'reschedule_requested' | 'no_answer' | 'wrong_person' | null;
  resultAt: string | null;
};

/** $1 = ผู้ใช้ · $2 = ย้อนกี่วันของแถวที่ลงผลแล้ว */
export function selectionContactsSql(): string {
  return `
    select h.id::text as id, h.candidate_ref, h.candidate_name, h.phone_e164, h.job_id, h.request_no,
           h.held_at, h.expires_at, h.released_at, h.release_reason, h.result_outcome,
           coalesce(h.result_at, h.updated_at) as result_at
      from ${HOLDS} h
     where h.held_by_user_id = $1::uuid
       and h.source = 'board'
       and ((h.released_at is null and h.expires_at > now())
            or (h.release_reason in ('result', 'expired')
                and coalesce(h.result_at, h.released_at, h.updated_at) > now() - make_interval(days => $2::int)))
     order by (h.released_at is null) desc, coalesce(h.result_at, h.held_at) desc
     limit 500`;
}

type HoldRow = {
  id: string;
  candidate_ref: string;
  candidate_name: string | null;
  phone_e164: string | null;
  job_id: string;
  request_no: string | null;
  held_at: Date | string;
  expires_at: Date | string;
  released_at: Date | string | null;
  release_reason: string | null;
  result_outcome: SelectionContactRow['result'];
  result_at: Date | string | null;
};

const iso = (v: Date | string | null): string | null => (v == null ? null : new Date(v).toISOString());

export function localPhone(e164: string | null | undefined): string | null {
  const s = (e164 ?? '').trim();
  if (/^\+66\d{8,9}$/.test(s)) return `0${s.slice(3)}`;
  return s || null;
}

type CardRow = { card_id: number; age: number | null; sex_code: string | null; amphur_name: string | null; province_name: string | null };

/** อายุ · เพศ · อำเภอ/จังหวัด ของการ์ดบอร์ดตาม id — อ่านไม่ได้ = Map ว่าง */
async function loadCards(ids: number[]): Promise<Map<number, CardRow>> {
  const out = new Map<number, CardRow>();
  const keys = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))].slice(0, 500);
  if (keys.length === 0) return out;
  const inputs: Record<string, unknown> = {};
  const ph = keys.map((id, i) => {
    inputs[`c${i}`] = id;
    return `@c${i}`;
  });
  try {
    const rows = await siamrajSqlQuery<CardRow>(
      `SELECT c.card_id,
              CASE WHEN r.birth_date IS NOT NULL THEN DATEDIFF(YEAR, r.birth_date, GETDATE()) ELSE NULL END AS age,
              r.sex_code, am.amphur_name, pv.province_name
         FROM dbo.ir_board_card AS c
         LEFT JOIN dbo.hr_recruitment AS r ON r.citizen_id = c.citizen_id
         LEFT JOIN dbo.hr_recruitment_address AS ra ON ra.citizen_id = r.citizen_id
         LEFT JOIN dbo.ms_province AS pv ON pv.province_code = ra.province_code
         LEFT JOIN dbo.ms_province_amphur AS am ON am.province_code = ra.province_code AND am.amphur_code = ra.amphur_code
        WHERE c.card_id IN (${ph.join(', ')})`,
      inputs,
    );
    for (const r of rows) if (!out.has(r.card_id)) out.set(r.card_id, r);
  } catch (e) {
    logWarn('selectionContacts: อ่านการ์ดบอร์ดไม่สำเร็จ', { error: errorSummaryText(e) });
  }
  return out;
}

const SEX_LABEL: Record<string, string> = { M: 'ชาย', F: 'หญิง', '1': 'ชาย', '2': 'หญิง' };

export async function listSelectionContacts(
  userId: string,
  jobLabelOf: (jobId: string) => string | null,
): Promise<SelectionContactRow[]> {
  let rows: HoldRow[];
  try {
    rows = (await dbQuery<HoldRow>(selectionContactsSql(), [userId, SELECTION_RESULT_DAYS])).rows;
  } catch (e) {
    if (isPgUndefinedTable(e)) return [];
    throw e;
  }
  const cards = await loadCards(rows.map((r) => Number(r.candidate_ref)));
  return rows.map((r) => {
    const cardId = Number(r.candidate_ref);
    const card = Number.isInteger(cardId) ? cards.get(cardId) : undefined;
    const age = card && typeof card.age === 'number' && card.age > 0 && card.age < 100 ? card.age : null;
    return {
      id: r.id,
      cardId: Number.isInteger(cardId) ? cardId : null,
      name: r.candidate_name,
      phone: localPhone(r.phone_e164),
      age,
      sex: card?.sex_code ? (SEX_LABEL[card.sex_code.trim()] ?? null) : null,
      area: [card?.amphur_name, card?.province_name].map((x) => (x ?? '').trim()).filter(Boolean).join(' · ') || null,
      jobId: r.job_id,
      requestNo: r.request_no,
      jobLabel: jobLabelOf(r.job_id),
      heldAt: iso(r.held_at) as string,
      expiresAt: iso(r.expires_at) as string,
      open: r.released_at == null,
      expired: r.release_reason === 'expired',
      result: r.result_outcome ?? null,
      resultAt: r.released_at == null ? null : iso(r.result_at),
    };
  });
}
