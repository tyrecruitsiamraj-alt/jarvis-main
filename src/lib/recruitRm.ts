import { toYmdBangkok } from '@/lib/dateTh';
import { isInterestedApplicant, isNotInterestedApplicant } from '@/lib/applicantCallOutcome';
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
  contact: 'การโทรของฉัน',
  appointments: 'ติดตามนัดหมาย',
};

/** สถานะใบสมัครที่แต่ละแท็บมองเห็น — null = เห็นทุกสถานะ */
export const RM_TAB_STATUSES: Record<RmTab, ApplicationStatus[] | null> = {
  candidates: null,
  contact: ['new', 'contacted'],
  appointments: ['converted'],
};

/**
 * ใบนี้อยู่ในแท็บนี้ไหม — นิยามแท็บที่เดียวของทั้งระบบ (ตัวนับบนแท็บ + ตัวกรองใช้ร่วมกัน)
 *
 * เจ้าของเปลี่ยนความหมายแท็บ "การติดต่อ" 13 ส.ค. 2569: จาก "สถานะ new+contacted"
 * เป็น **"ใบที่ฉันเก็บมาติดต่อ"** (เลือกจากกล่องงานแล้วมาโผล่ที่นี่ · ของใครของมัน —
 * server กรองใบที่คนอื่นเก็บออกจาก feed อยู่แล้ว ฝั่งนี้แค่แยก "ของฉัน" ออกจาก "ยังว่าง")
 * · ใบที่เก็บแล้วออกจากแท็บ "ข้อมูลผู้สมัคร" (ไปอยู่การติดต่อแทน — ไม่โผล่สองที่ให้งง)
 */
export function isInRmTab(r: PublicApplication, tab: RmTab): boolean {
  // ⚠️ **คนที่ตอบว่าไม่สนใจ กลับเข้าคลังกลาง** (เจ้าของสั่ง 13 ส.ค. 2569:
  // "กรณีคนไม่สนใจให้ไปอยู่ในนี้" ชี้ที่แท็บรายชื่อผู้สมัคร)
  // เหตุผล: งาน**ใบนั้น**จบแล้ว ไม่ต้องตามต่อ แต่ **คนยังอยู่ในระบบ** เอาไปเสนอ
  // งานอื่นได้ · ถ้าปล่อยค้างในถัง "การติดต่อ" ของคนเก็บ จะเป็นงานค้างที่ไม่มีวันจบ
  // และคนคนนั้นจะหายจากคลังกลางไปเฉย ๆ
  if (isClosedByCallOutcome(r)) return tab === 'candidates';
  // "เก็บไว้ทำงานต่อ" = เก็บไปติดต่อ (claim) **หรือ** เก็บ Lead (เจ้าของสั่ง 14 ส.ค. 2569:
  // "เก็บ Lead → รายชื่อไปอยู่ที่การติดต่อแทน" · เดิม Lead หายเข้าคลังสำรอง)
  const kept = r.claimed_by_me === true || r.is_lead === true;
  if (tab === 'contact') return kept;
  if (tab === 'candidates') return !kept;
  const st = RM_TAB_STATUSES[tab];
  return !st || st.includes(r.status);
}

/**
 * ผลโทรที่แปลว่า "จบเรื่องกับใบนี้แล้ว" — ไม่ต้องตามต่อ แต่คนยังอยู่ในคลัง
 *
 * ⚠️ เอาเฉพาะผลที่ **จบจริง** · "ไม่รับสาย/ขอเลื่อน" ยังไม่จบ ต้องอยู่ในถังคนตามต่อ
 * ⚠️ ใบที่ **รับเข้าทำงานแล้ว** (converted) ไม่เข้าเงื่อนไขนี้ — ไปแท็บติดตามนัดหมาย
 * ตามเดิม แม้ผลโทรจะเป็นอะไรก็ตาม
 */
export function isClosedByCallOutcome(r: PublicApplication): boolean {
  if (r.status === 'converted') return false;
  return r.last_call_outcome === 'declined';
}

/**
 * มุมมองย่อยของแท็บ "รายชื่อผู้สมัคร" (เจ้าของสั่ง 13 ส.ค. 2569: "แบ่ง 3 อัน")
 * ทั้งหมด / คนที่สนใจ / คนที่ไม่สนใจ — แบ่งด้วย **ผลโทร** ไม่ใช่สถานะใบสมัคร
 */
