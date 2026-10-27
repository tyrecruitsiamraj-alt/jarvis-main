/**
 * ═══ ดึงรายชื่อ "ส่งคนแทน" จาก iRecruit → สร้างสายในแท็บติดตามส่งคนแทน (2 ต.ค. 2569 · Journey 3 สาย + ดึงทุก 5 นาที 5 ต.ค. 2569) ═══
 *
 * 🔴 5 ต.ค. 2569: ลำดับข้างล่างเป็นของรุ่นแรก — ตอนนี้หนึ่งรอบ = `runIrecruitReplaceSync` (สร้าง/ย้ายเวลา/ยกเลิก ตาม `reconcileReplaceCalls`)
 *
 * เจ้าของส่ง SQL ของหน้า "จัดเวรติดตาม" มาเอง (ใบงาน `job_type='2'` สถานะ `WS` · คนไปแทน = `ir_job_request` ล่าสุด ·
 * ชื่อ/เบอร์จาก `z_hr_recruitment_header` ล่าสุด ตัดสถานะ C) และเคาะ: **ดึงเองทุกเช้า · เวลาโทรตั้งได้ · AI โทรเลย**
 *
 * ลำดับหนึ่งรอบ (`runIrecruitReplaceSync`):
 *   1. iRecruit ใช้ได้ไหม (สวิตช์ `IRECRUIT_ENABLED` + config) · ฐานรัน 133 แล้วไหม — ไม่ผ่าน = จดเหตุผล ไม่สร้างสาย
 *   2. ดึงใบ WS ที่เข้างานตั้งแต่วันนี้ถึง +N วัน (นาฬิกาไทย)
 *   3. ตัดใบที่เคยดึงแล้ว (`source_ref`) · ไม่มีเบอร์ 10 หลัก · เลยเวลาเข้างาน
 *   4. คนเดียวหลายใบ = **ชุดเดียว** (group_id เดียว · สายละวัน · ทุกสายเป็น "สายแรก" เพราะคนละวันคนละหน่วย ไม่ใช่โทรซ้ำ)
 *   5. ส่งแผนให้ Lumos **เฉพาะเมื่อ** `follow_entry` ตั้งเป็น auto (สวิตช์เดิมของเจ้าของ) — ไม่งั้นสายอยู่ในระบบแบบ `off` ให้คนกดส่งเอง
 *   6. จดผลรอบนี้ไว้ที่ `app_irecruit_replace_sync.payload.lastRun` ให้แท็บบอกได้
 *
 * 🔴 กันซ้ำที่ฐาน: `follow_entries.source_ref` unique — ดึงซ้ำ/สองรอบชนกัน = unique violation = นับว่ามีแล้ว ไม่โทรซ้ำ
 * 🔴 ไม่ลบ/ไม่แก้สายเดิมที่คนกรอกเอง · ไม่แตะใบที่ iRecruit เปลี่ยนสถานะไปแล้ว (ยกเลิกเองในหน้าติดตามเหมือนสายปกติ)
 * ตรรกะเวลาโทร/คีย์/ค่าตั้งอยู่ `src/lib/irecruitReplaceSync.ts` (มีเทสต์) · ไฟล์นี้ต่อฐาน + iRecruit + Lumos
 */
import { createHash, randomUUID } from 'node:crypto';
import { dbQuery, isPgUndefinedTable, isPgUniqueViolation, withSessionLock } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { irecruitSqlQuery, irecruitUnavailableReason } from './irecruitSqlServer.js';
import { toE164Thai } from './thaiPhone.js';
import { isAutoDispatchEnabled } from './lumosDispatchMode.js';
import {
  cancelFollowReminder,
  cancelPushedReminderIgnoringMissing,
  enqueueFollowReminderPlan,
  replanFollowSetWithLumos,
  type FollowEntryInput,
} from './lumosDispatch.js';
import { KEEP_PUSH_FAILED_SQL } from '../../src/lib/followDispatchState.js';
import { getLumosPushConfig } from './lumosPushClient.js';
import { staffNameOfPhone } from './followStaffName.js';
import { bangkokBusinessDateYmd } from './businessDate.js';
import { auditContextFromActor, writeAudit } from './audit.js';
import { logError, logInfo, logWarn, errorSummaryText } from './logger.js';
import { FOLLOW_TEAM_REPLACEMENT } from '../../src/lib/followReplacement.js';
import type { FollowDispatchState } from '../../src/lib/followDispatchState.js';
import {
  DEFAULT_REPLACE_CALL_RULE,
  normalizeReplaceCallRule,
  replaceAiPhoneOf,
  replaceAiPhonesCoverYmd,
  replaceWorkYmd,
  replacePhoneKey,
  planReplaceCallsFull,
  reconcileReplaceCalls,
  REPLACE_FOLLOW_TOPIC,
  REPLACE_SYNC_ACTOR_NAME,
  REPLACE_SYNC_DEFAULTS,
  replaceCallModeFor,
  replaceModeForType,
  replaceSlotNote,
  replaceSiteShortName,
  irecruitChangedSinceSync,
  irecruitLabelChanged,
  replaceSlotRef,
  parseReplaceRef,
  pickReplaceJobPerPhoneTime,
  wantWallFromSqlDate,
  type ReplaceCallRule,
  type ReplaceDesiredCall,
  type ReplaceExistingCall,
  type ReplaceSyncSummary,
  type ReplaceWantWall,
} from '../../src/lib/irecruitReplaceSync.js';

const followTable = tableInAppSchema('follow_entries');
const REPLACE_QUEUE_TABLE = tableInAppSchema('lumos_dispatch_queue');
const settingsTable = tableInAppSchema('app_irecruit_replace_sync');

/** 42703 undefined_column — โค้ดใหม่ขึ้นก่อน migration 133 (`source_ref`) */
function isUndefinedColumn(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '42703';
}

export const MIGRATION_133_NOT_READY = 'ฐานยังไม่รัน migration 133 — ยังไม่สร้างสาย (รอ deploy รอบ migrate)';

/** แถวจาก iRecruit — เท่าที่ต้องใช้ (ชื่อ/เบอร์เป็นข้อมูลคน ห้ามพิมพ์ลง log) */
export type IrecruitReplaceRow = {
  job_id: string | number;
  replace_no: string | null;
  fname: string | null;
  lname: string | null;
  mobile: string | null;
  site_name: string | null;
  site_code: string | null;
  want_date: Date;
  /**
   * กลุ่มคนไปแทน — 'WL' = อยู่ในรายชื่อ WL ของ iRecruit (`staff_wl_view`) · 'EX' = ไม่ใช่ WL
   * 🔴 8 ต.ค. 2569 เลิกอ่าน `z_hr_recruitment_header.replace_type` (IN/EX ในประวัติค้างค่าเก่า — อิศเรศลาออก ก.พ. 2022
   *    แต่ยังติด IN ⇒ ขึ้นคนโทรผิด · คนที่ติด IN อยู่ในพนักงานจริงแค่ 8 จาก 55) · เจ้าของ: *"แค่ WL ที่คนโทร ที่เหลือ AI เลย"*
   */
  replace_type?: string | null;
  /** อีเมล/ชื่อคนที่เพิ่มใบใน iRecruit — โชว์เป็น "เพิ่มโดย" */
  adder_email?: string | null;
  adder_name?: string | null;
  /**
   * คนแก้ใบล่าสุดใน iRecruit (`user_update` — ชื่อในหน้า /replaces · เจ้าของ 27 ต.ค. 2569 Choice
   * "คนแก้ล่าสุด ถ้ามี · ไม่มี = คนสร้างใบ") — ใช้เป็นเจ้าหน้าที่ของสาย (เบอร์ที่ AI บอกให้โทรกลับ)
   * ⚠️ ใบที่ยังเปิดส่วนใหญ่ไม่มีคนแก้ (573/588 วัด 27 ต.ค.) ⇒ ถอยไปคนสร้างใบ
   */
  updater_email?: string | null;
};

/** "เพิ่มโดย" ของสายที่ดึงมา — อีเมลคนเพิ่มใบใน iRecruit · ไม่มีอีเมล = ชื่อ · ไม่รู้เลย = null (ใช้ป้ายของรอบดึง) */
export function replaceAdderLabel(r: Pick<IrecruitReplaceRow, 'adder_email' | 'adder_name'>): string | null {
  const email = (r.adder_email ?? '').trim();
  if (email) return email;
  const name = (r.adder_name ?? '').trim();
  return name || null;
}

/** +66XXXXXXXXX → 0XXXXXXXXX (รูปเดียวกับ staff_phone ของงานติดตาม) */
export function localThaiPhoneOf(raw: string | null | undefined): string | null {
  const e164 = toE164Thai(raw ?? '');
  return e164 ? `0${e164.slice(3)}` : null;
}

/**
 * เบอร์ฉุกเฉิน = เบอร์ของคนเพิ่มแผนใน iRecruit จากหน้าผู้ใช้งาน (จับด้วยอีเมล · เจ้าของ 20 ต.ค. 2569
 * "ถ้าดึงมาจะได้ match ชื่อเบอร์ฉุกเฉินเข้าไปเลย") · อ่านไม่ได้ = Map ว่าง (สายยังสร้างได้ตามเดิม)
 */
async function loadAdderPhones(emails: ReadonlyArray<string | null | undefined>): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const keys = [...new Set(emails.map((e) => (e ?? '').trim().toLowerCase()).filter((e) => e.includes('@')))];
  if (keys.length === 0) return out;
  try {
    const { rows } = await dbQuery<{ e: string; phone: string | null }>(
      `select lower(btrim(email)) as e, phone from ${tableInAppSchema('users')}
        where lower(btrim(email)) = any($1::text[]) and coalesce(btrim(phone), '') <> ''`,
      [keys],
    );
    for (const r of rows) {
      const local = localThaiPhoneOf(r.phone);
      if (local) out.set(r.e, local);
    }
  } catch (e) {
    logWarn('irecruit.replaceSync: อ่านเบอร์คนเพิ่มแผนไม่สำเร็จ', { error: errorSummaryText(e) });
  }
  return out;
}

function shiftYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * SQL ของเจ้าของ (2 ต.ค. 2569) — เพิ่ม `site_code` ให้ผูกหน่วยงานได้ · ช่วงวันเป็นนาฬิกาไทย
 * (driver ถือค่าในฐานเป็น UTC ⇒ ส่ง Date ที่ส่วน UTC = นาฬิกาไทย · `to` ไม่รวม = วันถัดจาก toYmd)
 */
/** ลงย้อนหลัง: ต้องเพิ่งลงใน iRecruit ภายในกี่วัน (นาฬิกาไทยตาม `date_add`) — วันเข้างานย้อนได้ไม่จำกัด */
const REPLACE_PAST_ADDED_DAYS = 2;

/**
 * เหตุการณ์ที่ iRecruit แก้ / ยกเลิกใบ → audit (หน้าหลักนับ "iRecruit แก้กี่ใบ / ยกเลิกกี่ใบ" · เจ้าของ 7 ต.ค. 2569 "ต้องมี")
 * ⚠️ จดไม่สำเร็จห้ามทำให้รอบดึงล้ม
 */
const REPLACE_EVENT_CTX = auditContextFromActor({ userId: '', userEmail: REPLACE_SYNC_ACTOR_NAME, role: 'admin' });
async function logReplaceEvent(
  kind: 'edit' | 'cancel',
  followId: string,
  info: { job: string; name: string; unit: string | null; what?: string },
): Promise<void> {
  try {
    await writeAudit(REPLACE_EVENT_CTX, {
      action: `irecruit_replace_sync.${kind}`,
      entityType: 'follow_entry',
      entityId: followId,
      after: info,
    });
  } catch (e) {
    logWarn('irecruit.replaceSync: จดเหตุการณ์ไม่สำเร็จ', { kind, error: errorSummaryText(e) });
  }
}

export async function fetchIrecruitReplaceRows(fromYmd: string, toYmd: string): Promise<IrecruitReplaceRow[]> {
  return irecruitSqlQuery<IrecruitReplaceRow>(
    `SELECT h.job_id, h.replace_no, z.fname, z.lname, z.mobile,
            CASE WHEN wl.staff_id IS NOT NULL THEN 'WL' ELSE 'EX' END AS replace_type,
            s.site_name, h.site_code, h.want_date,
            COALESCE(ua.email, ad.email) AS adder_email, COALESCE(hs.nm, ad.name) AS adder_name,
            COALESCE(uu.email, au.email) AS updater_email
       FROM ir_job_header h
       -- คนแก้ใบล่าสุด (หน้า /replaces · 27 ต.ค. 2569) — เจ้าหน้าที่ของสาย · ไม่มี = คนเพิ่มใบ
       OUTER APPLY (SELECT TOP 1 u.email FROM users u WHERE h.user_update IS NOT NULL AND u.staff_id = h.user_update) uu
       OUTER APPLY (SELECT TOP 1 LTRIM(RTRIM(a.email)) AS email FROM admins a WHERE h.user_update IS NOT NULL AND a.staff_id = h.user_update) au
       -- คนที่เพิ่มใบใน iRecruit (7 ต.ค. 2569 เจ้าของ "ดึงเมล์คนเพิ่มแผนมาด้วย") — users.staff_id = เลขบัตรใน user_add
       OUTER APPLY (SELECT TOP 1 u.email FROM users u WHERE u.staff_id = h.user_add) ua
       -- 🔴 เจ้าหน้าที่หลังบ้านอยู่ตาราง admins ไม่ใช่ users (20 ต.ค. 2569 — เดิมเห็นแค่ชื่อนุศรา · 1,010 ใบของพลอยขึ้น "ดึงจาก iRecruit")
       OUTER APPLY (SELECT TOP 1 LTRIM(RTRIM(a.email)) AS email, LTRIM(RTRIM(a.name)) AS name FROM admins a WHERE a.staff_id = h.user_add) ad
       OUTER APPLY (
         SELECT TOP 1 LTRIM(RTRIM(CONCAT(LTRIM(RTRIM(st.fname)), N' ', LTRIM(RTRIM(st.lname))))) AS nm FROM hr_staff st WHERE st.staff_id = h.user_add
       ) hs
       OUTER APPLY (
         SELECT TOP 1 jr.staff_id
         FROM ir_job_request jr
         WHERE jr.job_id = h.job_id
         ORDER BY jr.date_add DESC
       ) cand
       OUTER APPLY (
         SELECT TOP 1 zz.fname, zz.lname, zz.mobile, zz.status, zz.replace_type
         FROM z_hr_recruitment_header zz
         WHERE zz.id_card = cand.staff_id
         ORDER BY zz.date_update DESC, zz.date_add DESC
       ) z
       -- WL = รายชื่อ WL ของ iRecruit (84 คน 8 ต.ค. 2569) — ตัวเดียวที่ตัดสินคนโทร (ที่เหลือ AI)
       OUTER APPLY (SELECT TOP 1 w.staff_id FROM staff_wl_view w WHERE w.staff_id = cand.staff_id) wl
       LEFT JOIN ir_ms_site s ON s.site_code = h.site_code
      -- 🔴 W "รอดำเนินการ" ด้วย (เจ้าของ 7 ต.ค. 2569 Choice "ตามด้วย" — วิภพ/นันทชัยใบ W ไม่ขึ้น) · C = ยกเลิก ไม่เอา
      WHERE h.status IN ('W', 'WS')
        AND h.job_type = '2'
        AND (
          (h.want_date >= @from AND h.want_date < @to)
          -- 🔴 ลงย้อนหลัง (เจ้าของ 7 ต.ค. 2569 "เอาด้วย ดึงมาแต่ไม่ต้องส่งไป lumos" · "ไม่ต้องกำหนด 7 วัน"):
          --    วันเข้างานเลยไปแล้ว (ย้อนกี่วันก็ได้) แต่เพิ่งลงใน iRecruit ภายใน 2 วัน ⇒ ขึ้นบนจอ สายทั้งหมดเป็นคนโทร
          OR (h.want_date < @from AND h.date_add >= @addedSince)
        )
        AND ISNULL(z.status, '') <> 'C'
      ORDER BY h.want_date ASC`,
    {
      from: new Date(`${fromYmd}T00:00:00Z`),
      to: new Date(`${shiftYmd(toYmd, 1)}T00:00:00Z`),
      addedSince: new Date(`${shiftYmd(fromYmd, -REPLACE_PAST_ADDED_DAYS)}T00:00:00Z`),
    },
  );
}

export type ReplaceSyncSettings = {
  rule: ReplaceCallRule;
  lastRun: ReplaceSyncSummary | null;
  updatedAt: string | null;
  updatedByName: string | null;
  /** ตาราง 133 มีแล้วไหม — ไม่มี = บอกตรง ๆ ว่าฐานยังไม่พร้อม (ห้ามเดา) */
  tableReady: boolean;
};

type SettingsRow = { payload: unknown; updated_at: string | Date | null; updated_by_name: string | null };

function parsePayload(raw: unknown): { rule: ReplaceCallRule; lastRun: ReplaceSyncSummary | null } {
  const p = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const lr = p.lastRun;
  const lastRun =
    typeof lr === 'object' && lr !== null && typeof (lr as { at?: unknown }).at === 'string' ? (lr as ReplaceSyncSummary) : null;
  return { rule: normalizeReplaceCallRule(p.rule), lastRun };
}

export async function getReplaceSyncSettings(): Promise<ReplaceSyncSettings> {
  try {
    const { rows } = await dbQuery<SettingsRow>(
      `select payload, updated_at, updated_by_name from ${settingsTable} where id = 'default' limit 1`,
    );
    const row = rows[0];
    const parsed = parsePayload(row?.payload);
    return {
      ...parsed,
      updatedAt: row?.updated_at ? new Date(row.updated_at).toISOString() : null,
      updatedByName: row?.updated_by_name ?? null,
      tableReady: true,
    };
  } catch (e) {
    if (!isPgUndefinedTable(e)) throw e;
    return { rule: DEFAULT_REPLACE_CALL_RULE, lastRun: null, updatedAt: null, updatedByName: null, tableReady: false };
  }
}

/** เขียนทับเฉพาะคีย์ที่ส่งมา (jsonb ||) — กติกากับผลรอบล่าสุดเขียนคนละจังหวะ ห้ามทับกัน */
export async function saveReplaceSyncSettings(
  patch: { rule?: ReplaceCallRule; lastRun?: ReplaceSyncSummary },
  updatedByName: string | null,
): Promise<void> {
  await dbQuery(
    `insert into ${settingsTable} (id, payload, updated_at, updated_by_name)
     values ('default', $1::jsonb, now(), $2)
     on conflict (id) do update
       set payload = ${settingsTable}.payload || excluded.payload,
           updated_at = now(),
           updated_by_name = excluded.updated_by_name`,
    [JSON.stringify(patch), updatedByName],
  );
}

