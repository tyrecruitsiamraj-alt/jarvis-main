/**
 * Follow — รายชื่อคนที่ต้องติดตาม (คนกรอกเอง) → ส่งเข้าเส้น reminder ให้ Lumos โทร
 *
 * GET    /api/follow            → รายการ + สถานะการโทรจาก Lumos
 * POST   /api/follow            → เพิ่มรายชื่อ (enqueue ให้ Lumos ทันที)
 * DELETE /api/follow?id=<uuid>  → ยกเลิก (soft cancel + ยกเลิกในคิวถ้ายังไม่ถูกดึง)
 * DELETE /api/follow?id=<uuid>&purge=1 → **ลบทิ้งจริง** (admin เท่านั้น · ล้างข้อมูลทดสอบ)
 */
import { randomUUID } from 'node:crypto';
import { dbQuery } from '../_lib/postgres.js';
import { FOLLOW_TEAM_REPLACEMENT } from '../../src/lib/followReplacement.js';
import { FOLLOW_CALL_ROUND_MAX } from '../../src/lib/followCallRound.js';

/** 42703 undefined_column — โค้ดใหม่ขึ้นก่อน migration 092 (group_id/call_times) */
function isUndefinedColumn(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '42703';
}
import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody, getString } from '../_lib/body.js';
import type { FollowDispatchState } from '@/lib/followDispatchState';
import { tableInAppSchema } from '../_lib/schema.js';
import { staffNameOfPhone } from '../_lib/followStaffName.js';
import { restoreRoundsStoppedByClose, type ReopenRestore } from '../_lib/followReopenRestore.js';
import { cancelFollowScope, parseCancelScope } from '../_lib/followCancelScope.js';
import { getReplaceSyncSettings } from '../_lib/irecruitReplaceSync.js';
import { logWarn } from '../_lib/logger.js';
import { auditFromAuthed } from '../_lib/audit.js';
import {
  enqueueFollowReminder,
  enqueueFollowReminderPlan,
  cancelFollowReminder,
  replanFollowSetWithLumos,
  refreshFollowReminderPayload,
} from '../_lib/lumosDispatch.js';
import { isAutoDispatchEnabled } from '../_lib/lumosDispatchMode.js';
import { toE164Thai } from '../_lib/lumosDispatch.js';
import {
  FOLLOW_OUTCOME_ALL,
  isFollowOutcome,
  requiresNote,
} from '../../src/lib/followOutcome.js';
import { isAiDecisiveOutcome, validateFollowStaffCall } from '../../src/lib/followStaffCall.js';

const followTable = tableInAppSchema('follow_entries');
const queueTable = tableInAppSchema('lumos_dispatch_queue');


type LumosNextAction = {
  type: string;
  urgency: 'urgent' | 'normal' | 'not urgent';
  due_at: string;
  reason: string;
};

type FollowRow = {
  id: string;
  recipient_name: string;
  recipient_phone: string;
  topic: string;
  note: string | null;
  /** เบอร์เจ้าหน้าที่ผู้ติดตาม — AI บอกผู้สมัครไว้โทรกลับ (migration 081) */
  staff_phone: string | null;
  scheduled_at: string | Date;
  /** ชุดตาราง (092) — แถวของคนเดียวกันที่ตั้งพร้อมกัน · null = แถวเก่า/รอบเดี่ยว */
  group_id?: string | null;
  /** รอบเวลาของวันนั้น (092) — ต้องพกไปด้วยตอนสร้าง payload ใหม่ ไม่งั้นตารางหลายรอบหาย */
  call_times: string[] | null;
  /**
   * รอบนี้คือ "สายที่เท่าไหร่" (113) — คนเลือกเองตอนเพิ่ม
   * 1 = สายแรก (บท `follow`) · 2 ขึ้นไป = บท `follow_repeat` · null = แถวเก่า ถือเป็นสายแรก
   */
  call_round: number | null;
  /**
   * ใครโทรรอบนี้ (migration 121) — `ai` = ส่งเข้าคิวให้ Lumos · `manual` = เจ้าหน้าที่โทรเอง
   * แถวเก่า/ฐานที่ยังไม่รัน 121 = null ⇒ อ่านว่า `ai` (พฤติกรรมเดิม)
   */
  call_mode: string | null;
  /** ยังไม่กำหนดเวลาโทร (134) — เวลาใน scheduled_at เป็นค่าแทน */
  time_tbd?: boolean | null;
  /** ติดตามครั้งที่ของวันแรกในชุด (137) */
  plan_day_start?: number | null;
  replace_type?: string | null;
  source_ref?: string | null;
  /** หน่วยงานที่ตามเรื่องให้ + รหัสไซต์ (migration 096) — snapshot ตอนกรอก ไม่ใช่ FK */
  unit_name: string | null;
  site_code: string | null;
  created_by_name: string | null;
  /** คนแก้ล่าสุด — คนละคนกับเจ้าของข้อมูล (created_by_name) ได้ */
  updated_at: string | Date | null;
  updated_by_name: string | null;
  cancelled_at: string | Date | null;
  /** ปิดงานแล้วเมื่อไหร่ + จบแบบไหน (migration 095) */
  completed_at: string | Date | null;
  outcome_code: string | null;
  outcome_note: string | null;
  completed_by_name: string | null;
  /**
   * ผลที่เจ้าหน้าที่ลงเองของรอบคนโทร (migration 130 · 30 ก.ย. 2569)
   * `undefined` = ฐานยังไม่รัน 130 (`select *` ไม่มีคีย์นี้) · `null` = ยังไม่ได้ลงผล
   */
  staff_call_outcome?: string | null;
  staff_call_note?: string | null;
  staff_called_at?: string | Date | null;
  staff_called_by_name?: string | null;
  created_at: string | Date;
  /**
   * ผลตอนพยายามส่งเข้าคิว AI ตอนสร้าง (migration 109)
   * `null` = แถวเก่าก่อนมีคอลัมน์นี้ ⇒ **ไม่รู้ว่าทำไม** ห้ามตีความว่าส่งแล้ว
   */
  dispatch_state: string | null;
  /** เหตุที่ push ไม่สำเร็จ (migration 116) — undefined = ฐานยังไม่มีคอลัมน์นี้ */
  dispatch_error?: string | null;
  call_status: string | null;
  call_outcome: string | null;
  /** รอบที่โทรล่าสุดของแถวคิว — ใช้จัดกลุ่ม "ใครอยู่รอบไหน" บนแผงหน้าหลัก */
  call_attempt: number | null;
  call_summary: string | null;
  /** คำที่คนรับสายพูดเอง (ต่อจาก transcript) — null = ไม่มี transcript หรือเขาไม่พูดเลย */
  call_reply: string | null;
  call_next_action: LumosNextAction | null;
  called_at: string | Date | null;
  /** สถานะ followup ของคิว (070) — 'needs_human' = AI เอาไม่อยู่ ต้องคนตาม */
  followup_state: string | null;
  /**
   * เบอร์ฉุกเฉินที่ส่งไปกับสายนั้น (`payload->>'admin_phone'`) — เบอร์ที่ **AI โทรหา**
   * เมื่อติดต่อผู้รับไม่ได้ · คนละช่องกับเบอร์ที่ AI พูดให้ผู้สมัครโทรกลับ
   *
   * 🔴 feedback 2 ก.ย. 2569: *"เพิ่มการแสดงสถานะการโทรติดต่อเบอร์ฉุกเฉิน"*
   * ⚠️ **บอกได้แค่ "ส่งเบอร์ไปแล้ว" ไม่ใช่ "โทรไปแล้ว"** — ผลที่ Lumos ส่งกลับ
   * ยังไม่มีช่องบอกว่าโทรเบอร์ฉุกเฉินหรือยัง (ตรวจครบทุกช่อง 2 ก.ย. 2569)
   */
  emergency_phone: string | null;
  /** ทีมของรายการ (131 · 1 ต.ค. 2569) — null = ทีมติดตาม · 'replacement' = ทีมส่งคนแทน · ฐานยังไม่รัน 131 = ไม่มีคีย์ */
  follow_team?: string | null;
};

const iso = (v: string | Date | null): string | null =>
  v == null ? null : v instanceof Date ? v.toISOString() : String(v);

function toResponse(r: FollowRow) {
  return {
    id: r.id,
    recipient_name: r.recipient_name,
    recipient_phone: r.recipient_phone,
    topic: r.topic,
    note: r.note,
    staff_phone: r.staff_phone ?? null,
    dispatch_state: r.dispatch_state ?? null,
    dispatch_error: r.dispatch_error ?? null,
    scheduled_at: iso(r.scheduled_at),
    unit_name: r.unit_name ?? null,
    site_code: r.site_code ?? null,
    /** สายที่เท่าไหร่ (113) — null = ไม่ได้ระบุ ฝั่งจออ่านเป็นสายแรก */
    call_round: r.call_round == null ? null : Number(r.call_round),
    /** ใครโทรรอบนี้ (121) — แถวเก่า/ฐานยังไม่รัน 121 = ai (พฤติกรรมเดิม) */
    call_mode: r.call_mode === 'manual' ? 'manual' : 'ai',
    /** ยังไม่กำหนดเวลา (134) — จอโชว์ "ยังไม่ระบุเวลา" แทนเวลา */
    time_tbd: r.time_tbd === true,
    plan_day_start: typeof r.plan_day_start === 'number' && r.plan_day_start > 1 ? r.plan_day_start : null,
    /** ประเภทใบส่งคนแทนจาก iRecruit (136) — EX = คนนอก · อื่น ๆ = คนใน · null = ไม่รู้ */
    replace_type: r.replace_type?.trim() || null,
    /** ที่มาของแถว (133) — หน้าจออ่านสายที่ 1/2/3 ของแถวจาก iRecruit จากตรงนี้ */
    source_ref: r.source_ref ?? null,
    /** ทีมของรายการ (131) — แท็บ "ติดตามส่งคนแทน" อ่านช่องนี้ · ค่าอื่น/ไม่มี = ทีมติดตาม */
    follow_team: r.follow_team === FOLLOW_TEAM_REPLACEMENT ? FOLLOW_TEAM_REPLACEMENT : null,
    /**
     * รอบเวลาของวันนั้น (092) — **ต้องส่งออกมาด้วย** (21 ก.ย. 2569)
     * ตาราง Planning รายเดือนต้องบอกให้ได้ว่า "วันนี้กี่รอบ รอบไหนกี่โมง"
     * ซึ่งอ่านจากช่องนี้ช่องเดียว · ก่อนหน้านี้เก็บในฐานแต่ไม่เคยส่งออกมาเลย
     */
    call_times: Array.isArray(r.call_times) ? r.call_times : null,
    /** ชุดตาราง (092) — จอ "แก้ตารางทั้งชุด" ใช้เลือกสายของชุดเดียวกัน (1 ต.ค. 2569) · null = แถวเก่า/รอบเดี่ยว */
    group_id: r.group_id ?? null,
    /** เบอร์ฉุกเฉินที่ส่งไปกับสายนั้น — null = ไม่เคยเข้าคิว หรือไม่มีเบอร์ให้ส่ง */
    emergency_phone: r.emergency_phone ?? null,
    /** เจ้าของข้อมูล = คนที่กรอกครั้งแรก · ไม่เปลี่ยนแม้มีคนอื่นมาแก้ทีหลัง */
    created_by_name: r.created_by_name,
    updated_at: iso(r.updated_at ?? null),
    updated_by_name: r.updated_by_name ?? null,
    created_at: iso(r.created_at),
    cancelled: r.cancelled_at != null,
    // ปิดงาน (095) — คนละช่องกับ cancelled โดยตั้งใจ (ตามจนจบ ≠ ตัดทิ้งก่อนถึงวัน)
    completed_at: iso(r.completed_at ?? null),
    outcome_code: r.outcome_code ?? null,
    outcome_note: r.outcome_note ?? null,
    completed_by_name: r.completed_by_name ?? null,
    /**
     * ผลที่เจ้าหน้าที่ลงเองของรอบคนโทร (130) — **คนละช่องกับ `call_outcome`** (ผลจาก AI)
     * ฝั่งจอรวมสองแหล่งด้วย `effectiveCallOutcome()` ที่เดียว · ฐานยังไม่รัน 130 = null
     */
    staff_call_outcome: r.staff_call_outcome ?? null,
    staff_call_note: r.staff_call_note ?? null,
    staff_called_at: iso(r.staff_called_at ?? null),
    staff_called_by_name: r.staff_called_by_name ?? null,
    /** สถานะจากคิว Lumos: pending=รอโทร, delivered=Lumos รับไปแล้ว, completed/failed/cancelled */
    /**
     * 🔴 **ห้ามเดา `'pending'` เมื่อไม่มีแถวในคิว** (แก้ 25 ส.ค. 2569)
     *
     * เดิม `r.call_status ?? 'pending'` ⇒ รายการที่ **ไม่เคยถูกส่งให้ AI เลย**
     * ขึ้นบนจอว่า **"รอ AI โทร"** · นี่คือเหตุผลที่งานหายไป 5 วันโดยไม่มีใครสังเกต
     * (รายการ 24 ส.ค. 2569 — ไม่มีแถวในคิว แต่จอบอกว่ากำลังรอโทร)
     *
     * `null` = ไม่อยู่ในคิว · ฝั่งจอใช้ `followDispatchLabel()` บอกว่าไม่ได้ส่งเพราะอะไร
     */
    call_status: r.cancelled_at != null ? 'cancelled' : (r.call_status ?? null),
    call_outcome: r.call_outcome,
    call_attempt: r.call_attempt == null ? null : Number(r.call_attempt),
    call_summary: r.call_summary,
    /** คำพูดของคนรับสาย — ตรงกว่า summary เวลาถามว่า "เขาตอบว่าอะไร" */
    call_reply: r.call_reply ?? null,
    next_action: r.call_next_action ?? null,
    called_at: iso(r.called_at),
    /**
     * 'needs_human' = AI เอาไม่อยู่ ต้องคนตาม (070) — กล่อง "โทรครบแล้ว" (Phase 7.1) ใช้ตัวนี้
     * ⚠️ ส่งมาดิบ ๆ · การตีความอยู่ที่ `followCompletion.ts` ฝั่งเดียว
     */
    followup_state: r.followup_state ?? null,
  };
}