export const RM_LIST_VIEWS = ['all', 'interested', 'declined', 'collect'] as const;
export type RmListView = (typeof RM_LIST_VIEWS)[number];

export const RM_LIST_VIEW_LABEL: Record<RmListView, string> = {
  all: 'รายชื่อทั้งหมด',
  interested: 'รายชื่อคนที่สนใจ',
  declined: 'รายชื่อคนที่ไม่สนใจ',
  // คิวงานสรรหา (16 ส.ค.): สนใจจริง แต่ยังไม่ขึ้นบอร์ด (= ยังไม่ได้มาสมัคร)
  // "ขึ้นบอร์ดแล้ว" = on_board (server จับคู่เบอร์กับคนบนบอร์ด ERP) → ออกจากคิวเอง
  collect: 'รอเก็บใบสมัคร',
};

/**
 * ⚠️ **"สนใจ" กับ "ไม่สนใจ" ต้องมาจากผลโทรเท่านั้น** — สถานะใบสมัครมีแค่
 * ใหม่/ติดต่อแล้ว/รับเข้าทำงาน/ปฏิเสธ ซึ่งเป็นคนละเรื่อง (สถานะการทำงานของเจ้าหน้าที่
 * ไม่ใช่คำตอบของผู้สมัคร) · คนที่ยังไม่ได้โทรจะไม่อยู่ในสองมุมมองหลัง — ตั้งใจ
 * เพราะยังไม่มีใครรู้ว่าเขาสนใจไหม การเดาแทนคือการโกหกตัวเลข
 */
export function isInRmListView(r: PublicApplication, view: RmListView): boolean {
  /**
   * 🔴 กติกา "สนใจ/ไม่สนใจ" อยู่ที่ `applicantCallOutcome.ts` **ที่เดียว**
   * (เดิมไฟล์นี้เทียบ `=== 'confirmed'` / `=== 'declined'` เองตรง ๆ → พอเจ้าของสั่งให้
   * ผลติดต่อ `ok=false` นับเป็นไม่สนใจด้วย (Phase 5.11) กล่องกับแท็บจะตอบไม่เหมือนกัน)
   */
  if (view === 'interested') return isInterestedApplicant(r);
  if (view === 'declined') return isNotInterestedApplicant(r);
  // คิวสรรหา: ตอบสนใจตอนโทร แต่ยังไม่ขึ้นบอร์ด (ยังไม่มาสมัคร) — พอสรรหาเก็บใบสมัคร
  // (ชื่อขึ้นบอร์ด) on_board = true → หลุดจากคิวเอง
  if (view === 'collect') return isInterestedApplicant(r) && r.on_board !== true;
  return true;
}

export function isRmListView(v: string | null | undefined): v is RmListView {
  return !!v && (RM_LIST_VIEWS as readonly string[]).includes(v);
}

/**
 * ⚠️ **แถวเครื่องมือของแท็บแรกไม่เหมือนอีกสองแท็บ** — ตาม HTML เดิม
 * แท็บ "ข้อมูลผู้สมัคร" เท่านั้นที่มีเครื่องมือ Lead (เก็บ Lead / ลบ Lead)
 */
export function rmTabHasLeadTools(tab: RmTab): boolean {
  return tab === 'candidates';
}

/**
 * ตัวกรองของหน้ารายชื่อผู้สมัคร
 *
 * ⚠️ สามกลุ่มแรก (channels/provinces/statuses) **ไม่มี UI แล้ว** — เจ้าของสั่งถอด
 * แผงตัวกรองด้านข้างออกจากทุกหน้า 17 ส.ค. 2569 (commit 9dbe94b ลบ RmFilterSidebar.tsx)
 * ตรรกะยังอยู่เพราะ drill-down จาก Dashboard ใช้ผ่าน `?bucket=` และเทสต์คุมไว้
 * 🔴 **ห้ามเอา UI สามกลุ่มนั้นกลับมาโดยไม่ได้สั่งใหม่**
 *
 * `dateFrom`/`dateTo` (YYYY-MM-DD) = ตัวกรองวันที่สมัคร — เจ้าของสั่ง 22 ส.ค. 2569
 * *"หน้าผู้สมัครขอเป็นแบบ filter แบบ calendar ที่กดแล้วข้อมูลเปลี่ยนตามวันที่เลือก"*
 */