/** ข้อมูลประกอบของสายที่ iRecruit ต้องการ — ใช้ตอนสร้าง/ย้ายเวลา (ชื่อ/เบอร์เป็นข้อมูลคน ห้ามพิมพ์ลง log) */
type DesiredMeta = ReplaceDesiredCall & {
  round: 1 | 2 | 3;
  name: string;
  phone: string;
  wall: ReplaceWantWall;
  siteName: string | null;
  siteCode: string | null;
  /** "เพิ่มโดย" — อีเมลคนเพิ่มใบใน iRecruit (`replaceAdderLabel`) */
  adder: string | null;
  mode: 'ai' | 'manual';
  /** เบอร์ฉุกเฉินของคนในรายชื่อให้ AI โทร (`rule.aiPhones`) · ไม่อยู่ในรายชื่อ = null */
  emergency: string | null;
  /** ประเภทจาก iRecruit (EX · คนใน ฯลฯ) — เก็บลงแถวให้หน้าติดตามกรองได้ (136 · เจ้าของสั่ง 6 ต.ค. 2569) */
  replaceType: string | null;
};

type ExistingRow = {
  id: string;
  source_ref: string;
  scheduled_at: string | Date;
  mode: string;
  group_id: string | null;
  recipient_phone: string | null;
  pending: boolean;
  /** ยกเลิกแล้ว — ใบซ้ำต้องรู้ว่าใบไหนยังมีแถวที่ใช้อยู่ (`pickReplaceJobPerPhoneTime`) */
  cancelled: boolean;
  /** สร้างก่อนกติกา EX = AI · คนใน = คนโทร — เฉพาะแถวพวกนี้ที่รอบดึงเปลี่ยน AI → คนโทรให้เอง */
  /** เจ้าหน้าที่เคยแก้แถวนี้บนระบบ (`updated_by` — รอบดึงไม่เคยตั้งค่านี้) */
  staff_edited: boolean;
  /** เวลาเข้างานของ iRecruit ตอนดึงครั้งล่าสุด (`irecruit_note` 156 · ไม่มี = หมายเหตุเดิม) — ไม่ใช่หมายเหตุที่เจ้าหน้าที่แก้ */
  note: string | null;
  /** ชื่อ/หน่วยงานปัจจุบันในแถว — iRecruit แก้แล้วต้องตาม (7 ต.ค. 2569) */
  recipient_name: string | null;
  unit_name: string | null;
  site_code: string | null;
  /** ชื่อ/หน่วยงานของ iRecruit ตอนดึงล่าสุด (156 · ไม่มี = ค่าในแถว) — ตัดสิน "แก้ล่าสุดชนะ" */
  irecruit_name?: string | null;
  irecruit_unit_name?: string | null;
  irecruit_site_code?: string | null;
};

/** คีย์คนไปแทน — แฮชเบอร์ (ไม่เก็บเบอร์ดิบในคีย์) · เปลี่ยนคน = คีย์ใหม่ */
function personKeyOf(phone: string): string {
  return createHash('sha1').update(phone).digest('hex').slice(0, 10);
}

/** ระยะกันชน — สายที่จะโทรภายในนี้ถือว่ากำลังโทร แตะไม่ได้ */
const LOCK_AHEAD_MS = 2 * 60_000;

let running = false;

/** รอบหนึ่งกำลังเดินอยู่ไหม (ปุ่ม "ดึงตอนนี้" กับ worker ชนกันได้) */
export function isReplaceSyncRunning(): boolean {
  return running;
}

/** ส่งแผนให้ Lumos ทีละ "คน + วัน" (หนึ่งแผนต่อวัน) — คืนสถานะต่อแถว */
async function enqueueByPersonDay(items: Array<{ id: string; meta: DesiredMeta }>): Promise<Map<string, FollowDispatchState>> {
  const out = new Map<string, FollowDispatchState>();
  const groups = new Map<string, Array<{ id: string; meta: DesiredMeta }>>();
  for (const it of items) {
    const key = `${it.meta.phone}|${bangkokBusinessDateYmd(it.meta.at)}`;
    groups.set(key, [...(groups.get(key) ?? []), it]);
  }
  /**
   * 🔴 เบอร์ฉุกเฉินของแถว (12 ต.ค. 2569) — เดิมส่ง null เสมอ ⇒ Lumos ใช้เบอร์สำรองแทนเบอร์ที่ตั้งไว้
   * ใช้ของแถวก่อน (เจ้าหน้าที่ตั้งเอง / รายชื่อให้ AI โทร) แล้วค่อยถอยไปเบอร์ในรายชื่อ
   */
  const staffPhoneOf = new Map<string, string | null>();
  try {
    const { rows } = await dbQuery<{ id: string; staff_phone: string | null }>(
      `select id::text as id, staff_phone from ${followTable} where id = any($1::uuid[])`,
      [items.map((it) => it.id)],
    );
    for (const r of rows) staffPhoneOf.set(r.id, (r.staff_phone ?? '').trim() || null);
  } catch (e) {
    logWarn('irecruit.replaceSync: อ่านเบอร์ฉุกเฉินไม่สำเร็จ', { error: errorSummaryText(e) });
  }
  for (const list of groups.values()) {
    const inputs: FollowEntryInput[] = [];
    for (const { id, meta } of list) {
      const staffPhone = staffPhoneOf.get(id) ?? meta.emergency;
      inputs.push({
      id,
      recipient_name: meta.name,
      recipient_phone: meta.phone,
      topic: REPLACE_FOLLOW_TOPIC,
      note: replaceSlotNote(meta.slot, meta.wall),
      staffPhone,
      scheduled_at: meta.at,
      callTimes: null,
      callRound: meta.round,
      staffName: staffPhone ? await staffNameOfPhone(staffPhone) : null,
      unitName: meta.siteName,
      });
    }
    try {
      for (const [id, st] of await enqueueFollowReminderPlan(inputs)) out.set(id, st);
    } catch (e) {
      // 🔴 13 ต.ค. 2569 (A13): เดิมตกเป็น "ปิดส่งอัตโนมัติ" ซึ่งโกหก · `guarded` = ตัวกู้ทุกนาทีส่งให้
      for (const it of inputs) out.set(it.id, 'guarded');
      logError('irecruit.replaceSync: ส่งแผนให้ Lumos ไม่สำเร็จ — ตัวกู้จะส่งให้', e, { rows: inputs.length });
    }
  }
  return out;
}

/** จำชื่อ/หน่วยงานของ iRecruit (156) — ค่าบนจอตรงอยู่แล้ว แต่ iRecruit เพิ่งเปลี่ยนมาเท่ากัน · ฐานยังไม่รัน 156 = ข้าม */
async function rememberIrecruitLabel(id: string, meta: { name: string; siteName: string | null; siteCode: string | null }): Promise<void> {
  try {
    await dbQuery(
      `update ${followTable} set irecruit_name = $2, irecruit_unit_name = $3, irecruit_site_code = $4 where id = $1`,
      [id, meta.name, meta.siteName, meta.siteCode],
    );
  } catch (e) {
    if (!isUndefinedColumn(e)) logWarn('irecruit.replaceSync: จำชื่อ/หน่วยงานของ iRecruit ไม่สำเร็จ', { id, error: errorSummaryText(e) });
  }
}

async function setDispatchState(id: string, state: FollowDispatchState): Promise<void> {
  try {
    await dbQuery(`update ${followTable} set dispatch_state = $2 where id = $1 and ${KEEP_PUSH_FAILED_SQL}`, [id, state]);
  } catch (e) {
    if (!isUndefinedColumn(e)) throw e;
  }
}

/**
 * ═══ หนึ่งรอบ (ทุก 5 นาที · เจ้าของสั่ง 5 ต.ค. 2569) ═══
 * ดึงใบ WS → สายที่ต้องมี (`planReplaceCalls` 3 สาย) → เทียบกับสายที่มี (`reconcileReplaceCalls`) →
 * ยกเลิก (ใบยกเลิก/เปลี่ยนคน/รุ่นเก่า) · ย้ายเวลา (iRecruit แก้เวลา) · สร้างใหม่ — ส่ง Lumos เฉพาะสาย AI เมื่อสวิตช์ follow_entry เปิด
 * 🔴 ดึงพัง/ได้ 0 ใบทั้งที่มีสายรอโทร = ไม่ยกเลิกอะไรเลย (ห้ามล้างทั้งระบบเพราะรอบเดียวพัง)
 */
/**
 * 🔴 ล็อกเดียวของงานที่แตะ "ใครโทร" ของสายส่งคนแทน (12 ต.ค. 2569 — race ที่เจอจริง):
 * รอบดึง iRecruit อ่านสาย AI ตอนต้นรอบ แล้วส่งแผนให้ Lumos ตอนท้าย · ระหว่างนั้นกดพัก AI เปลี่ยนสายเป็นคนโทร
 * ⇒ รอบดึงส่งแผนของสายที่เพิ่งเป็นคนโทรไป (AI โทรสายคนโทร) · ล็อกนี้ทำให้ดึง / พัก AI / AI เริ่มโทรตั้งแต่ เดินทีละงาน
 * ⚠️ ห้ามเรียกซ้อนกันข้างใน (ล็อกระดับ session บนคนละ connection = รอตัวเองจนค้าง)
 */
const REPLACE_SYNC_LOCK_KEY = 731_041_210;

export async function runIrecruitReplaceSync(
  opts: { now?: Date; horizonDays?: number; actorName?: string } = {},
): Promise<ReplaceSyncSummary> {
  return withSessionLock(REPLACE_SYNC_LOCK_KEY, () => runIrecruitReplaceSyncUnlocked(opts));
}

