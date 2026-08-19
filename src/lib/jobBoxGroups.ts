/**
 * กล่องสถานะบนหน้า "กล่องงาน" — ตรรกะล้วน
 *
 * เจ้าของสั่ง 19 ส.ค. 2569: *"หน้ากล่องงานใบไหนปิดแล้วก็ย้ายไปกล่องปิดแล้ว ยกเลิกก็ไป
 * กล่องยกเลิก มีกล่องเพื่อดูข้อมูลได้หมดอะ กำลังสรรหา ยกเลิก รอแจ้งเข้า รอเริ่มงานไรงี้"*
 * → เคาะเป็น **6 กล่อง** (ยุบ 9 สถานะทำงานเหลือ 4 ช่วง + ปิดแล้ว + ยกเลิก)
 *
 * 🔴 **ทุกใบต้องตกลงกล่องใดกล่องหนึ่งเสมอ** — สถานะที่ไม่รู้จัก/ยังไม่ตั้ง ตกลง "กำลังสรรหา"
 * ไม่ใช่หายไปเฉย ๆ · มีเทสต์คุมว่าผลรวมทุกกล่อง = จำนวนใบทั้งหมดเป๊ะ
 * (ถ้าใครเพิ่มสถานะใหม่ใน `work_status_master` แล้วลืมแมป เทสต์จะจับได้)
 */

/** กล่องที่กรองจากใบขอที่ยังเปิด (feed กล่องงาน) */
import type { ToneKey } from './designTokens';

export const OPEN_BOX_KEYS = ['sourcing', 'selecting', 'waiting', 'started'] as const;
export type OpenBoxKey = (typeof OPEN_BOX_KEYS)[number];

/** กล่องที่มาจากคนละแหล่ง (ใบที่หลุดจากกล่องงานไปแล้ว) */
export const CLOSED_BOX_KEYS = ['closed', 'cancelled'] as const;
export type ClosedBoxKey = (typeof CLOSED_BOX_KEYS)[number];

export type JobBoxKey = OpenBoxKey | ClosedBoxKey;

export const JOB_BOX_KEYS: readonly JobBoxKey[] = [...OPEN_BOX_KEYS, ...CLOSED_BOX_KEYS];

export const JOB_BOX_LABEL: Record<JobBoxKey, string> = {
  sourcing: 'กำลังสรรหา',
  selecting: 'กำลังคัดเลือก',
  waiting: 'รอแจ้งเข้า / รอเริ่มงาน',
  started: 'เริ่มงานแล้ว',
  closed: 'ปิดแล้ว',
  cancelled: 'ยกเลิก',
};

/**
 * สีของแต่ละกล่อง — **ความหมายสีมาจาก `designTokens` ที่เดียว** (กติกาข้อ 4 ของโปรเจกต์)
 * เรียงตามการเดินทางของงาน: ฟ้า = เพิ่งเริ่มหา → ม่วง = กำลังคัดคน → ส้ม = รอ →
 * เขียว = ได้คนเริ่มงานแล้ว · เทา = จบแล้ว · แดง = ยกเลิก
 */
export const JOB_BOX_TONE: Record<JobBoxKey, ToneKey> = {
  sourcing: 'info',
  selecting: 'violet',
  waiting: 'orange',
  started: 'success',
  closed: 'neutral',
  cancelled: 'danger',
};

/** คำอธิบายใต้ชื่อกล่อง — บอกว่ากล่องนี้รวมสถานะอะไรบ้าง (คนจะได้ไม่ต้องเดา) */
export const JOB_BOX_HINT: Record<JobBoxKey, string> = {
  sourcing: 'ยังไม่ตั้งสถานะ · ดำเนินการ · ชะลอ',
  selecting: 'เริ่มประเมิน · รอสัมภาษณ์ · รอผลสัมภาษณ์',
  waiting: 'รอแจ้งเข้า · รอเริ่มงาน',
  started: 'งานรายวัน · จ่ายรายวัน',
  closed: 'ใบที่ปิดแล้ว (ไม่รวมยกเลิก)',
  cancelled: 'ใบที่ถูกยกเลิก',
};

/**
 * สถานะทำงาน (`work_status_master`) → กล่อง
 * ⚠️ ต้องครบทุก code ที่ active อยู่ — มีเทสต์เทียบกับรายการจริง
 */
const STATUS_TO_BOX: Record<string, OpenBoxKey> = {
  in_progress: 'sourcing',
  on_hold: 'sourcing',
  evaluating: 'selecting',
  waiting_interview: 'selecting',
  waiting_result: 'selecting',
  waiting_inform: 'waiting',
  waiting_start: 'waiting',
  daily_work: 'started',
  daily_pay: 'started',
};

/**
 * ใบขอที่ยังเปิดอยู่ใบหนึ่ง → กล่องไหน
 * 🔴 ไม่ตั้งสถานะ / สถานะที่ไม่รู้จัก → `sourcing` เสมอ **ห้ามคืน null**
 * (ของจริง 193 จาก 293 ใบยังไม่ได้ตั้งสถานะ — ถ้าตกกล่องจะหายไปจากหน้าจอทันที)
 */
export function openJobBoxOf(job: { work_status?: unknown }): OpenBoxKey {
  const raw = typeof job.work_status === 'string' ? job.work_status.trim() : '';
  if (!raw) return 'sourcing';
  return STATUS_TO_BOX[raw] ?? 'sourcing';
}

/** นับใบต่อกล่องของฝั่ง "ใบเปิด" */
export function countOpenBoxes(
  jobs: readonly { work_status?: unknown }[],
): Record<OpenBoxKey, number> {
  const out: Record<OpenBoxKey, number> = {
    sourcing: 0,
    selecting: 0,
    waiting: 0,
    started: 0,
  };
  for (const j of jobs) out[openJobBoxOf(j)] += 1;
  return out;
}

/** กรองใบเปิดตามกล่องที่เลือก · ไม่เลือก (null) = ไม่กรอง */
export function filterByOpenBox<T extends { work_status?: unknown }>(
  jobs: readonly T[],
  box: OpenBoxKey | null,
): T[] {
  if (!box) return [...jobs];
  return jobs.filter((j) => openJobBoxOf(j) === box);
}

/**
 * ใบที่หลุดจากกล่องงานแล้ว → ปิดแล้ว หรือ ยกเลิก
 * 🔴 แยกด้วย `cancel_date` จาก ERP — เดิมสองอย่างนี้กองรวมกันในแท็บ "ปิดแล้ว"
 * (เจ้าของสั่งแยก 19 ส.ค. 2569) · ไม่มี cancel_date = ปิดปกติ
 */
export function closedJobBoxOf(job: { cancel_date?: unknown }): ClosedBoxKey {
  const raw = typeof job.cancel_date === 'string' ? job.cancel_date.trim() : '';
  return raw ? 'cancelled' : 'closed';
}

export function filterByClosedBox<T extends { cancel_date?: unknown }>(
  jobs: readonly T[],
  box: ClosedBoxKey,
): T[] {
  return jobs.filter((j) => closedJobBoxOf(j) === box);
}

/** กล่องนี้อ่านจาก feed ใบปิดไหม (ต้องสลับมุมมอง ไม่ได้กรองการ์ดในหน้าเดียว) */
export function isClosedBox(box: JobBoxKey): box is ClosedBoxKey {
  return box === 'closed' || box === 'cancelled';
}
