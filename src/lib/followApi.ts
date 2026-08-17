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
  scheduled_at: string | null;
  created_by_name: string | null;
  created_at: string | null;
  cancelled: boolean;
  /**
   * ปิดงานแล้ว (095) — **คนละเรื่องกับ `cancelled`**
   * ยกเลิก = ไม่ต้องตามแล้ว ตัดสายทิ้งก่อนถึงวัน · ปิดงาน = ตามจนจบแล้ว จบแบบไหน
   */
  completed_at?: string | null;
  outcome_code?: string | null;
  outcome_note?: string | null;
  completed_by_name?: string | null;
  call_status: FollowCallStatus;
  call_outcome: string | null;
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
