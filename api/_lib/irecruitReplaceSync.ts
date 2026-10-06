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
import { dbQuery, isPgUndefinedTable, isPgUniqueViolation } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { irecruitSqlQuery, irecruitUnavailableReason } from './irecruitSqlServer.js';
import { toE164Thai } from './thaiPhone.js';
import { isAutoDispatchEnabled } from './lumosDispatchMode.js';
import {
  cancelFollowReminder,
  cancelPushedReminderIgnoringMissing,
  enqueueFollowReminderPlan,
  type FollowEntryInput,
} from './lumosDispatch.js';
import { getLumosPushConfig } from './lumosPushClient.js';
import { staffNameOfPhone } from './followStaffName.js';
import { bangkokBusinessDateYmd } from './businessDate.js';
import { logError, logInfo, logWarn, errorSummaryText } from './logger.js';
import { FOLLOW_TEAM_REPLACEMENT } from '../../src/lib/followReplacement.js';
import type { FollowDispatchState } from '../../src/lib/followDispatchState.js';
import {
  DEFAULT_REPLACE_CALL_RULE,
  normalizeReplaceCallRule,
  planReplaceCalls,
  reconcileReplaceCalls,
  REPLACE_FOLLOW_TOPIC,
  REPLACE_SYNC_ACTOR_NAME,
  REPLACE_SYNC_DEFAULTS,
  replaceCallModeFor,
  replaceModeForType,
  replaceSlotNote,
  replaceSlotRef,
  wantWallFromSqlDate,
  type ReplaceCallRule,
  type ReplaceDesiredCall,
  type ReplaceExistingCall,
  type ReplaceSyncSummary,
  type ReplaceWantWall,
} from '../../src/lib/irecruitReplaceSync.js';

const followTable = tableInAppSchema('follow_entries');
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
  /** ประเภทคนไปแทนใน iRecruit (`z_hr_recruitment_header.replace_type`) — EX = คนนอก/อดีตพนักงาน · IN = คนใน · ER ฯลฯ */
  replace_type?: string | null;
};

function shiftYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * SQL ของเจ้าของ (2 ต.ค. 2569) — เพิ่ม `site_code` ให้ผูกหน่วยงานได้ · ช่วงวันเป็นนาฬิกาไทย
 * (driver ถือค่าในฐานเป็น UTC ⇒ ส่ง Date ที่ส่วน UTC = นาฬิกาไทย · `to` ไม่รวม = วันถัดจาก toYmd)
 */
export async function fetchIrecruitReplaceRows(fromYmd: string, toYmd: string): Promise<IrecruitReplaceRow[]> {
  return irecruitSqlQuery<IrecruitReplaceRow>(
    `SELECT h.job_id, h.replace_no, z.fname, z.lname, z.mobile, z.replace_type, s.site_name, h.site_code, h.want_date
       FROM ir_job_header h
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
       LEFT JOIN ir_ms_site s ON s.site_code = h.site_code
      WHERE h.status = 'WS'
        AND h.job_type = '2'
        AND h.want_date >= @from
        AND h.want_date < @to
        AND ISNULL(z.status, '') <> 'C'
      ORDER BY h.want_date ASC`,
    { from: new Date(`${fromYmd}T00:00:00Z`), to: new Date(`${shiftYmd(toYmd, 1)}T00:00:00Z`) },
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
  mode: 'ai' | 'manual';
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
  /** สร้างก่อนกติกา EX = AI · คนใน = คนโทร — เฉพาะแถวพวกนี้ที่รอบดึงเปลี่ยน AI → คนโทรให้เอง */
  before_type_rule: boolean;
};

/** คีย์คนไปแทน — แฮชเบอร์ (ไม่เก็บเบอร์ดิบในคีย์) · เปลี่ยนคน = คีย์ใหม่ */
function personKeyOf(phone: string): string {
  return createHash('sha1').update(phone).digest('hex').slice(0, 10);
}

/** ระยะกันชน — สายที่จะโทรภายในนี้ถือว่ากำลังโทร แตะไม่ได้ */
const LOCK_AHEAD_MS = 2 * 60_000;
/** วันที่กติกา EX = AI · คนใน = คนโทร มีผลกับแถวที่สร้าง (เที่ยงคืน 6 ต.ค. 2569 เวลาไทย) — ดูขั้น 2.5 */
const REPLACE_TYPE_RULE_FROM = '2026-10-05T17:00:00.000Z';

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
  for (const list of groups.values()) {
    const inputs: FollowEntryInput[] = list.map(({ id, meta }) => ({
      id,
      recipient_name: meta.name,
      recipient_phone: meta.phone,
      topic: REPLACE_FOLLOW_TOPIC,
      note: replaceSlotNote(meta.slot, meta.wall),
      staffPhone: null,
      scheduled_at: meta.at,
      callTimes: null,
      callRound: meta.round,
      staffName: null,
      unitName: meta.siteName,
    }));
    try {
      for (const [id, st] of await enqueueFollowReminderPlan(inputs)) out.set(id, st);
    } catch (e) {
      logError('irecruit.replaceSync: ส่งแผนให้ Lumos ไม่สำเร็จ', e, { rows: inputs.length });
    }
  }
  return out;
}

