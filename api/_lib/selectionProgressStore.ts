/**
 * ตัวกลางเดียวของ "ขั้นในกระบวนการจ้าง" (Phase 6.1-6.2 · migration 105)
 *
 * 🔴 เจ้าของเคาะ: *"สถานะผู้สมัคร รวมเป็นชุดเดียว — คนจาก match ใช้ด้วย"*
 * ของเดิม (094) เก็บบน `public_job_applications` จึงใช้ได้เฉพาะคนที่**มีใบสมัคร**
 * คนที่ AI จับคู่มาจากบอร์ด/iRecruit ตั้งขั้นไม่ได้เลย
 *
 * วิธีเปลี่ยนผ่านแบบไม่ทำของเดิมหาย (กติกาโปรเจกต์: parallel layer + adapter):
 *   **เขียน** → ตารางกลาง `selection_progress` **และ** คอลัมน์เดิมบนใบสมัคร (dual-write)
 *   **อ่าน**  → ตารางกลางก่อน ไม่มีค่อยถอยไปคอลัมน์เดิม
 * ⇒ ถอย migration/โค้ดกลับได้ทุกเมื่อ ข้อมูลยังอยู่ครบทั้งสองที่
 *
 * ⚠️ คีย์คนคือ **เบอร์ E.164** ไม่ใช่ id ใบสมัคร/candidate_ref
 * (บทเรียนล็อกโทร 068: คนเดียวมีหลายรหัส แต่เบอร์มีเบอร์เดียว)
 * ⚠️ ตารางยังไม่ migrate (42P01) / คอลัมน์ยังไม่มี (42703) → **ต้องไม่พัง** ทำงานต่อได้ด้วยของเดิม
 */
import { dbQuery, isPgUndefinedTable } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { toE164Thai } from './thaiPhone.js';
import { logError } from './logger.js';
import {
  isSelectionStatus,
  normalizePrepChecklist,
  type PrepChecklist,
  type SelectionStatus,
} from '../../src/lib/selectionProgress.js';

const TABLE = tableInAppSchema('selection_progress');
const APPS = tableInAppSchema('public_job_applications');

/** 42703 undefined_column — โค้ดใหม่ขึ้นก่อน migration */
function isUndefinedColumn(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '42703';
}

/** ตาราง/คอลัมน์ยังไม่มี = ยังใช้ของเดิมได้ ห้ามพัง */
function isMissingSchema(e: unknown): boolean {
  return isPgUndefinedTable(e) || isUndefinedColumn(e);
}

export type SelectionProgressRow = {
  jobId: string;
  phoneE164: string;
  selectionStatus: SelectionStatus | null;
  prepChecklist: PrepChecklist;
  /** หน่วยงานที่กำลังพิจารณา (Phase 6.6) — snapshot ข้อความ ไม่มี FK */
  unitSiteCode: string | null;
  unitName: string | null;
  updatedByName: string | null;
};

type RawRow = {
  job_id: string;
  phone_e164: string;
  selection_status: string | null;
  prep_checklist: unknown;
  unit_site_code: string | null;
  unit_name: string | null;
  updated_by_name: string | null;
};

function mapRow(r: RawRow): SelectionProgressRow {
  return {
    jobId: r.job_id,
    phoneE164: r.phone_e164,
    // ค่าที่ไม่รู้จักส่ง null — ห้ามเดาเป็นขั้นแรก (ป้ายบนจอจะโกหก)
    selectionStatus: isSelectionStatus(r.selection_status) ? r.selection_status : null,
    prepChecklist: normalizePrepChecklist(r.prep_checklist),
    unitSiteCode: r.unit_site_code,
    unitName: r.unit_name,
    updatedByName: r.updated_by_name,
  };
}

const COLS = `job_id, phone_e164, selection_status, prep_checklist, unit_site_code, unit_name, updated_by_name`;

