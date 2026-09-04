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
 * ⚠️ **ยังไม่จบ** ถ้ายังมีนัดข้างหน้า (`nextRound`) หรือ AI นัดโทรซ้ำไว้ (`retry_scheduled`)
 * — กล่องนี้ต้องเป็น "งานที่พร้อมส่งต่อจริง" ไม่ใช่ "กำลังตามอยู่"
 *
 * 🔴 **แก้ 3 ก.ย. 2569 (เจ้าของแจ้ง: "แดชบอร์ดโชว์การโทรสำเร็จแล้ว แต่ไม่ขึ้นแถบที่ต้อง
 * ย้ายไปดูแลหลังบ้าน")** — ของเดิมบังคับว่า **ทุกรอบ**ต้องเดินจบ (`every`) ⇒ วัดของจริง
 * 3 ก.ย.: Lumos ตอบสายที่ 2 แล้วปิดคนนั้น (`followup_state='closed'`) แต่**สายที่ 1
 * ค้าง `pending` ตลอดกาล** เพราะไม่เคยถูกยิงออก ⇒ 14 คนที่ได้คำตอบแล้วไม่มีใครเข้ากองนี้เลย
 * (แถบหายทั้งแถบ · แท็บ "สำเร็จ" ก็เป็น 0 เพราะไม่มีทางกดปิดงานจากที่ไหน)
 * ⇒ เปลี่ยนเป็น **มีรอบใดรอบหนึ่งได้คำตอบแล้ว + ไม่มีอะไรจ่อข้างหน้า = จบ**
 * สายเก่าที่ไม่เคยยิงถือว่า **ตกไป** (moot) เพราะเรารู้คำตอบแล้ว ไม่ต้องรอมันอีก
 *
 * 🔴 **ผลจาก AI ก็นับ ไม่ใช่รอแต่คนกดปิดงาน** — คนที่ AI ได้คำตอบว่า "ไม่ไป" ต้องขึ้น
 * กองนี้ด้วย แต่ติดป้ายว่าไม่ต้องส่งต่อ (เดิมตกหายเงียบ ๆ เพราะเช็คแต่ `outcome_code`
 * ที่คนกรอก) · คนที่ผลปิดงานว่าไม่ไปแล้วยังไม่เข้ากองนี้เหมือนเดิม — จบเรียบร้อยแล้ว
 */
import type { FollowEntry } from '@/lib/followApi';
import type { FollowGroup } from '@/lib/followGrouping';
import { isLostOutcome, isSuccessOutcome } from '@/lib/followOutcome';
import { CONNECTED_CALL_OUTCOMES, UNREACHED_CALL_OUTCOMES } from '@/lib/callOutcomeBuckets';

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

/** สถานะ followup ที่แปลว่า "AI นัดโทรซ้ำแล้ว" — ยังตามอยู่ ห้ามนับว่าจบ */
export const RETRY_STATE = 'retry_scheduled';

/** ผลโทรที่ถือว่า "ได้คำตอบแล้ว" (คุยได้ หรือ ยกหูไม่ได้จนหมดรอบ) */
const DECISIVE_OUTCOMES: readonly string[] = [
  ...CONNECTED_CALL_OUTCOMES,
  ...UNREACHED_CALL_OUTCOMES,
];

/** รอบนี้ได้คำตอบจากการโทรแล้วหรือยัง */
export function hasCallAnswer(r: FollowRoundLike): boolean {
  return Boolean(r.call_outcome && DECISIVE_OUTCOMES.includes(r.call_outcome));
}

export type CompletionReason =
  | 'closed_success'
  | 'ai_going'
  | 'ai_not_going'
  | 'needs_human'
  | 'called_no_close';

export type CompletedFollowPerson = {
  group: FollowGroup;
  /** ทำไมอยู่ในกองนี้ — คำบนจอต้องบอกได้ว่าจบแบบไหน */
  reason: CompletionReason;
  /** จำนวนรอบที่เดินจบ (ไม่นับที่ยกเลิก) */
  roundsDone: number;
};

export const COMPLETION_REASON_LABEL: Record<CompletionReason, string> = {
  closed_success: 'ปิดงานแล้ว — ไปเริ่มงานจริง',
  ai_going: 'AI ได้คำตอบว่าไป — รอปิดงาน/ส่งต่อ',
  ai_not_going: 'AI ได้คำตอบว่าไม่ไป — รอปิดงานว่าไม่ไป',
  needs_human: 'AI เอาไม่อยู่ ต้องคนตามต่อ',
  called_no_close: 'โทรครบรอบแล้ว แต่ยังไม่ได้ปิดงาน',
};

/** เหตุที่ "ไม่มีอะไรให้ดูแลต่อ" — ปุ่มย้ายไปดูแลหลังเริ่มงานต้องไม่ขึ้น */
export function reasonBlocksAftercare(reason: CompletionReason): boolean {
  return reason === 'ai_not_going';
}

function reasonOf(rounds: FollowRoundLike[]): CompletionReason | null {
  const active = rounds.filter((r) => !r.cancelled);
  if (active.length === 0) return null; // ยกเลิกหมด = ไม่ใช่ "โทรครบ"
  // ปิดงานว่าไม่ไปแล้ว = จบเรียบร้อย ไม่ต้องมาคาที่กองนี้
  if (active.some((r) => isLostOutcome(r.outcome_code))) return null;
  if (active.some((r) => isSuccessOutcome(r.outcome_code))) return 'closed_success';
  if (active.some((r) => r.followup_state === NEEDS_HUMAN_STATE)) return 'needs_human';
  /**
   * ผลจาก AI — ดู **รอบล่าสุดที่ได้คำตอบ** ไม่ใช่รอบไหนก็ได้
   * (คนหนึ่งอาจสายแรก "รับสายแล้ว" สายสองบอก "ไม่ไป" ⇒ คำตอบล่าสุดชนะ)
   */
  const answered = active.filter(hasCallAnswer);
  const last = answered[answered.length - 1];
  if (last?.call_outcome === 'declined') return 'ai_not_going';
  if (last?.call_outcome === 'confirmed') return 'ai_going';
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
    const active = rounds.filter((r) => !r.cancelled);
    // AI นัดโทรซ้ำไว้ = ยังตามอยู่ (สายที่ยังไม่ได้ยิงจริงถือว่าตกไป แต่ "นัดซ้ำ" ไม่ตก)
    if (active.some((r) => r.followup_state === RETRY_STATE)) continue;
    // ต้องมีรอบใดรอบหนึ่งเดินจบจริง — ไม่มีเลย = ค้างอยู่ ไม่ใช่ "โทรครบ"
    if (!active.some(isRoundSettled)) continue;
    const reason = reasonOf(rounds);
    if (!reason) continue;
    out.push({
      group: g,
      reason,
      roundsDone: active.filter((r) => isRoundSettled(r) || hasCallAnswer(r)).length,
    });
  }
  // จบดีขึ้นก่อน (พร้อมส่งต่อเลย) แล้วค่อยกลุ่มที่ต้องคนตาม
  const order: Record<CompletionReason, number> = {
    closed_success: 0,
    ai_going: 1,
    needs_human: 2,
    called_no_close: 3,
    // ไม่ไปแล้วอยู่ท้ายสุด — ไม่ใช่งานที่ต้องรีบส่งต่อ
    ai_not_going: 4,
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