async function runIrecruitReplaceSyncUnlocked(
  opts: { now?: Date; horizonDays?: number; actorName?: string } = {},
): Promise<ReplaceSyncSummary> {
  const now = opts.now ?? new Date();
  const horizon = opts.horizonDays ?? REPLACE_SYNC_DEFAULTS.horizonDays;
  const actorName = opts.actorName ?? REPLACE_SYNC_ACTOR_NAME;
  const fromYmd = bangkokBusinessDateYmd(now);
  const summary: ReplaceSyncSummary = {
    at: now.toISOString(),
    fromYmd,
    toYmd: shiftYmd(fromYmd, horizon),
    fetched: 0,
    added: 0,
    alreadyIn: 0,
    noPhone: 0,
    pastDue: 0,
    asap: 0,
    queued: 0,
    notSent: 0,
    realigned: 0,
    cancelled: 0,
    error: null,
  };
  if (running) {
    summary.error = 'กำลังดึงอยู่ รอรอบนี้จบก่อน';
    return summary;
  }
  running = true;
  try {
    const unavailable = irecruitUnavailableReason();
    if (unavailable) {
      summary.error = unavailable;
      await persistLastRun(summary, actorName);
      return summary;
    }
    const settings = await getReplaceSyncSettings();
    if (!settings.tableReady) {
      summary.error = MIGRATION_133_NOT_READY;
      return summary;
    }

    let rows: IrecruitReplaceRow[];
    try {
      rows = await fetchIrecruitReplaceRows(summary.fromYmd, summary.toYmd);
    } catch (e) {
      summary.error = `ต่อ iRecruit ไม่ได้: ${errorSummaryText(e)}`;
      logError('irecruit.replaceSync: ดึงจาก iRecruit ไม่สำเร็จ', e);
      await persistLastRun(summary, actorName);
      return summary;
    }
    summary.fetched = rows.length;
    const adderPhones = await loadAdderPhones([...rows.map((r) => r.adder_email), ...rows.map((r) => r.updater_email)]);

    // ── สายที่ iRecruit ต้องการตอนนี้ ──
    const desired: DesiredMeta[] = [];
    for (const r of rows) {
      const phone = toE164Thai(r.mobile);
      if (!phone) {
        summary.noPhone += 1;
        continue;
      }
      const wall = wantWallFromSqlDate(r.want_date instanceof Date ? r.want_date : new Date(String(r.want_date)));
      /**
       * 🔴 3 สายครบทุกใบ · สายที่เลยเวลาแล้ว = คนโทร (เจ้าของ 7 ต.ค. 2569 "ต้องมี 3 สายนะทุกคนเลย" · ลงย้อนหลัง "ขึ้น แต่ไม่โทร")
       * เดิมใบที่เลยเวลาเข้างานแล้วข้ามทั้งใบ (`pastDue`) ⇒ คนที่ทีมเพิ่งเพิ่มไม่ขึ้นบนจอเลย
       */
      const plans = planReplaceCallsFull(wall, now, settings.rule);
      if (plans.length === 0) continue;
      if (plans.every((p) => p.past)) summary.pastDue += 1;
      const name = `${(r.fname ?? '').trim()} ${(r.lname ?? '').trim()}`.trim() || 'คนไปแทนงาน';
      const personKey = personKeyOf(phone);
      // 🔴 รายชื่อให้ AI โทร (เจ้าของ 12 ต.ค. 2569) — ทับพัก AI / WL · สายที่เลยเวลายังเป็นคนโทร
      const listed = replaceAiPhonesCoverYmd(settings.rule, wall.ymd) ? replaceAiPhoneOf(settings.rule, phone) : null;
      for (const p of plans) {
        const typeMode: 'ai' | 'manual' = listed
          ? 'ai'
          : replaceModeForType(r.replace_type, replaceCallModeFor(p.at, settings.rule.aiFrom, settings.rule.aiPaused));
        desired.push({
          ref: replaceSlotRef(r.job_id, p.slot, personKey),
          jobId: String(r.job_id).trim(),
          slot: p.slot,
          round: p.round,
          at: p.at,
          asap: p.asap,
          name,
          phone,
          wall,
          siteName: replaceSiteShortName(r.site_name),
          adder: replaceAdderLabel(r),
          siteCode: r.site_code?.trim() || null,
          // สายที่เลยเวลาแล้ว = คนโทร (AI ไม่โทรย้อนหลัง)
          mode: p.past ? 'manual' : typeMode,
          // รายชื่อให้ AI โทรตั้งเบอร์ไว้ = ใช้ก่อน · ไม่มี = เบอร์คนแก้ใบล่าสุด · ไม่มี = เบอร์คนเพิ่มแผน (หน้าผู้ใช้งาน · 27 ต.ค. 2569)
          emergency:
            listed?.emergency ??
            adderPhones.get((r.updater_email ?? '').trim().toLowerCase()) ??
            adderPhones.get((r.adder_email ?? '').trim().toLowerCase()) ??
            null,
          replaceType: (r.replace_type ?? '').trim() || null,
        });
      }
    }

    // ── สายที่มีอยู่ (ทั้งรุ่นเก่าหนึ่งใบหนึ่งสาย และรุ่น 3 สาย) ──
    let existingRows: ExistingRow[];
    try {
      const { rows: ex } = await dbQuery<ExistingRow>(
        `select id, source_ref, scheduled_at, coalesce(call_mode, 'ai') as mode, group_id::text as group_id, recipient_phone,
                (cancelled_at is null and completed_at is null and staff_call_outcome is null
                  and scheduled_at > $1::timestamptz) as pending,
                (cancelled_at is not null) as cancelled,
                (updated_by is not null) as staff_edited, coalesce(irecruit_note, note) as note, recipient_name, unit_name, site_code,
                coalesce(irecruit_name, recipient_name) as irecruit_name,
                coalesce(irecruit_unit_name, unit_name) as irecruit_unit_name,
                coalesce(irecruit_site_code, site_code) as irecruit_site_code
           from ${followTable}
          where source_ref like 'irecruit-replace:%'
            and (scheduled_at >= $2::timestamptz or source_ref = any($3::text[]))`,
        [
          new Date(now.getTime() + LOCK_AHEAD_MS).toISOString(),
          new Date(now.getTime() - 3 * 86_400_000).toISOString(),
          // ใบลงย้อนหลัง (วันเข้างานเก่ากว่า 3 วัน) — หาด้วยคีย์ ไม่งั้นทุกรอบพยายามสร้างซ้ำแล้วชนตัวกันซ้ำ
          desired.map((d) => d.ref),
        ],
      );
      existingRows = ex;
    } catch (e) {
      if (isUndefinedColumn(e)) {
        summary.error = MIGRATION_133_NOT_READY;
        await persistLastRun(summary, actorName);
        return summary;
      }
      throw e;
    }
    // ── ใบซ้ำ: คนเดียวหลายใบ เวลาเข้างานเดียวกัน = เหลือใบเดียว (เจ้าของ Choice 10 ต.ค. 2569) ──
    {
      const activeJobs = new Set<string>();
      for (const x of existingRows) {
        const jobId = parseReplaceRef(x.source_ref)?.jobId;
        if (jobId && !x.cancelled && x.recipient_phone) activeJobs.add(`${jobId}|${x.recipient_phone}`);
      }
      const picked = pickReplaceJobPerPhoneTime(desired, activeJobs);
      if (picked.droppedJobs.length > 0) {
        summary.duplicateJobs = picked.droppedJobs.length;
        logInfo('irecruit.replaceSync: ใบซ้ำเวลาเข้างานเดียวกัน เหลือใบเดียว', { dropped: picked.droppedJobs });
        desired.splice(0, desired.length, ...picked.kept);
      }
    }
        /** ยกเลิกได้เฉพาะสายที่นัดก่อนวันท้ายของช่วงที่ดึง — ใบที่เข้างานเลยช่วงไป iRecruit ไม่ได้ตอบมารอบนี้ (ไม่ใช่ถูกยกเลิก) */
    const cancelCutoff = new Date(`${summary.toYmd}T00:00:00+07:00`).getTime();
    const existing: ReplaceExistingCall[] = existingRows.map((x) => {
      const at = new Date(x.scheduled_at);
      return { id: x.id, ref: x.source_ref, scheduledAt: at, state: x.pending && at.getTime() < cancelCutoff ? 'pending' : 'locked' };
    });
    // แถวที่นัดเลยวันท้ายช่วง: ยังย้ายเวลาได้ ⇒ ให้เป็น pending สำหรับการย้าย แต่ห้ามยกเลิก — แยกจัดการข้างล่าง
    const pendingBeyond = new Set(
      existingRows.filter((x) => x.pending && new Date(x.scheduled_at).getTime() >= cancelCutoff).map((x) => x.source_ref),
    );
    const pendingCount = existingRows.filter((x) => x.pending).length;
    const safeToCancel = !(rows.length === 0 && pendingCount > 0);
    if (!safeToCancel) logWarn('irecruit.replaceSync: iRecruit ตอบ 0 ใบแต่มีสายรอโทร — รอบนี้ไม่ยกเลิกอะไร', { pending: pendingCount });

    const plan = reconcileReplaceCalls(
      desired,
      existing.map((e) => (pendingBeyond.has(e.ref) ? { ...e, state: 'pending' as const } : e)),
      { safeToCancel },
    );
    plan.cancel = plan.cancel.filter((c) => !pendingBeyond.has(c.ref));
    const metaByRef = new Map(desired.map((d) => [d.ref, d]));
    const rowById = new Map(existingRows.map((x) => [x.id, x]));
    /**
     * 🔴 แก้ล่าสุดชนะ (เจ้าของ 7 ต.ค. 2569: *"ถ้าแก้มาจาก irecruit ใช้ irecruit แก้บนระบบใช้บนระบบ อันไหนแก้ล่าสุดใช้อันนั้น"*)
     * เดิมรอบดึงย้ายเวลากลับตาม iRecruit ทุก 5 นาที ⇒ เจ้าหน้าที่แก้เวลาบนระบบไม่ติด
     * iRecruit ไม่มีเวลาแก้ไขให้เทียบ ⇒ ใช้หมายเหตุ (เวลาเข้างานของ iRecruit ตอนดึงล่าสุด):
     * หมายเหตุยังตรงกับ iRecruit ตอนนี้ = iRecruit ไม่ได้เปลี่ยน ⇒ ที่เวลาไม่ตรงคือเจ้าหน้าที่แก้ทีหลัง → ไม่ทับ
     * หมายเหตุไม่ตรง = iRecruit เปลี่ยนทีหลัง → ย้ายตาม iRecruit
     */
    plan.reschedule = plan.reschedule.filter(({ existing: ex, desired: d }) => {
      const row = rowById.get(ex.id);
      const meta = metaByRef.get(d.ref);
      if (!row?.staff_edited || !meta) return true;
      return irecruitChangedSinceSync(row.note, replaceSlotNote(meta.slot, meta.wall));
    });
    summary.alreadyIn = desired.length - plan.create.length;
    summary.asap = plan.create.filter((c) => c.asap).length;

    const autoAi =
      plan.create.length > 0 || plan.reschedule.length > 0 ? await isAutoDispatchEnabled('follow_entry') : false;

    // ── 1) ยกเลิก (ก่อนสร้างของคนใหม่ — กันแผนสองคนชนกัน) ──
    /**
     * 🔴 ติดธงยกเลิก **ทุกแถวของรอบนี้ก่อน** แล้วค่อยบอก Lumos ทีละแผน แผนละครั้ง (6 ต.ค. 2569)
     * เดิมทำทีละแถว: ติดธงแถวแรก → `cancelFollowReminder` ส่งแผนใหม่ที่มีพี่น้องที่ยังไม่ติดธง → แถวถัดไปต้องลบแผนใหม่
     * ซึ่งพลาดได้ (Lumos รับ push แบบ async · 404 ถูกกลืน) ⇒ วัดจริง: สายที่ยกเลิก 5 ต.ค. ถูก Lumos โทรเช้า 6 ต.ค. 7 สาย
     */
    const cancelIds = plan.cancel.map((c) => c.id);
    if (cancelIds.length > 0) {
      try {
        const { rows: done } = await dbQuery<{ id: string }>(
          `update ${followTable} set cancelled_at = now()
            where id = any($1::uuid[]) and cancelled_at is null and completed_at is null returning id`,
          [cancelIds],
        );
        summary.cancelled = (summary.cancelled ?? 0) + done.length;
        for (const r of done) {
          const x = rowById.get(r.id);
          await logReplaceEvent('cancel', r.id, {
            job: parseReplaceRef(x?.source_ref ?? '')?.jobId ?? '',
            name: x?.recipient_name ?? '',
            unit: x?.unit_name ?? null,
          });
        }
        const aiIds = done.map((r) => r.id).filter((id) => rowById.get(id)?.mode === 'ai');
        const res = await cancelFlaggedFollowRowsAtLumos(aiIds, staffNameOfPhone);
        if (res.errors > 0) logWarn('irecruit.replaceSync: ยกเลิกที่ Lumos ไม่ครบ', res);
      } catch (e) {
        logError('irecruit.replaceSync: ยกเลิกสายไม่สำเร็จ', e, { ids: cancelIds.length });
      }
    }

    // ── 2) ย้ายเวลา (iRecruit แก้เวลาเข้างาน) ──
    const toEnqueue: Array<{ id: string; meta: DesiredMeta }> = [];
    for (const { existing: ex, desired: d } of plan.reschedule) {
      const meta = metaByRef.get(d.ref);
      if (!meta) continue;
      try {
        const row = rowById.get(ex.id);
        const wasAi = row?.mode === 'ai';
        if (wasAi) await cancelFollowReminder(ex.id, staffNameOfPhone);
        // 🔴 ใครโทรตัดสินครั้งเดียวตอนสร้าง (เจ้าของ Choice 13 ต.ค. 2569) — iRecruit แก้แค่เวลา = คงใครโทรเดิม
        //    ยกเว้นเวลาใหม่ถึงแล้ว = คนโทร (AI ไม่โทรย้อนหลัง · กติกาเดียวกับฝั่งคนเริ่มงาน)
        const mode = wasAi && meta.at.getTime() > now.getTime() + LOCK_AHEAD_MS ? 'ai' : 'manual';
        // iRecruit ย้ายเวลา = จำค่าของ iRecruit ไว้ด้วย (156) — ตัวตัดสิน "แก้ล่าสุดชนะ" รอบหน้า
        await dbQuery(`update ${followTable} set scheduled_at = $2, note = $3, irecruit_note = $3, call_mode = $4 where id = $1`, [
          ex.id,
          meta.at.toISOString(),
          replaceSlotNote(meta.slot, meta.wall),
          mode,
        ]);
        if (mode === 'ai' && autoAi) toEnqueue.push({ id: ex.id, meta });
        else await setDispatchState(ex.id, mode === 'manual' ? 'manual' : 'off');
        summary.realigned = (summary.realigned ?? 0) + 1;
        await logReplaceEvent('edit', ex.id, { job: meta.jobId, name: meta.name, unit: meta.siteName, what: 'time' });
      } catch (e) {
        logError('irecruit.replaceSync: ย้ายเวลาสายไม่สำเร็จ', e, { id: ex.id });
      }
    }

    /**
     * 🔴 13 ต.ค. 2569 เจ้าของ Choice "ตัดสินครั้งเดียวตอนสร้าง": รอบ 5 นาทีแก้แค่ที่ iRecruit แก้ (เวลา · ยกเลิก · ชื่อ/หน่วยงาน)
     * **ห้ามเปลี่ยนใครโทรของแถวที่มีอยู่แล้ว** — เดิมมีขั้น WL → คนโทร / EX → AI / รายชื่อ → AI ทุกรอบ
     * ⇒ สาย AI ของคนในรายชื่อโดนสลับเป็นคนโทร + ยกเลิกที่ Lumos ~8 นาทีก่อนโทร (9 สายเช้า 13 ต.ค.)
     * ใครโทรเปลี่ยนได้ทางเดียว = เจ้าหน้าที่แก้ในป๊อป หรือกดสวิตช์พัก AI (ตอนกดเท่านั้น)
     */
    const rescheduledIds = new Set(plan.reschedule.map((r) => r.existing.id));

    // ── 2.55) iRecruit แก้ชื่อ/หน่วยงาน → ระบบแก้ตาม แล้วส่งแผนใหม่ให้ Lumos (เจ้าของ 7 ต.ค. 2569:
    //    *"irecruit แก้อะไรระบบนี้แก้ตาม แล้วแก้ทับส่งไป lumos อีกที"*) — เฉพาะสายที่ยังไม่ถึงเวลา
    //    (เวลา/ยกเลิก/เปลี่ยนคน ทำในขั้น 1–2 แล้ว · เปลี่ยนเบอร์ = คนใหม่ ⇒ ยกเลิกของเดิม + สร้างใหม่)
    const changedAi: string[] = [];
    for (const x of existingRows) {
      // ชื่อ/หน่วยงานบนจอแก้ทุกแถว (สายที่ผ่านแล้วก็โชว์) · ส่ง Lumos ใหม่เฉพาะสาย AI ที่ยังไม่ถึงเวลา
      const meta = metaByRef.get(x.source_ref);
      if (!meta) continue;
      const nameChanged = (x.recipient_name ?? '') !== meta.name;
      const siteChanged = (x.unit_name ?? null) !== meta.siteName || (x.site_code ?? null) !== meta.siteCode;
      /** iRecruit เปลี่ยนจากที่ดึงครั้งก่อนไหม (156) — แถวที่เจ้าหน้าที่แก้แล้ว ทับเฉพาะตอน iRecruit แก้ทีหลัง (แก้ล่าสุดชนะ · 20 ต.ค. 2569) */
      const irecruitChanged = irecruitLabelChanged(x, meta);
      if (!nameChanged && !siteChanged) {
        if (irecruitChanged) await rememberIrecruitLabel(x.id, meta);
        continue;
      }
      if (x.staff_edited && !irecruitChanged) continue;
      try {
        await dbQuery(
          `update ${followTable} set recipient_name = $2, unit_name = $3, site_code = $4,
                  irecruit_name = $2, irecruit_unit_name = $3, irecruit_site_code = $4 where id = $1`, [
          x.id,
          meta.name,
          meta.siteName,
          meta.siteCode,
        ]);
        if (x.pending && x.mode === 'ai' && !rescheduledIds.has(x.id)) changedAi.push(x.id);
        await logReplaceEvent('edit', x.id, { job: meta.jobId, name: meta.name, unit: meta.siteName, what: 'name_unit' });
      } catch (e) {
        logError('irecruit.replaceSync: แก้ชื่อ/หน่วยงานตาม iRecruit ไม่สำเร็จ', e, { id: x.id });
      }
    }
    if (changedAi.length > 0 && getLumosPushConfig() && (await isAutoDispatchEnabled('follow_entry'))) {
      try {
        const res = await replanFollowSetWithLumos({ memberIds: changedAi, cancelledIds: [], resolveStaffName: staffNameOfPhone });
        if (res.reason) logWarn('irecruit.replaceSync: ส่งแผนใหม่หลังแก้ชื่อ/หน่วยงานไม่ครบ', { reason: res.reason });
      } catch (e) {
        logError('irecruit.replaceSync: ส่งแผนใหม่หลังแก้ชื่อ/หน่วยงานล้ม', e, { rows: changedAi.length });
      }
    }

    // ── 2.6) "เพิ่มโดย" ของสายที่ดึงมาก่อนหน้านี้ = อีเมลคนเพิ่มใบใน iRecruit (7 ต.ค. 2569) — เติมเฉพาะแถวที่ยังเป็นป้ายของรอบดึง ──
    const adderRefs = desired.filter((d) => d.adder).map((d) => [d.ref, d.adder as string] as const);
    if (adderRefs.length > 0) {
      try {
        await dbQuery(
          `update ${followTable} f set created_by_name = v.adder
             from unnest($1::text[], $2::text[]) as v(ref, adder)
            where f.source_ref = v.ref
              and (f.created_by_name like 'ดึงจาก iRecruit%' or f.created_by_name not like '%@%')
              and f.created_by_name is distinct from v.adder`,
          [adderRefs.map((a) => a[0]), adderRefs.map((a) => a[1])],
        );
      } catch (e) {
        logWarn('irecruit.replaceSync: เติมคนเพิ่มใบไม่สำเร็จ', { error: errorSummaryText(e) });
      }
    }
    // เบอร์ฉุกเฉินของสายเดิมที่ยังว่าง (20 ต.ค. 2569) — เติมในฐานเท่านั้น ไม่แตะเบอร์ที่มีอยู่แล้ว
    // ⚠️ แผนที่ส่ง Lumos ไปแล้วยังถือของเดิม จนกว่าจะส่งแผนใหม่
    const emRefs = desired.filter((d) => d.emergency).map((d) => [d.ref, d.emergency as string] as const);
    if (emRefs.length > 0) {
      try {
        await dbQuery(
          `update ${followTable} f set staff_phone = v.phone
             from unnest($1::text[], $2::text[]) as v(ref, phone)
            where f.source_ref = v.ref and coalesce(btrim(f.staff_phone), '') = ''
              and f.completed_at is null and f.cancelled_at is null`,
          [emRefs.map((a) => a[0]), emRefs.map((a) => a[1])],
        );
      } catch (e) {
        logWarn('irecruit.replaceSync: เติมเบอร์ฉุกเฉินไม่สำเร็จ', { error: errorSummaryText(e) });
      }
    }

    // ── 3) สร้างสายใหม่ — คนเดียวกัน (เบอร์เดียว) อยู่ชุดเดียวกัน ใช้ชุดเดิมถ้ามี ──
    const groupOfPhone = new Map<string, string>();
    for (const x of existingRows) if (x.pending && x.recipient_phone && x.group_id) groupOfPhone.set(x.recipient_phone, x.group_id);
    for (const c of plan.create) {
      const meta = metaByRef.get(c.ref);
      if (!meta) continue;
      const groupId = groupOfPhone.get(meta.phone) ?? randomUUID();
      groupOfPhone.set(meta.phone, groupId);
      try {
        const { rows: ins } = await dbQuery<{ id: string }>(
          `insert into ${followTable}
             (recipient_name, recipient_phone, topic, note, staff_phone, scheduled_at,
              group_id, call_times, unit_name, site_code, call_round, call_mode,
              created_by, created_by_name, follow_team, source_ref, irecruit_note,
              irecruit_name, irecruit_unit_name, irecruit_site_code)
           values ($1, $2, $3, $4, $14, $5, $6, null, $7, $8, $9, $10, null, $11, $12, $13, $4, $1, $7, $8)
           returning id`,
          [meta.name, meta.phone, REPLACE_FOLLOW_TOPIC, replaceSlotNote(meta.slot, meta.wall), meta.at.toISOString(), groupId,
           meta.siteName, meta.siteCode, meta.round, meta.mode, meta.adder ?? actorName, FOLLOW_TEAM_REPLACEMENT, meta.ref,
           meta.emergency],
        );
        if (!ins[0]) continue;
        summary.added += 1;
        if (meta.mode === 'ai' && autoAi) toEnqueue.push({ id: ins[0].id, meta });
        else await setDispatchState(ins[0].id, meta.mode === 'manual' ? 'manual' : 'off');
      } catch (e) {
        if (isPgUniqueViolation(e)) {
          summary.alreadyIn += 1; // สองรอบชนกัน — ฐานกันให้แล้ว
          continue;
        }
        if (isUndefinedColumn(e)) {
          summary.error = MIGRATION_133_NOT_READY;
          await persistLastRun(summary, actorName);
          return summary;
        }
        throw e;
      }
    }

    // ── 3.5) ประเภทจาก iRecruit ลงแถว (136 · เจ้าของสั่ง 6 ต.ค. 2569 "แยก Ex กับ คนใน เพิ่ม Filter") ──
    // ทำทุกรอบ = แถวเก่าที่ยังอยู่ในช่วงที่ดึงได้ค่าไปด้วย · ฐานยังไม่รัน 136 = ข้ามเงียบ ๆ (งานหลักต้องเดินต่อ)
    if (desired.length > 0) {
      try {
        await dbQuery(
          `update ${followTable} f set replace_type = d.t
             from unnest($1::text[], $2::text[]) as d(ref, t)
            where f.source_ref = d.ref and f.replace_type is distinct from d.t`,
          [desired.map((d) => d.ref), desired.map((d) => d.replaceType)],
        );
      } catch (e) {
        if (!isUndefinedColumn(e)) logWarn('irecruit.replaceSync: เก็บประเภทไม่สำเร็จ', { error: errorSummaryText(e) });
      }
    }

    // ── 4) ส่งแผนให้ Lumos (สาย AI · สวิตช์เปิด) ทีละคน+วัน ──
    if (toEnqueue.length > 0) {
      const states = await enqueueByPersonDay(toEnqueue);
      for (const { id } of toEnqueue) {
        const st = states.get(id) ?? 'off';
        if (st === 'queued') summary.queued += 1;
        else summary.notSent += 1;
        await setDispatchState(id, st);
      }
    }

    await persistLastRun(summary, actorName);
    logInfo('irecruit.replaceSync.done', {
      fetched: summary.fetched,
      added: summary.added,
      alreadyIn: summary.alreadyIn,
      cancelled: summary.cancelled,
      realigned: summary.realigned,
      noPhone: summary.noPhone,
      pastDue: summary.pastDue,
      asap: summary.asap,
      queued: summary.queued,
      notSent: summary.notSent,
      safeToCancel,
      autoAi,
    });
    return summary;
  } finally {
    running = false;
  }
}

