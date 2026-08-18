import type { FollowEntry } from '@/lib/followApi';

/**
 * **แยกหน้าตามสถานะ + filter ประจำวัน** ของหน้า Follow
 * (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ-6: *"ติดตามสำเร็จ/สิ้นสุด/ยกเลิก แยกหน้ากัน จะได้ดูง่าย"*
 * + *"ปุ่ม Filter เช็คสถานะประจำวัน — วันที่ / เวลา / ชื่อเจ้าของงาน"*)
 *
 * ทำงานระดับ **รอบ (entry)** ไม่ใช่ระดับคน — กรองรอบก่อนแล้วค่อยจับกลุ่มเป็นการ์ด
 * เพราะ "เช็คสถานะประจำวัน" คือดูว่าวันนี้รอบไหนอยู่สถานะอะไร ไม่ใช่ดูตลอดชีพของคน
 */

export type FollowTab = 'active' | 'success' | 'ended' | 'cancelled';

export const FOLLOW_TAB_LABEL: Record<FollowTab, string> = {
  active: 'กำลังตาม',
  success: 'สำเร็จ',
  ended: 'สิ้นสุด',
  cancelled: 'ยกเลิก',
};

export const FOLLOW_TABS: FollowTab[] = ['active', 'success', 'ended', 'cancelled'];

/** ผลปิดงานที่ถือว่า "สำเร็จ" (ไปแล้ว/ถึงแล้ว + เสร็จสิ้นของชุดเก่า) */
const SUCCESS_OUTCOMES = new Set(['went', 'arrived', 'done']);
/** ผลปิดงานที่ถือว่า "ยกเลิก" (งานถูกยกเลิก — คู่กับ entry.cancelled ที่ตัดสายทิ้งก่อนถึงวัน) */
const CANCELLED_OUTCOMES = new Set(['cancelled', 'job_cancelled']);

/**
 * รอบนี้อยู่แท็บไหน — **รอบเดียวอยู่ได้แท็บเดียวเสมอ** (ไม่มีทางซ้ำ)
 *
 * ลำดับการตัดสิน:
 * 1. `cancelled` (ตัดสายทิ้งก่อนถึงวัน) → ยกเลิก · เช็คก่อนสุดเพราะ server กันไม่ให้
 *    รายการที่ยกเลิกไปปิดงานได้อยู่แล้ว
 * 2. ปิดงานแล้ว (`completed_at` + `outcome_code`):
 *    - ผลยกเลิกงาน → ยกเลิก · ผลสำเร็จ → สำเร็จ · ที่เหลือ (ลา/เลื่อน/ไม่ไป/อื่นๆ) → สิ้นสุด
 * 3. ที่เหลือ = ยังไม่ปิด ยังไม่ยกเลิก → กำลังตาม
 */
export function followLifecycleTab(e: FollowEntry): FollowTab {
  if (e.cancelled) return 'cancelled';
  if (e.completed_at && e.outcome_code) {
    if (CANCELLED_OUTCOMES.has(e.outcome_code)) return 'cancelled';
    if (SUCCESS_OUTCOMES.has(e.outcome_code)) return 'success';
    return 'ended';
  }
  if (e.completed_at) return 'ended'; // ปิดงานแต่ไม่มีผล (ไม่ควรเกิด แต่กันไว้ ไม่ให้ตกไปกำลังตาม)
  return 'active';
}

export type TimeBand = '' | 'morning' | 'afternoon' | 'evening';

export const TIME_BAND_LABEL: Record<Exclude<TimeBand, ''>, string> = {
  morning: 'เช้า (06:00–12:00)',
  afternoon: 'บ่าย (12:00–17:00)',
  evening: 'เย็น (17:00–20:00)',
};

/** ชั่วโมงของช่วงเวลา (เวลาไทย) — ปลายเปิด [from, to) */
const BAND_RANGE: Record<Exclude<TimeBand, ''>, [number, number]> = {
  morning: [6, 12],
  afternoon: [12, 17],
  evening: [17, 20],
};

/** ชั่วโมงเวลาไทยของ ISO — null = อ่านไม่ได้ */
function bangkokHour(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // en-GB ให้ 24 ชม. · ใช้ hour อย่างเดียวพอ
  const hh = d.toLocaleString('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', hour12: false });
  const n = Number(hh);
  return Number.isFinite(n) ? n % 24 : null;
}

/** วันเวลาไทย (YYYY-MM-DD) ของ ISO */
function bangkokDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
}

export function inTimeBand(iso: string | null | undefined, band: TimeBand): boolean {
  if (!band) return true;
  const h = bangkokHour(iso);
  if (h == null) return false;
  const [from, to] = BAND_RANGE[band];
  return h >= from && h < to;
}

export type FollowFilter = {
  tab: FollowTab;
  /** YYYY-MM-DD · '' = ทุกวัน */
  date: string;
  band: TimeBand;
  /** ชื่อเจ้าของงาน (created_by_name) · '' = ทุกคน */
  owner: string;
};

/** กรองรอบด้วยแท็บ + วันที่ + ช่วงเวลา + เจ้าของงาน (ทุกเงื่อนไข AND กัน) */
export function filterFollowEntries(entries: FollowEntry[], f: FollowFilter): FollowEntry[] {
  return entries.filter((e) => {
    if (followLifecycleTab(e) !== f.tab) return false;
    if (f.date && bangkokDay(e.scheduled_at) !== f.date) return false;
    if (f.band && !inTimeBand(e.scheduled_at, f.band)) return false;
    if (f.owner && (e.created_by_name ?? '') !== f.owner) return false;
    return true;
  });
}

/** จำนวนรอบในแต่ละแท็บ — ป้ายบนแท็บ ( นับ "รอบ" ไม่ใช่ "คน") */
export function countFollowTabs(entries: FollowEntry[]): Record<FollowTab, number> {
  const out: Record<FollowTab, number> = { active: 0, success: 0, ended: 0, cancelled: 0 };
  for (const e of entries) out[followLifecycleTab(e)] += 1;
  return out;
}

/** รายชื่อเจ้าของงานที่มีอยู่จริง (created_by_name) เรียง ก-ฮ — สำหรับ dropdown filter */
export function listFollowOwners(entries: FollowEntry[]): string[] {
  const set = new Set<string>();
  for (const e of entries) {
    const name = (e.created_by_name ?? '').trim();
    if (name) set.add(name);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'th'));
}
