import { apiFetch } from '@/lib/apiFetch';
import { TONE, type ToneKey } from '@/lib/designTokens';
import type { LumosNextAction } from '@/lib/lumosDispatchApi';
import type { FollowOutcome } from '@/lib/followOutcome';
import type { FollowStaffCallOutcome } from '@/lib/followStaffCall';
import { withFollowDayCalls } from '@/lib/followDayCall';

export type FollowCallStatus = 'pending' | 'delivered' | 'completed' | 'failed' | 'cancelled';

/** สถานะสายที่รู้จัก — ค่าที่อ่านไม่ออกต้องไม่ขึ้นป้ายมั่ว (ใช้ร่วมป๊อปรายชื่อกับตารางแท็บผู้สมัคร) */
export const isFollowCallStatus = (v: unknown): v is FollowCallStatus =>
  v === 'pending' || v === 'delivered' || v === 'completed' || v === 'failed' || v === 'cancelled';

export type FollowEntry = {
  id: string;
  recipient_name: string;
  recipient_phone: string;
  topic: string;
  note: string | null;
  /** เบอร์เจ้าหน้าที่ผู้ติดตาม — AI บอกผู้สมัครไว้โทรกลับ */
  staff_phone?: string | null;
  /**
   * ผลตอนพยายามส่งเข้าคิว AI ตอนสร้าง (migration 109)
   * `null` = แถวเก่าก่อนมีคอลัมน์นี้ ⇒ ไม่รู้ว่าทำไม (ห้ามตีความว่าส่งแล้ว)
   */
  dispatch_state?: string | null;
  /**
   * เหตุที่ดันรายการไปหา Lumos ไม่สำเร็จ (คู่กับ `dispatch_state = 'push_failed'`)
   * `null` = ไม่เคยล้ม หรือส่งซ้ำสำเร็จแล้ว
   */
  dispatch_error?: string | null;
  scheduled_at: string | null;
  /** หน่วยงานที่ตามเรื่องให้ + รหัสไซต์ (096) — null = ไม่ได้ระบุ */
  unit_name?: string | null;
  site_code?: string | null;
  /** สายที่เท่าไหร่ (113) — null = แถวเก่า/ไม่ได้ระบุ ⇒ ถือเป็นสายแรก · ตารางหลายวันนับต่อทั้งชุด (เลือกบทของ AI) */
  call_round?: number | null;
  /**
   * **"วันที่ D · สายที่ N" ที่คนอ่านบนจอ** (1 ต.ค. 2569 · คิดฝั่งหน้าเว็บตอนโหลด `withFollowDayCalls`)
   * `call_day` = วันที่เท่าไหร่ของชุด (null = ชุดวันเดียว) · `call_of_day` = สายที่เท่าไหร่ของวันนั้น
   * ไม่มีคีย์ (แถวที่ไม่ได้ผ่าน `listFollowEntries`) = ถอยไปใช้ `call_round`
   */
  call_day?: number | null;
  call_of_day?: number | null;
  /**
   * ใครโทรรอบนี้ (121) — `'ai'` ส่งให้ Lumos · `'manual'` เจ้าหน้าที่โทรเอง
   * แถวเก่าที่ไม่มีค่านี้ = `'ai'` (เส้นหลังบ้านเติมให้แล้ว ฝั่งจอไม่ต้องเดา)
   */
  call_mode?: 'ai' | 'manual';
  /**
   * ยังไม่กำหนดเวลาโทร (134 · Journey ข้อ 5 "ยังไม่ชัวร์เวลา") — true = เวลาใน scheduled_at เป็นค่าแทน
   * จอทุกจุดโชว์ "ยังไม่ระบุเวลา" · เป็นคนโทรเสมอจนกว่าจะตั้งเวลาจริง
   */
  time_tbd?: boolean;
  /** "ติดตามครั้งที่" ของวันแรกในชุด (137 · 6 ต.ค. 2569) — null/1 = นับ 1 ตามเดิม · เลขวันคิดที่ `followDayCall.ts` */
  plan_day_start?: number | null;
  /** ประเภทใบส่งคนแทนจาก iRecruit (136) — 'EX' = คนนอก · ค่าอื่น = คนใน · null = ไม่รู้ */
  replace_type?: string | null;
  /** ที่มาของแถว (133) — `irecruit-replace:<ใบ>:<ช่อง>:<คน>` = ดึงจาก iRecruit · null = คีย์เอง */
  source_ref?: string | null;
  /**
   * รอบเวลาของวันนั้น (092 · HH:MM) — **หนึ่งแถว = หนึ่งวัน แต่มีได้หลายรอบ**
   * `null`/ไม่มี = รอบเดียวตามเวลาใน `scheduled_at`
   */
  call_times?: string[] | null;
  /** ชุดตาราง (092) — สายของคนเดียวกันที่ตั้ง/แก้พร้อมกัน · null = แถวเก่า/รอบเดี่ยว */
  group_id?: string | null;
  /**
   * เบอร์ฉุกเฉินที่ส่งไปกับสายนั้น — เบอร์ที่ **AI โทรหา** เมื่อติดต่อผู้รับไม่ได้
   * ⚠️ บอกได้แค่ว่า **ส่งเบอร์ไปแล้ว** · Lumos ยังไม่ส่งกลับมาว่าโทรเบอร์นี้หรือยัง
   */
  emergency_phone?: string | null;
  /**
   * ทีมของรายการ (131 · 1 ต.ค. 2569) — null = ทีมติดตาม (แท็บรายชื่อติดตาม) · `'replacement'` = ทีมส่งคนแทน
   * ฐานยังไม่รัน 131 = ไม่มีคีย์ ⇒ อ่านเป็นทีมติดตาม (ของเดิม)
   */
  follow_team?: 'replacement' | null;
  /** 🔴 เจ้าของข้อมูล = **คนที่กรอกครั้งแรก** ไม่เปลี่ยนแม้มีคนอื่นมาแก้ทีหลัง */
  created_by_name: string | null;
  created_at: string | null;
  /** คนแก้ล่าสุด — คนละคนกับเจ้าของข้อมูลได้ */
  updated_at?: string | null;
  updated_by_name?: string | null;
  cancelled: boolean;
  /**
   * ปิดงานแล้ว (095) — **คนละเรื่องกับ `cancelled`**
   * ยกเลิก = ไม่ต้องตามแล้ว ตัดสายทิ้งก่อนถึงวัน · ปิดงาน = ตามจนจบแล้ว จบแบบไหน
   */
  completed_at?: string | null;
  outcome_code?: string | null;
  outcome_note?: string | null;
  completed_by_name?: string | null;
  /**
   * **ผลที่เจ้าหน้าที่ลงเอง** ของรอบคนโทร (130 · 30 ก.ย. 2569) — คนละช่องกับ `call_outcome` (ผลจาก AI)
   * สภาพ/สีของรอบรวมสองแหล่งด้วย `effectiveCallOutcome()` (`src/lib/followStaffCall.ts`) ที่เดียว
   */
  staff_call_outcome?: string | null;
  staff_call_note?: string | null;
  staff_called_at?: string | null;
  staff_called_by_name?: string | null;
  /**
   * สถานะในคิว AI — 🔴 **`null` ได้** เมื่อรายการนี้ไม่เคยเข้าคิวเลย
   * (SQL เป็น LEFT JOIN) · เดิมประกาศเป็น non-null ⇒ จอวาดป้ายว่างเปล่า
   * คนเห็นช่องโล่ง ๆ แล้วไม่รู้ว่า "ไม่ได้ส่ง" — ใช้ `followDispatchLabel()` แทน
   */
  call_status: FollowCallStatus | null;
  call_outcome: string | null;
  /** รอบที่โทรล่าสุด — null = ยังไม่มีแถวคิว (ยังไม่ได้ส่งให้ AI) */
  call_attempt?: number | null;
  /**
   * สถานะ followup ของคิว (070): `retry_scheduled` · **`needs_human`** · `closed`
   * — กล่อง "โทรครบแล้ว" (Phase 7.1) นับ `needs_human` เข้ากองด้วย
   */
  followup_state?: string | null;
  call_summary: string | null;
  /**
   * **คำที่คนรับสายพูดเอง** (ต่อจาก transcript ฝั่ง candidate) — `null` = ไม่มี
   *
   * ต่างจาก `call_summary` ซึ่งเป็นคำบรรยายของ AI มุมมองบุคคลที่สาม
   * ("ผู้รับสายแจ้งว่า…") · ช่อง "เขาตอบว่าอะไร" ต้องใช้ตัวนี้เป็นหลัก
   */
  call_reply?: string | null;
  next_action: LumosNextAction | null;
  called_at: string | null;
};

