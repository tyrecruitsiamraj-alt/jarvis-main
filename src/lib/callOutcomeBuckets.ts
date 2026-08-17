/**
 * ถังผลโทร — นิยามกลางที่ฝั่ง API และหน้าเว็บต้องใช้ตัวเดียวกัน
 *
 * ทำไมต้องแยกมาไว้ที่เดียว: แผง "งาน Follow" บนหน้าหลักโชว์**ยอด**จาก funnel (นับใน SQL)
 * แต่ตอนกดดูรายชื่อต้องจัดกลุ่ม**รายคน**ฝั่งหน้าเว็บ ถ้าสองฝั่งเขียนเงื่อนไขแยกกัน
 * วันหนึ่งจะกลายเป็น "ยอดบอก 5 แต่กดเข้าไปเห็น 3" โดยไม่มีอะไรเตือน
 *
 * ⚠️ `declined` (ปฏิเสธ) อยู่ในถัง **โทรติด** โดยตั้งใจ — คุยกับคนได้แล้วถือว่าติดต่อถึงตัว
 * คนละเรื่องกับ "โทรไม่ติด" · เปลี่ยนตรงนี้เมื่อไหร่ ตัวเลขทุกหน้าขยับพร้อมกัน
 */

/** คุยกับคนได้แล้ว (รวมที่ปฏิเสธ) */
export const CONNECTED_CALL_OUTCOMES = [
  'confirmed',
  'acknowledged',
  'declined',
  'reschedule_requested',
] as const;

/** ยกหูไม่ได้/สายไม่ถึงตัว */
export const UNREACHED_CALL_OUTCOMES = ['no_answer', 'busy', 'unresponsive', 'failed'] as const;

export type CallBucket = 'connected' | 'unreached' | 'cancelled' | 'pending';

export const CALL_BUCKET_LABEL: Record<CallBucket, string> = {
  connected: 'โทรติด',
  unreached: 'ไม่ติด',
  cancelled: 'ยกเลิก',
  pending: 'รอโทร',
};

/**
 * คนคนนี้อยู่ถังไหนของรอบนั้น
 *
 * ลำดับการตัดสินต้องเหมือนฝั่ง SQL เป๊ะ: **ยกเลิกมาก่อนเสมอ** แล้วค่อยดูผล
 * (เดิมแถวที่ยกเลิกตกไปอยู่ "รอโทร" ทำให้ยอดรอโทรโป่งด้วยแถวที่ตายแล้ว)
 */
export function bucketOfCall(status: string | null | undefined, outcome: string | null | undefined): CallBucket {
  const st = (status ?? '').trim();
  const out = (outcome ?? '').trim();
  if (st === 'cancelled' || out === 'cancelled') return 'cancelled';
  if (out) {
    if ((CONNECTED_CALL_OUTCOMES as readonly string[]).includes(out)) return 'connected';
    if ((UNREACHED_CALL_OUTCOMES as readonly string[]).includes(out)) return 'unreached';
    // ผลที่ไม่รู้จัก = ยังไม่ตัดสิน ดีกว่าเดาให้ตกถังใดถังหนึ่ง
    return 'pending';
  }
  return 'pending';
}

/**
 * รอบที่โทร — เกิน 3 รวบเป็น 3 (เพดานเริ่มต้นคือ 3 ครั้ง) · ไม่มีค่า = รอบ 1
 * กติกาเดียวกับ `least(greatest(coalesce(attempt_count,1),1),3)` ฝั่ง SQL
 */
export function callAttemptSlot(attempt: number | null | undefined): 1 | 2 | 3 {
  const n = Math.trunc(Number(attempt));
  if (!Number.isFinite(n) || n < 1) return 1;
  return (n > 3 ? 3 : n) as 1 | 2 | 3;
}
