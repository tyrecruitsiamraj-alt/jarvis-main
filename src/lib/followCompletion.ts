/**
 * "โทรครบแล้ว" — กองที่ตามจนจบรอบแล้ว รอส่งต่อไปดูแลหลังเริ่มงาน (Phase 7.1-7.2)
 *
 * เจ้าของสั่ง: *กล่อง "โทรครบแล้ว" (โทรครบรอบที่ตั้ง + `needs_human`) กดดูรายชื่อได้*
 * แล้วมีปุ่ม *[ย้ายไปดูแลหลังเริ่มงาน]* จากกล่องนั้น
 *
 * 🔴 นับที่ระดับ **คน (กลุ่ม)** ไม่ใช่ระดับรอบ — คนหนึ่งมีหลายรอบ (1 วัน = 1 แถว
 * ตาม migration 092) ถ้านับเป็นรอบ คนเดียวจะโผล่ในกล่องหลายครั้งและเลขจะเฟ้อ
 *
 * เข้ากองนี้เมื่อ **ทุกรอบที่ไม่ถูกยกเลิกเดินจบแล้ว** และไม่มีนัดข้างหน้าเหลือ:
 *   · ปิดงานแล้ว (`completed_at` + `outcome_code`) หรือ
 *   · มีผลโทรกลับมาแล้ว (`call_outcome`) หรือ
 *   · AI เอาไม่อยู่ ต้องคนตาม (`needs_human`) ← เจ้าของระบุมาในโจทย์
 *
 * ⚠️ **ยังไม่จบ** ถ้ายังมีรอบที่รอโทร/กำลังโทรอยู่ (`nextRound` ไม่ null หรือรอบยังไม่มีผล)
 * — กล่องนี้ต้องเป็น "งานที่พร้อมส่งต่อจริง" ไม่ใช่ "กำลังตามอยู่"
 * ⚠️ คนที่ **ผลออกมาว่าไม่ไป** (ยกเลิก/ไม่ไปเริ่มงาน) ไม่เข้ากองนี้ — ไม่มีอะไรให้ดูแลต่อ
 */
import type { FollowEntry } from '@/lib/followApi';
import type { FollowGroup } from '@/lib/followGrouping';
import { isLostOutcome, isSuccessOutcome } from '@/lib/followOutcome';

/** สถานะ followup ของคิวที่แปลว่า "AI เอาไม่อยู่ ต้องคนตาม" (migration 070) */
export const NEEDS_HUMAN_STATE = 'needs_human';

export type FollowRoundLike = Pick<
  FollowEntry,
  'cancelled' | 'completed_at' | 'outcome_code' | 'call_outcome'
> & {
  /** สถานะ followup จากคิว Lumos — 'needs_human' = ต้องคนตาม */
  followup_state?: string | null;
};

/** รอบนี้ "เดินจบ" แล้วหรือยัง (ยกเลิกถือว่าไม่ต้องนับ) */
export function isRoundSettled(r: FollowRoundLike): boolean {
  if (r.cancelled) return true;
  if (r.completed_at && r.outcome_code) return true;
  if (r.call_outcome) return true;
  return r.followup_state === NEEDS_HUMAN_STATE;
}

export type CompletionReason = 'closed_success' | 'needs_human' | 'called_no_close';

export type CompletedFollowPerson = {
  group: FollowGroup;
  /** ทำไมอยู่ในกองนี้ — คำบนจอต้องบอกได้ว่าจบแบบไหน */
  reason: CompletionReason;
  /** จำนวนรอบที่เดินจบ (ไม่นับที่ยกเลิก) */
  roundsDone: number;
};

export const COMPLETION_REASON_LABEL: Record<CompletionReason, string> = {
  closed_success: 'ปิดงานแล้ว — ไปเริ่มงานจริง',
  needs_human: 'AI เอาไม่อยู่ ต้องคนตามต่อ',
  called_no_close: 'โทรครบรอบแล้ว แต่ยังไม่ได้ปิดงาน',
};

function reasonOf(rounds: FollowRoundLike[]): CompletionReason | null {
  const active = rounds.filter((r) => !r.cancelled);
  if (active.length === 0) return null; // ยกเลิกหมด = ไม่ใช่ "โทรครบ"
  // ผลออกมาว่าไม่ไป = ไม่มีอะไรให้ดูแลต่อ (ไม่เข้ากองนี้)
  if (active.some((r) => isLostOutcome(r.outcome_code))) return null;
  if (active.some((r) => isSuccessOutcome(r.outcome_code))) return 'closed_success';
  if (active.some((r) => r.followup_state === NEEDS_HUMAN_STATE)) return 'needs_human';
  return 'called_no_close';
}

/**
 * เลือกคนที่ "โทรครบแล้ว" จากกลุ่มที่หน้า Follow จัดไว้แล้ว
 * ⚠️ รับ `FollowGroup[]` ตัวเดียวกับที่ลิสต์ใช้ — ยอดกับรายชื่อจึงมาจากชุดเดียวกันเสมอ
 * (กติกาเดิมของหน้านี้: ห้ามให้ยอดมาจากคนละชุดกับชื่อที่กางออกมา)
 */
export function selectCompletedFollowPeople(groups: FollowGroup[]): CompletedFollowPerson[] {
  const out: CompletedFollowPerson[] = [];
  for (const g of groups) {
    // ยังมีนัดข้างหน้า = ยังตามอยู่ ไม่ใช่ "ครบ"
    if (g.nextRound) continue;
    const rounds = g.rounds as FollowRoundLike[];
    if (rounds.length === 0) continue;
    if (!rounds.filter((r) => !r.cancelled).every(isRoundSettled)) continue;
    const reason = reasonOf(rounds);
    if (!reason) continue;
    out.push({
      group: g,
      reason,
      roundsDone: rounds.filter((r) => !r.cancelled).length,
    });
  }
  // จบดีขึ้นก่อน (พร้อมส่งต่อเลย) แล้วค่อยกลุ่มที่ต้องคนตาม
  const order: Record<CompletionReason, number> = {
    closed_success: 0,
    needs_human: 1,
    called_no_close: 2,
  };
  return out.sort((a, b) => order[a.reason] - order[b.reason] || a.group.name.localeCompare(b.group.name, 'th'));
}

/** สรุปสั้น ๆ ใต้หัวกล่อง — ไม่มีของ = null (กล่องซ่อนตัวเอง) */
export function completedFollowSummary(people: CompletedFollowPerson[]): string | null {
  if (people.length === 0) return null;
  const byReason = new Map<CompletionReason, number>();
  for (const p of people) byReason.set(p.reason, (byReason.get(p.reason) ?? 0) + 1);
  const parts = (Object.keys(COMPLETION_REASON_LABEL) as CompletionReason[])
    .filter((r) => (byReason.get(r) ?? 0) > 0)
    .map((r) => `${COMPLETION_REASON_LABEL[r]} ${byReason.get(r)}`);
  return parts.join(' · ');
}