async function listFollow(req: AuthedReq, res: ApiRes) {
  const rawLimit = typeof req.query?.limit === 'string' ? Number(req.query.limit) : NaN;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 500) : 200;
  const rawOffset = typeof req.query?.offset === 'string' ? Number(req.query.offset) : NaN;
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;

  const { rows } = await dbQuery<FollowRow>(
    /**
     * ⚠️ รวมสองสายที่ทำขนานกัน 17 ส.ค. 2569 — merge ต่อบรรทัดให้ดื้อ ๆ จน SQL พัง
     * (ไม่มี conflict marker เพราะเป็นการเพิ่มบรรทัดติดกัน) เก็บของทั้งสองฝั่ง:
     *   · `next_action` ของอีกสาย
     *   · `coalesce(last_outcome, result->>'outcome')` ของสายนี้ — ผลที่คนบันทึกเขียนแค่
     *     `last_outcome` ส่วนแถวก่อน migration 070 มีแต่ `result` อ่านทางเดียวจะหายเงียบ
     */
    /**
     * `call_reply` = **คำที่คนรับสายพูดเอง** ดึงจาก transcript เฉพาะฝั่ง candidate
     *
     * 🔴 เจ้าของทัก 10 ก.ย. 2569: *"ไม่แสดงข้อความที่ตอบ"* — ของเดิมส่งมาแต่
     * `summary` ซึ่งเป็นคำบรรยายของ AI มุมมองบุคคลที่สาม (*"ผู้รับสายแจ้งว่า…"*)
     * ไม่ใช่คำตอบของเขา · และบางสาย (เช่น `unresponsive`) ไม่มี summary เลย
     * ⇒ ช่อง "เขาตอบว่าอะไร" ว่างทั้งที่ transcript มีคำพูดอยู่
     *
     * ⚠️ **ไม่ส่ง transcript ทั้งก้อน** — บางสาย 24 ตา ถ้าส่งดิบทุกแถว payload บวม
     * และไม่มีจอไหนใช้ · ต่อคำด้วย ' · ' ให้อ่านรวดเดียว ฝั่งจอตัดความยาวเอง
     */
    `select f.*,
            q.status                                       as call_status,
            coalesce(q.last_outcome, q.result->>'outcome') as call_outcome,
            q.attempt_count                                as call_attempt,
            q.result->>'summary'                           as call_summary,
            (select string_agg(x.t->>'text', ' · ' order by x.ord)
               from jsonb_array_elements(
                      case when jsonb_typeof(q.result->'transcript') = 'array'
                           then q.result->'transcript' else '[]'::jsonb end
                    ) with ordinality as x(t, ord)
              where x.t->>'role' = 'candidate'
                and coalesce(btrim(x.t->>'text'), '') <> '')  as call_reply,
            q.result->'next_action'                        as call_next_action,
            q.updated_at                                   as called_at,
            q.followup_state                               as followup_state,
            q.payload->>'admin_phone'                      as emergency_phone
       from ${followTable} f
       left join ${queueTable} q
              on q.channel = 'reminder'
             and q.job_ref = 'follow'
             and q.person_ref = 'follow-' || f.id::text
      order by f.created_at desc
      limit $1 offset $2`,
    [limit, offset],
  );

  /**
   * 🔴 **`total` ต้องเป็นยอดจริงทั้งตาราง ไม่ใช่จำนวนแถวที่เพิ่งส่งไป** (20 ก.ย. 2569)
   *
   * ของเดิมส่ง `total: rows.length` ⇒ ฐานมี 257 แถว แต่เส้นส่งไป 200 แล้วบอกว่า
   * "total 200" · หน้าจอจึงคิดเลขทุกตัว (ป้ายแท็บ · ปฏิทิน · Planning) จากของ
   * ไม่ครบ **โดยไม่มีอะไรบอกใครเลย** — เจ้าของจับได้ว่าเลขไม่สอดคล้องกัน
   */
  const { rows: countRows } = await dbQuery<{ n: string }>(
    `select count(*)::text as n from ${followTable}`,
  );
  const total = Number(countRows[0]?.n ?? rows.length);
  return res.status(200).json({
    items: rows.map(toResponse),
    /** ยอดจริงทั้งตาราง — ฝั่งจอใช้ตัวนี้ตัดสินว่าต้องดึงหน้าต่อไปไหม */
    total,
    returned: rows.length,
    offset,
    has_more: offset + rows.length < total,
  });
}

export type ParsedFollowInput = {
  name: string;
  phone: string;
  topic: string;
  note: string | null;
  /** เบอร์เจ้าหน้าที่ผู้ติดตาม — ไว้ให้ AI บอกผู้สมัครโทรกลับ ไม่ใช่เบอร์ที่ระบบโทรออก */
  staffPhone: string | null;
  when: Date;
  /** ชุดตารางโทร (migration 092) — client gen uuid เดียวต่อ 1 คน แล้วยิง 1 แถว/วัน · null = รอบเดี่ยว */
  groupId: string | null;
  /** รอบเวลาของวันนั้น (HH:MM) — payload สร้าง steps ตามนี้ · ว่าง = 1 รอบที่ when */
  callTimes: string[] | null;
  /**
   * ใครโทร (121) — `'ai'` ส่งเข้าคิว · `'manual'` เจ้าหน้าที่โทรเอง **ไม่ส่งเข้าคิว**
   * ไม่ส่งมา = `'ai'` ⇒ ของเดิมที่ยิงมาโดยไม่มีคีย์นี้ไม่เปลี่ยนพฤติกรรม
   */
  callMode: 'ai' | 'manual';
  /** ยังไม่กำหนดเวลา (134) — บังคับเป็นคนโทร (ห้ามส่ง AI โดยไม่มีเวลาจริง) */
  timeTbd: boolean;
  /** "ติดตามครั้งที่" ของวันแรกในชุด (137) — null = นับ 1 · ตั้งหลัง insert (`insertFollowRow`) */
  planDayStart?: number | null;
  /** หน่วยงานที่ตามเรื่องให้ (096) — เลือกจากใบขอหรือพิมพ์เอง · null = ไม่ได้ระบุ */
  unitName: string | null;
  /** รหัสไซต์ของหน่วยงานนั้น — เติมเองเมื่อเลือกจากใบขอ */
  siteCode: string | null;
  /**
   * รอบนี้คือสายที่เท่าไหร่ (113) — คนเลือกจาก dropdown ตอนตั้งรอบ
   * null = ไม่ได้ระบุ ⇒ ถือเป็นสายแรก (ของเดิมที่ยิงมาโดยไม่มีคีย์นี้จึงไม่พัง)
   */
  callRound: number | null;
  /**
   * ทีมของรายการ (131 · เจ้าของสั่ง 1 ต.ค. 2569: *"ทำงานเหมือนกันแค่คนละทีม"*) — แท็บที่กดเพิ่มเป็นคนบอก
   * null = ทีมติดตาม (ของเดิม · ไม่ส่งคีย์มา) · 'replacement' = ทีมส่งคนแทน
   */
  team: typeof FOLLOW_TEAM_REPLACEMENT | null;
};

const HHMM_RE = /^\d{1,2}:\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * อ่าน/ตรวจ body ของ POST /api/follow — pure เพื่อคุมด้วย unit test
 * ระวัง: getString() trim ให้แล้วและคืน null เมื่อไม่มีค่า — อย่าเรียก .trim() ต่อ
 */
export type FollowInputResult = { error: string | null; value: ParsedFollowInput | null };

export function parseFollowInput(raw: unknown, now = new Date()): FollowInputResult {
  const fail = (message: string): FollowInputResult => ({ error: message, value: null });
  if (typeof raw !== 'object' || raw === null) {
    return fail('Invalid JSON body');
  }
  const body = raw as Record<string, unknown>;
  const name = getString(body.recipient_name) ?? '';
  const phoneRaw = getString(body.recipient_phone) ?? '';
  const topic = getString(body.topic) ?? '';
  const note = getString(body.note) || null;
  const staffPhoneRaw = getString(body.staff_phone) || '';
  const scheduledAt = getString(body.scheduled_at) ?? '';

  if (!name) return fail('กรุณากรอกชื่อผู้ที่ต้องติดตาม');
  if (!topic) return fail('กรุณากรอกเรื่องที่จะให้โทรติดตาม');

  const phone = toE164Thai(phoneRaw);
  if (!phone) {
    return fail('เบอร์โทรไม่ถูกต้อง — ใช้เบอร์มือถือ 10 หลัก เช่น 0812345678');
  }

  // ⚠️ เบอร์เจ้าหน้าที่เป็น **เบอร์ที่ AI พูดให้ฟัง** ไม่ใช่เบอร์ที่ระบบโทรออก
  // จึงไม่บังคับรูปแบบ E.164 (เบอร์บ้าน/เบอร์ต่อภายในก็ใช้ได้) แต่ต้องมีตัวเลขจริง
  // ไม่งั้นผู้สมัครจะได้ยินข้อความที่โทรกลับไม่ได้
  let staffPhone: string | null = null;
  if (staffPhoneRaw) {
    if ((staffPhoneRaw.match(/\d/g) ?? []).length < 8) {
      return fail('เบอร์เจ้าหน้าที่ไม่ถูกต้อง — ใส่เบอร์ที่ผู้สมัครโทรกลับได้จริง');
    }
    staffPhone = staffPhoneRaw;
  }

  const when = scheduledAt ? new Date(scheduledAt) : now;
  if (Number.isNaN(when.getTime())) {
    return fail('วันเวลาที่ให้โทรไม่ถูกต้อง');
  }

  // ตารางโทร (092): group_id (client gen · 1 คน 1 uuid) + call_times (รอบของวันนั้น)
  let groupId: string | null = null;
  const groupRaw = getString(body.group_id) || '';
  if (groupRaw) {
    if (!UUID_RE.test(groupRaw)) return fail('group_id ไม่ถูกต้อง');
    groupId = groupRaw;
  }
  let callTimes: string[] | null = null;
  if (Array.isArray(body.call_times)) {
    const times = body.call_times
      .map((t) => (typeof t === 'string' ? t.trim() : ''))
      .filter((t) => HHMM_RE.test(t));
    const uniq = [...new Set(times)];
    if (uniq.length === 0) return fail('รอบเวลาโทรไม่ถูกต้อง (เช่น 07:00)');
    if (uniq.length > 5) return fail('รอบโทรต่อวันมากสุด 5 รอบ');
    callTimes = uniq;
  }

  /**
   * ใครโทร (121) — ตรวจที่นี่แทน CHECK constraint (บ้านนี้โดน CHECK ล็อกมาสองรอบ)
   * ค่าที่อ่านไม่ออก = ปฏิเสธไปตรง ๆ **ห้ามเดาว่าเป็น ai** เพราะเดาผิด = คนจริงโดนโทร
   */
  let callMode: 'ai' | 'manual' = 'ai';
  const callModeRaw = getString(body.call_mode) || '';
  if (callModeRaw) {
    if (callModeRaw !== 'ai' && callModeRaw !== 'manual') return fail('call_mode ต้องเป็น ai หรือ manual');
    callMode = callModeRaw;
  }

  // หน่วยงาน/รหัสไซต์ (096) — ไม่บังคับ · Follow หลายเคสไม่ได้ผูกกับใบขอใด
  const unitName = getString(body.unit_name) || null;
  const siteCode = getString(body.site_code) || null;

  /**
   * สายที่เท่าไหร่ (113) — ตรวจที่นี่แทน CHECK constraint (บ้านนี้โดน CHECK ล็อกมาสองรอบ)
   * ไม่ส่งมา = null (สายแรก) · ค่าที่อ่านไม่ออก/นอกช่วง = ปฏิเสธไปตรง ๆ ไม่แอบปัดให้
   */
  let callRound: number | null = null;
  if (body.call_round != null && body.call_round !== '') {
    const n = Number(body.call_round);
    // เดิมตัน 9 — ลงหลายวันแล้ววันท้าย ๆ บันทึกไม่ได้ (4 ต.ค. 2569) · ดู followCallRound.ts
    if (!Number.isInteger(n) || n < 1 || n > FOLLOW_CALL_ROUND_MAX) {
      return fail(`สายที่เท่าไหร่ต้องเป็นเลข 1-${FOLLOW_CALL_ROUND_MAX}`);
    }
    callRound = n;
  }

  /** ทีม (131) — ตรวจที่นี่แทน CHECK constraint · ค่าที่อ่านไม่ออก = ปฏิเสธ (ห้ามเดาว่าเป็นทีมไหน — รายการจะไปโผล่ผิดแท็บ) */
  let team: typeof FOLLOW_TEAM_REPLACEMENT | null = null;
  const teamRaw = getString(body.follow_team) || '';
  if (teamRaw) {
    if (teamRaw !== FOLLOW_TEAM_REPLACEMENT) return fail('follow_team ต้องเป็น replacement หรือไม่ส่งมา');
    team = FOLLOW_TEAM_REPLACEMENT;
  }

  /**
   * ยังไม่ชัวร์เวลา (134 · Journey ข้อ 5) — เวลาที่ส่งมาเป็นค่าแทน (เที่ยงคืนของวันนั้น)
   * 🔴 บังคับเป็นคนโทร: ส่งให้ AI โดยไม่มีเวลาจริง = โทรหาคนจริงเวลามั่ว (fail-safe ไปทาง manual)
   */
  const timeTbd = body.time_tbd === true;
  if (timeTbd) callMode = 'manual';

  /** "ติดตามครั้งที่" ของวันแรกในชุด (137 · 6 ต.ค. 2569) — 2…99 เก็บ · ไม่ส่ง/1 = null (นับ 1 ตามเดิม) */
  const startRaw = Number(body.plan_day_start);
  if (body.plan_day_start != null && (!Number.isInteger(startRaw) || startRaw < 1 || startRaw > 99)) {
    return fail('plan_day_start ต้องเป็นเลข 1–99');
  }
  const planDayStart = Number.isInteger(startRaw) && startRaw > 1 ? startRaw : null;

  return {
    error: null,
    value: {
      name, phone, topic, note, staffPhone, when, groupId, callTimes, unitName, siteCode, callRound,
      callMode, team, timeTbd, planDayStart,
    },
  };
}

