/**
 * เมนูหน้า Settings — **ตรรกะล้วน** (จัดกลุ่ม + ป้ายชื่อ)
 *
 * เจ้าของทัก 20 ส.ค. 2569: *"หน้า Setting ตอนนี้มันสะเปะสะปะมาก"* — วัดของจริงเจอ 4 ปัญหา:
 *   1. 12 แท็บอยู่แถวเดียวเลื่อนซ้ายขวา เห็นพร้อมกันจริงแค่ ~8 อัน (3 อันท้ายตกขอบ)
 *   2. ไม่มีการจัดกลุ่ม — "ธีม/โลโก้" อยู่ติด "Users" ติด "น้ำหนักเรียงผู้สมัคร" ติด "Audit Log"
 *   3. ไทยปนอังกฤษ (Users · Roles · Reference Data · Audit Log)
 *   4. ป้ายยาวไม่เท่ากันสุดขั้ว (29 ตัวอักษร อยู่ข้าง 5 ตัวอักษร)
 *
 * เจ้าของเคาะ: **เมนูซ้ายแบ่งกลุ่ม** + **เปลี่ยนเป็นไทยให้หมด**
 *
 * 🔴 **ทุกแท็บต้องอยู่กลุ่มใดกลุ่มหนึ่งเสมอ** — มีเทสต์คุมว่าผลรวมทุกกลุ่ม = จำนวนแท็บทั้งหมด
 * และไม่มีแท็บไหนอยู่สองกลุ่ม (เพิ่มแท็บใหม่แล้วลืมจัดกลุ่ม เทสต์จับได้ทันที)
 */

export const SETTINGS_TAB_IDS = [
  'appearance',
  'navMenu',
  'users',
  'roles',
  'workStatus',
  'matchWeights',
  'lumosMode',
  'callScripts',
  'aiSettings',
  'callSuppression',
  'pdpaRequests',
  'autoMove',
  'health',
  'reference',
  'audit',
] as const;

export type SettingsTabId = (typeof SETTINGS_TAB_IDS)[number];

/**
 * ป้ายชื่อแท็บ — **ไทยทั้งหมด** (เจ้าของสั่ง 20 ส.ค. 2569)
 * ของเดิม: Users · Roles · Reference Data · Audit Log เป็นอังกฤษปนอยู่กลางแท็บไทย
 */
export const SETTINGS_TAB_LABEL: Record<SettingsTabId, string> = {
  appearance: 'ธีม / โลโก้',
  navMenu: 'จัดเมนู',
  users: 'ผู้ใช้งาน',
  roles: 'บทบาทและสิทธิ์',
  workStatus: 'สถานะทำงาน',
  matchWeights: 'น้ำหนักเรียงผู้สมัคร',
  lumosMode: 'โหมดส่งงานให้ Lumos',
  callScripts: 'บทพูดของ AI',
  aiSettings: 'AI ที่ใช้คิดงาน',
  callSuppression: 'บัญชีห้ามโทร',
  pdpaRequests: 'คำขอข้อมูลส่วนบุคคล',
  autoMove: 'ย้ายใบสมัครอัตโนมัติ',
  health: 'สถานะระบบ',
  reference: 'ข้อมูลอ้างอิง',
  audit: 'บันทึกการใช้งาน',
};

/** คำอธิบายใต้ชื่อ — บอกว่าเข้าไปทำอะไรได้ คนจะได้ไม่ต้องกดไล่หา */
export const SETTINGS_TAB_HINT: Record<SettingsTabId, string> = {
  appearance: 'สีธีม โลโก้ ชื่อระบบ',
  navMenu: 'เลือกเมนูที่แต่ละบทบาทเห็น',
  users: 'เพิ่ม/แก้ผู้ใช้ · บทบาท · แผนก',
  roles: 'สิทธิ์เข้าถึงของแต่ละบทบาท',
  workStatus: 'สถานะของใบขอที่ใช้ทั้งระบบ',
  matchWeights: 'เกณฑ์เรียงลำดับผู้สมัครที่ AI แนะนำ',
  lumosMode: 'ให้ AI โทรเอง / ช่วยโทร / โทรมือ',
  callScripts: 'แก้บทที่ AI พูดตอนโทร — มีผลกับสายใหม่ทันที',
  aiSettings: 'เลือกเจ้า AI และโมเดลที่ใช้จับคู่งานและอ่านใบขอ',
  callSuppression: 'เบอร์ที่ AI ไม่โทรถึงชั่วคราว — ดูเหตุผลและปลดได้',
  pdpaRequests: 'ขอดู ขอแก้ ขอลบข้อมูล (PDPA) · โทรยืนยันตัวตนแล้วทำต่อ',
  autoMove: 'ย้ายใบสมัครตามผลโทรอัตโนมัติ',
  health: 'ไฟสถานะ · สวิตช์ที่เปิดอยู่ · ของค้าง',
  reference: 'ตัวเลือกในดรอปดาวน์ต่าง ๆ',
  audit: 'ใครทำอะไรไว้เมื่อไหร่',
};