/**
 * อ่านขั้นของหลายคนในใบขอเดียว — คืน Map คีย์ **เบอร์ E.164**
 * ตารางยังไม่มี = Map ว่าง (ผู้เรียกถอยไปใช้ค่าบนใบสมัครเอง)
 */
export async function loadProgressByJob(
  jobId: string,
  phones: Array<string | null | undefined>,
): Promise<Map<string, SelectionProgressRow>> {
  const out = new Map<string, SelectionProgressRow>();
  const keys = [...new Set(phones.map((p) => toE164Thai(p ?? '')).filter((p): p is string => !!p))];
  if (!jobId.trim() || keys.length === 0) return out;
  try {
    const { rows } = await dbQuery<RawRow>(
      `select ${COLS} from ${TABLE} where job_id = $1 and phone_e164 = any($2::text[])`,
      [jobId, keys],
    );
    for (const r of rows) out.set(r.phone_e164, mapRow(r));
  } catch (e) {
    if (!isMissingSchema(e)) throw e;
  }
  return out;
}

/** อ่านขั้นของคนเดียวในใบขอเดียว */
export async function loadProgressOne(
  jobId: string,
  phone: string | null | undefined,
): Promise<SelectionProgressRow | null> {
  const e164 = toE164Thai(phone ?? '');
  if (!jobId.trim() || !e164) return null;
  const map = await loadProgressByJob(jobId, [e164]);
  return map.get(e164) ?? null;
}

/**
 * "คนนี้อยู่ขั้นไหนในใบขออื่นด้วย" — ถามด้วยเบอร์ข้ามใบขอ
 * ใช้เตือนตอนจะเสนอคนที่กำลังเดินอยู่กับใบอื่น (คู่กับ `findActiveConflict` ของ proposals)
 */
export async function loadProgressByPhones(
  phones: Array<string | null | undefined>,
): Promise<Map<string, SelectionProgressRow[]>> {
  const out = new Map<string, SelectionProgressRow[]>();
  const keys = [...new Set(phones.map((p) => toE164Thai(p ?? '')).filter((p): p is string => !!p))];
  if (keys.length === 0) return out;
  try {
    const { rows } = await dbQuery<RawRow>(
      `select ${COLS} from ${TABLE}
        where phone_e164 = any($1::text[]) and selection_status is not null`,
      [keys],
    );
    for (const r of rows) {
      const list = out.get(r.phone_e164) ?? [];
      list.push(mapRow(r));
      out.set(r.phone_e164, list);
    }
  } catch (e) {
    if (!isMissingSchema(e)) throw e;
  }
  return out;
}

export type SaveProgressInput = {
  jobId: string;
  phone: string;
  /** ไม่ส่ง = ไม่แตะของเดิม · `null` = ล้างขั้น (ต่างกันโดยตั้งใจ) */
  selectionStatus?: SelectionStatus | null;
  prepChecklist?: PrepChecklist;
  unitSiteCode?: string | null;
  unitName?: string | null;
  actor?: { id?: string | null; name?: string | null };
  /** id ใบสมัคร (ถ้ามี) — ใช้เขียนคอลัมน์เดิมคู่กันไประหว่างเปลี่ยนผ่าน */
  applicationId?: string | null;
};

export type SaveProgressResult =
  | { ok: true; row: SelectionProgressRow; centralWritten: boolean; legacyWritten: boolean }
  | { ok: false; reason: 'no_phone' | 'no_job' };

/**
 * บันทึกขั้น — **เขียนสองที่** (ตารางกลาง + คอลัมน์เดิมถ้ารู้ใบสมัคร)
 *
 * 🔴 ลำดับสำคัญ: เขียน**ตารางกลางก่อน** เพราะเป็นแหล่งที่ระบบอ่านเป็นอันดับแรก
 * ถ้าเขียนคอลัมน์เดิมสำเร็จแต่ตารางกลางล้ม จอจะยังโชว์ค่าเก่า = คนกดแล้วเหมือนไม่ติด
 * ⚠️ คอลัมน์เดิมล้มเพราะยังไม่ migrate → **ไม่ throw** (ของใหม่ทำงานได้แล้ว) แค่ log
 */