/** ฐานยังไม่รัน 131 แต่มีคนกดเพิ่มจากแท็บส่งคนแทน — ห้ามบันทึกแบบไม่มีทีม (รายการจะไปโผล่แท็บรายชื่อติดตาม) */
export class FollowTeamNotReady extends Error {
  constructor() {
    super('ยังบันทึกทีมส่งคนแทนไม่ได้ตอนนี้ — ระบบกำลังอัปเดต ลองใหม่อีกครั้งในอีกสักครู่');
  }
}

/** ฐานยังไม่รัน 134 — แจ้งให้ลองใหม่ ห้ามถอยไปบันทึกแบบมีเวลา (เวลาแทนจะกลายเป็นเวลาจริงเงียบ ๆ) */
export class FollowTimeTbdNotReady extends Error {
  constructor() {
    super('ยังบันทึกสายแบบ "ยังไม่ชัวร์เวลา" ไม่ได้ตอนนี้ — ระบบกำลังอัปเดต ลองใหม่อีกครั้งในอีกสักครู่');
  }
}

export type FollowRoundInput = {
  when: Date;
  staffPhone: string | null;
  callRound: number | null;
  /** ใครโทรรอบนี้ (121) — ไม่ระบุ = ตามค่าของทั้งคำขอ */
  callMode?: 'ai' | 'manual';
  /** ยังไม่กำหนดเวลา (134) — บังคับคนโทรของรอบนั้น */
  timeTbd?: boolean;
};

/**
 * อ่านรายการรอบจาก body — `rounds: [{ scheduled_at, staff_phone?, call_round? }, …]`
 *
 * ไม่ส่ง `rounds` มา = รอบเดียวตามของเดิม (เส้นเก่ายังใช้ได้ทุกตัว)
 * ⚠️ **เรียงตามเวลาและตัดเวลาซ้ำ** ที่นี่เลย — step ในแผนต้องเรียงถูกและห้ามซ้ำ
 * ไม่งั้น Lumos โทรซ้ำเวลาเดียวกันสองครั้ง
 */
export function parseFollowRounds(raw: unknown, primary: FollowRoundInput): FollowRoundInput[] {
  const list = (raw as { rounds?: unknown } | null)?.rounds;
  if (!Array.isArray(list) || list.length === 0) return [primary];

  const out: FollowRoundInput[] = [];
  const seen = new Set<number>();
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const at = typeof o.scheduled_at === 'string' ? new Date(o.scheduled_at) : null;
    if (!at || Number.isNaN(at.getTime())) continue;
    if (seen.has(at.getTime())) continue;
    seen.add(at.getTime());
    const phoneRaw = typeof o.staff_phone === 'string' ? o.staff_phone.trim() : '';
    const roundRaw = Number(o.call_round);
    const modeRaw = typeof o.call_mode === 'string' ? o.call_mode.trim() : '';
    const timeTbd = o.time_tbd === true;
    out.push({
      when: at,
      staffPhone: phoneRaw || primary.staffPhone,
      callRound: Number.isInteger(roundRaw) && roundRaw >= 1 ? roundRaw : null,
      // อ่านไม่ออก = ไม่ระบุ ⇒ ตามค่าของทั้งคำขอ (ห้ามเดาเป็น ai เองตรงนี้)
      // 🔴 ยังไม่ชัวร์เวลา = คนโทรเสมอ (ห้ามส่ง AI โดยไม่มีเวลาจริง)
      callMode: timeTbd ? 'manual' : modeRaw === 'ai' || modeRaw === 'manual' ? modeRaw : undefined,
      timeTbd,
    });
  }
  if (out.length === 0) return [primary];
  return out.sort((a, b) => a.when.getTime() - b.when.getTime());
}

/**
 * สร้างหลายรอบในคำขอเดียว แล้วดัน **แผนเดียว** ที่มีครบทุกรอบไปหา Lumos
 *
 * 🔴 ยังเป็น **หนึ่งแถวต่อหนึ่งรอบ** เหมือนเดิม — ทั้งหน้าจอผูกกับแถวต่อรอบ
 * (สถานะ · ผล · ปุ่มแก้เวลา) เปลี่ยนแค่สิ่งที่ยิงออกไป ไม่ใช่โครงข้อมูล
 */
async function createFollowRounds(
  req: AuthedReq,
  res: ApiRes,
  inputBase: ParsedFollowInput,
  inputRounds: FollowRoundInput[],
): Promise<void> {
  /**
   * 🔴 พัก AI ของส่งคนแทนอยู่ (เจ้าของ 6 ต.ค. 2569 "อย่าพึ่งส่งให้ Ai โทร") — สายที่เพิ่มเองในแท็บนั้นเป็นคนโทรตั้งแต่สร้าง
   * (ตรวจ Journey 7 ต.ค.: เดิมส่ง Lumos ไปก่อน แล้วรอบดึง 5 นาทีค่อยเปลี่ยนเป็นคนโทร — สายที่นัดในช่วงนั้นโดน AI โทรได้)
   */
  let base = inputBase;
  let rounds = inputRounds;
  if (inputBase.team === FOLLOW_TEAM_REPLACEMENT) {
    try {
      if ((await getReplaceSyncSettings()).rule.aiPaused) {
        base = { ...inputBase, callMode: 'manual' };
        rounds = inputRounds.map((r) => ({ ...r, callMode: 'manual' as const }));
      }
    } catch (e) {
      logWarn('follow.create.replaceAiPausedCheckFailed', { error: String(e) });
    }
  }
  const createdRows: FollowRow[] = [];
  for (const r of rounds) {
    const row = await insertFollowRow(req, base, r);
    if (row) createdRows.push(row);
  }
  if (createdRows.length === 0) {
    sendError(res, 500, 'Failed to create follow entries');
    return;
  }

  /**
   * 🔴 **รอบที่เจ้าหน้าที่จะโทรเอง ห้ามส่งเข้าคิว** (121 · เจ้าของสั่ง 20 ก.ย. 2569:
   * *"วันที่ 1-3 กำหนดเองอะนะว่าจะโทรเองหรือส่ง lumos โทร"*)
   * ⇒ กรองออกก่อนสร้างแผน ไม่ใช่สร้างแล้วค่อยยกเลิก (ยกเลิกทีหลัง = เสี่ยงหลุดไปหาคนจริง)
   */
  const modeOf = (i: number): 'ai' | 'manual' => rounds[i]?.callMode ?? base.callMode;
  const aiIndexes = createdRows.map((_, i) => i).filter((i) => modeOf(i) === 'ai');

  let states = new Map<string, FollowDispatchState>();
  if (aiIndexes.length > 0 && (await isAutoDispatchEnabled('follow_entry'))) {
    const staffName = await staffNameOfPhone(base.staffPhone);
    states = await enqueueFollowReminderPlan(
      aiIndexes.map((i) => ({
        id: createdRows[i].id,
        recipient_name: base.name,
        recipient_phone: base.phone,
        topic: base.topic,
        note: base.note,
        staffPhone: rounds[i]?.staffPhone ?? base.staffPhone,
        staffName,
        unitName: base.unitName,
        scheduled_at: rounds[i]?.when ?? new Date(String(createdRows[i].scheduled_at)),
        callTimes: base.callTimes,
        callRound: rounds[i]?.callRound ?? null,
      })),
    );
  }

  const out: FollowRow[] = [];
  for (const [i, row] of createdRows.entries()) {
    const state: FollowDispatchState =
      modeOf(i) === 'manual' ? 'manual' : (states.get(row.id) ?? 'off');
    try {
      await dbQuery(`update ${followTable} set dispatch_state = $2 where id = $1`, [row.id, state]);
      out.push({ ...row, dispatch_state: state });
    } catch (e) {
      // ฐานยังไม่รัน 109 → ข้ามการจด (จอถอยไปอ่านสถานะจากคิวเหมือนเดิม)
      if (!isUndefinedColumn(e)) throw e;
      out.push(row);
    }
    await auditFromAuthed(req, {
      action: 'follow.create',
      entityType: 'follow_entry',
      entityId: row.id,
      after: toResponse(row),
    });
  }

  res.status(201).json({ items: out.map(toResponse) });
}

/**
 * insert หนึ่งแถวติดตาม — แยกออกมาเพราะทางสร้าง **หลายรอบในคำขอเดียว** (11 ก.ย. 2569)
 * ต้องใช้ตัวเดียวกัน ไม่ใช่ก๊อป SQL ไปอีกชุดแล้วค่อย ๆ เพี้ยนกัน
 *
 * ฐานที่รัน 092 แล้วเก็บ `group_id`/`call_times` · ยังไม่รัน → ถอยไป insert ชุดเดิม (42703)
 */
/**
 * insert หนึ่งสาย + ตั้ง "ติดตามครั้งที่" (137 · 6 ต.ค. 2569) ทีหลัง — คำสั่ง insert เดิมทุกแบบไม่ต้องแตะ
 * ฐานยังไม่รัน 137 = บันทึกสายได้ตามเดิม แต่เลขครั้งที่หาย ⇒ log ไว้ (รัน migration ก่อน deploy)
 */
async function insertFollowRow(
  req: AuthedReq,
  base: ParsedFollowInput,
  round: FollowRoundInput,
): Promise<FollowRow | undefined> {
  const row = await insertFollowRowBase(req, base, round);
  if (row && base.planDayStart && base.planDayStart > 1) {
    try {
      await dbQuery(`update ${followTable} set plan_day_start = $2 where id = $1`, [row.id, base.planDayStart]);
      (row as FollowRow & { plan_day_start?: number }).plan_day_start = base.planDayStart;
    } catch (e) {
      if (!isUndefinedColumn(e)) throw e;
      logWarn('follow.plan_day_start: ฐานยังไม่รัน 137 — ไม่ได้เก็บเลขติดตามครั้งที่', { id: row.id });
    }
  }
  return row;
}

async function insertFollowRowBase(
  req: AuthedReq,
  base: ParsedFollowInput,
  round: FollowRoundInput,
): Promise<FollowRow | undefined> {
  const { name, phone, topic, note, groupId, callTimes, unitName, siteCode, callMode, team } = base;
  /**
   * ยังไม่ชัวร์เวลา (134) — insert ที่มีช่อง time_tbd (พ่วงช่องทีมด้วย เผื่อเพิ่มจากแท็บส่งคนแทน)
   * ฐานยังไม่รัน 134 = แจ้งให้ลองใหม่ **ห้ามถอยไปบันทึกแบบมีเวลา** (ค่าแทนจะกลายเป็นเวลาจริงเงียบ ๆ)
   */
  if (round.timeTbd || base.timeTbd) {
    try {
      const { rows } = await dbQuery<FollowRow>(
        `insert into ${followTable}
           (recipient_name, recipient_phone, topic, note, staff_phone, scheduled_at,
            group_id, call_times, unit_name, site_code, call_round, call_mode,
            created_by, created_by_name, follow_team, time_tbd)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'manual', $12, $13, $14, true)
         returning *`,
        [name, phone, topic, note, round.staffPhone, round.when.toISOString(), groupId, callTimes,
         unitName, siteCode, round.callRound, req.user.sub, req.user.email, team ?? null],
      );
      return rows[0];
    } catch (e) {
      if (isUndefinedColumn(e)) throw new FollowTimeTbdNotReady();
      throw e;
    }
  }
  /**
   * ทีมส่งคนแทน (131) — insert ที่มีช่องทีม · ฐานยังไม่รัน 131 = แจ้งให้ลองใหม่ **ห้ามถอยไปบันทึกแบบไม่มีทีม**
   * ทีมติดตาม (null) ใช้ insert เดิมทุกตัวอักษร ⇒ ของเดิมไม่ขึ้นกับ migration ใหม่
   */
  if (team) {
    try {
      const { rows } = await dbQuery<FollowRow>(
        `insert into ${followTable}
           (recipient_name, recipient_phone, topic, note, staff_phone, scheduled_at,
            group_id, call_times, unit_name, site_code, call_round, call_mode,
            created_by, created_by_name, follow_team)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         returning *`,
        [name, phone, topic, note, round.staffPhone, round.when.toISOString(), groupId, callTimes,
         unitName, siteCode, round.callRound, round.callMode ?? callMode, req.user.sub, req.user.email, team],
      );
      return rows[0];
    } catch (e) {
      if (isUndefinedColumn(e)) throw new FollowTeamNotReady();
      throw e;
    }
  }
  try {
    const { rows } = await dbQuery<FollowRow>(
      `insert into ${followTable}
         (recipient_name, recipient_phone, topic, note, staff_phone, scheduled_at,
          group_id, call_times, unit_name, site_code, call_round, call_mode,
          created_by, created_by_name)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       returning *`,
      [name, phone, topic, note, round.staffPhone, round.when.toISOString(), groupId, callTimes,
       unitName, siteCode, round.callRound, round.callMode ?? callMode, req.user.sub, req.user.email],
    );
    return rows[0];
  } catch (e) {
    if (!isUndefinedColumn(e)) throw e;
    const { rows } = await dbQuery<FollowRow>(
      `insert into ${followTable}
         (recipient_name, recipient_phone, topic, note, staff_phone, scheduled_at, created_by, created_by_name)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning *`,
      [name, phone, topic, note, round.staffPhone, round.when.toISOString(), req.user.sub, req.user.email],
    );
    return rows[0];
  }
}