/**
 * ═══ บอก Lumos ว่าแถวที่ **ติดธงยกเลิกแล้ว** ไม่ต้องโทร — ทีละแผน แผนละครั้ง (6 ต.ค. 2569) ═══
 * ⚠️ ผู้เรียกต้องติดธง `cancelled_at` ทุกแถวก่อน (แผนใหม่ที่ส่งไปจะได้ไม่ดึงแถวพวกนี้กลับเข้าไป)
 * - แผนที่ทุกสายถูกยกเลิก = ปิดคิวทั้งแผน + ลบที่ Lumos ด้วยรหัสหัวขบวน (`plan_ref`) ครั้งเดียว
 * - แผนที่ยังมีสายอื่นเหลือ = ปิดคิวของแถวที่ยกเลิกทั้งหมด แล้ว `cancelFollowReminder` **ครั้งเดียว**
 *   (ส่งแผนใหม่ที่มีแต่สายที่เหลือ — ไม่ส่งซ้ำทีละแถว)
 * - แถวที่ไม่อยู่แผนไหน = `cancelFollowReminder` ของมันเอง
 */
export async function cancelFlaggedFollowRowsAtLumos(
  ids: readonly string[],
  staffNameOfPhone: (phone: string | null) => Promise<string | null>,
): Promise<{ plansCancelled: number; plansResent: number; errors: number }> {
  const out = { plansCancelled: 0, plansResent: 0, errors: 0 };
  if (ids.length === 0) return out;
  const queueTable = tableInAppSchema('lumos_dispatch_queue');
  const idSet = new Set(ids);
  const { rows: qrows } = await dbQuery<{ person_ref: string; plan_ref: string | null }>(
    `select person_ref, plan_ref from ${queueTable}
      where channel = 'reminder' and job_ref = 'follow' and plan_ref in (
        select plan_ref from ${queueTable}
         where channel = 'reminder' and job_ref = 'follow' and person_ref = any($1::text[]))`,
    [ids.map((id) => `follow-${id}`)],
  );
  const plans = new Map<string, { inside: string[]; outside: number }>();
  const inPlan = new Set<string>();
  for (const r of qrows) {
    if (!r.plan_ref) continue;
    const id = r.person_ref.slice('follow-'.length);
    const p = plans.get(r.plan_ref) ?? { inside: [], outside: 0 };
    if (idSet.has(id)) {
      p.inside.push(id);
      inPlan.add(id);
    } else p.outside += 1;
    plans.set(r.plan_ref, p);
  }
  for (const [planRef, p] of plans) {
    try {
      if (p.outside === 0) {
        await dbQuery(
          `update ${queueTable} set status = 'cancelled', updated_at = now()
            where channel = 'reminder' and job_ref = 'follow' and plan_ref = $1 and status = 'pending'`,
          [planRef],
        );
        if (getLumosPushConfig()) await cancelPushedReminderIgnoringMissing(planRef);
        out.plansCancelled += 1;
      } else if (p.inside.length > 0) {
        await dbQuery(
          `update ${queueTable} set status = 'cancelled', updated_at = now()
            where channel = 'reminder' and job_ref = 'follow' and person_ref = any($1::text[]) and status = 'pending'`,
          [p.inside.map((id) => `follow-${id}`)],
        );
        await cancelFollowReminder(p.inside[0], staffNameOfPhone);
        out.plansResent += 1;
      }
    } catch (e) {
      out.errors += 1;
      logError('irecruit.replaceSync: ยกเลิกแผนที่ Lumos ไม่สำเร็จ', e, { planRef });
    }
  }
  for (const id of ids) {
    if (inPlan.has(id)) continue;
    try {
      await cancelFollowReminder(id, staffNameOfPhone);
    } catch (e) {
      out.errors += 1;
      logError('irecruit.replaceSync: ยกเลิกคิวไม่สำเร็จ', e, { id });
    }
  }
  return out;
}

