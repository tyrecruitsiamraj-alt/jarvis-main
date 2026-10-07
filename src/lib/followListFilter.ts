import type { FollowEntry } from '@/lib/followApi';
import { followGroupKey } from '@/lib/followGrouping';
import { FOLLOW_OUTCOME_SUCCESS } from '@/lib/followOutcome';
import { inFollowRoundBucket } from '@/lib/followRoundBuckets';
import { replaceWorkYmd } from '@/lib/irecruitReplaceSync';

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

/**
 * ผลปิดงานที่ถือว่า "สำเร็จ" — ⚠️ นิยามอยู่ที่ `followOutcome.ts` **ที่เดียว**
 * (เดิมประกาศซ้ำที่นี่ แล้วอีกที่ (`followRoundBuckets`) เขียนไม่ตรงกัน = เลขช่อง "ไป" เพี้ยน)
 */
const SUCCESS_OUTCOMES = new Set<string>(FOLLOW_OUTCOME_SUCCESS);
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

export type TimeBand = '' | 'morning' | 'afternoon' | 'evening' | 'night';

export const TIME_BAND_LABEL: Record<Exclude<TimeBand, ''>, string> = {
  morning: 'เช้า (06:00–12:00)',
  afternoon: 'บ่าย (12:00–17:00)',
  evening: 'เย็น (17:00–20:00)',
  // ยกเลิกช่วงห้ามโทรแล้ว (28 ก.ย. 2569) มีสายจริงตี 2–5 ⇒ ต้องกรองช่วงนี้ได้ (QA 5 ต.ค. 2569)
  night: 'กลางคืน (20:00–06:00)',
};

/** ชั่วโมงของช่วงเวลา (เวลาไทย) — ปลายเปิด [from, to) */
const BAND_RANGE: Record<Exclude<TimeBand, ''>, [number, number]> = {
  morning: [6, 12],
  afternoon: [12, 17],
  evening: [17, 20],
  night: [20, 30], // ข้ามเที่ยงคืน — ดู inBand
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
  // ช่วงข้ามเที่ยงคืน (กลางคืน 20–06): ชั่วโมง 0–5 นับเป็น 24–29
  const hh = to > 24 && h < to - 24 ? h + 24 : h;
  return hh >= from && hh < to;
}

export type FollowFilter = {
  /**
   * งานจบหรือยัง · ไม่ส่ง = ทุกสถานะ (หน้าติดตามไม่ส่งแล้ว — 3 ต.ค. 2569 เจ้าของถอดตัวเลือกนี้
   * และสายที่ปิดงาน/ยกเลิกต้องยังเห็นในตารางของวันนั้น ไม่ใช่หายเหลือ "ไม่มีสายที่ต้องตาม")
   */
  tab?: FollowTab;
  /** YYYY-MM-DD · '' = ทุกวัน */
  date: string;
  band: TimeBand;
  /**
   * **ใครเพิ่ม** (created_by_name) · `''`/ไม่ส่ง = ทุกคน · `FOLLOW_ADDER_NONE` = ไม่มีชื่อคนเพิ่ม
   * กลับมาอยู่บนจอ 5 ต.ค. 2569 (เจ้าของ: *"Filter ดูได้ว่ารายชื่อที่เพิ่มไปใครเพิ่ม เพราะคนเพิ่มอยากดูแค่งานตัวเอง"*)
   */
  owner?: string;
  /** ใครโทร (เจ้าของสั่ง 2 ต.ค. 2569 "เพิ่ม filter ดึงรายชื่อเจ้าหน้าที่โทรเอง") · ไม่ส่ง/'all' = ทั้งหมด */
  caller?: FollowCaller;
  /**
   * เจ้าของงาน = **เจ้าหน้าที่ที่ติดตาม** (`staff_phone` · เจ้าของ Choice 4 ต.ค. 2569: *"เพิ่ม filter เลือกชื่อเจ้าของงาน
   * เพื่อดูรายชื่อที่ลงแผนแล้วทั้งหมด"*) · `''`/ไม่ส่ง = ทุกคน · `FOLLOW_STAFF_NONE` = ไม่ได้ระบุเจ้าหน้าที่
   */
  staff?: string;
  /** ชื่อของเบอร์เจ้าหน้าที่ (สมุดเบอร์) — ใช้จับกลุ่มเจ้าของงานด้วยชื่อ · ไม่ส่ง = จับด้วยเบอร์อย่างเดียว */
  staffNameOf?: (phone: string) => string | null;
};