export type NewFollowEntry = {
  recipient_name: string;
  recipient_phone: string;
  topic: string;
  /** ทีม (131) — ส่งเฉพาะเมื่อกดเพิ่มจากแท็บติดตามส่งคนแทน · ไม่ส่ง = ทีมติดตาม (ของเดิม) */
  follow_team?: 'replacement';
  note?: string;
  staff_phone?: string;
  scheduled_at?: string;
  /** ตารางโทร (092) — uuid เดียวต่อ 1 คน (client gen · ยิง 1 แถว/วัน ผูก group เดียว) */
  group_id?: string;
  /** รอบเวลาของวันนั้น (HH:MM) — หลายรอบในวันเดียว (Lumos หยุดที่เหลือเมื่อยืนยัน) */
  call_times?: string[];
  /** หน่วยงาน + รหัสไซต์ (096) — เลือกจากใบขอแล้วเติมให้ทั้งคู่ */
  unit_name?: string;
  site_code?: string;
  /**
   * รอบนี้คือ "สายที่เท่าไหร่" (113 · เจ้าของสั่ง 1 ก.ย. 2569) — คนเลือกจาก dropdown
   * 1 = ใช้บทสายแรก · 2 ขึ้นไป = ใช้บทรอบถัดไป · ไม่ส่ง = ถือเป็นสายแรก
   */
  call_round?: number;
  /**
   * **ทุกรอบของคนนี้ในคำขอเดียว** (11 ก.ย. 2569) — ส่งมาเมื่อไหร่ ฝั่ง API จะสร้าง
   * ครบทุกรอบแล้วดัน **แผนเดียว** ที่มีทุก step ไปหา Lumos
   *
   * 🔴 ต้องส่งพร้อมกัน **ห้ามยิงทีละรอบ** — ยิงทีละรอบ = แผนแยกกันรอบละแผนไปที่
   * เบอร์เดียวกัน แผนหลังทับแผนแรก สายแรกไม่ได้โทร (วัดจริง 11 ก.ย. 2569)
   */
  rounds?: Array<{
    scheduled_at: string;
    staff_phone?: string;
    call_round?: number;
    /** ใครโทรรอบนี้ (121) — ไม่ส่ง = ตามค่าของทั้งคำขอ */
    call_mode?: 'ai' | 'manual';
    /** ยังไม่กำหนดเวลา (134) — เวลาใน scheduled_at เป็นค่าแทน · ฝั่ง API บังคับเป็นคนโทร */
    time_tbd?: boolean;
  }>;
  /**
   * ใครโทร (121 · เจ้าของสั่ง 20 ก.ย. 2569) — `'manual'` = **ไม่ส่งเข้าคิว AI เลย**
   * แถวยังถูกสร้างตามปกติ เพื่อให้วันที่ตั้งใจโทรเองมีร่องรอยและมีคนรับผิดชอบ
   */
  call_mode?: 'ai' | 'manual';
  /** ยังไม่กำหนดเวลา (134) — เวลาที่ส่งเป็นค่าแทน (เที่ยงคืนของวันนั้น) · ฝั่ง API บังคับเป็นคนโทร */
  time_tbd?: boolean;
  /** "ติดตามครั้งที่" ของวันแรกในชุด (137) — ไม่ส่ง/1 = นับ 1 */
  plan_day_start?: number;
};