async function persistLastRun(summary: ReplaceSyncSummary, actorName: string): Promise<void> {
  try {
    await saveReplaceSyncSettings({ lastRun: summary }, actorName);
  } catch (e) {
    if (isPgUndefinedTable(e)) return; // ตาราง 133 ยังไม่มี — worker ถือผลไว้ในหน่วยความจำ
    logWarn('irecruit.replaceSync: จดผลรอบล่าสุดไม่สำเร็จ', { error: errorSummaryText(e) });
  }
}

/**
 * ═══ พัก AI ของงานส่งคนแทน (เจ้าของสั่ง 6 ต.ค. 2569 ค่ำ "อย่าพึ่งส่งให้ Ai โทร") ═══
 * สาย AI ที่ **ยังไม่ถึงเวลาโทร** (`scheduled_at` หลังตอนนี้) · ยังไม่ยกเลิก/ปิด → คนโทร + ยกเลิกแผนที่ Lumos
 * สายที่ถึงเวลาไปแล้ว = AI โทรไปแล้ว/กำลังโทร — คงเป็นของ AI (Choice "หยุดสายที่ยังไม่โทร + ของใหม่")
 * 🔴 ไม่มีคีย์ push (เครื่อง dev) = ไม่ทำอะไร · เรียกจาก worker ทุกรอบ + ตอนกดพักบนจอ
 * 🔴 พักแค่สายที่ระบบตั้งให้ (เจ้าของ 8 ต.ค. 2569 Choice "เลือก AI รายสายได้") — ข้ามสายที่เจ้าหน้าที่เลือก AI เอง
 *    (`updated_by` มีค่า) และสายที่เพิ่มเอง (ไม่ใช่ `irecruit-replace:` — ฟอร์มเพิ่มคน · เพิ่มสายในป๊อป)
 *    ไม่งั้นรอบนี้เปลี่ยนสายที่คนเลือกกลับเป็นคนโทรทุก 5 นาที
 */