export type RmFilters = {
  channels: ApplicationReferralSource[];
  provinces: string[];
  statuses: ApplicationStatus[];
  /** วันที่สมัคร ตั้งแต่ (YYYY-MM-DD) — ว่าง/ไม่ส่ง = ไม่กรอง */
  dateFrom?: string | null;
  /** วันที่สมัคร ถึง (YYYY-MM-DD) — ว่าง/ไม่ส่ง = ไม่กรอง */
  dateTo?: string | null;
};

export const EMPTY_RM_FILTERS: RmFilters = {
  channels: [],
  provinces: [],
  statuses: [],
  dateFrom: null,
  dateTo: null,
};

/** วันที่สมัครในรูป YYYY-MM-DD (ตัดเวลาออก) — null = ไม่รู้วัน */
export function applicationAppliedYmd(row: PublicApplication): string | null {
  const raw = row.created_at;
  if (!raw || typeof raw !== 'string') return null;
  const ymd = raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
}

/** ไม่ได้ติ๊กอะไรเลย = ไม่กรอง (ไม่ใช่ "กรองจนไม่เหลืออะไร") */
export function countActiveRmFilters(f: RmFilters): number {
  const dateActive = f.dateFrom || f.dateTo ? 1 : 0;
  return f.channels.length + f.provinces.length + f.statuses.length + dateActive;
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
 * ป้าย "หน่วยงาน" ของแถวรายชื่อ (เจ้าของสั่ง 17 ส.ค. 2569 — คอลัมน์นี้เอาชื่อหน่วยงานล้วน)
 *
 * ⚠️ ของจริงมีใบที่ `job_title` กับ `unit_name` เป็นค่าเดียวกันเป๊ะ ทำให้คอลัมน์เดิม
 * โชว์ซ้ำสองรอบคั่นด้วยขีด ("บริษัท ก. — บริษัท ก.") — ตัวนี้เอาชื่อหน่วยงานอย่างเดียว
 * ไม่มีหน่วยงานค่อยถอยไปใช้ชื่องานที่สมัคร
 */
export function applicationUnitLabel(r: PublicApplication): string {
  const unit = (r.unit_name || '').trim();
  if (unit) return unit;
  return (r.job_title || '').trim() || (r.position_interest || '').trim() || '';
}

/**
 * ที่อยู่ย่อของผู้สมัคร — ตำบล/อำเภอ/จังหวัด เท่าที่กรอกมา (เจ้าของสั่ง 17 ส.ค. 2569)
 * เดิมโชว์แค่จังหวัด ซึ่งกว้างเกินกว่าจะบอกได้ว่าคนนี้ไปไซต์ไหนไหว
 * ⚠️ กรอกไม่ครบ = ต่อเท่าที่มี ห้ามเติมคำว่า "ไม่ระบุ" คั่นกลางให้อ่านยาก
 */
export function applicationAddressLabel(r: PublicApplication): string {
  return [r.subdistrict, r.district, r.province]
    .map((v) => (v || '').trim())
    .filter(Boolean)
    .join(' · ');
}

/**
 * ใบนี้ยื่นมาแล้วกี่วัน (เจ้าของสั่ง 17 ส.ค. 2569 — "ผ่านมาแล้วกี่วัน")
 *
 * นับตาม **ปฏิทินกรุงเทพ** ไม่ใช่ผลต่างมิลลิวินาที — ใบที่กรอกเมื่อวานตอนสามทุ่ม
 * ต้องอ่านว่า "1 วัน" ตั้งแต่เช้าวันนี้ ไม่ใช่รอครบ 24 ชม.
 * คืน null เมื่อไม่มีวันที่/วันที่เสีย (คนละความหมายกับ 0 = วันนี้)
 */
export function daysSinceApplied(createdAt: string | null | undefined, now: Date): number | null {
  const raw = (createdAt || '').trim();
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  const start = Date.parse(`${toYmdBangkok(d)}T00:00:00Z`);
  const today = Date.parse(`${toYmdBangkok(now)}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(today)) return null;
  return Math.round((today - start) / 86400000);
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
  const kw = keyword.trim().toLowerCase();
  return rows.filter((r) => {
    if (!isInRmTab(r, tab)) return false;
    if (filters.statuses.length > 0 && !filters.statuses.includes(r.status)) return false;
    if (filters.channels.length > 0) {
      if (!r.referral_source || !filters.channels.includes(r.referral_source)) return false;
    }
    if (filters.provinces.length > 0 && !filters.provinces.includes((r.province || '').trim())) {
      return false;
    }
    // ช่วงวันที่สมัคร — ใบที่ไม่รู้วันถือว่า "ไม่เข้าเงื่อนไข" เมื่อมีการกรองวัน
    // (ดีกว่าปล่อยผ่านแล้วคนอ่านคิดว่าใบนั้นสมัครในช่วงที่เลือก)
    if (filters.dateFrom || filters.dateTo) {
      const ymd = applicationAppliedYmd(r);
      if (!ymd) return false;
      if (filters.dateFrom && ymd < filters.dateFrom) return false;
      if (filters.dateTo && ymd > filters.dateTo) return false;
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
export type RmRowAction = 'bookmark' | 'call' | 'dial' | 'view' | 'rule' | 'remove';

/**
 * ⚠️ `call` กับ `dial` เป็นคนละเรื่อง — สับสนเมื่อไหร่ตัวเลขเวลารอโทรเพี้ยนทันที
 *   call = **เก็บไปโทรเอง** (จองใบ + จับล็อกที่เบอร์ กัน AI/คนอื่นโทรทับ — สองอย่างในกดเดียว)
 *   dial = **จดว่าเพิ่งยกหูโทร** (095 · เจ้าของสั่ง 17 ส.ค. 2569 ข้อ 5 ของงานสรรหา)
 * ปุ่ม dial โผล่เฉพาะแท็บ "การโทรของฉัน" เพราะเป็นขั้นหลังเก็บชื่อไปแล้ว
 */
export const RM_ROW_ACTIONS: Record<RmTab, RmRowAction[]> = {
  candidates: ['bookmark', 'call', 'view'],
  contact: ['bookmark', 'call', 'dial', 'view'],
  appointments: ['call', 'rule', 'remove'],
};

export const RM_ROW_ACTION_LABEL: Record<RmRowAction, string> = {
  bookmark: 'เก็บเข้า Lead',
  /**
   * 🔴 เดิมมีสองปุ่มที่คนงงว่าต่างกันตรงไหน — "เก็บไปติดต่อ" (claim บนใบ) กับ
   * "ดึงเข้าถังโทร" (ล็อกเบอร์กัน AI ทับ) · เจ้าของเคาะ 22 ส.ค. 2569 ให้ **รวมเป็นปุ่มเดียว**
   * กดทีเดียวได้ทั้งคู่ (เส้น /api/application-call-choice choice=manual)
   */
  call: 'เก็บไปโทรเอง',
  dial: 'กดโทร (จดเวลา)',
  view: 'ดูรายละเอียด',
  rule: 'บันทึกผลนัดหมาย',
  remove: 'เอาออกจากรายการ',
};

/**
 * ── "ดึงไปโทร" จากแถวรายชื่อผู้สมัคร (เจ้าของเคาะ 11 ส.ค. 2569 รอบหก) ──────────
 *
 * จับ call hold (ล็อกตัวเดียวกับหน้า Matching — ผูกเบอร์ ไม่ใช่ ref) ได้เฉพาะใบที่
 *   1. มีเบอร์ — server จะแปลง E.164 เอง แต่ใบไม่มีเบอร์เลยไม่มีอะไรให้ล็อก
 *   2. **ผูกใบขอ (`job_id`)** — POST บังคับ jobId เพื่อเช็ค BU scope
 *      ใบที่เจ้าหน้าที่คีย์เอง (job_id ว่าง) จับไม่ได้ **โดยตั้งใจ** — ผ่อนเมื่อไหร่
 *      ล็อกเบอร์ข้ามแผนกได้ (ขัด fail-safe) · ปุ่มต้อง disable พร้อมบอกเหตุผล
 */
export type RmHoldability =
  | { ok: true }
  | { ok: false; reason: string };

export function canHoldApplication(row: {
  phone?: string | null;
  job_id?: string | null;
}): RmHoldability {
  if (!row.phone?.trim()) return { ok: false, reason: 'ไม่มีเบอร์โทร' };
  if (!row.job_id?.trim()) {
    return { ok: false, reason: 'ใบคีย์เอง ไม่ผูกใบขอ — เก็บเข้าถังโทรไม่ได้ (ล็อกต้องเช็คสิทธิ์ BU จากใบขอ)' };
  }
  return { ok: true };
}