export async function saveProgress(input: SaveProgressInput): Promise<SaveProgressResult> {
  const jobId = (input.jobId || '').trim();
  const e164 = toE164Thai(input.phone);
  if (!jobId) return { ok: false, reason: 'no_job' };
  if (!e164) return { ok: false, reason: 'no_phone' };

  const hasStatus = input.selectionStatus !== undefined;
  const hasChecklist = input.prepChecklist !== undefined;
  const hasUnit = input.unitSiteCode !== undefined || input.unitName !== undefined;
  const checklist = hasChecklist ? normalizePrepChecklist(input.prepChecklist) : null;

  let row: SelectionProgressRow | null = null;
  let centralWritten = false;
  try {
    const { rows } = await dbQuery<RawRow>(
      `insert into ${TABLE}
         (job_id, phone_e164, selection_status, prep_checklist, unit_site_code, unit_name,
          updated_by, updated_by_name)
       values ($1, $2, $3, coalesce($4::jsonb, '{}'::jsonb), $5, $6, $7::uuid, $8)
       on conflict (job_id, phone_e164) do update set
         selection_status = case when $9::boolean then excluded.selection_status else ${TABLE}.selection_status end,
         prep_checklist   = case when $10::boolean then excluded.prep_checklist else ${TABLE}.prep_checklist end,
         unit_site_code   = case when $11::boolean then excluded.unit_site_code else ${TABLE}.unit_site_code end,
         unit_name        = case when $11::boolean then excluded.unit_name else ${TABLE}.unit_name end,
         updated_by       = excluded.updated_by,
         updated_by_name  = excluded.updated_by_name,
         updated_at       = now()
       returning ${COLS}`,
      [
        jobId,
        e164,
        hasStatus ? input.selectionStatus : null,
        checklist ? JSON.stringify(checklist) : null,
        input.unitSiteCode ?? null,
        input.unitName ?? null,
        input.actor?.id ?? null,
        input.actor?.name ?? null,
        hasStatus,
        hasChecklist,
        hasUnit,
      ],
    );
    if (rows[0]) {
      row = mapRow(rows[0]);
      centralWritten = true;
    }
  } catch (e) {
    if (!isMissingSchema(e)) throw e;
    logError('selectionProgress.central.skipped', e, { reason: 'ยังไม่รัน migration 105' });
  }

  // ── คอลัมน์เดิม (094) — เขียนคู่กันไปเพื่อให้ถอยกลับได้ ──────────────────
  let legacyWritten = false;
  const appId = (input.applicationId || '').trim();
  if (appId && (hasStatus || hasChecklist)) {
    try {
      const { rows } = await dbQuery<{ id: string }>(
        `update ${APPS}
            set selection_status = case when $2::boolean then $3 else selection_status end,
                prep_checklist   = case when $4::boolean then $5::jsonb else prep_checklist end,
                updated_at = now()
          where id = $1::uuid
          returning id`,
        [appId, hasStatus, input.selectionStatus ?? null, hasChecklist, checklist ? JSON.stringify(checklist) : null],
      );
      legacyWritten = rows.length > 0;
    } catch (e) {
      if (!isMissingSchema(e)) throw e;
      logError('selectionProgress.legacy.skipped', e, { reason: 'ยังไม่รัน migration 094' });
    }
  }

  // ตารางกลางเขียนไม่ได้ (ยังไม่ migrate) แต่ของเดิมเขียนได้ → ประกอบผลจาก input
  if (!row) {
    row = {
      jobId,
      phoneE164: e164,
      selectionStatus: hasStatus ? (input.selectionStatus ?? null) : null,
      prepChecklist: checklist ?? {},
      unitSiteCode: input.unitSiteCode ?? null,
      unitName: input.unitName ?? null,
      updatedByName: input.actor?.name ?? null,
    };
  }
  return { ok: true, row, centralWritten, legacyWritten };
}
