/**
 * งานสรรหา (RM) — นิยามกลางของหน้า `/recruit/rm`
 *
 * โจทย์จากเจ้าของ (11 ส.ค. 2569): เอาโครง 3 แท็บของระบบเดิม (Bootstrap 4 + DataTables)
 * มา**ครอบข้อมูลที่มีอยู่แล้ว** — ไม่สร้างข้อมูลชุดใหม่ ไม่ทำของเดิมหาย และหัวใจคือ
 * **ต้องรู้ว่าใครสมัครมางานไหน**
 *
 * ═══ ออกแบบ: 3 แท็บ = 3 มุมของ "ใบสมัครจากบอร์ดรับสมัคร" ที่ระบบเก็บอยู่แล้ว ═══
 *
 * ตาราง `job_applications` (หน้า /apply) เก็บครบอยู่แล้ว: ใครสมัคร (ชื่อ/เบอร์/จังหวัด)
 * · สมัครงานไหน (`job_id` + `job_title` + `unit_name`) · เข้ามาทางไหน (`referral_source`)
 * · สถานะ (`new → contacted → converted / rejected`) — เดิมดูได้ทีละใบขอผ่าน dialog
 * บนบอร์ดเท่านั้น สิ่งที่ขาดคือ "มุมมองรวมทุกงาน" ซึ่งคือหน้านี้
 *
 * | แท็บ            | เห็นใคร                       | คือขั้นไหนของงานสรรหา |
 * |-----------------|-------------------------------|------------------------|
 * | ข้อมูลผู้สมัคร   | ทุกใบสมัคร ทุกสถานะ           | คลังรวม                |
 * | การติดต่อ       | `new` + `contacted`           | ยังต้องโทร/กำลังคุย     |
 * | ติดตามนัดหมาย   | `converted`                   | รับแล้ว ตามนัด/เริ่มงาน |
 *
 * ⚠️ ทั้งสามแท็บอ่านจากชุดเดียวกัน กรองด้วยสถานะ — เปลี่ยนสถานะใบสมัคร (ผ่าน dialog
 * เดิมบนบอร์ด หรือปุ่มในหน้านี้เมื่อต่อ API แล้ว) คนจะย้ายแท็บเอง ไม่มีข้อมูลสองชุด
 *
 * ⚠️ สถานะ/สี/ป้าย ใช้ของที่มีอยู่แล้วใน `publicApplicationsApi.ts`
 * (APPLICATION_STATUS_LABEL / _CLASS) — ไม่ประดิษฐ์ชุดใหม่มาชนกัน
 *
 * ไฟล์นี้ pure ทั้งไฟล์ — เทสต์ที่ `tests/api/recruitRm.test.ts`
 */
import type {
  ApplicationReferralSource,
  ApplicationStatus,
  PublicApplication,
} from '@/lib/publicApplicationsApi';

/** แท็บของหน้า — ตามลำดับใน HTML เดิม (panel0/1/2) */
export const RM_TABS = ['candidates', 'contact', 'appointments'] as const;
export type RmTab = (typeof RM_TABS)[number];

export const RM_TAB_LABEL: Record<RmTab, string> = {
  candidates: 'ข้อมูลผู้สมัคร',
  contact: 'การติดต่อ',
  appointments: 'ติดตามนัดหมาย',
};

/** สถานะใบสมัครที่แต่ละแท็บมองเห็น — null = เห็นทุกสถานะ */
export const RM_TAB_STATUSES: Record<RmTab, ApplicationStatus[] | null> = {
  candidates: null,
  contact: ['new', 'contacted'],
  appointments: ['converted'],
};

/**
 * ⚠️ **แถวเครื่องมือของแท็บแรกไม่เหมือนอีกสองแท็บ** — ตาม HTML เดิม
 * แท็บ "ข้อมูลผู้สมัคร" เท่านั้นที่มีเครื่องมือ Lead (เก็บ Lead / ลบ Lead)
 */
export function rmTabHasLeadTools(tab: RmTab): boolean {
  return tab === 'candidates';
}

/** ตัวกรอง sidebar — ทุกกลุ่มมาจากฟิลด์ที่มีจริงในใบสมัคร ไม่มีกลุ่มที่กรองแล้วไม่มีผล */
export type RmFilters = {
  channels: ApplicationReferralSource[];
  provinces: string[];
  statuses: ApplicationStatus[];
};

export const EMPTY_RM_FILTERS: RmFilters = {
  channels: [],
  provinces: [],
  statuses: [],
};

/** ไม่ได้ติ๊กอะไรเลย = ไม่กรอง (ไม่ใช่ "กรองจนไม่เหลืออะไร") */
export function countActiveRmFilters(f: RmFilters): number {
  return f.channels.length + f.provinces.length + f.statuses.length;
}