/** ฟิลด์ที่แก้ไขได้ (096) — ไม่รวมเจ้าของข้อมูลและตารางโทร (ดูเหตุผลที่ฝั่ง API) */
export type EditFollowEntry = {
  recipient_name: string;
  recipient_phone: string;
  topic: string;
  note?: string;
  staff_phone?: string;
  scheduled_at?: string;
  unit_name?: string;
  site_code?: string;
  /** เปลี่ยนเบอร์ของสายที่เหลือในชุดเดียวกันด้วย (4 ต.ค. 2569) */
  apply_phone_to_set?: boolean;
};

async function readError(r: Response): Promise<string> {
  const data = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
  return data.message || data.error || `ไม่สำเร็จ (HTTP ${r.status})`;
}

/** หนึ่งหน้าเต็ม ๆ ของเส้น `/api/follow` — ฝั่ง API จำกัดไว้ที่ 500 ต่อครั้ง */
const FOLLOW_PAGE_SIZE = 500;
/** กันวนไม่รู้จบถ้าเส้นตอบเพี้ยน — 20 หน้า = 10,000 รอบ มากกว่าของจริงหลายเท่า */
const FOLLOW_MAX_PAGES = 20;

/**
 * 🔴 **ต้องดึงให้ครบทุกแถว ห้ามหยุดที่หน้าแรก** (20 ก.ย. 2569)
 *
 * เดิมยิงครั้งเดียวไม่ส่ง `limit` ⇒ ได้ 200 แถวแรก · ตอนนั้นฐานมี 257
 * ⇒ ป้ายแท็บ · ปฏิทิน · ตาราง Planning คิดจากของไม่ครบ **แบบเงียบ ๆ**
 * (เจ้าของจับได้ว่าเลขบนหน้าไม่สอดคล้องกัน) · ตอนนี้ไล่ดึงจนครบตาม `total`
 */
