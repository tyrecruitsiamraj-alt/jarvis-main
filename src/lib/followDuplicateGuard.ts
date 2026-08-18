import type { FollowEntry } from '@/lib/followApi';

/**
 * **เตือนก่อนลงรายการติดตามซ้ำ** (เจ้าของสั่ง 18 ส.ค. 2569:
 * *"popup เตือนว่าลงซ้ำ เช่น นายคนนี้ลงวันเวลาเดิมเลยก็เด้งเตือนเลยว่าซ้ำ"*)
 *
 * ซ้ำ = **เบอร์เดียวกัน + เวลาเดียวกัน (ระดับนาที)** กับรายการเดิมที่ยังไม่ถูกยกเลิก
 * — ชื่ออาจสะกดต่างกันได้ (มี/ไม่มีคำนำหน้า) เบอร์คือตัวระบุคนจริง
 *
 * 🔴 **เทียบเบอร์ด้วยเลข 9 ตัวท้าย** — ฟอร์มกรอก `0812345678` แต่ฐานเก็บ E.164
 * `+66812345678` เทียบตรง ๆ ไม่มีวันเจอกัน (ตัวเลข 9 ตัวท้ายคือส่วนที่ตรงกันของสองรูปแบบ)
 *
 * 🔴 **รายการที่ยกเลิกแล้วไม่นับเป็นซ้ำ** — คนยกเลิกไปเพราะจะตั้งใหม่ ถ้ายังเตือนอยู่
 * จะตั้งใหม่ไม่ได้เลย · แต่รายการที่**ปิดงานแล้ว** (completed) ยังนับ เพราะโทรไปแล้วจริง
 * ตั้งซ้ำเวลาเดิม = โทรซ้อนเรื่องที่จบไปแล้ว
 */

export type DuplicateRound = {
  /** เวลา (ISO) ที่ชนกับของเดิม */
  iso: string;
  /** ชื่อบนรายการเดิม — ให้ popup บอกว่าไปชนกับใคร */
  existingName: string;
  existingId: string;
};

export type DuplicateCheck = {
  /** รอบที่ชนกับรายการเดิม */
  duplicates: DuplicateRound[];
  /** รอบที่ไม่ชน — ใช้ปุ่ม "บันทึกเฉพาะที่ไม่ซ้ำ" */
  freshIso: string[];
};

/** เลข 9 ตัวท้ายของเบอร์ — ส่วนที่ตรงกันระหว่าง 08x… กับ +668x… */
export function phoneKey(phone?: string | null): string | null {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length < 9) return null;
  return digits.slice(-9);
}

/** ตัดวินาทีทิ้ง — คนตั้งเวลาเป็นนาที เทียบละเอียดกว่านั้นคือไม่มีวันซ้ำ */
function minuteKey(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setSeconds(0, 0);
  return d.toISOString();
}

/**
 * @param phone   เบอร์ที่กำลังจะลง (รูปแบบไหนก็ได้)
 * @param isoTimes รอบเวลาที่กำลังจะลง (ISO)
 * @param entries รายการติดตามทั้งหมดที่โหลดไว้แล้ว
 */
export function findScheduleDuplicates(
  phone: string,
  isoTimes: string[],
  entries: FollowEntry[],
): DuplicateCheck {
  const key = phoneKey(phone);
  const existing = new Map<string, FollowEntry>();
  if (key) {
    for (const e of entries) {
      if (e.cancelled) continue;
      if (phoneKey(e.recipient_phone) !== key) continue;
      const mk = minuteKey(e.scheduled_at);
      if (mk && !existing.has(mk)) existing.set(mk, e);
    }
  }

  const duplicates: DuplicateRound[] = [];
  const freshIso: string[] = [];
  const seen = new Set<string>();
  for (const iso of isoTimes) {
    const mk = minuteKey(iso);
    if (!mk || seen.has(mk)) continue; // เวลาพัง/ซ้ำกันเองในชุด — ตัดทิ้ง (มีด่านอื่นคุมอยู่แล้ว)
    seen.add(mk);
    const hit = existing.get(mk);
    if (hit) {
      duplicates.push({ iso: mk, existingName: hit.recipient_name, existingId: hit.id });
    } else {
      freshIso.push(mk);
    }
  }
  return { duplicates, freshIso };
}