async function createFollow(req: AuthedReq, res: ApiRes) {
  const raw = await readJsonBody(req);
  const parsed = parseFollowInput(raw);
  if (parsed.error || !parsed.value) {
    return sendError(res, 400, 'Bad request', parsed.error || 'ข้อมูลไม่ถูกต้อง');
  }
  const { name, phone, topic, note, staffPhone, when, groupId, callTimes, unitName, siteCode, callRound } =
    parsed.value;

  /**
   * 🔴 **หลายรอบของคนเดียวกัน = คำขอเดียว = แผนเดียว** (เจ้าของสั่ง 11 ก.ย. 2569)
   *
   * เดิมหน้าเว็บวนยิงทีละรอบ ⇒ ฝั่งเราสร้าง **แผนแยกกันรอบละแผน** ไปที่เบอร์เดียวกัน
   * แผนหลังไปทับแผนแรก สายแรกจึงไม่ได้โทรและไม่มีผลกลับ
   * (วัดจริง 11 ก.ย.: สายที่นัดทีหลังได้ผล 7/16 · สายที่นัดก่อนได้ผล 1/16)
   *
   * ต้องรู้ทุกรอบ**ตั้งแต่ตอนสร้าง** ถึงจะประกอบแผนเดียวที่มีครบทุก step ได้ —
   * จะไปรวมทีหลังไม่ได้ เพราะแผนแรกถูกส่งไปแล้ว
   */
  const rounds = parseFollowRounds(raw, { when, staffPhone, callRound });
  if (rounds.length > 1) {
    await createFollowRounds(req, res, parsed.value, rounds);
    return;
  }

  let created = await insertFollowRow(req, parsed.value, {
    when,
    staffPhone,
    callRound,
  });
  if (!created) return sendError(res, 500, 'Failed to create follow entry');

  /**
   * ส่งให้ Lumos โทรตาม **เฉพาะเมื่อตั้งโหมดเป็น auto**
   *
   * 🔴 **ผลต้องกลับไปถึงคนกด** (เจ้าของสั่ง 25 ส.ค. 2569) — เดิมเรียกแล้วทิ้งผล
   * ระบบ "ไม่ส่ง" ได้หลายทางและถูกต้องทุกทาง แต่**เงียบสนิท** ⇒ คนสร้างรายการเสร็จ
   * เห็นว่าสำเร็จ แล้วนั่งรอสายที่ไม่มีวันออก (เกิดจริง 24 ส.ค. 2569 กว่าจะรู้ต้องไล่ฐาน)
   * ตอนนี้จด `dispatch_state` ไว้ที่แถว + ส่งกลับใน response ให้จอบอกได้ทันที
   *
   * ⚠️ จดผลล้มเหลวห้ามทำให้สร้างรายการล้ม — รายการถูกบันทึกไปแล้ว
   */
  // 🔴 โทรเอง = ไม่ส่งเข้าคิว (121) — ดูเหตุผลที่ `createFollowRounds`
  let dispatchState: FollowDispatchState = parsed.value.callMode === 'manual' ? 'manual' : 'off';
  if (parsed.value.callMode === 'ai' && (await isAutoDispatchEnabled('follow_entry'))) {
    dispatchState = await enqueueFollowReminder({
      id: created.id,
      recipient_name: name,
      recipient_phone: phone,
      topic,
      note,
      staffPhone,
      staffName: await staffNameOfPhone(staffPhone),
      unitName,
      scheduled_at: when,
      callTimes,
      callRound,
    });
  }
  try {
    await dbQuery(`update ${followTable} set dispatch_state = $2 where id = $1`, [
      created.id,
      dispatchState,
    ]);
    created = { ...created, dispatch_state: dispatchState };
  } catch (e) {
    // ฐานยังไม่รัน 109 → ข้ามการจด (จอถอยไปอ่านสถานะจากคิวเหมือนเดิม)
    if (!isUndefinedColumn(e)) throw e;
  }

  await auditFromAuthed(req, {
    action: 'follow.create',
    entityType: 'follow_entry',
    entityId: created.id,
    after: toResponse(created),
  });

  return res.status(201).json(toResponse(created));
}

async function cancelFollow(req: AuthedReq, res: ApiRes) {
  const id = getString(req.query?.id) ?? '';
  if (!id) return sendError(res, 400, 'Bad request', 'Query id is required');

  /** 🔴 ยกเลิกวันนี้ / เลิกตามคนนี้ (เจ้าของ 7 ต.ค. 2569 Journey ข้อ 2) — ไม่ส่ง scope = สายเดียวแบบเดิม */
  const scope = parseCancelScope(getString(req.query?.scope));
  if (scope) {
    if (!UUID_RE.test(id)) return sendError(res, 400, 'Bad request', 'ต้องระบุ id ของรายการติดตาม');
    const out = await cancelFollowScope(id, scope, { sub: req.user.sub, email: req.user.email ?? null });
    if (out.ids.length === 0) return sendError(res, 404, 'Not found', 'ไม่มีสายที่ยังยกเลิกได้');
    await auditFromAuthed(req, {
      action: 'follow.cancel',
      entityType: 'follow_entry',
      entityId: id,
      after: { scope, cancelledIds: out.ids, lumosFailed: out.lumosFailed },
    });
    return res.status(200).json({ cancelled: out.ids.length, lumos_failed: out.lumosFailed });
  }

  const { rows } = await dbQuery<FollowRow>(
    `update ${followTable} set cancelled_at = now()
      where id = $1 and cancelled_at is null
      returning *`,
    [id],
  );
  const cancelled = rows[0];
  if (!cancelled) return sendError(res, 404, 'Not found', 'ไม่พบรายการ หรือยกเลิกไปแล้ว');

  // รอบในแผนหลายรอบ = ส่งรอบที่เหลือเป็นแผนใหม่ (ต้องรู้ชื่อเจ้าหน้าที่เพื่อประกอบบท) — ดู `cancelFollowReminder`
  const removedFromQueue = await cancelFollowReminder(id, staffNameOfPhone);

  await auditFromAuthed(req, {
    action: 'follow.cancel',
    entityType: 'follow_entry',
    entityId: id,
    after: { ...toResponse(cancelled), removedFromQueue },
  });

  return res.status(200).json({ ...toResponse(cancelled), removedFromQueue });
}

/**
 * **ลบทิ้งจริง** — `DELETE /api/follow?id=<uuid>&purge=1`
 *
 * เจ้าของสั่ง 3 ก.ย. 2569: *"หน้าการติดตาม ทำให้ฉันลบได้หน่อย เฉพาะฉันนะ
 * เพราะตอนนี้ทดสอบอยู่"* — ช่วงทดลองมีแถวขยะค้างเยอะ "ยกเลิก" ยังโชว์บนจอ
 * (ตั้งใจ: ยกเลิกคือประวัติ) จึงต้องมีทางลบให้หายจริง
 *
 * 🔴 **admin เท่านั้น** — role อื่นได้ 403 แม้เส้น `follow` จะเปิดถึง staff
 * 🔴 **ลบแถวคิว Lumos ของรายการนั้นด้วย** ไม่งั้นคิวยังจ่อโทรหาคนจริงทั้งที่ต้นเรื่องหายแล้ว
 *    (ลบด้วย `person_ref` แบบตรงตัวเป๊ะ ๆ ห้ามใช้ LIKE — `_` เป็นไวลด์การ์ด เคยลบของจริงพลาด)
 * 🔴 ลบแล้วกู้ไม่ได้ — จดลง audit ก่อนลบเสมอ (เก็บค่าเดิมไว้ใน `before`)
 */
async function purgeFollow(req: AuthedReq, res: ApiRes) {
  if (req.user.role !== 'admin') {
    return sendError(res, 403, 'Forbidden', 'ลบทิ้งได้เฉพาะผู้ดูแลระบบ (admin)');
  }

  const id = getString(req.query?.id) ?? '';
  if (!id) return sendError(res, 400, 'Bad request', 'Query id is required');

  const { rows } = await dbQuery<FollowRow>(`select * from ${followTable} where id = $1`, [id]);
  const target = rows[0];
  if (!target) return sendError(res, 404, 'Not found', 'ไม่พบรายการ');

  const { rows: removed } = await dbQuery<{ id: string }>(
    `delete from ${queueTable} where person_ref = $1 returning id`,
    [`follow-${id}`],
  );

  await dbQuery(`delete from ${followTable} where id = $1`, [id]);

  await auditFromAuthed(req, {
    action: 'follow.purge',
    entityType: 'follow_entry',
    entityId: id,
    before: { ...toResponse(target), queueRowsDeleted: removed.length },
  });

  return res.status(200).json({ purged: true, id, queueRowsDeleted: removed.length });
}

/**
 * ปิดงานติดตาม (migration 095 · เจ้าของสั่ง 17 ส.ค. 2569) — PATCH /api/follow?id=<uuid>
 *
 * ⚠️ **คนละเรื่องกับ DELETE (ยกเลิก)** — ยกเลิก = ไม่ต้องตามแล้ว ตัดสายทิ้งก่อนถึงวัน ·
 * ปิดงาน = ตามจนจบแล้ว บันทึกว่าจบแบบไหน · สองอย่างเก็บคนละช่องและนับคนละกอง
 *
 * ⚠️ ไม่แตะคิวโทร — รายการที่ปิดแล้วแต่ยังมีรอบค้างในตาราง ให้กดยกเลิกแยก
 * (ปิดงานแล้วลบสายที่นัดไว้อัตโนมัติ = เดาแทนคน · เจ้าของยังไม่ได้สั่ง)
 */
async function completeFollow(req: AuthedReq, res: ApiRes, body: Record<string, unknown> | null) {
  const id = typeof req.query?.id === 'string' ? req.query.id.trim() : '';
  if (!UUID_RE.test(id)) return sendError(res, 400, 'Bad request', 'ต้องระบุ id ของรายการติดตาม');

  const outcome = getString(body?.outcome_code) ?? '';
  const note = getString(body?.outcome_note) || null;

  if (!isFollowOutcome(outcome)) {
    return sendError(
      res, 400, 'Bad request',
      `ผลปิดงานต้องเป็นค่าใดค่าหนึ่ง: ${FOLLOW_OUTCOME_ALL.join(', ')}`,
    );
  }
  // 'อื่น ๆ' ที่ไม่มีคำอธิบาย = เก็บไปก็ตอบอะไรไม่ได้ (กติกาเดียวกับ requiresNote ฝั่งหน้าเว็บ)
  if (requiresNote(outcome) && !note) {
    return sendError(res, 400, 'Bad request', 'เลือก "อื่น ๆ" ต้องใส่หมายเหตุด้วย');
  }

  const { rows } = await dbQuery<FollowRow>(
    `update ${followTable}
        set completed_at = now(), outcome_code = $2, outcome_note = $3,
            completed_by = $4, completed_by_name = $5
      where id = $1 and completed_at is null and cancelled_at is null
      returning *`,
    [id, outcome, note, req.user.sub, req.user.email ?? null],
  );
  const done = rows[0];
  if (!done) {
    return sendError(res, 404, 'Not found', 'ไม่พบรายการ หรือปิด/ยกเลิกไปแล้ว');
  }

  /**
   * 🔴 ปิดงานแล้วหยุดสายที่เหลือ (เจ้าของ 5 ต.ค. 2569 — วัดย้อน 30 วัน: กด "ถึงแล้ว" แล้วยังโดน AI โทรต่อ 56 สาย ·
   * "ไปแล้ว" 55 · "ยกเลิก" 3) · Choice: ทุกผล = หยุดเฉพาะวันนั้น · "ยกเลิก" ให้คนกดเลือก วันนั้น / ทั้งชุด
   */
  const stopScope: FollowStopScope = outcome === 'cancelled' && body?.stop_scope === 'set' ? 'set' : 'day';
  let stoppedIds: string[] = [];
  try {
    stoppedIds = await stopRemainingFollowRounds(done, stopScope);
  } catch (e) {
    // ปิดงานสำเร็จแล้ว — หยุดสายที่เหลือไม่สำเร็จต้องไม่ทำให้การปิดล้ม แต่ต้องบอกจอ (stopped_error)
    logWarn('follow.complete.stopRemainingFailed', { followId: id, error: String(e) });
    await auditFromAuthed(req, {
      action: 'follow.complete',
      entityType: 'follow_entry',
      entityId: id,
      after: { outcome_code: outcome, outcome_note: note, stopScope, stopError: String(e) },
    });
    return res.status(200).json({ ...toResponse(done), stopped_rounds: 0, stopped_error: true });
  }

  await auditFromAuthed(req, {
    action: 'follow.complete',
    entityType: 'follow_entry',
    entityId: id,
    after: { outcome_code: outcome, outcome_note: note, stopScope, stoppedIds },
  });

  return res.status(200).json({ ...toResponse(done), stopped_rounds: stoppedIds.length });
}