export async function listFollowEntries(): Promise<FollowEntry[]> {
  const all: FollowEntry[] = [];
  for (let page = 0; page < FOLLOW_MAX_PAGES; page += 1) {
    const r = await apiFetch(`/api/follow?limit=${FOLLOW_PAGE_SIZE}&offset=${all.length}`);
    if (!r.ok) throw new Error(await readError(r));
    const data = (await r.json()) as {
      items?: FollowEntry[];
      total?: number;
      has_more?: boolean;
    };
    const items = data.items ?? [];
    all.push(...items);
    // เส้นเก่า (ยังไม่มี has_more) หรือหน้าสุดท้าย ⇒ จบ · หน้าว่างก็จบ กันวนซ้ำ
    if (items.length === 0 || data.has_more !== true) break;
  }
  // เลข "วันที่ · สายที่" ต้องคิดจากทั้งชุด — ที่เดียวตอนโหลด ทุกจอที่อ่านรายการนี้เห็นเลขเดียวกัน
  return withFollowDayCalls(all);
}

export async function createFollowEntry(input: NewFollowEntry): Promise<FollowEntry> {
  const r = await apiFetch('/api/follow', { method: 'POST', body: JSON.stringify(input) });
  if (!r.ok) throw new Error(await readError(r));
  return (await r.json()) as FollowEntry;
}

/**
 * สร้าง **ทุกรอบของคนเดียวกันในคำขอเดียว** — คืนทุกแถวที่สร้าง
 *
 * 🔴 ใช้ตัวนี้เสมอเมื่อตั้งมากกว่าหนึ่งรอบ (เจ้าของสั่ง 11 ก.ย. 2569)
 * ยิงทีละรอบ = ฝั่งเราสร้างแผนแยกกันรอบละแผนไปที่เบอร์เดียวกัน แผนหลังทับแผนแรก
 * **สายแรกจะไม่ได้โทรและไม่มีผลกลับ**
 */
export async function createFollowRounds(
  input: NewFollowEntry & { rounds: NonNullable<NewFollowEntry['rounds']> },
): Promise<FollowEntry[]> {
  const r = await apiFetch('/api/follow', { method: 'POST', body: JSON.stringify(input) });
  if (!r.ok) throw new Error(await readError(r));
  const data = (await r.json()) as { items?: FollowEntry[] } | FollowEntry;
  // เส้นเดิมคืนแถวเดียว (ตอนส่งรอบเดียว) — รองรับทั้งสองรูปเพื่อไม่ผูกกับลำดับ deploy
  return Array.isArray((data as { items?: FollowEntry[] }).items)
    ? ((data as { items: FollowEntry[] }).items)
    : [data as FollowEntry];
}

/** ผลของการแก้ตารางทั้งชุด (1 ต.ค. 2569) — `lumos.pushed = false` ต้องขึ้นบนจอ ห้ามเงียบ */
export type FollowScheduleReplaceResult = {
  group_id: string;
  kept: number;
  cancelled: number;
  created: number;
  lumos: { pushed: boolean; plans: number; rounds: number; reason: string | null };
};

/**
 * **แก้ตารางทั้งชุด** (เจ้าของ Choice 1 ต.ค. 2569 "แก้ตารางหลังบันทึกไม่ได้ → แก้")
 * `replace_ids` = สายที่จอเปิดให้แก้ทั้งหมด · `rounds` = ตารางใหม่ (มี id = สายเดิม · ไม่มี = สายใหม่ · ที่หายไป = เอาออก)
 * 409 = มีสายโทรไปแล้ว/ถูกแก้ระหว่างเปิดจอ (ปิดแล้วเปิดใหม่)
 */
