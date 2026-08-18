import { bucketOfCall } from '@/lib/callOutcomeBuckets';
import { isFollowOutcome, FOLLOW_OUTCOME_LOST, type FollowOutcome } from '@/lib/followOutcome';

/**
 * ช่องของแต่ละรอบโทรบนหน้า Follow (เจ้าของสั่ง 18 ส.ค. 2569)
 *
 * > *"ต้องเห็นแบบนี้ — ทั้งหมด รอโทร กำลังโทร โทรติด โทรไม่ติด ไป ไม่ไป ·
 * > ต้องเห็นแบบเดียวกันทั้ง 3 รอบ · ต้องกดดูแต่ละช่องได้"*
 *
 * 🔴 **สองแกนคนละเรื่อง อยู่ในแถวเดียวกัน**
 *   · `รอโทร / กำลังโทร / โทรติด / โทรไม่ติด` = **สถานะของสาย** (คิว Lumos)
 *   · `ไป / ไม่ไป` = **ผลปิดงานติดตาม** (095 — คนไปเริ่มงานจริงไหม)
 * คนหนึ่งคนจึงอยู่ได้ทั้ง "โทรติด" และ "ไป" พร้อมกัน — **ช่องพวกนี้ไม่ได้บวกกันเป็นทั้งหมด**
 * ห้ามเอาไปคิดเป็นสัดส่วนของ "ทั้งหมด" หรือคาดว่าบวกแล้วต้องเท่ากัน
 *
 * ⚠️ นับจาก **รายการติดตามชุดเดียวกับที่แสดงชื่อ** — ยอดกับรายชื่อจึงตรงกันเสมอ
 * (เดิมยอดมาจาก funnel ที่นับแถวคิว ทำให้มีเคสยอดไม่ตรงกับชื่อที่กางออกมา)
 *
 * ไฟล์นี้ pure — เทสต์ที่ `tests/api/followRoundBuckets.test.ts`
 */

export type FollowRoundBucket =
  | 'all'
  | 'waiting'
  | 'calling'
  | 'connected'
  | 'unreached'
  | 'went'
  | 'not_went';

/** เรียงตามที่เจ้าของสั่งให้เห็นบนจอ */
export const FOLLOW_ROUND_BUCKETS: readonly FollowRoundBucket[] = [
  'all',
  'waiting',
  'calling',
  'connected',
  'unreached',
  'went',
  'not_went',
];

export const FOLLOW_ROUND_BUCKET_LABEL: Record<FollowRoundBucket, string> = {
  all: 'ทั้งหมด',
  waiting: 'รอโทร',
  calling: 'กำลังโทร',
  connected: 'โทรติด',
  unreached: 'โทรไม่ติด',
  went: 'ไป',
  not_went: 'ไม่ไป',
};

export const FOLLOW_ROUND_BUCKET_HINT: Record<FollowRoundBucket, string> = {
  all: 'ทุกคนที่อยู่รอบนี้',
  waiting: 'ยังไม่ถูกดึงไปโทร',
  calling: 'AI รับไปแล้ว ยังไม่มีผลกลับ',
  connected: 'คุยกับคนได้ (รวมที่ปฏิเสธ)',
  unreached: 'ยกหูไม่ได้/สายไม่ถึงตัว',
  went: 'ปิดงานว่าเสร็จสิ้น — ไปเริ่มงานจริง',
  not_went: 'ปิดงานว่าไม่ไปเริ่มงาน หรือ งานถูกยกเลิก',
};

export type FollowRoundRow = {
  call_status?: string | null;
  call_outcome?: string | null;
  cancelled?: boolean;
  /** ผลปิดงานติดตาม (095) */
  outcome_code?: string | null;
};

/** คนคนนี้อยู่ในช่องนี้ไหม — ช่องซ้อนกันได้โดยตั้งใจ (สองแกน) */
export function inFollowRoundBucket(row: FollowRoundRow, bucket: FollowRoundBucket): boolean {
  if (bucket === 'all') return true;

  if (bucket === 'went' || bucket === 'not_went') {
    const code = row.outcome_code;
    if (!isFollowOutcome(code)) return false;
    const lost = (FOLLOW_OUTCOME_LOST as readonly string[]).includes(code as FollowOutcome);
    // 'ลา' กับ 'อื่น ๆ' ไม่เข้าทั้งสองช่อง — ยังไม่รู้ผลจริง เดาไม่ได้
    if (bucket === 'not_went') return lost;
    return code === 'done';
  }

  const call = bucketOfCall(row.cancelled ? 'cancelled' : row.call_status, row.call_outcome);
  if (bucket === 'connected') return call === 'connected';
  if (bucket === 'unreached') return call === 'unreached';

  // ยังไม่มีผล → แยก "รอโทร" (ยังไม่ถูกดึง) กับ "กำลังโทร" (ดึงไปแล้ว)
  if (call !== 'pending') return false;
  const st = (row.call_status ?? '').trim();
  if (bucket === 'calling') return st === 'delivered';
  // 'รอโทร' รวมสถานะที่ยังไม่ถูกดึงทั้งหมด (pending/ว่าง) — ยกเลิกถูกตัดออกไปแล้วข้างบน
  return st !== 'delivered';
}

/** นับทุกช่องในรอบเดียว — คืนครบทุกคีย์เสมอ (ช่อง 0 ก็ยังต้องโชว์) */
export function countFollowRoundBuckets(
  rows: readonly FollowRoundRow[],
): Record<FollowRoundBucket, number> {
  const out = {} as Record<FollowRoundBucket, number>;
  for (const b of FOLLOW_ROUND_BUCKETS) {
    out[b] = rows.filter((r) => inFollowRoundBucket(r, b)).length;
  }
  return out;
}