type FollowStopScope = 'day' | 'set';

/**
 * สายที่เหลือของคนนี้ (ชุดเดียวกัน `group_id` หรือแผนเดียวกันที่ Lumos `plan_ref`) ที่ยังไม่ถึงเวลา ไม่ปิด ไม่ยกเลิก
 * — `day` = เฉพาะวันเดียวกับสายที่ปิด (เวลาไทย) · `set` = ทุกวัน
 * ⇒ ตั้งยกเลิก (จอขึ้น "ยกเลิก") แล้วยกเลิกคิวฝั่งเรา + ที่ Lumos ด้วย `cancelFollowReminder` ตัวเดียวกับปุ่มยกเลิก
 * (รอบในแผนหลายรอบ = ส่งรอบที่ยังเหลือเป็นแผนใหม่ · ไม่เหลือ = ยกเลิกแผน) · สายที่ปิดเองก็ถอนคิวด้วยถ้ายังไม่ได้โทร
 */
async function stopRemainingFollowRounds(done: FollowRow, scope: FollowStopScope): Promise<string[]> {
  const doneId = String(done.id);
  let planRef: string | null = null;
  try {
    const { rows: pr } = await dbQuery<{ plan_ref: string | null }>(
      `select plan_ref from ${tableInAppSchema('lumos_dispatch_queue')}
        where channel = 'reminder' and job_ref = 'follow' and person_ref = $1 limit 1`,
      [`follow-${doneId}`],
    );
    planRef = pr[0]?.plan_ref ?? null;
  } catch (e) {
    if (!isUndefinedColumn(e)) throw e;
  }
  const groupId = (done.group_id as string | null | undefined) ?? null;
  if (!groupId && !planRef) {
    // สายเดี่ยว — ถอนคิวของตัวเองอย่างเดียว (ยังไม่ได้โทร = ไม่ต้องโทรแล้ว)
    await cancelFollowReminder(doneId, staffNameOfPhone);
    return [];
  }
  const { rows: sib } = await dbQuery<{ id: string }>(
    `update ${followTable} f
        set cancelled_at = now()
      where f.id <> $1::uuid
        and f.cancelled_at is null and f.completed_at is null
        and f.scheduled_at > now()
        and (
          ($2::uuid is not null and f.group_id = $2::uuid)
          or ($3::text is not null and f.id::text in (
            select substring(q.person_ref from 8) from ${tableInAppSchema('lumos_dispatch_queue')} q
             where q.channel = 'reminder' and q.job_ref = 'follow' and q.plan_ref = $3::text))
        )
        and ($4::text = 'set'
          or to_char(timezone('Asia/Bangkok', f.scheduled_at), 'YYYY-MM-DD')
           = to_char(timezone('Asia/Bangkok', $5::timestamptz), 'YYYY-MM-DD'))
      returning f.id::text as id`,
    [doneId, groupId, planRef, scope, done.scheduled_at],
  );
  const ids = sib.map((r) => r.id);
  // ถอนคิว + แจ้ง Lumos ทีละสาย (ตัวเดียวกับปุ่มยกเลิก) — สายที่ปิดเองด้วย เผื่อปิดก่อน AI โทรรอบนั้น
  for (const sid of [doneId, ...ids]) {
    try {
      await cancelFollowReminder(sid, staffNameOfPhone);
    } catch (e) {
      logWarn('follow.complete.stopRound.cancelFailed', { followId: sid, error: String(e) });
    }
  }
  return ids;
}

/**
 * ฟิลด์ที่แก้ได้ของรายการติดตาม (096 · เจ้าของสั่ง 17 ส.ค. 2569: *"เพิ่มให้แก้ไขได้"*)
 *
 * ⚠️ **เจ้าของข้อมูลแก้ไม่ได้** — `created_by` / `created_by_name` คือคนที่กรอกครั้งแรก
 * ทับเมื่อไหร่ = ประวัติว่าใครลงงานนี้หายเงียบ ๆ · คนแก้ทีหลังลงที่ `updated_by_name` แทน
 *
 * ⚠️ **`group_id` / `call_times` แก้ไม่ได้ทางนี้** — สองอันนั้นกำหนดรูปตารางโทรทั้งชุด
 * แก้ทีละแถวคือชุดเพี้ยน (บางวันรอบไม่เท่ากัน) · จะเปลี่ยนตารางให้ยกเลิกชุดแล้วตั้งใหม่
 */
export type ParsedFollowEdit = {
  name: string;
  phone: string;
  topic: string;
  note: string | null;
  staffPhone: string | null;
  when: Date;
  unitName: string | null;
  siteCode: string | null;
};

export function parseFollowEditInput(
  raw: unknown,
  now = new Date(),
): { error: string | null; value: ParsedFollowEdit | null } {
  // ใช้ตัวตรวจชุดเดียวกับตอนสร้าง — กติกาความถูกต้องต้องเหมือนกันเป๊ะ
  // ไม่งั้นแก้ทีหลังจะใส่ค่าที่ตอนสร้างห้ามใส่ได้ (เช่นเบอร์ที่โทรไม่ได้)
  const parsed = parseFollowInput(raw, now);
  if (parsed.error || !parsed.value) return { error: parsed.error, value: null };
  const v = parsed.value;
  return {
    error: null,
    value: {
      name: v.name,
      phone: v.phone,
      topic: v.topic,
      note: v.note,
      staffPhone: v.staffPhone,
      when: v.when,
      unitName: v.unitName,
      siteCode: v.siteCode,
    },
  };
}

/**
 * แก้ไขรายการติดตาม — PATCH /api/follow?id=<uuid> body มี `action: 'update'`
 *
 * ⚠️ PATCH เดิม (ไม่มี action) = **ปิดงาน** ยังทำงานเหมือนเดิมทุกอย่าง
 * แยกด้วย action เพราะของเก่ามีคนใช้อยู่ เปลี่ยนความหมายกลางทางคือพังเงียบ
 */
/**
 * ส่งแผนใหม่ให้ Lumos ทุกวันที่โดนแก้ของคนนี้ (เบอร์ 9 หลักท้าย + ทีมเดียวกัน) — แผนละวัน ยกเลิกแผนเดิมทุกตัวก่อน
 * `days` = เวลาที่ใช้หาวัน (ก่อน/หลังแก้) · `ids` = แถวที่โดนแก้ (วันของแถวพวกนี้นับด้วย)
 */
async function replanPersonDays(
  anchor: FollowRow,
  times: Array<string | Date | null | undefined>,
  ids: readonly string[],
): Promise<{ pushed: boolean; rounds: number; cancelled: boolean; reason?: string }> {
  if (!(await isAutoDispatchEnabled('follow_entry'))) {
    return { pushed: false, rounds: 0, cancelled: false, reason: 'ปิดส่งงานให้ AI อัตโนมัติอยู่' };
  }
  const { rows: members } = await dbQuery<{ id: string }>(
    `with days as (
       select distinct (t at time zone 'Asia/Bangkok')::date as d from unnest($1::timestamptz[]) t
       union
       select distinct (scheduled_at at time zone 'Asia/Bangkok')::date from ${followTable} where id = any($2::uuid[])
     )
     select f.id::text as id from ${followTable} f
      where f.cancelled_at is null and f.completed_at is null and coalesce(f.call_mode, 'ai') = 'ai'
        and f.scheduled_at > now()
        and right(regexp_replace(coalesce(f.recipient_phone, ''), '\\D', '', 'g'), 9)
          = right(regexp_replace($3::text, '\\D', '', 'g'), 9)
        and coalesce(f.follow_team, '') = coalesce($4::text, '')
        and (f.scheduled_at at time zone 'Asia/Bangkok')::date in (select d from days)`,
    [
      times.filter(Boolean).map((t) => new Date(String(t)).toISOString()),
      [...ids],
      String(anchor.recipient_phone ?? ''),
      (anchor as FollowRow & { follow_team?: string | null }).follow_team ?? null,
    ],
  );
  const memberIds = members.map((m) => m.id);
  const out = await replanFollowSetWithLumos({ memberIds, cancelledIds: [...ids].filter((x) => !memberIds.includes(x)), resolveStaffName: staffNameOfPhone });
  const pushed = out.plans > 0 && out.pushedPlans === out.plans;
  return {
    pushed,
    rounds: out.rounds,
    cancelled: out.cancelledOld,
    reason: pushed ? undefined : (out.reason ?? (out.rounds === 0 ? 'ไม่มีสาย AI ที่ยังรอโทร' : 'ส่งแผนให้ Lumos ไม่ครบ')),
  };
}