async function setDispatchState(id: string, state: FollowDispatchState): Promise<void> {
  try {
    await dbQuery(`update ${followTable} set dispatch_state = $2 where id = $1`, [id, state]);
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
export async function runIrecruitReplaceSync(
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

    // ── สายที่ iRecruit ต้องการตอนนี้ ──
    const desired: DesiredMeta[] = [];
    for (const r of rows) {
      const phone = toE164Thai(r.mobile);
      if (!phone) {
        summary.noPhone += 1;
        continue;
      }
      const wall = wantWallFromSqlDate(r.want_date instanceof Date ? r.want_date : new Date(String(r.want_date)));
      const plans = planReplaceCalls(wall, now);
      if (plans.length === 0) {
        summary.pastDue += 1;
        continue;
      }
      const name = `${(r.fname ?? '').trim()} ${(r.lname ?? '').trim()}`.trim() || 'คนไปแทนงาน';
      const personKey = personKeyOf(phone);
      for (const p of plans) {
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
          siteName: r.site_name?.trim() || null,
          siteCode: r.site_code?.trim() || null,
          mode: replaceModeForType(r.replace_type, replaceCallModeFor(p.at, settings.rule.aiFrom, settings.rule.aiPaused)),
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
                (created_at < $3::timestamptz) as before_type_rule
           from ${followTable}
          where source_ref like 'irecruit-replace:%' and scheduled_at >= $2::timestamptz`,
        [
          new Date(now.getTime() + LOCK_AHEAD_MS).toISOString(),
          new Date(now.getTime() - 3 * 86_400_000).toISOString(),
          REPLACE_TYPE_RULE_FROM,
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
        const wasAi = rowById.get(ex.id)?.mode === 'ai';
        if (wasAi) await cancelFollowReminder(ex.id, staffNameOfPhone);
        const mode = wasAi ? meta.mode : 'manual';
        await dbQuery(`update ${followTable} set scheduled_at = $2, note = $3, call_mode = $4 where id = $1`, [
          ex.id,
          meta.at.toISOString(),
          replaceSlotNote(meta.slot, meta.wall),
          mode,
        ]);
        if (mode === 'ai' && autoAi) toEnqueue.push({ id: ex.id, meta });
        else await setDispatchState(ex.id, mode === 'manual' ? 'manual' : 'off');
        summary.realigned = (summary.realigned ?? 0) + 1;
      } catch (e) {
        logError('irecruit.replaceSync: ย้ายเวลาสายไม่สำเร็จ', e, { id: ex.id });
      }
    }

    // ── 2.5) คนในที่เคยเป็นสาย AI → คนโทร (WL ห้ามโดน AI โทร · เจ้าของ Choice 5 ต.ค. 2569) ──
    // ไม่ทำกลับทาง (คน → AI) เอง — เจ้าหน้าที่สลับเองได้ที่หน้าติดตาม ห้ามรอบ 5 นาทีไปทับ
    // 🔴 6 ต.ค. 2569: ทำเฉพาะแถวที่สร้างก่อนกติกานี้ (`before_type_rule`) — แถวใหม่ของคนในสร้างเป็นคนโทรอยู่แล้ว
    //    ถ้าเจอคนในที่เป็น AI = เจ้าหน้าที่สลับเอง (เจ้าของ: "ถ้าคนจะโทรให้แก้") ⇒ เดิมรอบ 5 นาทีสลับกลับทุกครั้ง ห้ามแล้ว
    const rescheduledIds = new Set(plan.reschedule.map((r) => r.existing.id));
    for (const x of existingRows) {
      if (!x.pending || x.mode !== 'ai' || rescheduledIds.has(x.id) || !x.before_type_rule) continue;
      const meta = metaByRef.get(x.source_ref);
      if (!meta || meta.mode !== 'manual') continue;
      try {
        await cancelFollowReminder(x.id, staffNameOfPhone);
        await dbQuery(`update ${followTable} set call_mode = 'manual' where id = $1`, [x.id]);
        await setDispatchState(x.id, 'manual');
        summary.toManual = (summary.toManual ?? 0) + 1;
      } catch (e) {
        logError('irecruit.replaceSync: เปลี่ยนเป็นคนโทรไม่สำเร็จ', e, { id: x.id });
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
              created_by, created_by_name, follow_team, source_ref)
           values ($1, $2, $3, $4, null, $5, $6, null, $7, $8, $9, $10, null, $11, $12, $13)
           returning id`,
          [meta.name, meta.phone, REPLACE_FOLLOW_TOPIC, replaceSlotNote(meta.slot, meta.wall), meta.at.toISOString(), groupId,
           meta.siteName, meta.siteCode, meta.round, meta.mode, actorName, FOLLOW_TEAM_REPLACEMENT, meta.ref],
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
 * ═══ บังคับ "AI เริ่มโทรตั้งแต่" กับสายที่มีอยู่แล้ว (เจ้าของสั่ง 2 ต.ค. 2569) ═══
 * > *"ของวันนี้ ไปจนถึงวันจันทร์ เปลี่ยนเป็นคนโทรก่อนให้หมดเลย เพราะจะเริ่มใช้จริงวันจันทร์"*
 *
 * สายทีมส่งคนแทนที่ยังเป็น AI · ยังไม่ยกเลิก/ปิด · นัดก่อนวัน `aiFrom` → คนโทร + ยกเลิกแผนที่ Lumos
 * - แผนที่มีแต่สายในกลุ่มนี้ = ยกเลิกทั้งแผนด้วยรหัสหัวขบวน (`plan_ref`) ครั้งเดียว (ไม่ส่งแผนใหม่ไปกวน Lumos ทีละสาย)
 * - แผนที่มีสายหลังวันนั้นปนอยู่ = ยกเลิกเฉพาะสายในกลุ่ม (`cancelFollowReminder` ส่งสายที่เหลือเป็นแผนใหม่)
 * 🔴 ไม่มีคีย์ push (เครื่อง dev) = ไม่ทำอะไร — ห้ามเปลี่ยนแถวเป็นคนโทรทั้งที่แผนที่ Lumos ยังจะโทรอยู่
 * เรียกจาก worker ทุกรอบ (5 นาที) — ไม่มีแถวเข้าเงื่อนไขก็จบที่คำถามเดียว
 */
export async function enforceReplaceAiFrom(aiFrom: string | null): Promise<{ converted: number; plansCancelled: number; errors: number }> {
  const out = { converted: 0, plansCancelled: 0, errors: 0 };
  if (!aiFrom || !getLumosPushConfig()) return out;
  const cut = new Date(`${aiFrom}T00:00:00+07:00`);
  if (Number.isNaN(cut.getTime())) return out;
  const { rows: aff } = await dbQuery<{ id: string }>(
    `select id from ${followTable}
      where follow_team = $1 and cancelled_at is null and completed_at is null
        and coalesce(call_mode, 'ai') = 'ai' and scheduled_at < $2`,
    [FOLLOW_TEAM_REPLACEMENT, cut.toISOString()],
  );
  if (aff.length === 0) return out;
  const res = await convertReplaceAiRowsToManual(new Set(aff.map((r) => r.id)), 'aiFrom');
  logInfo('irecruit.replaceSync.aiFrom.done', { aiFrom, ...res });
  return res;
}

/**
 * ═══ พัก AI ของงานส่งคนแทน (เจ้าของสั่ง 6 ต.ค. 2569 ค่ำ "อย่าพึ่งส่งให้ Ai โทร") ═══
 * สาย AI ที่ **ยังไม่ถึงเวลาโทร** (`scheduled_at` หลังตอนนี้) · ยังไม่ยกเลิก/ปิด → คนโทร + ยกเลิกแผนที่ Lumos
 * สายที่ถึงเวลาไปแล้ว = AI โทรไปแล้ว/กำลังโทร — คงเป็นของ AI (Choice "หยุดสายที่ยังไม่โทร + ของใหม่")
 * 🔴 ไม่มีคีย์ push (เครื่อง dev) = ไม่ทำอะไร · เรียกจาก worker ทุกรอบ + ตอนกดพักบนจอ
 */
export async function enforceReplaceAiPaused(now: Date = new Date()): Promise<{ converted: number; plansCancelled: number; errors: number }> {
  const out = { converted: 0, plansCancelled: 0, errors: 0 };
  if (!getLumosPushConfig()) return out;
  const { rows: aff } = await dbQuery<{ id: string }>(
    `select id from ${followTable}
      where follow_team = $1 and cancelled_at is null and completed_at is null
        and coalesce(call_mode, 'ai') = 'ai' and scheduled_at > $2`,
    [FOLLOW_TEAM_REPLACEMENT, now.toISOString()],
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