export async function enforceReplaceAiPaused(now: Date = new Date()): Promise<{ converted: number; plansCancelled: number; errors: number }> {
  return withSessionLock(REPLACE_SYNC_LOCK_KEY, () => enforceReplaceAiPausedUnlocked(now));
}

async function enforceReplaceAiPausedUnlocked(now: Date): Promise<{ converted: number; plansCancelled: number; errors: number }> {
  const out = { converted: 0, plansCancelled: 0, errors: 0 };
  if (!getLumosPushConfig()) return out;
  // 🔴 คนในรายชื่อให้ AI โทร (เจ้าของ 12 ต.ค. 2569) ไม่โดนพัก — ไม่งั้นรอบนี้สลับกลับเป็นคนโทรทุก 5 นาที
  const { rule } = await getReplaceSyncSettings();
  const listedKeys = rule.aiPhones.map((x) => replacePhoneKey(x.phone)).filter((k): k is string => Boolean(k));
  const { rows: aff } = await dbQuery<{ id: string }>(
    `select id from ${followTable}
      where follow_team = $1 and cancelled_at is null and completed_at is null
        and coalesce(call_mode, 'ai') = 'ai' and scheduled_at > $2
        and updated_by is null and coalesce(source_ref, '') like 'irecruit-replace:%'
        and not (right(regexp_replace(coalesce(recipient_phone, ''), '\\D', '', 'g'), 9) = any($3::text[]))`,
    [FOLLOW_TEAM_REPLACEMENT, now.toISOString(), listedKeys],
  );
  if (aff.length === 0) return out;
  const res = await convertReplaceAiRowsToManual(new Set(aff.map((r) => r.id)), 'aiPaused');
  logInfo('irecruit.replaceSync.aiPaused.done', res);
  return res;
}

/**
 * สาย AI ชุดนี้ → คนโทร + ยกเลิกแผนที่ Lumos (ใช้ร่วม "AI เริ่มโทรตั้งแต่" กับ "พัก AI")
 * - แผนที่มีแต่สายในชุดนี้ = ยกเลิกทั้งแผนด้วยรหัสหัวขบวน (`plan_ref`) ครั้งเดียว
 * - แผนที่มีสายอื่นปน = ยกเลิกเฉพาะสายในชุด (`cancelFollowReminder` ส่งสายที่เหลือเป็นแผนใหม่)
 */
async function convertReplaceAiRowsToManual(
  ids: Set<string>,
  tag: 'aiFrom' | 'aiPaused',
): Promise<{ converted: number; plansCancelled: number; errors: number }> {
  const out = { converted: 0, plansCancelled: 0, errors: 0 };
  const queueTable = tableInAppSchema('lumos_dispatch_queue');
  const { rows: qrows } = await dbQuery<{ person_ref: string; plan_ref: string | null }>(
    `select person_ref, plan_ref from ${queueTable}
      where channel = 'reminder' and job_ref = 'follow' and status = 'pending' and plan_ref in (
        select plan_ref from ${queueTable}
         where channel = 'reminder' and job_ref = 'follow' and person_ref = any($1::text[]))`,
    [[...ids].map((id) => `follow-${id}`)],
  );
  const plans = new Map<string, { inside: string[]; outside: number }>();
  const inPlan = new Set<string>();
  for (const r of qrows) {
    if (!r.plan_ref) continue;
    const id = r.person_ref.slice('follow-'.length);
    const p = plans.get(r.plan_ref) ?? { inside: [], outside: 0 };
    if (ids.has(id)) {
      p.inside.push(id);
      inPlan.add(id);
    } else p.outside += 1;
    plans.set(r.plan_ref, p);
  }
  for (const [planRef, p] of plans) {
    try {
      if (p.outside === 0) {
        await dbQuery(
          `update ${queueTable} set status = 'cancelled', updated_at = now()
            where channel = 'reminder' and job_ref = 'follow' and plan_ref = $1 and status = 'pending'`,
          [planRef],
        );
        await cancelPushedReminderIgnoringMissing(planRef);
        out.plansCancelled += 1;
      } else {
        for (const id of p.inside) await cancelFollowReminder(id, staffNameOfPhone);
      }
    } catch (e) {
      out.errors += 1;
      logError(`irecruit.replaceSync.${tag}: ยกเลิกแผนไม่สำเร็จ`, e, { planRef });
    }
  }
  // แถวที่ไม่มีแผนในคิว (ยังไม่เคยส่ง) — ยกเลิกแถวคิวเดี่ยว ๆ ของมันถ้ามี
  for (const id of ids) {
    if (inPlan.has(id)) continue;
    try {
      await cancelFollowReminder(id, staffNameOfPhone);
    } catch (e) {
      out.errors += 1;
      logError(`irecruit.replaceSync.${tag}: ยกเลิกคิวไม่สำเร็จ`, e, { id });
    }
  }
  const upd = await dbQuery<{ id: string }>(
    `update ${followTable} set call_mode = 'manual', dispatch_state = 'manual'
      where id = any($1::uuid[]) and coalesce(call_mode, 'ai') = 'ai' returning id`,
    [[...ids]],
  );
  out.converted = upd.rows.length;
  return out;
}

/**
 * ═══ ใช้รายชื่อให้ AI โทรกับสายที่มีอยู่ — ครั้งเดียวตอนตั้งรายชื่อ (เจ้าของ 13 ต.ค. 2569 รายชื่อฝั่งรายวัน) ═══
 * 🔴 19 ต.ค. 2569 เจ้าของ Choice "สลับเป็น AI ด้วย" — สายที่เจ้าหน้าที่แก้เอง (updated_by) ก็สลับด้วย เพราะรายชื่อคือคำสั่งตรงของคนตั้ง
 *    (เดิมข้าม ⇒ 42 จาก 65 สายคอนเฟิร์ม 16:00 ยังเป็นคนโทร) · เปลี่ยนแค่คนโทร + เบอร์ฉุกเฉิน — เวลาที่เจ้าหน้าที่แก้ไว้คงเดิม
 * สายคนโทรของงานส่งคนแทนที่ยังไม่ถึงเวลา (เกิน 2 นาที) ของเบอร์ในรายชื่อ · ระบบตั้ง (ไม่มีคนแก้เอง) → AI + เบอร์ฉุกเฉิน
 * แล้วส่งแผนด้วยตัวเดียวกับป๊อปแก้ (`replanFollowSetWithLumos` — ยกเลิกแผนเก่าที่ Lumos + ส่งใหม่ทั้งวัน + จดสถานะส่ง)
 * 🔴 ไม่มีคีย์ push / ปิดส่งอัตโนมัติ = ไม่แตะอะไร (ห้ามสลับเป็น AI ทั้งที่ส่งไม่ได้) · ธงยังค้างไว้ให้รอบหน้า
 */