async function updateFollow(req: AuthedReq, res: ApiRes, body: Record<string, unknown>) {
  const id = typeof req.query?.id === 'string' ? req.query.id.trim() : '';
  if (!UUID_RE.test(id)) return sendError(res, 400, 'Bad request', 'ต้องระบุ id ของรายการติดตาม');

  const parsed = parseFollowEditInput(body);
  if (parsed.error || !parsed.value) {
    return sendError(res, 400, 'Bad request', parsed.error || 'ข้อมูลไม่ถูกต้อง');
  }
  const v = parsed.value;

  const { rows: beforeRows } = await dbQuery<FollowRow>(
    `select * from ${followTable} where id = $1`,
    [id],
  );
  const before = beforeRows[0];
  if (!before) return sendError(res, 404, 'Not found', 'ไม่พบรายการติดตาม');
  // ปิด/ยกเลิกไปแล้ว = จบเรื่องแล้ว แก้ย้อนหลังคือแก้ประวัติ
  if (before.cancelled_at != null) {
    return sendError(res, 409, 'Conflict', 'รายการนี้ยกเลิกไปแล้ว แก้ไขไม่ได้');
  }
  if (before.completed_at != null) {
    return sendError(res, 409, 'Conflict', 'รายการนี้ปิดงานไปแล้ว แก้ไขไม่ได้');
  }

  /**
   * 🔴 คนเดียวกันห้ามมีสองสายนาทีเดียวกัน (กติกาเดียวกับแก้ตาราง) — 7 ต.ค. 2569 เจอ 3 สาย 09:25 ของคนเดียว
   * จากการแก้ทีละแถว ⇒ Lumos โทรซ้อน · ตรวจเฉพาะตอนเปลี่ยนเวลา (แก้ช่องอื่นของแถวที่ซ้อนอยู่แล้วยังบันทึกได้)
   */
  if (new Date(String(before.scheduled_at)).getTime() !== v.when.getTime()) {
    const { rows: clash } = await dbQuery<{ id: string }>(
      `select id::text as id from ${followTable}
        where id <> $1::uuid and cancelled_at is null and completed_at is null
          and date_trunc('minute', scheduled_at) = date_trunc('minute', $2::timestamptz)
          and right(regexp_replace(coalesce(recipient_phone, ''), '\\D', '', 'g'), 9)
            = right(regexp_replace($3::text, '\\D', '', 'g'), 9)
          and coalesce(follow_team, '') = coalesce($4::text, '')
        limit 1`,
      [id, v.when.toISOString(), v.phone, (before as FollowRow & { follow_team?: string | null }).follow_team ?? null],
    );
    if (clash.length > 0) return sendError(res, 409, 'Conflict', 'คนนี้มีอีกสายเวลาเดียวกันอยู่แล้ว — เลือกเวลาอื่น');
  }

  const { rows } = await dbQuery<FollowRow>(
    `update ${followTable}
        set recipient_name = $2, recipient_phone = $3, topic = $4, note = $5,
            staff_phone = $6, scheduled_at = $7, unit_name = $8, site_code = $9,
            updated_at = now(), updated_by = $10, updated_by_name = $11
      where id = $1 and cancelled_at is null and completed_at is null
      returning *`,
    [id, v.name, v.phone, v.topic, v.note, v.staffPhone, v.when.toISOString(),
     v.unitName, v.siteCode, req.user.sub, req.user.email ?? null],
  );
  const updated = rows[0];
  if (!updated) return sendError(res, 404, 'Not found', 'ไม่พบรายการ หรือปิด/ยกเลิกไปแล้ว');

  // สายที่เคย "ยังไม่ชัวร์เวลา" (134): คนตั้งเวลาจริงแล้ว (เวลาเปลี่ยนจากค่าแทน) → ล้างธง
  if (before.time_tbd === true && new Date(String(before.scheduled_at)).getTime() !== v.when.getTime()) {
    try {
      await dbQuery(`update ${followTable} set time_tbd = false where id = $1`, [id]);
      updated.time_tbd = false;
    } catch (e) {
      if (!isUndefinedColumn(e)) throw e;
    }
  }

  /**
   * 🔴 เปลี่ยนเบอร์ทั้งชุด (เจ้าของสั่ง 4 ต.ค. 2569) — เคสจริง: ลงเบอร์ผิด 10 สาย แก้ทีละแถวแล้วหลุด 1 สาย
   * (AI จะโทรหาเจ้าหน้าที่แทนผู้สมัคร) ⇒ `apply_phone_to_set: true` = สายที่ยังไม่ถึงเวลา/ไม่ปิด/ไม่ยกเลิกในชุดเดียวกันใช้เบอร์ใหม่ด้วย
   * (สายที่ผ่านไปแล้วเป็นประวัติ — ไม่เปลี่ยนย้อนหลัง)
   * แล้วค่อยส่งแผนให้ Lumos **ครั้งเดียว** ข้างล่าง (resync อ่านทุกรอบของแผนจากฐาน) — ไม่ยิงแก้ทีละแถว
   */
  let phoneAppliedIds: string[] = [];
  const phoneChanged = phoneDigits(before.recipient_phone) !== phoneDigits(updated.recipient_phone);
  if (body.apply_phone_to_set === true && phoneChanged && before.group_id) {
    const { rows: sib } = await dbQuery<FollowRow>(
      `update ${followTable}
          set recipient_phone = $3, updated_at = now(), updated_by = $4, updated_by_name = $5
        where group_id = $1 and id <> $2 and cancelled_at is null and completed_at is null
          and scheduled_at > now()
          and recipient_phone is distinct from $3
        returning *`,
      [before.group_id, id, updated.recipient_phone, req.user.sub, req.user.email ?? null],
    );
    phoneAppliedIds = sib.map((r) => String(r.id));
    for (const r of sib) {
      try {
        await refreshFollowReminderPayload({
          id: String(r.id),
          recipient_name: String(r.recipient_name ?? ''),
          recipient_phone: String(r.recipient_phone ?? ''),
          topic: String(r.topic ?? ''),
          note: (r.note as string | null) ?? null,
          staffPhone: (r.staff_phone as string | null) ?? null,
          staffName: await staffNameOfPhone((r.staff_phone as string | null) ?? null),
          unitName: (r.unit_name as string | null) ?? null,
          scheduled_at: new Date(String(r.scheduled_at)),
          callTimes: r.call_times ?? null,
          callRound: r.call_round ?? null,
        });
      } catch (e) {
        logWarn('follow.update.siblingQueueRefreshFailed', { followId: r.id, error: String(e) });
      }
    }
  }

  /**
   * 🔴 แก้แถวแล้วต้องแก้บทพูดในคิวด้วย — payload ถูกสร้างตอนเข้าคิว ไม่ใช่ตอนเสิร์ฟ
   * ไม่แก้ = AI ไปพูดชุดเก่าโดยที่หน้าจอโชว์ชุดใหม่
   * ได้ผลเฉพาะสายที่ Lumos ยังไม่ดึงไป — ดึงไปแล้วบอกคนใช้ตรง ๆ
   */
  let queueRefreshed = 0;
  try {
    queueRefreshed = await refreshFollowReminderPayload({
      id: updated.id,
      recipient_name: v.name,
      recipient_phone: v.phone,
      topic: v.topic,
      note: v.note,
      staffPhone: v.staffPhone,
      staffName: await staffNameOfPhone(v.staffPhone),
      unitName: v.unitName,
      scheduled_at: v.when,
      callTimes: updated.call_times ?? null,
      callRound: updated.call_round ?? null,
    });
  } catch (e) {
    logWarn('follow.update.queueRefreshFailed', { followId: id, error: String(e) });
  }

  /**
   * 🔴 **แก้แล้วต้องบอก Lumos ด้วย ไม่ใช่แก้แค่คิวฝั่งเรา** (เจ้าของสั่ง 13 ก.ย. 2569)
   *
   * ของเดิมแก้แค่ฝั่งเรา ⇒ Lumos ยังถือเวลา/บทพูดชุดก่อนแก้ · วัดกับงานของวันที่ 14 ก.ย.
   * เจอ 3 ใน 10 คนเพี้ยน (รอบหาย 1 คน · เวลาเพี้ยนไป 20:00 อีก 1 คน · อีกคนโดนโทร
   * ตามเวลาเดิมไปแล้ว) ทั้งสามรายคือแถวที่ถูกกดแก้ไข ส่วนอีก 7 คนที่ไม่ได้แก้ถูกหมด
   *
   * `resyncFollowPlanWithLumos` = ยกเลิกของเดิมที่ Lumos แล้วส่ง **แผนใหม่ทั้งก้อน**
   * (ทุกรอบที่ยังไม่ถูกโทร) ⚠️ ล้มเหลวห้ามทำให้การแก้ล้ม — แถวถูกแก้ไปแล้ว
   */
  /**
   * 🔴 แผนที่ Lumos มีเบอร์/ชื่อได้ชุดเดียว (มาจากหัวขบวน) — แก้เบอร์/ชื่อที่สาย 2 ของวัน = Lumos ไม่เห็น
   * (ตรวจ Journey 7 ต.ค. 2569) ⇒ เปลี่ยนเบอร์/ชื่อ = สายอื่นที่ยังรอโทรในแผนเดียวกันเปลี่ยนตามเสมอ
   */
  const nameChanged = String(before.recipient_name ?? '') !== String(updated.recipient_name ?? '');
  let samePlanIds: string[] = [];
  if (phoneChanged || nameChanged) {
    try {
      const { rows: mates } = await dbQuery<{ id: string }>(
        `update ${followTable} f
            set recipient_phone = $2, recipient_name = $3, updated_at = now(), updated_by = $4, updated_by_name = $5
          where f.id <> $1::uuid and f.cancelled_at is null and f.completed_at is null
            and f.id::text in (
              select substring(y.person_ref from 8) from ${queueTable} y
               where y.channel = 'reminder' and y.job_ref = 'follow' and y.status = 'pending'
                 and coalesce(y.plan_ref, y.person_ref) = (
                   select coalesce(x.plan_ref, x.person_ref) from ${queueTable} x
                    where x.channel = 'reminder' and x.job_ref = 'follow' and x.person_ref = 'follow-' || $1::text
                    limit 1))
          returning f.id::text as id`,
        [id, updated.recipient_phone, updated.recipient_name, req.user.sub, req.user.email ?? null],
      );
      samePlanIds = mates.map((m) => m.id);
    } catch (e) {
      logWarn('follow.update.samePlanSyncFailed', { followId: id, error: String(e) });
    }
  }

  /**
   * ส่งใหม่ **ทุกแผนที่โดนแก้** (แถวนี้ + สายในชุดที่เปลี่ยนเบอร์ตาม) — เดิมส่งแค่แผนของแถวที่เปิดแก้
   * ⇒ เปลี่ยนเบอร์ทั้งชุด 30 วัน แต่ Lumos ได้เบอร์ใหม่แค่วันเดียว (ตรวจ Journey 7 ต.ค. 2569)
   * `planResync` = ผลของแผนแถวนี้ (จอใช้) · แผนอื่นล้ม = ใส่เหตุผลลงผลนี้ ห้ามเงียบ
   */
  /**
   * 🔴 ส่งแผนใหม่ให้ Lumos **ทั้งวันของคนนี้** (เจ้าของ 7 ต.ค. 2569: *"แก้ไขเวลาแล้ว ไม่โทรตามเวลาที่แก้"*)
   * วัดจริงที่พลาด (ทางเดิม `resyncFollowPlanWithLumos` = ส่งใหม่เฉพาะแผนเดิมของแถวที่แก้):
   * - สายที่โทรไปแล้ว (ล้ม/มีผล) หรือคิวถูกยกเลิก แล้วย้ายเวลาไปข้างหน้า → ไม่มีอะไรไป Lumos เลย ไม่มีวันโทร
   * - แก้หลายแถวของคนเดียวกัน → แผนแยก 3 แผนเวลาเดียวกัน + แผนเก่ายังถือเวลาเดิม (โทรซ้ำ 09:25 แล้ว 10:27)
   * ⇒ ใช้ตัวเดียวกับ "แก้ตาราง" (`replanFollowSetWithLumos`): ทุกสาย AI ที่ยังรอโทรของคนนี้ในวันที่โดนแก้
   * ยกเลิกแผนเดิมทุกตัวก่อน แล้วส่งแผนละวัน · สายที่โทรไปแล้วแต่ย้ายไปอนาคต = คืนเข้าคิวก่อน (ตั้ง cancelled ให้ revive)
   */
  let planResync: { pushed: boolean; rounds: number; cancelled: boolean; reason?: string } | null = null;
  let otherPlansFailed = 0;
  try {
    const movedToFuture =
      new Date(String(before.scheduled_at)).getTime() !== v.when.getTime() && v.when.getTime() > Date.now() + 60_000;
    if (movedToFuture && (updated.call_mode ?? 'ai') !== 'manual') {
      await dbQuery(
        `update ${queueTable} set status = 'cancelled', updated_at = now()
          where channel = 'reminder' and job_ref = 'follow' and person_ref = $1 and status in ('failed', 'completed')`,
        [`follow-${id}`],
      );
    }
    planResync = await replanPersonDays(updated, [before.scheduled_at, updated.scheduled_at], [id, ...phoneAppliedIds, ...samePlanIds]);
  } catch (e) {
    otherPlansFailed += 1;
    logWarn('follow.update.lumosReplanFailed', { followId: id, error: String(e) });
  }
  await auditFromAuthed(req, {
    action: 'follow.update',
    entityType: 'follow_entry',
    entityId: id,
    before: toResponse(before),
    after: { ...toResponse(updated), queueRefreshed, planResync, phoneAppliedIds, samePlanIds, otherPlansFailed },
  });

  return res.status(200).json({
    ...toResponse(updated),
    queue_refreshed: queueRefreshed,
    /** จำนวนสายอื่นในชุดที่เปลี่ยนเบอร์ตามด้วย (apply_phone_to_set) */
    phone_applied: phoneAppliedIds.length,
    /** ส่งแผนใหม่ให้ Lumos แล้วหรือยัง — จอต้องบอกคนกดได้ ห้ามเงียบ */
    lumos_resync: planResync,
    /** แผนวันอื่น (เปลี่ยนเบอร์ทั้งชุด) ที่ส่งให้ Lumos ไม่สำเร็จ */
    lumos_other_failed: otherPlansFailed,
  });
}

/**
 * ═══ แก้ตารางทั้งชุด — `PATCH /api/follow?id=<แถวที่เปิดแก้>` body `action: 'replace_schedule'` ═══
 *
 * เจ้าของ Choice 1 ต.ค. 2569 "แก้ตารางหลังบันทึกไม่ได้ → แก้" (เดิมต้องยกเลิกทั้งชุดแล้วตั้งใหม่)
 * body: `replace_ids` = สายที่จอเปิดให้แก้ (อนาคต · ยังไม่ถูกโทร) · `rounds` = ตารางใหม่ของสายพวกนั้น
 *   `[{ id?, scheduled_at, call_mode }]` — มี `id` = สายเดิม (ย้ายเวลา/สลับคนโทรได้) · ไม่มี `id` = สายใหม่
 *   สายใน `replace_ids` ที่ไม่อยู่ใน `rounds` = เอาออก (ยกเลิก)
 * 🔴 สายที่โทรไปแล้ว/เลยเวลาแล้วไม่อยู่ในชุดที่แก้ (ประวัติ ห้ามแตะ) · เวลาใหม่ต้องเป็นอนาคตเท่านั้น
 */
export type FollowScheduleReplace = {
  replaceIds: string[];
  rounds: Array<{ id: string | null; when: Date; callMode: 'ai' | 'manual' }>;
};

/** 92 วัน × 5 สาย (7 ต.ค. 2569 · เดิม 160 = แก้ตาราง 31 วันเต็ม) */
const MAX_SCHEDULE_ROUNDS = 460;

export function parseFollowScheduleReplace(
  raw: unknown,
  now = new Date(),
): { error: string | null; value: FollowScheduleReplace | null } {
  const fail = (message: string) => ({ error: message, value: null });
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const idsRaw = Array.isArray(body.replace_ids) ? body.replace_ids : [];
  const replaceIds = [...new Set(idsRaw.map((x) => (typeof x === 'string' ? x.trim() : '')))];
  if (replaceIds.some((id) => !UUID_RE.test(id))) return fail('replace_ids ต้องเป็นรหัสรายการ');
  if (replaceIds.length > MAX_SCHEDULE_ROUNDS) return fail('สายในชุดเยอะเกินไป');
  if (!Array.isArray(body.rounds)) return fail('rounds ต้องเป็นรายการ');
  if (body.rounds.length > MAX_SCHEDULE_ROUNDS) return fail('สายในตารางเยอะเกินไป');
  const allowed = new Set(replaceIds);
  const seenIds = new Set<string>();
  const seenMinutes = new Set<number>();
  const rounds: FollowScheduleReplace['rounds'] = [];
  for (const item of body.rounds) {
    if (!item || typeof item !== 'object') return fail('ข้อมูลสายไม่ถูกต้อง');
    const o = item as Record<string, unknown>;
    const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : null;
    if (id && !allowed.has(id)) return fail('มีสายที่ไม่ได้อยู่ในชุดที่แก้');
    if (id && seenIds.has(id)) return fail('สายเดียวกันซ้ำสองครั้ง');
    const when = typeof o.scheduled_at === 'string' ? new Date(o.scheduled_at) : null;
    if (!when || Number.isNaN(when.getTime())) return fail('เวลาโทรไม่ถูกต้อง');
    // Lumos รับแต่เวลาอนาคต — เวลาที่ผ่านแล้ว = โทรทันที (ให้เวลาเหลือ 1 นาที กันคนกดตรงนาทีนั้นพอดี)
    if (when.getTime() < now.getTime() + 60_000) return fail('เวลาที่ผ่านมาแล้วตั้งไม่ได้ — เลือกเวลาอนาคต');
    const minute = Math.floor(when.getTime() / 60_000);
    if (seenMinutes.has(minute)) return fail('มีสองสายเวลาเดียวกัน — ตั้งเวลาให้ต่างกัน');
    const modeRaw = typeof o.call_mode === 'string' ? o.call_mode.trim() : 'ai';
    if (modeRaw !== 'ai' && modeRaw !== 'manual') return fail('call_mode ต้องเป็น ai หรือ manual');
    if (id) seenIds.add(id);
    seenMinutes.add(minute);
    rounds.push({ id, when, callMode: modeRaw });
  }
  if (replaceIds.length === 0 && rounds.length === 0) return fail('ไม่มีอะไรให้แก้');
  rounds.sort((a, b) => a.when.getTime() - b.when.getTime());
  return { error: null, value: { replaceIds, rounds } };
}

