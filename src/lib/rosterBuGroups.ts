import { APP_DEPARTMENT_CODES, APP_DEPARTMENT_LABELS } from '@/lib/departmentCodes';
import type { JobStaffManageState, RosterEntry } from '@/lib/jobStaffRemote';

/**
 * **จัดหน้าตั้งค่ารายชื่อทีมเป็น drill-down ราย, BU + แบ่งหน้า**
 * (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ-7: *"แยกกล่องเป็นกล่องแต่ละ BU แล้วพอกดแต่ละ BU
 * แยกกล่องของเจ้าหน้าที่สรรหา/คัดสรร/OPL/ทีมออนไลน์ · pagination หน้าละ 10"*)
 *
 * เดิมเป็น filter BU แนวนอน + 4 กล่องเรียงกันโชว์หมดทุกที · เปลี่ยนเป็น
 * เลือก BU (กล่อง) ก่อน → ค่อยเห็น 4 กล่องบทบาทของ BU นั้น แบ่งหน้าอิสระ
 *
 * ⚠️ "ไม่ระบุ" (bu=null) เป็นกล่องแยกของตัวเอง — ตรงกับ tab เดิมที่มี "ไม่ระบุ"
 * (ในหน้าจัดการนี้จับคู่ BU แบบ exact · ที่ picker มอบหมายงาน null = โชว์ทุก BU
 * เป็นคนละเรื่องกัน อย่าเอามาปนกัน)
 */

/** คีย์ของกล่อง BU — รหัสแผนกจริง + 'none' (ไม่ระบุ) */
export type RosterBuKey = (typeof APP_DEPARTMENT_CODES)[number] | 'none';

export const ROSTER_BU_KEYS: RosterBuKey[] = [...APP_DEPARTMENT_CODES, 'none'];

export function rosterBuLabel(key: RosterBuKey): string {
  return key === 'none' ? 'ไม่ระบุ BU' : APP_DEPARTMENT_LABELS[key];
}

export type RosterKind = 'recruiter' | 'screener' | 'opl' | 'online';

export const ROSTER_KINDS: { kind: RosterKind; title: string }[] = [
  { kind: 'recruiter', title: 'เจ้าหน้าที่สรรหา' },
  { kind: 'screener', title: 'เจ้าหน้าที่คัดสรร' },
  { kind: 'opl', title: 'เจ้าหน้าที่ OPL' },
  // ทีม online (097 · เจ้าของสั่ง 17 ส.ค. 2569) — บทบาทที่ 4 โครงเดียวกับสามอันบน
  { kind: 'online', title: 'ทีม Online' },
];

/** entries ของแต่ละบทบาทจาก state — map kind → array */
export function entriesOfKind(state: JobStaffManageState, kind: RosterKind): RosterEntry[] {
  switch (kind) {
    case 'recruiter':
      return state.recruiters;
    case 'screener':
      return state.screeners;
    case 'opl':
      return state.opls;
    case 'online':
      return state.onlines;
  }
}

/** entry นี้อยู่กล่อง BU ไหน — jับคู่ exact (null → 'none') */
export function entryInBu(entry: RosterEntry, key: RosterBuKey): boolean {
  if (key === 'none') return entry.bu === null;
  return entry.bu === key;
}

export function entriesForBu(entries: RosterEntry[], key: RosterBuKey): RosterEntry[] {
  return entries.filter((e) => entryInBu(e, key));
}

export type RosterBuCount = {
  key: RosterBuKey;
  recruiter: number;
  screener: number;
  opl: number;
  online: number;
  total: number;
};

/** จำนวนคนต่อ BU แยกตามบทบาท — สำหรับป้ายบนกล่อง BU ในหน้ารวม */
export function countRosterByBu(state: JobStaffManageState): RosterBuCount[] {
  return ROSTER_BU_KEYS.map((key) => {
    const recruiter = entriesForBu(state.recruiters, key).length;
    const screener = entriesForBu(state.screeners, key).length;
    const opl = entriesForBu(state.opls, key).length;
    const online = entriesForBu(state.onlines, key).length;
    return { key, recruiter, screener, opl, online, total: recruiter + screener + opl + online };
  });
}

export type Paged<T> = {
  items: T[];
  /** หน้าปัจจุบัน (1-based) หลังบีบให้อยู่ในช่วง */
  page: number;
  pageCount: number;
  total: number;
};

/**
 * แบ่งหน้า — หน้าละ `size` (เจ้าของขอ 10) · บีบ page ให้อยู่ในช่วงเสมอ
 * ลบคนออกจนหน้าสุดท้ายว่างแล้วยังค้าง page เดิม = เห็นหน้าเปล่า ถ้าไม่บีบ
 */
export function paginate<T>(items: T[], page: number, size = 10): Paged<T> {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * size;
  return { items: items.slice(start, start + size), page: safePage, pageCount, total };
}