export const FOLLOW_STAFF_NONE = '__none__';
export const FOLLOW_ADDER_NONE = '__none__';

/** ชื่อสั้นของคนเพิ่ม — เก็บเป็นอีเมล ตัดโดเมนออก (kunthida.b@siamraj.com → kunthida.b) */
export function followAdderLabel(name: string | null | undefined): string {
  const n = (name ?? '').trim();
  if (!n) return 'ไม่ระบุคนเพิ่ม';
  return n.includes('@') ? n.slice(0, n.indexOf('@')) : n;
}

/** ตัวเลือก "ใครเพิ่ม" + จำนวน — เรียงชื่อ · ไม่ระบุไว้ท้าย */
export function followAdderOptions(entries: readonly FollowEntry[]): Array<{ value: string; label: string; count: number }> {
  const count = new Map<string, number>();
  for (const e of entries) {
    const k = (e.created_by_name ?? '').trim() || FOLLOW_ADDER_NONE;
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  return [...count.entries()]
    .map(([value, n]) => ({ value, label: value === FOLLOW_ADDER_NONE ? 'ไม่ระบุคนเพิ่ม' : followAdderLabel(value), count: n }))
    .sort((a, b) => {
      if (a.value === FOLLOW_ADDER_NONE) return 1;
      if (b.value === FOLLOW_ADDER_NONE) return -1;
      return a.label.localeCompare(b.label, 'th');
    });
}

/** รายการนี้ตรงตัวกรอง "ใครเพิ่ม" ไหม */
export function matchesFollowAdder(e: Pick<FollowEntry, 'created_by_name'>, owner: string): boolean {
  const v = (e.created_by_name ?? '').trim();
  return owner === FOLLOW_ADDER_NONE ? v === '' : v.toLowerCase() === owner.trim().toLowerCase();
}

/** คีย์เบอร์เจ้าหน้าที่ของรายการ — ตัดช่องว่าง/ขีด · +66 = 0 (เบอร์เดียวกันพิมพ์ต่างรูปต้องเป็นคนเดียวกัน) */
export function followStaffKey(e: Pick<FollowEntry, 'staff_phone'>): string {
  let d = (e.staff_phone ?? '').replace(/[^\d+]/g, '');
  if (d.startsWith('+66')) d = `0${d.slice(3)}`;
  else if (d.startsWith('66') && d.length === 11) d = `0${d.slice(2)}`;
  return d || FOLLOW_STAFF_NONE;
}

/**
 * คีย์กลุ่มของตัวกรองเจ้าของงาน — **ชื่อก่อน** (คนเดียวมีหลายเบอร์ในรายการเก่าได้ — วัดจริง 4 ต.ค. 2569 "กุ้งนาง" ขึ้นสองแถว)
 * หาชื่อไม่เจอ = เบอร์ · ไม่ระบุ = `FOLLOW_STAFF_NONE`
 */
export function followStaffGroupKey(e: Pick<FollowEntry, 'staff_phone'>, nameOf: (phone: string) => string | null): string {
  const phone = followStaffKey(e);
  if (phone === FOLLOW_STAFF_NONE) return phone;
  const name = nameOf(phone)?.trim();
  return name ? `name:${name}` : phone;
}

export function followStaffOptions(
  entries: readonly FollowEntry[],
  nameOf: (phone: string) => string | null,
): Array<{ value: string; label: string; count: number }> {
  const count = new Map<string, number>();
  for (const e of entries) {
    const k = followStaffGroupKey(e, nameOf);
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  const out = [...count.entries()].map(([value, n]) => ({
    value,
    label: value === FOLLOW_STAFF_NONE ? 'ไม่ระบุเจ้าหน้าที่' : value.startsWith('name:') ? value.slice(5) : value,
    count: n,
  }));
  return out.sort((a, b) => {
    if (a.value === FOLLOW_STAFF_NONE) return 1;
    if (b.value === FOLLOW_STAFF_NONE) return -1;
    return a.label.localeCompare(b.label, 'th');
  });
}

/**
 * ตัวกรอง "ใครโทร" — แถวเก่าที่ไม่มี call_mode = AI โทร (ค่าเดียวกับที่เส้นหลังบ้านเติม)
 * `tbd` (134) = สายที่ยังไม่กำหนดเวลา — เป็นคนโทรอยู่แล้ว แต่ต้องมีกองให้ไล่เติมเวลา (Journey ข้อ 5)
 */
export type FollowCaller = 'all' | 'ai' | 'manual' | 'tbd';
export const FOLLOW_CALLERS: readonly FollowCaller[] = ['all', 'ai', 'manual', 'tbd'];
export const FOLLOW_CALLER_LABEL: Record<FollowCaller, string> = {
  all: 'ทั้งหมด',
  ai: 'AI โทร',
  manual: 'คนโทร',
  // คำเดียวกับฟอร์มเพิ่มคน (เจ้าของ 5 ต.ค. 2569 ถามหาตัวกรอง "ยังไม่ชัวร์เวลา" — มีอยู่แล้วแต่คนละคำ)
  tbd: 'ยังไม่ชัวร์เวลา',
};

export function followCallerOf(e: Pick<FollowEntry, 'call_mode'>): 'ai' | 'manual' {
  return e.call_mode === 'manual' ? 'manual' : 'ai';
}

/** จำนวน **สาย** ต่อ "ใครโทร" ในแท็บที่เปิดอยู่ (ป้ายบนตัวเลือก) · ยังไม่ระบุเวลาเป็นกองย่อยของคนโทร */
export function countFollowCallers(entries: FollowEntry[], tab?: FollowTab): Record<FollowCaller, number> {
  const out: Record<FollowCaller, number> = { all: 0, ai: 0, manual: 0, tbd: 0 };
  for (const e of entries) {
    if (tab && followLifecycleTab(e) !== tab) continue;
    out.all += 1;
    out[followCallerOf(e)] += 1;
    if (e.time_tbd === true) out.tbd += 1;
  }
  return out;
}

/**
 * ยอดต่อฝั่ง "ใครโทร" + โทรสำเร็จของแต่ละฝั่ง (เจ้าของสั่ง 3 ต.ค. 2569:
 * *"แบ่งต่อได้ว่า คนโทรเท่าไหร่ Ai เท่าไหร่ แล้วบอกด้วยว่าทั้ง 2 อย่างโทรสำเร็จอย่างละเท่าไหร่"*)
 * สำเร็จ = ติดต่อได้ (ช่อง "โทรติด" ของ Pipeline — `inFollowRoundBucket('connected')` นิยามเดียว
 * ทั้ง AI และผลที่คนลงเอง) · นับทุกสาย ไม่สนแท็บ/ตัวกรอง — เลขเดียวกับหัวการ์ด Pipeline
 */
export function countFollowCallerResults(
  entries: FollowEntry[],
): Record<'ai' | 'manual', { calls: number; done: number }> {
  const out = { ai: { calls: 0, done: 0 }, manual: { calls: 0, done: 0 } };
  for (const e of entries) {
    const side = out[followCallerOf(e)];
    side.calls += 1;
    if (inFollowRoundBucket(e, 'connected')) side.done += 1;
  }
  return out;
}

/**
 * ค้นหาบนหน้าติดตาม (เจ้าของ 5 ต.ค. 2569: *"เพิ่ม filter ค้นหา ชื่อหน่วยงาน / ชื่อพนักงาน"*)
 * ชื่อคนที่ติดตาม · หน่วยงาน · รหัสไซต์ · เบอร์ (ตัวเลขล้วน) — ไม่สนตัวพิมพ์/ช่องว่างซ้ำ · ว่าง = ผ่านหมด
 */
export function matchesFollowSearch(
  e: Pick<FollowEntry, 'recipient_name' | 'recipient_phone' | 'unit_name' | 'site_code'>,
  q: string,
): boolean {
  const needle = q.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!needle) return true;
  const hay = [e.recipient_name, e.unit_name, e.site_code].map((v) => (v ?? '').toLowerCase().replace(/\s+/g, ' '));
  if (hay.some((h) => h.includes(needle))) return true;
  const digits = needle.replace(/\D/g, '');
  if (digits.length >= 3) {
    const phone = (e.recipient_phone ?? '').replace(/\D/g, '');
    const local = phone.startsWith('66') ? `0${phone.slice(2)}` : phone;
    return phone.includes(digits) || local.includes(digits);
  }
  return false;
}

/**
 * "ครั้งที่ติดตาม" = **วันที่ของแผน** (เจ้าของ Choice 5 ต.ค. 2569) — วันที่ 1 / 2 / 3 ของชุดนั้น
 * ชุดวันเดียว (`call_day` null) = วันที่ 1 · ไม่มีเวลา = null
 */
export function followPlanDayOf(e: Pick<FollowEntry, 'call_day' | 'scheduled_at'>): number | null {
  if (!e.scheduled_at) return null;
  return typeof e.call_day === 'number' && e.call_day > 0 ? e.call_day : 1;
}

/** ตัวเลือก "วันที่ของแผน" ที่มีจริงในชุด + จำนวนสาย (เรียงวัน) */
export function followPlanDayOptions(entries: readonly FollowEntry[]): Array<{ day: number; count: number }> {
  const by = new Map<number, number>();
  for (const e of entries) {
    const d = followPlanDayOf(e);
    if (d !== null) by.set(d, (by.get(d) ?? 0) + 1);
  }
  return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([day, count]) => ({ day, count }));
}