const phoneDigits = (p: string | null | undefined) => (toE164Thai(p ?? '') ?? String(p ?? '')).replace(/\D/g, '');

async function replaceFollowSchedule(req: AuthedReq, res: ApiRes, body: Record<string, unknown>) {
  const anchorId = typeof req.query?.id === 'string' ? req.query.id.trim() : '';
  if (!UUID_RE.test(anchorId)) return sendError(res, 400, 'Bad request', 'ต้องระบุ id ของรายการติดตาม');
  const parsed = parseFollowScheduleReplace(body);
  if (parsed.error || !parsed.value) return sendError(res, 400, 'Bad request', parsed.error || 'ข้อมูลไม่ถูกต้อง');
  const { replaceIds, rounds } = parsed.value;

  const { rows: anchorRows } = await dbQuery<FollowRow>(`select * from ${followTable} where id = $1`, [anchorId]);
  const anchor = anchorRows[0];
  if (!anchor) return sendError(res, 404, 'Not found', 'ไม่พบรายการติดตาม');
  if (anchor.cancelled_at != null) return sendError(res, 409, 'Conflict', 'รายการนี้ยกเลิกไปแล้ว แก้ตารางไม่ได้');
  // พัก AI ของส่งคนแทนอยู่ = สลับ/เพิ่มเป็น AI ไม่ได้ (ตัวเดียวกับตอนสร้าง · 7 ต.ค. 2569)
  if (anchor.follow_team === FOLLOW_TEAM_REPLACEMENT && rounds.some((r) => r.callMode === 'ai')) {
    try {
      if ((await getReplaceSyncSettings()).rule.aiPaused) {
        return sendError(res, 409, 'Conflict', 'ส่งคนแทนพัก AI อยู่ — ตั้งเป็นคนโทร หรือเปิด AI ก่อน');
      }
    } catch (e) {
      logWarn('follow.replaceSchedule.replaceAiPausedCheckFailed', { error: String(e) });
    }
  }

  // สายที่จะแก้ต้องยังแก้ได้จริง — คนเดียวกัน ชุดเดียวกัน อนาคต ยังไม่ถูกโทร (คนอื่นอาจแก้/สายอาจออกไประหว่างเปิดจอ)
  type ReplaceRow = FollowRow & { q_status: string | null; q_result_at: string | Date | null };
  let targets: ReplaceRow[] = [];
  if (replaceIds.length > 0) {
    ({ rows: targets } = await dbQuery<ReplaceRow>(
      `select f.*, q.status as q_status, q.first_result_at as q_result_at
         from ${followTable} f
         left join ${queueTable} q
           on q.channel = 'reminder' and q.job_ref = 'follow' and q.person_ref = 'follow-' || f.id::text
        where f.id = any($1::uuid[])`,
      [replaceIds],
    ));
  }
  const now = Date.now();
  const stale = replaceIds.length !== targets.length || targets.some((t) =>
    t.cancelled_at != null ||
    t.completed_at != null ||
    new Date(String(t.scheduled_at)).getTime() <= now ||
    phoneDigits(t.recipient_phone) !== phoneDigits(anchor.recipient_phone) ||
    (anchor.group_id != null && t.group_id !== anchor.group_id) ||
    (t.q_status != null && (t.q_status !== 'pending' || t.q_result_at != null)),
  );
  if (stale) {
    return sendError(res, 409, 'Conflict', 'บางสายโทรไปแล้วหรือถูกแก้ไปแล้ว — ปิดแล้วเปิดแก้ใหม่อีกครั้ง');
  }

  const groupId = anchor.group_id ?? randomUUID();
  const keepIds = new Set(rounds.filter((r) => r.id).map((r) => r.id as string));
  const cancelIds = replaceIds.filter((id) => !keepIds.has(id));
  const byId = new Map(targets.map((t) => [t.id, t]));
  const actor = [req.user.sub, req.user.email ?? null] as const;

  // ① เอาออก = ยกเลิก (ฐาน + คิวฝั่งเรา) · ฝั่ง Lumos ยกเลิกรวดเดียวตอนส่งแผนใหม่ (`replanFollowSetWithLumos`)
  if (cancelIds.length > 0) {
    await dbQuery(
      `update ${followTable}
          set cancelled_at = now(), updated_at = now(), updated_by = $2, updated_by_name = $3
        where id = any($1::uuid[]) and cancelled_at is null`,
      [cancelIds, ...actor],
    );
    await dbQuery(
      `update ${queueTable} set status = 'cancelled', updated_at = now()
        where channel = 'reminder' and job_ref = 'follow' and status = 'pending'
          and person_ref = any($1::text[])`,
      [cancelIds.map((id) => `follow-${id}`)],
    );
  }

  // ② สายเดิมที่อยู่ต่อ: ย้ายเวลา/สลับคนโทร (+ ผูกชุดถ้าเดิมยังไม่มี)
  const toManual: string[] = [];
  /** สาย "ยังไม่ชัวร์เวลา" ที่ถูกย้ายเวลา = ตั้งเวลาจริงแล้ว → ล้างธง (134) */
  const movedIds: string[] = [];
  for (const r of rounds) {
    if (!r.id) continue;
    const before = byId.get(r.id);
    if (!before) continue;
    const beforeMode = before.call_mode === 'manual' ? 'manual' : 'ai';
    const moved = new Date(String(before.scheduled_at)).getTime() !== r.when.getTime();
    if (moved) movedIds.push(r.id);
    if (!moved && beforeMode === r.callMode && before.group_id === groupId) continue;
    await dbQuery(
      `update ${followTable}
          set scheduled_at = $2, call_mode = $3, group_id = $4,
              updated_at = now(), updated_by = $5, updated_by_name = $6
        where id = $1 and cancelled_at is null and completed_at is null`,
      [r.id, r.when.toISOString(), r.callMode, groupId, ...actor],
    );
    if (r.callMode === 'manual' && beforeMode === 'ai') toManual.push(r.id);
  }
  if (toManual.length > 0) {
    // AI → คนโทร = ถอนออกจากคิว (ฝั่ง Lumos ถูกยกเลิกพร้อมแผนเดิมตอนส่งแผนใหม่)
    await dbQuery(
      `update ${queueTable} set status = 'cancelled', updated_at = now()
        where channel = 'reminder' and job_ref = 'follow' and status = 'pending'
          and person_ref = any($1::text[])`,
      [toManual.map((id) => `follow-${id}`)],
    );
    try {
      await dbQuery(`update ${followTable} set dispatch_state = 'manual' where id = any($1::uuid[])`, [toManual]);
    } catch (e) {
      if (!isUndefinedColumn(e)) throw e;
    }
  }
  if (movedIds.length > 0) {
    try {
      await dbQuery(`update ${followTable} set time_tbd = false where id = any($1::uuid[]) and time_tbd is true`, [movedIds]);
    } catch (e) {
      if (!isUndefinedColumn(e)) throw e;
    }
  }
  if (anchor.group_id == null && !cancelIds.includes(anchor.id)) {
    await dbQuery(`update ${followTable} set group_id = $2 where id = $1 and group_id is null`, [anchor.id, groupId]);
  }

  // ③ สายใหม่ — ลอกคน/เรื่อง/หน่วยงาน/ทีม/เบอร์เจ้าหน้าที่จากแถวที่เปิดแก้ (คนเพิ่มคือคนแก้ · เจ้าของเดิมไม่เปลี่ยน)
  const base: ParsedFollowInput = {
    name: anchor.recipient_name,
    phone: anchor.recipient_phone,
    topic: anchor.topic,
    note: anchor.note,
    staffPhone: anchor.staff_phone ?? null,
    when: rounds[0]?.when ?? new Date(),
    groupId,
    callTimes: null,
    callMode: 'ai',
    unitName: anchor.unit_name ?? null,
    siteCode: anchor.site_code ?? null,
    callRound: null,
    team: anchor.follow_team === FOLLOW_TEAM_REPLACEMENT ? FOLLOW_TEAM_REPLACEMENT : null,
  };
  const createdIds: string[] = [];
  for (const r of rounds) {
    if (r.id) continue;
    const row = await insertFollowRow(req, base, {
      when: r.when,
      staffPhone: base.staffPhone,
      callRound: null,
      callMode: r.callMode,
    });
    if (!row) continue;
    createdIds.push(row.id);
    r.id = row.id;
    if (r.callMode === 'manual') {
      try {
        await dbQuery(`update ${followTable} set dispatch_state = 'manual' where id = $1`, [row.id]);
      } catch (e) {
        if (!isUndefinedColumn(e)) throw e;
      }
    }
  }

  // ④ เลขรอบ: สายที่โทรไปแล้วของชุดคงเลขเดิม · สายในตารางใหม่นับต่อตามเวลา (บทสายแรก/รอบถัดไปถูกเสมอ)
  const { rows: locked } = await dbQuery<{ max_round: number | null; n: string }>(
    `select max(call_round) as max_round, count(*)::text as n from ${followTable}
      where group_id = $1 and cancelled_at is null and not (id = any($2::uuid[]))`,
    [groupId, rounds.map((r) => r.id).filter(Boolean)],
  );
  let next = Math.max(Number(locked[0]?.max_round ?? 0), Number(locked[0]?.n ?? 0)) + 1;
  for (const r of rounds) {
    if (!r.id) continue;
    await dbQuery(`update ${followTable} set call_round = $2 where id = $1`, [r.id, next]);
    next += 1;
  }

  // ⑤ ให้ Lumos ถือชุดเดียวกับในฐาน (ยกเลิกแผนเดิมก่อน → ส่งแผนละวัน) — ล้มห้ามทำให้การแก้ล้ม (ฐานแก้ไปแล้ว)
  const aiIds = rounds.filter((r) => r.id && r.callMode === 'ai').map((r) => r.id as string);
  let replan: Awaited<ReturnType<typeof replanFollowSetWithLumos>> | null = null;
  let replanNote: string | null = null;
  try {
    if (await isAutoDispatchEnabled('follow_entry')) {
      replan = await replanFollowSetWithLumos({ memberIds: aiIds, cancelledIds: [...cancelIds, ...toManual], resolveStaffName: staffNameOfPhone });
    } else {
      /**
       * 🔴 ปิดส่งอัตโนมัติ ≠ ปล่อยสายที่เอาออก/สลับเป็นคนโทรค้างที่ Lumos (1 ต.ค. 2569) — ยกเลิกแผนเดิมเหมือนปุ่มยกเลิก
       * (`cancelFollowReminder` ไม่ดูสวิตช์) · สายที่ยังอยู่ในแผนเดิมถูกส่งคืนตามเดิม · ไม่ส่งสายใหม่
       */
      if (cancelIds.length + toManual.length > 0) {
        replan = await replanFollowSetWithLumos({ memberIds: [], cancelledIds: [...cancelIds, ...toManual], resolveStaffName: staffNameOfPhone });
      }
      if (aiIds.length > 0) replanNote = 'ปิดการส่งให้ AI อยู่ — สายใหม่ยังไม่ถูกส่ง';
      if (createdIds.length > 0) {
        try {
          await dbQuery(
            `update ${followTable} set dispatch_state = 'off'
              where id = any($1::uuid[]) and dispatch_state is distinct from 'manual'`,
            [createdIds],
          );
        } catch (e) {
          if (!isUndefinedColumn(e)) throw e;
        }
      }
    }
  } catch (e) {
    logWarn('follow.schedule.replanFailed', { followId: anchorId, error: String(e) });
    replanNote = 'ส่งตารางใหม่ให้ AI ไม่สำเร็จ — ลองกดบันทึกอีกครั้ง';
  }

  await auditFromAuthed(req, {
    action: 'follow.schedule.replace',
    entityType: 'follow_entry',
    entityId: anchorId,
    before: { replaceIds },
    after: {
      groupId,
      kept: [...keepIds],
      cancelled: cancelIds,
      created: createdIds,
      toManual,
      replan,
      replanNote,
    },
  });

  return res.status(200).json({
    group_id: groupId,
    kept: keepIds.size,
    cancelled: cancelIds.length,
    created: createdIds.length,
    /** ให้ AI ถือตารางใหม่แล้วหรือยัง — จอต้องบอกคนกดได้ ห้ามเงียบ */
    /**
     * 🔴 ยกเลิกแผนเดิมไม่สำเร็จ = **ยังไม่ปลอดภัย** แม้ไม่เหลือแผนให้ส่ง (0 = 0) — เดิมรายงานว่าส่งแล้ว
     * ทั้งที่ Lumos อาจยังถือสายที่เพิ่งเอาออก/สลับเป็นคนโทร
     */
    lumos: replan
      ? {
          pushed: replan.cancelledOld && replan.pushedPlans === replan.plans && !replanNote,
          plans: replan.plans,
          rounds: replan.rounds,
          reason: replan.reason ?? replanNote ?? null,
        }
      : { pushed: false, plans: 0, rounds: 0, reason: replanNote },
  });
}