export async function replaceFollowSchedule(
  anchorId: string,
  body: { replace_ids: string[]; rounds: Array<{ id?: string; scheduled_at: string; call_mode: 'ai' | 'manual' }> },
): Promise<FollowScheduleReplaceResult> {
  const r = await apiFetch(`/api/follow?id=${encodeURIComponent(anchorId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'replace_schedule', ...body }),
  });
  if (!r.ok) throw new Error(await readError(r));
  return (await r.json()) as FollowScheduleReplaceResult;
}

/**
 * ผลของการ **ส่งแผนใหม่ให้ Lumos หลังแก้** (13 ก.ย. 2569)
 *
 * 🔴 ของเดิมแก้แค่คิวฝั่งเรา ⇒ Lumos ยังโทรตามเวลา/บทเดิม · วัดกับงานวันที่ 14 ก.ย.
 * เจอ 3 ใน 10 คนเพี้ยนเพราะเหตุนี้ · `pushed = false` **ต้องขึ้นบนจอ ห้ามเงียบ**
 */
export type FollowLumosResync = {
  rounds: number;
  cancelled: boolean;
  pushed: boolean;
  reason?: string;
};

/**
 * แก้ไขรายการติดตาม (096 · เจ้าของสั่ง 17 ส.ค. 2569: *"เพิ่มให้แก้ไขได้"*)
 *
 * ⚠️ `action: 'update'` คือตัวแยกจาก PATCH เดิมที่แปลว่า "ปิดงาน" — ห้ามตัดออก
 * คืน `queue_refreshed` = จำนวนสายในคิวที่แก้บทพูดตามได้ทัน · **0 = Lumos ดึงไปแล้ว
 * สายที่ออกไปใช้ข้อมูลเดิม** ต้องบอกคนใช้ ไม่ใช่เงียบ
 */
export async function updateFollowEntry(
  id: string,
  input: EditFollowEntry,
): Promise<FollowEntry & { queue_refreshed?: number; lumos_resync?: FollowLumosResync; phone_applied?: number }> {
  const r = await apiFetch(`/api/follow?id=${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...input, action: 'update' }),
  });
  if (!r.ok) throw new Error(await readError(r));
  return (await r.json()) as FollowEntry & {
    queue_refreshed?: number;
    lumos_resync?: FollowLumosResync;
    phone_applied?: number;
  };
}

export async function cancelFollowEntry(id: string): Promise<void> {
  const r = await apiFetch(`/api/follow?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!r.ok) throw new Error(await readError(r));
}

/**
 * **ลบทิ้งจริง** (admin เท่านั้น — server เป็นด่านตัดสิน)
 *
 * เจ้าของสั่ง 3 ก.ย. 2569 ให้มีทางลบข้อมูลช่วงทดลองออกให้หมดจด
 * ⚠️ คนละเรื่องกับ `cancelFollowEntry` — ยกเลิกยังเห็นบนจอ (เป็นประวัติ)
 * แต่ลบทิ้งคือหายจริง กู้ไม่ได้ · ลบแถวคิว Lumos ของรายการนั้นให้ด้วย
 */
export async function purgeFollowEntry(id: string): Promise<{ queueRowsDeleted: number }> {
  const r = await apiFetch(`/api/follow?id=${encodeURIComponent(id)}&purge=1`, {
    method: 'DELETE',
  });
  if (!r.ok) throw new Error(await readError(r));
  const body = (await r.json()) as { queueRowsDeleted?: number };
  return { queueRowsDeleted: body.queueRowsDeleted ?? 0 };
}

/**
 * ปิดงานติดตาม (095 · เจ้าของสั่ง 17 ส.ค. 2569 ข้อ 7 ของงานคัดสรร)
 * `outcome_note` บังคับเฉพาะ 'other' — server เป็นด่านตัดสินอีกชั้น
 */
/**
 * ปิดงาน 1 สาย — server หยุดสายที่เหลือให้ด้วย (5 ต.ค. 2569): `day` = เฉพาะวันนั้น (ค่าเริ่ม ทุกผล) ·
 * `set` = ทุกวันของชุด (รับเฉพาะผล "ยกเลิก") · `stopped_rounds` = ยกเลิกไปกี่สาย · `stopped_error` = หยุดไม่สำเร็จ
 */
export type FollowStopScope = 'day' | 'set';
export async function completeFollowEntry(
  id: string,
  outcome: FollowOutcome,
  note?: string,
  stopScope: FollowStopScope = 'day',
): Promise<FollowEntry & { stopped_rounds?: number; stopped_error?: boolean }> {
  const r = await apiFetch(`/api/follow?id=${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ outcome_code: outcome, outcome_note: note?.trim() || undefined, stop_scope: stopScope }),
  });
  if (!r.ok) throw new Error(await readError(r));
  return (await r.json()) as FollowEntry & { stopped_rounds?: number; stopped_error?: boolean };
}

