import type { CallHoldSource } from '@/lib/callHoldsApi';
import type { ProposalSource } from '@/lib/candidateProposalsApi';

/**
 * "โทรแล้วสนใจ → จองตัวเลย" — ตรรกะล้วนของปุ่มจองที่ต่อท้ายผลโทร
 *
 * ทำไมต้องมีไฟล์นี้: หลังถอดปุ่มจอง/เสนอ/ลงงานออกจาก drawer หน้า Matching (รอบแปด)
 * **การจองฝั่ง iRecruit ไม่มีปุ่มเหลือเลย** ทั้งที่ `CALL_RESULT_DESTINATION.confirmed`
 * บอกผู้ใช้ว่า "เข้าเส้นจองตัว" และชิปบนการ์ดพูดว่า "มีคนสนใจ N — กดจองตัวเลย"
 * (`src/lib/matchingCardAction.ts`) — คำสัญญาที่ไม่มีปลายทาง
 *
 * ปุ่มจองโผล่ 2 ที่ที่คนเห็นผล "สนใจ" จริง ๆ: กล่อง "สนใจงาน" ใน dialog ผลจากการโทร
 * บนหน้าหลัก · แถวที่เพิ่งกดผล "สนใจ" ในถังโทรของฉัน — ตรรกะจึงต้องอยู่ที่เดียว
 *
 * ⚠️ กติกาเดียวกับ `lumosSendActions.ts`: **จะปิดปุ่มต้องมีเหตุผลให้ผู้ใช้อ่านเสมอ**
 * (invariant `disabled === (reason !== null)` · มีเทสต์บังคับ)
 */

/** ใครจะถูกจอง — คีย์คู่ (source, ref) ชุดเดียวกับตาราง `candidate_proposals` */
export type BookingTarget = { source: ProposalSource; candidateRef: string };

/**
 * `person_ref` ของคิว Lumos → เป้าหมายการจอง
 *
 * ⚠️ ต้องตรงกับ `splitPersonRef()` ใน `api/_lib/callFollowup.ts` เป๊ะ —
 * `card-` = ผู้สมัครในบอร์ดของเรา · `ir-` = iRecruit · `follow-` = รายชื่อที่คนกรอกเอง
 * ที่หน้า Follow ซึ่ง **ไม่ใช่ผู้สมัครในระบบ** จึงจองไม่ได้ (คืน null)
 */
export function bookingTargetFromPersonRef(personRef: string): BookingTarget | null {
  const ref = personRef.trim();
  if (ref.startsWith('card-')) {
    const id = ref.slice(5).trim();
    return id ? { source: 'board', candidateRef: id } : null;
  }
  if (ref.startsWith('ir-')) {
    const id = ref.slice(3).trim();
    return id ? { source: 'irecruit', candidateRef: id } : null;
  }
  return null;
}

/**
 * ล็อกโทร (`CallHold`) → เป้าหมายการจอง
 *
 * ⚠️ `application` (ใบสมัครที่ดึงเข้าถังโทรจากมุมมองรายชื่อ) **จองไม่ได้** —
 * `candidate_proposals.source` รับแค่ `board` / `irecruit` และ ref ของใบสมัคร
 * เป็นคนละชุดกับ `card_id` ของบอร์ด · ยัดลงไปจะได้แถวจองที่ชี้ไปหาคนผิด
 */
export function bookingTargetFromHold(
  source: CallHoldSource,
  candidateRef: string,
): BookingTarget | null {
  const ref = candidateRef.trim();
  if (!ref) return null;
  if (source === 'board') return { source: 'board', candidateRef: ref };
  if (source === 'irecruit') return { source: 'irecruit', candidateRef: ref };
  return null;
}

/** สถานะปุ่มจอง — `disabled` จริงเมื่อไหร่ต้องมี `reason` เสมอ (มีเทสต์บังคับ) */
export type BookingAction = { disabled: boolean; reason: string | null };

const OK: BookingAction = { disabled: false, reason: null };

/**
 * ปุ่ม "จองตัวเลย" กดได้ไหม + ถ้าไม่ได้เพราะอะไร
 *
 * `alreadyBooked` = จองคนนี้ให้ใบนี้ไปแล้วในรอบนี้ (กันกดซ้ำจนได้ 409 จาก backend
 * ซึ่งเป็นข้อความคนละเรื่อง — 409 ของ backend แปลว่า "ติดจองอยู่กับ**ใบอื่น**")
 */
export function bookingActionFor(input: {
  target: BookingTarget | null;
  jobId: string | null | undefined;
  /** `person_ref` ของคิว Lumos (ถ้ามา) — ใช้บอกเหตุผลให้ตรงกรณี ไม่ใช่ข้อความกลาง ๆ */
  personRef?: string;
  /** ต้นทางของล็อกโทร (ถ้ามา) — เหตุผลของ `application` ต่างจาก "ไม่รู้จักต้นทาง" */
  holdSource?: CallHoldSource;
  alreadyBooked?: boolean;
  busy?: boolean;
}): BookingAction {
  if (input.alreadyBooked) return { disabled: true, reason: 'จองตัวไว้แล้ว' };
  if (input.busy) return { disabled: true, reason: 'กำลังบันทึก…' };
  if (!input.jobId || !input.jobId.trim()) {
    return { disabled: true, reason: 'ไม่รู้ว่าจะจองให้ใบขอไหน' };
  }
  if (!input.target) {
    if (input.personRef && input.personRef.startsWith('follow-')) {
      return { disabled: true, reason: 'รายชื่อจากหน้า Follow ยังไม่ใช่ผู้สมัครในระบบ จองตัวไม่ได้' };
    }
    if (input.holdSource === 'application') {
      return { disabled: true, reason: 'ใบสมัครจากบอร์ดรับสมัคร ยังไม่มีเส้นจองตัว' };
    }
    return { disabled: true, reason: 'ไม่รู้ว่าคนนี้เป็นผู้สมัครจากที่ไหน จองตัวไม่ได้' };
  }
  return OK;
}
