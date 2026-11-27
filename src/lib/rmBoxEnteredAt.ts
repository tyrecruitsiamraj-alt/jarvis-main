/**
 * ═══ ชื่อนี้เข้ากล่องที่อยู่ตอนนี้เมื่อไหร่ (เจ้าของ 27 พ.ย. 2569 "บอกให้หน่อยได้ไหมว่า มากล่องนี้วันไหน" · Choice แบบ ข คอลัมน์กดเรียงได้) ═══
 * ระบบไม่ได้จดการย้ายกล่องไว้ ⇒ ใช้เวลาของเหตุการณ์ที่ทำให้ชื่ออยู่กล่องนั้น (กล่องตัดสินที่ `rmShownViewOf` ที่เดียว):
 *   ไม่โทร = กดไม่โทร · ไม่มาตามนัด/ไม่ผ่าน = ลงผลนัด · สนใจ/ไม่สนใจ = คำตอบที่ใหม่กว่า (ผลโทร AI หรือผลติดต่อของคน)
 *   ไม่รับสาย/คุยแล้วไม่ได้คำตอบ/ยกเลิกสาย = ผลโทรล่าสุด · รอโทร = ส่งให้ AI · เก็บไปโทรเอง = กดเก็บ
 *   ส่ง AI ไม่ได้ (เหตุที่ตัวส่งจด) = เวลาที่จด · ที่เหลือ = ชื่อเข้าระบบ
 * ชื่อที่ระบบปล่อยกลับมาจากคนที่เก็บ (`unclaimed_at` · ป้าย "ปล่อยจาก …") = เวลาที่ปล่อย ถ้าใหม่กว่า (อินทัช: AI สนใจ 3 พ.ย. แต่กลับมา 27 พ.ย. 08:56)
 * pure — เทสต์ `tests/api/rmBoxEnteredAt2569-11-27.test.ts`
 */
import type { PublicApplication } from '@/lib/publicApplicationsApi';
import { isNoCallView } from '@/lib/applicantNoCall';
import { rmShownViewOf, type RmBoxView } from '@/lib/recruitRm';

export type BoxEntered = { at: string | null; released: boolean };

const ms = (iso: string | null | undefined): number => {
  if (!iso) return -1;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? -1 : t;
};

function eventAt(r: PublicApplication, view: RmBoxView): string | null {
  if (r.no_call_reason_id != null || isNoCallView(view)) return r.no_call_at ?? null;
  switch (view) {
    case 'appt_failed':
      return r.attendance_at ?? null;
    case 'interested':
    case 'declined': {
      // สัญญาณที่ใหม่กว่าชนะ (กติกาเดียวกับ `isInterestedApplicant`) — เวลาเท่ากัน/ไม่มีเวลา ผลติดต่อชนะ
      const hasContact = typeof r.last_contact_ok === 'boolean';
      const hasCall = Boolean(r.last_call_outcome);
      if (hasContact && (!hasCall || ms(r.last_contact_at) >= ms(r.last_call_at))) return r.last_contact_at ?? null;
      return r.last_call_at ?? r.ai_answer?.at ?? null;
    }
    case 'ai_waiting':
      return r.last_call_sent_at ?? null;
    case 'ai_cancelled':
    case 'no_pickup':
    case 'ai_talked':
      return r.last_call_at ?? r.ai_answer?.at ?? null;
    case 'kept':
      return r.claimed_at ?? r.call_choice_at ?? null;
    default:
      return r.ai_block_reason ? (r.ai_block_at ?? null) : null;
  }
}

export function rmBoxEnteredAt(r: PublicApplication, view: RmBoxView = rmShownViewOf(r)): BoxEntered {
  const base = eventAt(r, view) ?? r.created_at ?? null;
  // ปล่อยกลับมา = เข้ากล่องใหม่ตอนปล่อย (ยกเว้นกล่องเก็บไปโทรเอง — มีคนเก็บใหม่แล้ว เวลาเก็บใหม่กว่าอยู่แล้ว)
  if (view !== 'kept' && r.unclaimed_at && ms(r.unclaimed_at) > ms(base)) return { at: r.unclaimed_at, released: true };
  return { at: base, released: false };
}

/** เรียงตามเวลาเข้ากล่อง — ใหม่สุดก่อน (desc) / เก่าสุดก่อน (asc) · ไม่มีเวลาไปท้ายเสมอ · เวลาเท่ากันคงลำดับเดิม */
export function sortByBoxEntered<T extends PublicApplication>(rows: readonly T[], dir: 'desc' | 'asc'): T[] {
  const keyed = rows.map((r, i) => ({ r, i, t: ms(rmBoxEnteredAt(r).at) }));
  keyed.sort((a, b) => {
    if (a.t < 0 || b.t < 0) return a.t < 0 && b.t < 0 ? a.i - b.i : a.t < 0 ? 1 : -1;
    return (dir === 'desc' ? b.t - a.t : a.t - b.t) || a.i - b.i;
  });
  return keyed.map((k) => k.r);
}