export const FOLLOW_STATUS_LABEL: Record<FollowCallStatus, string> = {
  pending: 'รอ AI โทร',
  delivered: 'AI รับไปโทรแล้ว',
  completed: 'โทรสำเร็จ',
  failed: 'โทรไม่สำเร็จ',
  cancelled: 'ยกเลิกแล้ว',
};

/**
 * สีสถานะการโทร — ผูกกับ token กลาง (mockup rev.3 ข้อ 08 "ภาษาเดียวกับ Matching ทั้งระบบ")
 * เดิมเป็นชุดสี /15 ของตัวเอง ไม่มีคู่ dark เลย
 *
 * ความหมายตรงกับ TONE: รอ = เทา · AI รับไปโทร = น้ำเงิน (กำลังดำเนินการ) ·
 * สำเร็จ = เขียว · ไม่สำเร็จ = แดง · ยกเลิก = เทา
 */
export const FOLLOW_STATUS_TONE: Record<FollowCallStatus, ToneKey> = {
  pending: 'neutral',
  delivered: 'primary',
  completed: 'success',
  failed: 'danger',
  cancelled: 'neutral',
};

/** ชิปสถานะพร้อมใช้ — ชี้ไปที่ class กลางเดียวกับหน้าอื่น */
export const FOLLOW_STATUS_CLASS: Record<FollowCallStatus, string> = {
  pending: TONE.neutral.chip,
  delivered: TONE.primary.chip,
  completed: TONE.success.chip,
  failed: TONE.danger.chip,
  cancelled: TONE.neutral.chip,
};

/** แถบสีซ้ายของการ์ด (mockup rev.3 ข้อ 08) — โทนเดียวกับชิป */
export const FOLLOW_STATUS_BAR: Record<FollowCallStatus, string> = {
  pending: TONE.neutral.dot,
  delivered: TONE.primary.dot,
  completed: TONE.success.dot,
  failed: TONE.danger.dot,
  cancelled: TONE.neutral.dot,
};

/**
 * **ย้อนสถานะปิดงาน** (feedback 2 ก.ย. 2569) — ล้างผลปิดงานให้กลับมาแก้ต่อได้
 * ⚠️ ไม่แตะคิวโทร · รายการที่ยกเลิกไปแล้วย้อนทางนี้ไม่ได้
 */
/** ย้อนสถานะ = คืนสายที่การปิดครั้งนั้นหยุดไว้ด้วย (7 ต.ค. 2569) — `restore_error` = คืนไม่ครบ ต้องบอกจอ */
export async function reopenFollowEntry(
  id: string,
): Promise<FollowEntry & { restored_rounds?: number; restore_error?: string | null }> {
  const r = await apiFetch(`/api/follow?id=${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'reopen' }),
  });
  if (!r.ok) throw new Error(await readError(r));
  return (await r.json()) as FollowEntry & { restored_rounds?: number; restore_error?: string | null };
}

/**
 * **ลงผลโทรของรอบคนโทร** (130 · เจ้าของเคาะ 30 ก.ย. 2569) — ลงซ้ำ = แก้ผลเดิม
 * ⚠️ เฉพาะรอบที่ตั้งเป็นคนโทร (server ปฏิเสธรอบของ AI) · ไม่แตะคิวโทร ไม่แตะการปิดงาน
 */
export async function recordFollowStaffCall(
  id: string,
  outcome: FollowStaffCallOutcome,
  note?: string,
): Promise<FollowEntry> {
  const r = await apiFetch(`/api/follow?id=${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'staff_call', outcome, note: note?.trim() || undefined }),
  });
  if (!r.ok) throw new Error(await readError(r));
  return (await r.json()) as FollowEntry;
}

/** ล้างผลโทรของคนโทร — กดผิดแล้วย้อนได้ */
export async function clearFollowStaffCall(id: string): Promise<FollowEntry> {
  const r = await apiFetch(`/api/follow?id=${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'staff_call_clear' }),
  });
  if (!r.ok) throw new Error(await readError(r));
  return (await r.json()) as FollowEntry;
}