/** กรองรอบด้วยแท็บ + วันที่ + ช่วงเวลา + เจ้าของงาน (ทุกเงื่อนไข AND กัน) */
export function filterFollowEntries(entries: FollowEntry[], f: FollowFilter): FollowEntry[] {
  return entries.filter((e) => {
    if (f.tab && followLifecycleTab(e) !== f.tab) return false;
    // สายส่งคนแทนจาก iRecruit อยู่วันเข้างาน (7 ต.ค. 2569 · ตัวเดียวกับตาราง `followEntryYmd`)
    if (f.date && (replaceWorkYmd(e) ?? bangkokDay(e.scheduled_at)) !== f.date) return false;
    if (f.band && !inTimeBand(e.scheduled_at, f.band)) return false;
    if (f.owner && !matchesFollowAdder(e, f.owner)) return false;
    if (f.staff && followStaffGroupKey(e, f.staffNameOf ?? (() => null)) !== f.staff) return false;
    if (f.caller === 'tbd') {
      if (e.time_tbd !== true) return false;
    } else if (f.caller && f.caller !== 'all' && followCallerOf(e) !== f.caller) return false;
    return true;
  });
}

/**
 * ป้ายตัวเลขบนแท็บ — **นับ "คน" ให้ตรงกับลิสต์ข้างล่าง** (แก้ 20 ก.ย. 2569)
 *
 * 🔴 ของเดิมนับ "รอบ" ⇒ แท็บยกเลิกขึ้น **30** แต่ลิสต์ข้างล่างมี **25 แถว**
 * (คนเดียวถูกยกเลิกหลายรอบ) · เจ้าของสั่งให้ตัวเลขทุกตัวบนหน้านี้สอดคล้องกัน
 *
 * ⚠️ คนเดียวอยู่ได้หลายแท็บ (บางรอบยกเลิก บางรอบยังตามอยู่) ⇒ ผลรวมทุกแท็บ
 * **มากกว่าจำนวนคนทั้งหมดได้** — ตรงกับที่ลิสต์โชว์จริง ไม่ใช่ความผิดพลาด
 */
export function countFollowTabs(entries: FollowEntry[]): Record<FollowTab, number> {
  const seen: Record<FollowTab, Set<string>> = {
    active: new Set(),
    success: new Set(),
    ended: new Set(),
    cancelled: new Set(),
  };
  for (const e of entries) seen[followLifecycleTab(e)].add(followGroupKey(e));
  return {
    active: seen.active.size,
    success: seen.success.size,
    ended: seen.ended.size,
    cancelled: seen.cancelled.size,
  };
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