/**
 * **ย้อนสถานะปิดงาน** (feedback 2 ก.ย. 2569:
 * *"กรณีแก้ไขสถานะเสร็จแล้ว อยากให้ทำได้ต่อเนื่อง (ย้อนกลับ) ไม่ต้องเริ่มใหม่ทุกครั้ง"*)
 *
 * เดิมกด "เสร็จสิ้น" แล้วปุ่มทุกปุ่มของรอบนั้นหายไป — เลือกผิดคือแก้ไม่ได้เลย
 * ต้องสร้างรายการใหม่ทั้งชุด
 *
 * 🔴 ล้างช่องปิดงาน + คืนสายที่การปิดครั้งนั้นหยุดไว้ (`restoreRoundsStoppedByClose` · 7 ต.ค. 2569) — ปิดงานเป็นบันทึกของคน
 * ส่วนสายที่โทรไปแล้วเป็นเหตุการณ์ที่เกิดขึ้นจริง ย้อนไม่ได้และไม่ควรย้อน
 * ⚠️ รายการที่ **ยกเลิก** ไปแล้วย้อนทางนี้ไม่ได้ (คนละเรื่องกับปิดงาน)
 */
async function reopenFollow(req: AuthedReq, res: ApiRes) {
  const id = typeof req.query?.id === 'string' ? req.query.id.trim() : '';
  if (!UUID_RE.test(id)) return sendError(res, 400, 'Bad request', 'ต้องระบุ id ของรายการติดตาม');

  const { rows: beforeRows } = await dbQuery<FollowRow>(
    `select * from ${followTable} where id = $1 limit 1`,
    [id],
  );
  const before = beforeRows[0];
  if (!before) return sendError(res, 404, 'Not found', 'ไม่พบรายการ');
  if (before.cancelled_at) {
    return sendError(res, 400, 'Bad request', 'รายการนี้ถูกยกเลิกไปแล้ว — ย้อนสถานะปิดงานไม่ได้');
  }
  if (!before.completed_at) {
    return sendError(res, 400, 'Bad request', 'รายการนี้ยังไม่ได้ปิดงาน ไม่มีอะไรให้ย้อน');
  }

  const { rows } = await dbQuery<FollowRow>(
    `update ${followTable}
        set completed_at = null, outcome_code = null, outcome_note = null,
            completed_by = null, completed_by_name = null,
            updated_at = now(), updated_by = $2, updated_by_name = $3
      where id = $1 and cancelled_at is null
      returning *`,
    [id, req.user.sub, req.user.email ?? null],
  );
  const done = rows[0];
  if (!done) return sendError(res, 404, 'Not found', 'ย้อนสถานะไม่สำเร็จ');

  /** 🔴 คืนสายที่ปิดงานครั้งนั้นหยุดไว้ด้วย (เจ้าของ 7 ต.ค. 2569: *"ต้องการให้ย้อนสถานะทั้ง 2 สายเลย"*) */
  let restore: ReopenRestore = { restored: 0, resent: 0 };
  try {
    restore = await restoreRoundsStoppedByClose(id);
  } catch (e) {
    logWarn('follow.reopen.restoreFailed', { followId: id, error: String(e) });
    restore = { restored: 0, resent: 0, error: 'คืนสายที่ถูกหยุดไม่สำเร็จ' };
  }

  await auditFromAuthed(req, {
    action: 'follow.reopen',
    entityType: 'follow_entry',
    entityId: id,
    before: { outcome_code: before.outcome_code, outcome_note: before.outcome_note },
    after: { outcome_code: null, restore },
  });

  return res.status(200).json({ ...toResponse(done), restored_rounds: restore.restored, restore_error: restore.error ?? null });
}

/** ฐานยังไม่รัน migration 130 — บอกตรง ๆ แทนจะปล่อย error ดิบของ Postgres */
const STAFF_CALL_NOT_READY =
  'ยังลงผลโทรไม่ได้ ต้องรออัปเดตระบบก่อน';

/** `select *` ไม่มีคีย์นี้ = ฐานยังไม่รัน 130 (อ่านจากแถวจริง ไม่ต้องเดาจาก error) */
const hasStaffCallColumns = (r: FollowRow) => Object.prototype.hasOwnProperty.call(r, 'staff_called_at');

/**
 * **ลงผลโทรของรอบคนโทร** (130 · เจ้าของเคาะ 30 ก.ย. 2569) — PATCH /api/follow?id=<uuid>
 * body `{ action: 'staff_call', outcome, note? }` · ลงซ้ำ = แก้ผลเดิม (เวลา/คนลงเปลี่ยนตาม)
 *
 * 🔴 **เฉพาะรอบที่ตั้งเป็นคนโทร** — รอบของ AI มีผลจาก Lumos อยู่แล้ว ลงซ้อนไม่ได้
 * (หน้าหลักนับ "คนโทร" จากช่องนี้ · ปล่อยให้ลงทับรอบ AI = นับสายเดียวสองฝั่ง)
 * ⚠️ ไม่แตะคิวโทร ไม่แตะการปิดงาน — เป็นบันทึกของสายนั้นอย่างเดียว
 */
async function recordStaffCall(req: AuthedReq, res: ApiRes, body: Record<string, unknown>) {
  const id = typeof req.query?.id === 'string' ? req.query.id.trim() : '';
  if (!UUID_RE.test(id)) return sendError(res, 400, 'Bad request', 'ต้องระบุ id ของรายการติดตาม');
  const v = validateFollowStaffCall({ outcome: body.outcome, note: body.note });
  if (v.ok === false) return sendError(res, 400, 'Bad request', v.error);

  const { rows: beforeRows } = await dbQuery<FollowRow>(
    `select * from ${followTable} where id = $1 limit 1`,
    [id],
  );
  const before = beforeRows[0];
  if (!before) return sendError(res, 404, 'Not found', 'ไม่พบรายการ');
  if (!hasStaffCallColumns(before)) return sendError(res, 503, 'Service unavailable', STAFF_CALL_NOT_READY);
  if (before.cancelled_at) return sendError(res, 400, 'Bad request', 'รายการนี้ยกเลิกไปแล้ว ลงผลไม่ได้');
  /**
   * 🔴 สาย AI ลงผลเองได้แล้ว (เจ้าของ 7 ต.ค. 2569: *"ถ้าสาย AI โทรไม่ติดแล้วเจ้าหน้าที่โทรเองได้คำตอบ"* → ทำ)
   * เฉพาะเมื่อ AI ยังไม่ได้คำตอบ (ไม่รับสาย · ไม่ชัด · ยังไม่มีผล) — AI ได้ ไป/ไม่ไป/ขอเลื่อน แล้ว = ห้ามทับ
   */
  const isAiRow = before.call_mode !== 'manual';
  let aiQueuePending = false;
  if (isAiRow) {
    const { rows: q } = await dbQuery<{ outcome: string | null; status: string | null }>(
      `select coalesce(last_outcome, result->>'outcome') as outcome, status from ${queueTable}
        where channel = 'reminder' and job_ref = 'follow' and person_ref = $1 limit 1`,
      [`follow-${id}`],
    );
    if (isAiDecisiveOutcome(q[0]?.outcome)) {
      return sendError(res, 400, 'Bad request', 'AI ได้คำตอบของสายนี้แล้ว ลงผลทับไม่ได้');
    }
    aiQueuePending = q[0]?.status === 'pending';
  }

  const { rows } = await dbQuery<FollowRow>(
    `update ${followTable}
        set staff_call_outcome = $2, staff_call_note = $3, staff_called_at = now(),
            staff_called_by = $4, staff_called_by_name = $5
      where id = $1 and cancelled_at is null
      returning *`,
    [id, v.value.outcome, v.value.note, req.user.sub, req.user.email ?? null],
  );
  const done = rows[0];
  if (!done) return sendError(res, 404, 'Not found', 'ไม่พบรายการนี้ หรือยกเลิกไปแล้ว');

  // คนได้คำตอบแล้ว — สาย AI ของช่องนี้ที่ยังรอโทรไม่ต้องโทรแล้ว (ถอนคิว + แจ้ง Lumos ตัวเดียวกับปุ่มยกเลิก)
  if (isAiRow && aiQueuePending) {
    try {
      await cancelFollowReminder(id, staffNameOfPhone);
    } catch (e) {
      logWarn('follow.staffCall.cancelAiFailed', { followId: id, error: String(e) });
    }
  }

  await auditFromAuthed(req, {
    action: 'follow.staff_call',
    entityType: 'follow_entry',
    entityId: id,
    before: { staff_call_outcome: before.staff_call_outcome ?? null, staff_call_note: before.staff_call_note ?? null },
    after: { staff_call_outcome: v.value.outcome, staff_call_note: v.value.note },
  });

  return res.status(200).json(toResponse(done));
}

/**
 * **ล้างผลโทรของคนโทร** — กดผิดแล้วย้อนได้ (บทเรียนเดียวกับย้อนสถานะปิดงาน 2 ก.ย. 2569)
 * PATCH body `{ action: 'staff_call_clear' }` · ประวัติอยู่ใน audit `follow.staff_call*`
 */
async function clearStaffCall(req: AuthedReq, res: ApiRes) {
  const id = typeof req.query?.id === 'string' ? req.query.id.trim() : '';
  if (!UUID_RE.test(id)) return sendError(res, 400, 'Bad request', 'ต้องระบุ id ของรายการติดตาม');

  const { rows: beforeRows } = await dbQuery<FollowRow>(
    `select * from ${followTable} where id = $1 limit 1`,
    [id],
  );
  const before = beforeRows[0];
  if (!before) return sendError(res, 404, 'Not found', 'ไม่พบรายการ');
  if (!hasStaffCallColumns(before)) return sendError(res, 503, 'Service unavailable', STAFF_CALL_NOT_READY);
  if (!before.staff_called_at) return sendError(res, 400, 'Bad request', 'สายนี้ยังไม่ได้ลงผล');

  const { rows } = await dbQuery<FollowRow>(
    `update ${followTable}
        set staff_call_outcome = null, staff_call_note = null, staff_called_at = null,
            staff_called_by = null, staff_called_by_name = null
      where id = $1
      returning *`,
    [id],
  );
  const done = rows[0];
  if (!done) return sendError(res, 404, 'Not found', 'ล้างผลไม่ได้ ลองอีกครั้ง');

  await auditFromAuthed(req, {
    action: 'follow.staff_call_clear',
    entityType: 'follow_entry',
    entityId: id,
    before: { staff_call_outcome: before.staff_call_outcome ?? null, staff_call_note: before.staff_call_note ?? null },
    after: { staff_call_outcome: null },
  });

  return res.status(200).json(toResponse(done));
}

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  try {
    if (method === 'GET') return await listFollow(req, res);
    if (method === 'POST') {
      try {
        return await createFollow(req, res);
      } catch (e) {
        if (e instanceof FollowTeamNotReady) return sendError(res, 503, 'Service unavailable', e.message);
        if (e instanceof FollowTimeTbdNotReady) return sendError(res, 503, 'Service unavailable', e.message);
        throw e;
      }
    }
    if (method === 'PATCH') {
      // action='update' = แก้ไข · action='reopen' = ย้อนสถานะปิดงาน
      // action='staff_call' / 'staff_call_clear' = ลง/ล้างผลโทรของรอบคนโทร (130)
      // ไม่ใส่ = ปิดงาน (พฤติกรรมเดิม ห้ามเปลี่ยน)
      const body = ((await readJsonBody(req)) ?? {}) as Record<string, unknown>;
      const action = getString(body.action);
      if (action === 'update') return await updateFollow(req, res, body);
      if (action === 'replace_schedule') return await replaceFollowSchedule(req, res, body);
      if (action === 'reopen') return await reopenFollow(req, res);
      if (action === 'staff_call') return await recordStaffCall(req, res, body);
      if (action === 'staff_call_clear') return await clearStaffCall(req, res);
      return await completeFollow(req, res, body);
    }
    if (method === 'DELETE') {
      // purge=1 = ลบทิ้งจริง (admin) · ไม่ใส่ = ยกเลิก (พฤติกรรมเดิม ห้ามเปลี่ยน)
      const purge = getString(req.query?.purge);
      if (purge === '1' || purge === 'true') return await purgeFollow(req, res);
      return await cancelFollow(req, res);
    }
    return sendError(res, 405, 'Method not allowed', 'Use GET, POST, PATCH or DELETE');
  } catch (e) {
    return handleApiError(res, e, `follow ${method}`, { userId: req.user.sub });
  }
}

export default withRbac(handler, 'follow');