/** ติ๊ก/เอาติ๊กออกในลิสต์เดียว — ใช้ร่วมทุกกลุ่มใน sidebar */
export function toggleInList<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** จังหวัดที่เลือกได้ = จังหวัดที่มีคนสมัครจริง — ไม่ hardcode 77 จังหวัดให้เลื่อนหาเปล่า */
export function provincesFromApplications(rows: PublicApplication[]): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    const p = (r.province || '').trim();
    if (p) set.add(p);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'th'));
}

/** ชื่อ-นามสกุลแยกคอลัมน์ตามระบบเดิม — ใบสมัครเก่าบางใบมีแต่ full_name ต้องถอยไปตัดเอง */
export function splitApplicantName(r: PublicApplication): { firstName: string; lastName: string } {
  const first = (r.first_name || '').trim();
  const last = (r.last_name || '').trim();
  if (first || last) return { firstName: first, lastName: last };
  const parts = (r.full_name || '').trim().split(/\s+/);
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
}

/** ป้าย "สมัครงานไหน" — หัวใจของหน้านี้ · ใบที่สมัครแบบไม่ระบุงานต้องบอกตรง ๆ ไม่ปล่อยว่าง */
export function applicationJobLabel(r: PublicApplication): string {
  const job = (r.job_title || '').trim() || (r.position_interest || '').trim();
  const unit = (r.unit_name || '').trim();
  if (job && unit) return `${job} — ${unit}`;
  return job || unit || 'สมัครทั่วไป (ไม่ระบุงาน)';
}

/**
 * กรอง + ค้นหา — pure จึงเทสต์ได้โดยไม่ต้องมี DOM
 *
 * ⚠️ ช่องค้นหาตาม HTML เดิมเขียนว่า "ค้นหาข้อมูลจาก ชื่อ นามสกุล เบอร์" จึงค้นแค่นั้น
 * **บวกชื่องาน/หน่วยงาน** ที่เพิ่มให้เพราะเป็นหัวใจของหน้านี้ (หาว่า "ใครสมัครงาน X" ได้)
 */
export function filterApplications(
  rows: PublicApplication[],
  tab: RmTab,
  filters: RmFilters,
  keyword: string,
): PublicApplication[] {
  const tabStatuses = RM_TAB_STATUSES[tab];
  const kw = keyword.trim().toLowerCase();
  return rows.filter((r) => {
    if (tabStatuses && !tabStatuses.includes(r.status)) return false;
    if (filters.statuses.length > 0 && !filters.statuses.includes(r.status)) return false;
    if (filters.channels.length > 0) {
      if (!r.referral_source || !filters.channels.includes(r.referral_source)) return false;
    }
    if (filters.provinces.length > 0 && !filters.provinces.includes((r.province || '').trim())) {
      return false;
    }
    if (kw) {
      const hay = `${r.full_name} ${r.first_name ?? ''} ${r.last_name ?? ''} ${r.phone} ${applicationJobLabel(r)}`.toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    return true;
  });
}

/**
 * แถบปุ่มด้านบน
 * ⚠️ **ไม่มีปุ่ม "ตำแหน่งงาน"** — เจ้าของสั่งเอาออก 11 ส.ค. 2569 (ตำแหน่งงานเลือกตอน
 * สร้างลิงก์/เพิ่มผู้สมัครอยู่แล้ว ไม่ต้องมีปุ่มจัดการแยก)
 * ⚠️ **ไม่มีปุ่ม "รายงาน"** — เจ้าของสั่งเอาออก 11 ส.ค. 2569 รอบสี่
 * ⚠️ อยู่ที่ lib ไม่ใช่ไฟล์ component — ไฟล์ component ที่ export ค่าอื่นนอกจาก
 * ตัว component จะโดน eslint เตือน react-refresh (กติกาเดิมของโปรเจกต์)
 */
export const RM_TOOLBAR_KEYS = ['channels', 'link', 'reasons'] as const;
export type RmToolbarKey = (typeof RM_TOOLBAR_KEYS)[number];

export const RM_TOOLBAR_LABEL: Record<RmToolbarKey, string> = {
  channels: 'ช่องทาง',
  link: 'สร้างลิงก์',
  reasons: 'เหตุผล',
};

/** ปุ่ม action ต่อแถว — จุดเดียวที่ระบบเดิมให้แต่ละแท็บต่างกัน */
export type RmRowAction = 'bookmark' | 'call' | 'view' | 'rule' | 'remove';

export const RM_ROW_ACTIONS: Record<RmTab, RmRowAction[]> = {
  candidates: ['bookmark', 'call', 'view'],
  contact: ['bookmark', 'call', 'view'],
  appointments: ['call', 'rule', 'remove'],
};

export const RM_ROW_ACTION_LABEL: Record<RmRowAction, string> = {
  bookmark: 'เก็บเข้า Lead',
  call: 'โทร',
  view: 'ดูรายละเอียด',
  rule: 'บันทึกผลนัดหมาย',
  remove: 'เอาออกจากรายการ',
};
