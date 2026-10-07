/**
 * ═══ สรุปแบบบอท Lumos บนหน้าหลัก (เจ้าของ 7 ต.ค. 2569) ═══
 * เจ้าของส่งรูปบอท "MILO / LUMOS · สะสมเดือนนี้" แล้วสั่ง *"หน้าหลักทำให้มันตอบได้แบบรูปบอทที่ส่งให้"*
 * Choice: *"ฉันแค่อยากให้มันบอกได้แบบที่บอทสรุปมาให้"* · ช่วง = ปฏิทินบนหน้าหลัก · ส่วน = งานติดตาม + งานรับสมัคร + งานเก่า
 *
 * งานติดตาม (เจ้าของ: *"แล้วคนอะ บอกแล้วไงต้องรู้ทั้งคนและ Ai"*) = **ทุกรายชื่อของการ์ด แยก AI โทร / คนโทร** · วัน = วันนัดโทร
 *   ⇒ AI + คน = กล่อง "ทั้งหมด" ของการ์ดพอดี (หน่วยเดียวกัน)
 *   AI: ผลจากคิว Lumos — completed = มีผล · failed = ล้มเหลว · cancelled/ยกเลิกสาย = ยกเลิก · ที่เหลือ = รอ
 *   คน: ผลที่คนลง — ติดต่อไม่ได้ (no_answer) = ล้มเหลว · ผลอื่น = มีผล · ไม่มีผลแต่ยกเลิก = ยกเลิก · ที่เหลือ = รอ
 *   มีผล แตกเป็น ไป / ไม่ไป / ขอเลื่อน / สรุปไม่ได้ (เจ้าของ "แตกเลย") ด้วยหมวดของหน้าติดตาม (`categorizeFollowRows`)
 *   — มีผลแต่สายถูกยกเลิกทีหลัง = ยกเลิก · มีผลแต่หน้าติดตามนับไม่รับสาย = ล้มเหลว (ลาป่วยที่หน้าติดตามนับสรุปไม่ได้ = คงเดิม · เจ้าของ Choice)
 * งานรับสมัคร = นับ "งานที่ส่งให้ AI" จากคิว (`lumos_dispatch_queue`) แบบที่บอทนับ
 *   งานรับสมัคร = คิว interview · วัน = วันที่เข้าคิว
 *   งานเก่า = คิว interview ที่เข้าก่อนช่วงนี้และยังรออยู่
 * ช่อง: มีผล (completed) · รอ (pending/delivered/อื่น ๆ) · ล้มเหลว (failed) · ยกเลิก (cancelled) ⇒ รวมทุกช่อง = ทั้งหมดเสมอ
 * (บอทไม่มีช่องยกเลิก — ของเราแยกให้เห็น เลขจะได้บวกกันลง)
 */
export type LumosBucket = { total: number; done: number; waiting: number; failed: number; cancelled: number };

export type HomeLumosSummaryResponse = {
  generated_at: string;
  from: string | null;
  to: string | null;
  bu: string | null;
  follow: { ai: FollowBucket; staff: FollowBucket } | null;
  applicants: LumosBucket | null;
  /** ใบสมัครก่อนช่วงนี้ที่ยังรอ AI */
  backlog: number | null;
  error: string | null;
};

export const lumosBucketAddsUp = (b: LumosBucket) => b.done + b.waiting + b.failed + b.cancelled === b.total;

export const emptyLumosBucket = (): LumosBucket => ({ total: 0, done: 0, waiting: 0, failed: 0, cancelled: 0 });

export const sumLumosBuckets = (a: LumosBucket, b: LumosBucket): LumosBucket => ({
  total: a.total + b.total,
  done: a.done + b.done,
  waiting: a.waiting + b.waiting,
  failed: a.failed + b.failed,
  cancelled: a.cancelled + b.cancelled,
});

/** งานติดตาม — ช่องแยกกันขาด · รวมทุกช่อง = ทั้งหมด */
export type FollowBucket = {
  total: number;
  went: number;
  notWent: number;
  reschedule: number;
  unclear: number;
  waiting: number;
  failed: number;
  cancelled: number;
};
export const FOLLOW_BUCKET_KEYS = ['went', 'notWent', 'reschedule', 'unclear', 'waiting', 'failed', 'cancelled'] as const;
export type FollowBucketKey = (typeof FOLLOW_BUCKET_KEYS)[number];
export const emptyFollowBucket = (): FollowBucket => ({
  total: 0,
  went: 0,
  notWent: 0,
  reschedule: 0,
  unclear: 0,
  waiting: 0,
  failed: 0,
  cancelled: 0,
});
export const followBucketSum = (b: FollowBucket) => FOLLOW_BUCKET_KEYS.reduce((n, k) => n + b[k], 0);
export const followBucketAddsUp = (b: FollowBucket) => followBucketSum(b) === b.total;
export const sumFollowBuckets = (a: FollowBucket, b: FollowBucket): FollowBucket => {
  const out = emptyFollowBucket();
  out.total = a.total + b.total;
  for (const k of FOLLOW_BUCKET_KEYS) out[k] = a[k] + b[k];
  return out;
};

/**
 * ช่องของสายที่ "มีผล" (ขั้นแรกตัดด้วยผลคิว/ผลที่คนลง) → แตกด้วยหมวดของหน้าติดตาม
 * `result` = ผลของหน้าติดตาม (`journeyResultOf`) — ไป / ไม่ไป / ขอเลื่อน / สรุปไม่ได้ / ไม่รับสาย / ยกเลิก / รอโทร
 */
export function doneBucketOf(result: string): FollowBucketKey {
  switch (result) {
    case 'agreed':
      return 'went';
    case 'lost':
      return 'notWent';
    case 'reschedule':
      return 'reschedule';
    case 'unreachable':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'unclear';
  }
}
