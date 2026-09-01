import { apiFetch } from '@/lib/apiFetch';
import { TONE, type ToneKey } from '@/lib/designTokens';
import type { LumosNextAction } from '@/lib/lumosDispatchApi';
import type { FollowOutcome } from '@/lib/followOutcome';

export type FollowCallStatus = 'pending' | 'delivered' | 'completed' | 'failed' | 'cancelled';

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
  scheduled_at: string | null;
  /** หน่วยงานที่ตามเรื่องให้ + รหัสไซต์ (096) — null = ไม่ได้ระบุ */
  unit_name?: string | null;
  site_code?: string | null;
  /** สายที่เท่าไหร่ (113) — null = แถวเก่า/ไม่ได้ระบุ ⇒ ถือเป็นสายแรก */
  call_round?: number | null;
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
  next_action: LumosNextAction | null;
  called_at: string | null;
};

export type NewFollowEntry = {
  recipient_name: string;
  recipient_phone: string;
  topic: string;
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
};

async function readError(r: Response): Promise<string> {
  const data = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
  return data.message || data.error || `ไม่สำเร็จ (HTTP ${r.status})`;
}

export async function listFollowEntries(): Promise<FollowEntry[]> {
  const r = await apiFetch('/api/follow');
  if (!r.ok) throw new Error(await readError(r));
  const data = (await r.json()) as { items: FollowEntry[] };
  return data.items ?? [];
}

export async function createFollowEntry(input: NewFollowEntry): Promise<FollowEntry> {
  const r = await apiFetch('/api/follow', { method: 'POST', body: JSON.stringify(input) });
  if (!r.ok) throw new Error(await readError(r));
  return (await r.json()) as FollowEntry;
}

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
): Promise<FollowEntry & { queue_refreshed?: number }> {
  const r = await apiFetch(`/api/follow?id=${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...input, action: 'update' }),
  });
  if (!r.ok) throw new Error(await readError(r));
  return (await r.json()) as FollowEntry & { queue_refreshed?: number };
}

export async function cancelFollowEntry(id: string): Promise<void> {
  const r = await apiFetch(`/api/follow?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!r.ok) throw new Error(await readError(r));
}

/**
 * ปิดงานติดตาม (095 · เจ้าของสั่ง 17 ส.ค. 2569 ข้อ 7 ของงานคัดสรร)
 * `outcome_note` บังคับเฉพาะ 'other' — server เป็นด่านตัดสินอีกชั้น
 */
export async function completeFollowEntry(
  id: string,
  outcome: FollowOutcome,
  note?: string,
): Promise<FollowEntry> {
  const r = await apiFetch(`/api/follow?id=${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ outcome_code: outcome, outcome_note: note?.trim() || undefined }),
  });
  if (!r.ok) throw new Error(await readError(r));
  return (await r.json()) as FollowEntry;
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