export const SETTINGS_GROUP_IDS = ['people', 'look', 'automation', 'data', 'monitor'] as const;
export type SettingsGroupId = (typeof SETTINGS_GROUP_IDS)[number];

export const SETTINGS_GROUP_LABEL: Record<SettingsGroupId, string> = {
  people: 'คนและสิทธิ์',
  look: 'หน้าตาระบบ',
  automation: 'ระบบอัตโนมัติ',
  data: 'ข้อมูลอ้างอิง',
  monitor: 'ตรวจสอบระบบ',
};

/**
 * แท็บในแต่ละกลุ่ม — เรียงตามลำดับที่จะโชว์บนเมนูซ้าย
 * 🔴 แก้ที่นี่ที่เดียว · ห้ามเขียนลำดับซ้ำในไฟล์หน้า
 */
export const SETTINGS_GROUP_TABS: Record<SettingsGroupId, readonly SettingsTabId[]> = {
  // ทีมสรรหา/คัดสรร/OPL/Online ถอดแล้ว (เจ้าของ 19 ต.ค. 2569) — รายชื่อเจ้าหน้าที่มาจากหน้าผู้ใช้งานที่เดียว
  people: ['users', 'roles'],
  look: ['appearance', 'navMenu'],
  automation: ['lumosMode', 'callScripts', 'aiSettings', 'callSuppression', 'autoMove', 'matchWeights'],
  data: ['workStatus', 'reference', 'pdpaRequests'],
  monitor: ['health', 'audit'],
};

export function isSettingsTabId(value: unknown): value is SettingsTabId {
  return typeof value === 'string' && (SETTINGS_TAB_IDS as readonly string[]).includes(value);
}

/** กลุ่มของแท็บนี้ — ไม่เจอ = null (ผู้เรียกตัดสินใจเอง · เทสต์คุมว่าต้องไม่มี null จริง) */
export function groupOfSettingsTab(tab: SettingsTabId): SettingsGroupId | null {
  for (const g of SETTINGS_GROUP_IDS) {
    if (SETTINGS_GROUP_TABS[g].includes(tab)) return g;
  }
  return null;
}

export type SettingsNavGroup = {
  id: SettingsGroupId;
  label: string;
  tabs: { id: SettingsTabId; label: string; hint: string }[];
};

/**
 * เมนูที่จะโชว์จริง — กลุ่มที่ไม่มีแท็บเหลือ (ถูกกรองสิทธิ์ออกหมด) จะไม่ถูกคืนมา
 * `allowed` = ชุดแท็บที่คนนี้เห็นได้ (ตัดสินสิทธิ์ที่ไฟล์หน้า ไม่ใช่ที่นี่)
 */
export function buildSettingsNav(allowed: readonly SettingsTabId[]): SettingsNavGroup[] {
  const allowedSet = new Set(allowed);
  const out: SettingsNavGroup[] = [];
  for (const g of SETTINGS_GROUP_IDS) {
    const tabs = SETTINGS_GROUP_TABS[g]
      .filter((t) => allowedSet.has(t))
      .map((t) => ({ id: t, label: SETTINGS_TAB_LABEL[t], hint: SETTINGS_TAB_HINT[t] }));
    if (tabs.length > 0) out.push({ id: g, label: SETTINGS_GROUP_LABEL[g], tabs });
  }
  return out;
}
