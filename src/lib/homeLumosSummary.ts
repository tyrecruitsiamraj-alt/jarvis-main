/**
 * ═══ สรุปแบบบอท Lumos บนหน้าหลัก (เจ้าของ 7 ต.ค. 2569) ═══
 * เจ้าของส่งรูปบอท "MILO / LUMOS · สะสมเดือนนี้" แล้วสั่ง *"หน้าหลักทำให้มันตอบได้แบบรูปบอทที่ส่งให้"*
 * Choice: *"ฉันแค่อยากให้มันบอกได้แบบที่บอทสรุปมาให้"* · ช่วง = ปฏิทินบนหน้าหลัก · ส่วน = งานติดตาม + งานรับสมัคร + งานเก่า
 *
 * งานติดตาม (เจ้าของ: *"แล้วคนอะ บอกแล้วไงต้องรู้ทั้งคนและ Ai"*) = **ทุกรายชื่อของการ์ด แยก AI โทร / คนโทร** · วัน = วันนัดโทร
 *   ⇒ AI + คน = กล่อง "ทั้งหมด" ของการ์ดพอดี (หน่วยเดียวกัน)
 *   AI: ผลจากคิว Lumos — completed = มีผล · failed = ล้มเหลว · cancelled/ยกเลิกสาย = ยกเลิก · ที่เหลือ = รอ
 *   คน: ผลที่คนลง — ติดต่อไม่ได้ (no_answer) = ล้มเหลว · ผลอื่น = มีผล · ไม่มีผลแต่ยกเลิก = ยกเลิก · ที่เหลือ = รอ
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
  follow: { ai: LumosBucket; staff: LumosBucket } | null;
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
