/**
 * ═══ ดึงรายชื่อ "ส่งคนแทน" จาก iRecruit → สร้างสายในแท็บติดตามส่งคนแทน (2 ต.ค. 2569) ═══
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
import { randomUUID } from 'node:crypto';
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
  planReplaceCall,
  REPLACE_FOLLOW_TOPIC,
  REPLACE_SYNC_ACTOR_NAME,
  REPLACE_SYNC_DEFAULTS,
  replaceCallModeFor,
  replaceCallNote,
  replaceSourceRef,
  wantWallFromSqlDate,
  type ReplaceCallPlan,
  type ReplaceCallRule,
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
    `SELECT h.job_id, h.replace_no, z.fname, z.lname, z.mobile, s.site_name, h.site_code, h.want_date
       FROM ir_job_header h
       OUTER APPLY (
         SELECT TOP 1 jr.staff_id
         FROM ir_job_request jr
         WHERE jr.job_id = h.job_id
         ORDER BY jr.date_add DESC
       ) cand
       OUTER APPLY (
         SELECT TOP 1 zz.fname, zz.lname, zz.mobile, zz.status
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

type Candidate = {
  mode: 'ai' | 'manual';
  ref: string;
  name: string;
  phone: string;
  wall: ReplaceWantWall;
  plan: ReplaceCallPlan;
  siteName: string | null;
  siteCode: string | null;
};

let running = false;

/** รอบหนึ่งกำลังเดินอยู่ไหม (ปุ่ม "ดึงตอนนี้" กับ worker ชนกันได้) */
export function isReplaceSyncRunning(): boolean {
  return running;
}

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
      return summary; // ตารางยังไม่มี = จดลงฐานไม่ได้ · worker ถือผลไว้ในหน่วยความจำแทน
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

    // ใบที่เคยดึงแล้ว — ถามฐานทีเดียวทั้งก้อน
    const refs = rows.map((r) => replaceSourceRef(r.job_id));
    let existing = new Set<string>();
    if (refs.length > 0) {
      try {
        const { rows: ex } = await dbQuery<{ source_ref: string }>(
          `select source_ref from ${followTable} where source_ref = any($1::text[])`,
          [refs],
        );
        existing = new Set(ex.map((x) => x.source_ref));
      } catch (e) {
        if (isUndefinedColumn(e)) {
          summary.error = MIGRATION_133_NOT_READY;
          await persistLastRun(summary, actorName);
          return summary;
        }
        throw e;
      }
    }

    // คัด + จัดกลุ่มตามเบอร์ (คนเดียวหลายใบ = ชุดเดียว)
    const groups = new Map<string, Candidate[]>();
    for (const r of rows) {
      const ref = replaceSourceRef(r.job_id);
      if (existing.has(ref)) {
        summary.alreadyIn += 1;
        continue;
      }
      const phone = toE164Thai(r.mobile);
      if (!phone) {
        summary.noPhone += 1;
        continue;
      }
      const wall = wantWallFromSqlDate(r.want_date instanceof Date ? r.want_date : new Date(String(r.want_date)));
      const plan = planReplaceCall(wall, settings.rule, now);
      if (!plan) {
        summary.pastDue += 1;
        continue;
      }
      if (plan.asap) summary.asap += 1;
      const name = `${(r.fname ?? '').trim()} ${(r.lname ?? '').trim()}`.trim() || 'คนไปแทนงาน';
      const list = groups.get(phone) ?? [];
      list.push({ mode: replaceCallModeFor(plan.at, settings.rule.aiFrom), ref, name, phone, wall, plan, siteName: r.site_name?.trim() || null, siteCode: r.site_code?.trim() || null });
      groups.set(phone, list);
    }

    const autoAi = groups.size > 0 ? await isAutoDispatchEnabled('follow_entry') : false;

    for (const cands of groups.values()) {
      cands.sort((a, b) => a.plan.at.getTime() - b.plan.at.getTime());
      const groupId = randomUUID();
      const inserted: Array<{ id: string; cand: Candidate }> = [];
      for (const c of cands) {
        try {
          const { rows: ins } = await dbQuery<{ id: string }>(
            `insert into ${followTable}
               (recipient_name, recipient_phone, topic, note, staff_phone, scheduled_at,
                group_id, call_times, unit_name, site_code, call_round, call_mode,
                created_by, created_by_name, follow_team, source_ref)
             values ($1, $2, $3, $4, null, $5, $6, null, $7, $8, 1, $12, null, $9, $10, $11)
             returning id`,
            [c.name, c.phone, REPLACE_FOLLOW_TOPIC, replaceCallNote(c.wall), c.plan.at.toISOString(), groupId,
             c.siteName, c.siteCode, actorName, FOLLOW_TEAM_REPLACEMENT, c.ref, c.mode],
          );
          if (ins[0]) inserted.push({ id: ins[0].id, cand: c });
        } catch (e) {
          // สองรอบชนกัน / ใบนี้เพิ่งถูกดึงไปเมื่อกี้ — ฐานกันให้แล้ว นับว่ามีแล้ว
          if (isPgUniqueViolation(e)) {
            summary.alreadyIn += 1;
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
      if (inserted.length === 0) continue;
      summary.added += inserted.length;

      // ส่งให้ AI เฉพาะเมื่อสวิตช์ส่งอัตโนมัติของงานติดตามเปิดอยู่ (เจ้าของคุมที่หน้าตั้งค่า)
      let states = new Map<string, FollowDispatchState>();
      const aiInserted = inserted.filter(({ cand }) => cand.mode === 'ai');
      if (autoAi && aiInserted.length > 0) {
        const inputs: FollowEntryInput[] = aiInserted.map(({ id, cand }) => ({
          id,
          recipient_name: cand.name,
          recipient_phone: cand.phone,
          topic: REPLACE_FOLLOW_TOPIC,
          note: replaceCallNote(cand.wall),
          staffPhone: null,
          scheduled_at: cand.plan.at,
          callTimes: null,
          callRound: 1,
          staffName: null,
          unitName: cand.siteName,
        }));
        try {
          states = await enqueueFollowReminderPlan(inputs);
        } catch (e) {
          logError('irecruit.replaceSync: ส่งแผนให้ Lumos ไม่สำเร็จ', e, { rows: inserted.length });
          states = new Map();
        }
      }
      for (const { id, cand } of inserted) {
        const state: FollowDispatchState = cand.mode === 'manual' ? 'manual' : (states.get(id) ?? 'off');
        if (state === 'queued') summary.queued += 1;
        else if (state !== 'manual') summary.notSent += 1;
        try {
          await dbQuery(`update ${followTable} set dispatch_state = $2 where id = $1`, [id, state]);
        } catch (e) {
          if (!isUndefinedColumn(e)) throw e;
        }
      }
    }

    await persistLastRun(summary, actorName);
    logInfo('irecruit.replaceSync.done', {
      fetched: summary.fetched,
      added: summary.added,
      alreadyIn: summary.alreadyIn,
      noPhone: summary.noPhone,
      pastDue: summary.pastDue,
      asap: summary.asap,
      queued: summary.queued,
      notSent: summary.notSent,
      autoAi,
    });
    return summary;
  } finally {
    running = false;
  }
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
  const queueTable = tableInAppSchema('lumos_dispatch_queue');
  const { rows: aff } = await dbQuery<{ id: string }>(
    `select id from ${followTable}
      where follow_team = $1 and cancelled_at is null and completed_at is null
        and coalesce(call_mode, 'ai') = 'ai' and scheduled_at < $2`,
    [FOLLOW_TEAM_REPLACEMENT, cut.toISOString()],
  );
  if (aff.length === 0) return out;
  const ids = new Set(aff.map((r) => r.id));
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
      logError('irecruit.replaceSync.aiFrom: ยกเลิกแผนไม่สำเร็จ', e, { planRef });
    }
  }
  // แถวที่ไม่มีแผนในคิว (ยังไม่เคยส่ง) — ยกเลิกแถวคิวเดี่ยว ๆ ของมันถ้ามี
  for (const id of ids) {
    if (inPlan.has(id)) continue;
    try {
      await cancelFollowReminder(id, staffNameOfPhone);
    } catch (e) {
      out.errors += 1;
      logError('irecruit.replaceSync.aiFrom: ยกเลิกคิวไม่สำเร็จ', e, { id });
    }
  }
  const upd = await dbQuery<{ id: string }>(
    `update ${followTable} set call_mode = 'manual', dispatch_state = 'manual'
      where id = any($1::uuid[]) and coalesce(call_mode, 'ai') = 'ai' returning id`,
    [[...ids]],
  );
  out.converted = upd.rows.length;
  logInfo('irecruit.replaceSync.aiFrom.done', { aiFrom, ...out });
  return out;
}