export async function applyReplaceAiPhonesToPending(
  now: Date = new Date(),
): Promise<{ converted: number; reverted?: number; pushed: boolean; skipped?: string }> {
  return withSessionLock(REPLACE_SYNC_LOCK_KEY, async () => {
    const settings = await getReplaceSyncSettings();
    if (!settings.rule.aiPhonesApplyPending) return { converted: 0, pushed: false, skipped: 'ไม่มีรายชื่อรอใช้' };
    if (!getLumosPushConfig() || !(await isAutoDispatchEnabled('follow_entry'))) {
      return { converted: 0, pushed: false, skipped: 'ส่ง AI ไม่ได้ตอนนี้ — รอรอบหน้า' };
    }
    const keys = settings.rule.aiPhones.map((x) => replacePhoneKey(x.phone)).filter((k): k is string => Boolean(k));
    const emOf = new Map(settings.rule.aiPhones.map((x) => [replacePhoneKey(x.phone), x.emergency]));
    const { rows: flipCandidates } = await dbQuery<{ id: string; k: string; source_ref: string | null; scheduled_at: string; note: string | null }>(
      `select id::text as id, right(regexp_replace(coalesce(recipient_phone, ''), '\\D', '', 'g'), 9) as k,
              source_ref, scheduled_at::text as scheduled_at, note
         from ${followTable}
        where follow_team = $1 and coalesce(source_ref, '') like 'irecruit-replace:%'
          and cancelled_at is null and completed_at is null and staff_call_outcome is null
          and call_mode = 'manual' and coalesce(time_tbd, false) = false
          and scheduled_at > $2
          and right(regexp_replace(coalesce(recipient_phone, ''), '\\D', '', 'g'), 9) = any($3::text[])`,
      [FOLLOW_TEAM_REPLACEMENT, new Date(now.getTime() + LOCK_AHEAD_MS).toISOString(), keys],
    );
    // รายชื่อกำหนดวันเข้างาน = เฉพาะสายของงานวันนั้น (13 ต.ค. 2569 "เฉพาะงานพรุ่งนี้")
    const rows = flipCandidates.filter((r) => replaceAiPhonesCoverYmd(settings.rule, replaceWorkYmd(r)));
    for (const r of rows) {
      await dbQuery(
        `update ${followTable} set call_mode = 'ai', staff_phone = coalesce($2, staff_phone) where id = $1 and call_mode = 'manual'`,
        [r.id, emOf.get(r.k) ?? null],
      );
    }
    let pushed = true;
    if (rows.length > 0) {
      const res = await replanFollowSetWithLumos({
        memberIds: rows.map((r) => r.id),
        cancelledIds: [],
        resolveStaffName: staffNameOfPhone,
      });
      pushed = res.plans > 0 && res.pushedPlans === res.plans;
      if (!pushed) logWarn('irecruit.replaceSync.applyAiPhones: ส่งแผนไม่ครบ — ตัวส่งซ้ำจะลองให้', { reason: res.reason });
    }
    /**
     * 🔴 คนนอกรายชื่อ (เจ้าของ 13 ต.ค. 2569 Choice "เหลือแค่ 15 คนที่ส่งล่าสุด") — พัก AI อยู่ = สาย AI ที่ระบบตั้งให้ของคนที่หลุดจากรายชื่อ
     * กลับเป็นคนโทร + ยกเลิกแผนที่ Lumos (ตัวเดียวกับสวิตช์พัก AI) · สายที่คนในทีมเลือก AI เองไม่แตะ (Choice 12 ต.ค. "ยังเลือกทีละสายได้")
     */
    let reverted = 0;
    if (settings.rule.aiPaused) {
      const { rows: aiRows } = await dbQuery<{ id: string; k: string; source_ref: string | null; scheduled_at: string; note: string | null }>(
        `select id::text as id, right(regexp_replace(coalesce(recipient_phone, ''), '\\D', '', 'g'), 9) as k,
                source_ref, scheduled_at::text as scheduled_at, note
           from ${followTable}
          where follow_team = $1 and coalesce(source_ref, '') like 'irecruit-replace:%'
            and cancelled_at is null and completed_at is null and staff_call_outcome is null
            and updated_by is null and coalesce(call_mode, 'ai') = 'ai' and scheduled_at > $2`,
        [FOLLOW_TEAM_REPLACEMENT, new Date(now.getTime() + LOCK_AHEAD_MS).toISOString()],
      );
      // นอกรายชื่อ หรืออยู่ในรายชื่อแต่เป็นงานวันอื่น (รายชื่อกำหนดวัน) = คนโทร
      const keySet = new Set(keys);
      const off = aiRows.filter((r) => !keySet.has(r.k) || !replaceAiPhonesCoverYmd(settings.rule, replaceWorkYmd(r)));
      if (off.length > 0) reverted = (await convertReplaceAiRowsToManual(new Set(off.map((r) => r.id)), 'aiPaused')).converted;
    }
    await saveReplaceSyncSettings({ rule: { ...settings.rule, aiPhonesApplyPending: false } }, REPLACE_SYNC_ACTOR_NAME);
    logInfo('irecruit.replaceSync.applyAiPhones.done', { converted: rows.length, reverted, pushed });
    return { converted: rows.length, reverted, pushed };
  });
}


/**
 * ═══ ปุ่ม "สลับเป็น AI (เว้น WL)" บนแท็บส่งคนแทน (เจ้าของ 19 ต.ค. 2569 Choice "สลับเป็น AI ทั้งหมด เว้น WL") ═══
 * สายที่ระบบดึงจาก iRecruit ที่ยังเป็นคนโทร (ส่วนใหญ่ถูกเปลี่ยนตอนพัก AI) และยังไม่ถึงเวลา → AI + ส่งแผนให้ Lumos
 * 🔴 19 ต.ค. 2569 เจ้าของ "wl เปลี่ยนเป็น Ai โทรเลย" — รวม WL ด้วยแล้ว · เว้น: สายที่เจ้าหน้าที่ลงผลแล้ว · ยังไม่ชัวร์เวลา · ใกล้เวลาโทรเกิน 2 นาที
 * 🔴 คนกดเท่านั้น (ไม่มีรอบอัตโนมัติ) · ไม่มีคีย์ push / ปิดส่งอัตโนมัติ = ไม่แตะอะไร (ห้ามสลับเป็น AI ทั้งที่ส่งไม่ได้)
 */
export async function convertReplaceManualToAi(
  now: Date = new Date(),
): Promise<{ converted: number; pushed: boolean; skipped?: string }> {
  return withSessionLock(REPLACE_SYNC_LOCK_KEY, async () => {
    if (!getLumosPushConfig() || !(await isAutoDispatchEnabled('follow_entry'))) {
      return { converted: 0, pushed: false, skipped: 'ส่ง AI ไม่ได้ตอนนี้ — ลองใหม่ภายหลัง' };
    }
    const { rows } = await dbQuery<{ id: string }>(
      `update ${followTable} set call_mode = 'ai', updated_at = now()
        where follow_team = $1 and coalesce(source_ref, '') like 'irecruit-replace:%'
          and cancelled_at is null and completed_at is null and staff_call_outcome is null
          and call_mode = 'manual' and coalesce(time_tbd, false) = false
          and scheduled_at > $2
        returning id::text as id`,
      [FOLLOW_TEAM_REPLACEMENT, new Date(now.getTime() + LOCK_AHEAD_MS).toISOString()],
    );
    let pushed = true;
    if (rows.length > 0) {
      const res = await replanFollowSetWithLumos({
        memberIds: rows.map((r) => r.id),
        cancelledIds: [],
        resolveStaffName: staffNameOfPhone,
      });
      pushed = res.plans > 0 && res.pushedPlans === res.plans;
      if (!pushed) logWarn('irecruit.replaceSync.allAi: ส่งแผนไม่ครบ — ตัวส่งซ้ำจะลองให้', { reason: res.reason });
    }
    logInfo('irecruit.replaceSync.allAi.done', { converted: rows.length, pushed });
    return { converted: rows.length, pushed };
  });
}

/**
 * ═══ ปุ่ม "ยกเลิกสายที่เลยเวลา" บนแท็บส่งคนแทน (เจ้าของ 19 ต.ค. 2569 "อะไรที่ผ่านมาแล้วใส่เป็นยกเลิกให้หมดเว้น ai ที่โทรจริง"
 * → Choice "ยกเลิก 2,186 สายที่ไม่มีผล") ═══
 * สายที่เลยเวลาแล้ว · ยังไม่ปิด · ไม่มีผลจาก AI และเจ้าหน้าที่ยังไม่ลงผล ⇒ ยกเลิก (ฐาน + คิวฝั่งเรา) · สาย AI เว้น 3 ชม. ล่าสุด
 * 🔴 ไม่ยิงยกเลิกไป Lumos — สายเลยเวลาแล้ว และการลบแผนที่จบแล้วที่ Lumos ลากแผนอื่นของเบอร์เดียวกันหายด้วย (9 ต.ค. 2569)
 */
export async function cancelPastReplaceCalls(
  actor: { id: string | null; name: string | null },
  now: Date = new Date(),
): Promise<{ cancelled: number }> {
  const { rows } = await dbQuery<{ id: string }>(
    `update ${followTable} f
        set cancelled_at = now(), updated_at = now(), updated_by = $3::uuid, updated_by_name = $4
      where f.follow_team = $1 and f.cancelled_at is null and f.completed_at is null
        and f.staff_call_outcome is null
        -- สาย AI ผลกลับช้าได้ถึง ~2 ชม. (วัดจริง 134 นาที) ⇒ เว้นสาย AI 3 ชม. ล่าสุดไว้ ไม่งั้นผลจริงมาถึงแถวที่ยกเลิกไปแล้ว
        and ((coalesce(f.call_mode, 'ai') = 'manual' and f.scheduled_at < $2)
             or f.scheduled_at < $2::timestamptz - interval '3 hours')
        and not exists (
          select 1 from ${REPLACE_QUEUE_TABLE} q
           where q.channel = 'reminder' and q.job_ref = 'follow' and q.person_ref = 'follow-' || f.id::text
             and coalesce(q.last_outcome, q.result->>'outcome') is not null)
      returning f.id::text as id`,
    [FOLLOW_TEAM_REPLACEMENT, now.toISOString(), actor.id, actor.name],
  );
  if (rows.length > 0) {
    await dbQuery(
      `update ${REPLACE_QUEUE_TABLE} set status = 'cancelled', updated_at = now()
        where channel = 'reminder' and job_ref = 'follow' and status in ('pending', 'delivered')
          and person_ref = any($1::text[])`,
      [rows.map((r) => `follow-${r.id}`)],
    );
  }
  logInfo('irecruit.replaceSync.cancelPast.done', { cancelled: rows.length });
  return { cancelled: rows.length };
}
